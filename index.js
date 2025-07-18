const express = require('express')
const http = require('http'); // Necesitamos http para el servidor de WebSocket
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const cors = require('cors')
const bodyParser =require('body-parser')
const db = require('./db');

const usuarioRoutes = require('./routes/usuario')
const conversacionesRoutes = require('./routes/conversaciones')
const ajustesRoutes = require('./routes/ajustes')
const traduccion = require('./routes/traduccion')

const { SECRET_KEY, REFRESH_SECRET_KEY } = require('./routes/auth'); // Ajusta la ruta a tu archivo auth.js
const authRouter = require('./routes/auth'); 

const app = express()
const PORT = 4000

app.use(cors())
app.use(bodyParser.json())
app.use(express.json())
app.use('/usuarios', usuarioRoutes)
app.use('/conversaciones', conversacionesRoutes)
app.use('/ajustes', ajustesRoutes)
app.use('/traduccion', traduccion)

const server = http.createServer(app); // Creamos un servidor HTTP a partir de nuestra aplicación Express
const wss = new WebSocket.Server({ server }); // Asociamos el servidor WebSocket al servidor HTTP

const pendingSessions = new Map();

wss.on('connection', (ws) => {
    const sessionId = uuidv4();
    pendingSessions.set(sessionId, { ws, createdAt: Date.now() });
    console.log(`Nueva sesión al ws: ${sessionId}`);
    ws.send(JSON.stringify({ type: 'session-id', sessionId }));

    ws.on('message', (message) => {
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.error('Error al parsear mensaje WebSocket:', e);
            return;
        }

        if (data.type === 'jwt-auth' && data.sessionId && data.refreshToken) {
            const { sessionId: targetSessionId, refreshToken } = data;
            const targetSession = pendingSessions.get(targetSessionId);
            if (targetSession) {
                db.query('SELECT id, correo FROM usuarios WHERE refresh_token = ?', [refreshToken], (err, results) => {
                    if (err) {
                        console.error('Error en consulta de base de datos:', err);
                        ws.send(JSON.stringify({ type: 'auth-error', error: 'Error interno del servidor.' }));
                        return;
                    }
                    if (results.length === 0) {
                        console.log('refresh token del data que tenemos:', data.refreshToken)
                        
                        ws.send(JSON.stringify({ type: 'auth-error', error: 'La sesión de origen es inválida o ha expiradoxd.' }));
                        return;
                    }
                    const user = results[0];

                    jwt.verify(data.refreshToken, REFRESH_SECRET_KEY, (jwtErr, decoded) => {
                        if (jwtErr || user.id !== decoded.id) {
                            console.error('Error de verificación de JWT o ID de usuario no coincide:', jwtErr);
                            ws.send(JSON.stringify({ type: 'auth-error', error: 'Token de sesión corrupto.' }));
                            return;
                        }

                        const userPayload = { id: user.id, correo: user.correo };
                        const newAccessToken = jwt.sign(userPayload, SECRET_KEY, { expiresIn: '2h' });
                        const newRefreshToken = jwt.sign(userPayload, REFRESH_SECRET_KEY, { expiresIn: '30d' });
                        
                        db.query('UPDATE usuarios SET refresh_token = ? WHERE id = ?', [newRefreshToken, user.id], (updateErr) => {
                            console.log("error: " , updateErr)
                            if (updateErr) {
                                console.log('Error al actualizar refresh_token:', updateErr);
                            }else{
                                console.log("Refresh token actualizado al usuario id: ", user.id)
                            } 
                            
                            targetSession.ws.send(JSON.stringify({
                                type: 'jwt-transfer',                                
                                accessToken: newAccessToken,
                                refreshToken: newRefreshToken
                            }));
                            console.log("esto: ")

                            ws.send(JSON.stringify({
                                type: 'auth-success',
                                newRefreshToken: newRefreshToken 
                            }));
                            pendingSessions.delete(targetSessionId);
                        });
                    });
                });
            } else {
                ws.send(JSON.stringify({ type: 'auth-error', error: 'El código QR ha expirado o es inválido.' }));
            }
        }
    });

    ws.on('close', () => {
        for (const [key, value] of pendingSessions.entries()) {            
            if (value.ws === ws) {
                pendingSessions.delete(key);
                console.log(`Sesión QR eliminada: ${key}`);
                break;
            }
        }
    });
});

// Limpieza de sesiones QR expiradas
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of pendingSessions.entries()) {
        if (now - session.createdAt > 120000) { // 2 minutos (120000 ms)
            session.ws.close();
            pendingSessions.delete(sessionId);
            console.log(`Sesión QR expirada y eliminada: ${sessionId}`);
        }
    }
}, 30000); 


// ¡CORRECCIÓN CRÍTICA! Debes iniciar el 'server' de http, no la 'app' de express.
server.listen(PORT, () => {
    console.log(`Servidor HTTP y WebSocket corriendo en puerto ${PORT}`);
});
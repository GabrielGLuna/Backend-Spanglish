const jwt = require('jsonwebtoken');

const SECRET_KEY = 'tu_clave_secreta_segura'; // guarda en .env idealmente

// Middleware para proteger rutas
function verificarToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'Token no proporcionado' });

  jwt.verify(token, SECRET_KEY, (err, usuario) => {
    if (err) return res.status(401).json({ error: 'Token inválido' });
    req.usuario = usuario; // usuario autenticado
    next();
  });
}

module.exports = { verificarToken, SECRET_KEY };

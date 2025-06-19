const bcrypt = require('bcrypt');
const nodemailer = require("nodemailer");
const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('./auth');

// Pre-registro: valida email único, genera código y envía email
router.post('/pre-registro', (req, res) => {
  const { nombre, correo, idioma_preferido, contrasena } = req.body;

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // NUEVA VALIDACIÓN: Verificar si el email ya está registrado
  db.query('SELECT id FROM usuarios WHERE correo = ?', [correo], (err, results) => {
    if (err) {
      console.error('Error checking email:', err);
      return res.status(500).json({ error: 'Error al verificar el correo' });
    }

    // Si ya existe un usuario con ese correo
    if (results.length > 0) {
      return res.status(409).json({ 
        error: 'Este correo ya está registrado',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }

    // Si el email no existe, proceder con el código de verificación
    const codigo = Math.floor(1000000 + Math.random() * 9000000);

    db.query(
      "INSERT INTO codigos_verificacion (correo, codigo, creado_en) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE codigo = ?, creado_en = NOW()",
      [correo, codigo, codigo],
      async (err) => {
        if (err) {
          console.error('Error saving code:', err);
          return res.status(500).json({ error: 'Error al guardar código' });
        }

        try {
          await sendCodeEmail(correo, codigo);
          res.json({ message: 'Código enviado al correo' });
        } catch (error) {
          console.error('Error sending email:', error);
          res.status(500).json({ error: 'Error al enviar el correo' });
        }
      }
    );
  });
});

// Confirmar registro: valida código y crea usuario
router.post('/confirmar-registro', async (req, res) => {
  const { nombre, correo, idioma_preferido, contrasena, codigo } = req.body;

  if (!nombre || !correo || !contrasena || !codigo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Verificar código
  db.query(
    "SELECT * FROM codigos_verificacion WHERE correo = ? AND codigo = ? AND creado_en > DATE_SUB(NOW(), INTERVAL 10 MINUTE)",
    [correo, codigo],
    async (err, results) => {
      if (err) {
        console.error('Error validating code:', err);
        return res.status(500).json({ error: 'Error al validar código' });
      }
      if (results.length === 0) {
        return res.status(400).json({ error: 'Código inválido o expirado' });
      }

      // Verificar nuevamente que el email no esté registrado (por si acaso)
      db.query('SELECT id FROM usuarios WHERE correo = ?', [correo], async (err2, userResults) => {
        if (err2) {
          console.error('Error checking user:', err2);
          return res.status(500).json({ error: 'Error al verificar usuario' });
        }
        if (userResults.length > 0) {
          return res.status(409).json({ error: 'Este correo ya está registrado' });
        }

        try {
          // Crear usuario
          const pass_hash = await bcrypt.hash(contrasena, 10);
          db.query(
            'INSERT INTO usuarios (nombre, correo, idioma_preferido, contrasena) VALUES (?, ?, ?, ?)',
            [nombre, correo, idioma_preferido, pass_hash],
            (err3, result) => {
              if (err3) {
                console.error('Error creating user:', err3);
                return res.status(500).json({ error: 'Error al crear usuario' });
              }

              // Limpiar código usado
              db.query('DELETE FROM codigos_verificacion WHERE correo = ?', [correo], (err4) => {
                if (err4) console.error('Error deleting code:', err4);
              });

              res.json({ message: 'Usuario creado exitosamente', id: result.insertId });
            }
          );
        } catch (hashError) {
          console.error('Error hashing password:', hashError);
          return res.status(500).json({ error: 'Error al procesar contraseña' });
        }
      });
    }
  );
});

// Login
router.post('/login', (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
  }

  db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], async (err, results) => {
    if (err) {
      console.error('Error querying user:', err);
      return res.status(500).json({ error: 'Error al consultar la base de datos' });
    }
    if (results.length === 0) {
      return res.status(401).json({ error: 'Correo no registrado' });
    }

    const usuario = results[0];
    
    try {
      const match = await bcrypt.compare(contrasena, usuario.contrasena);

      if (!match) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }

      const token = jwt.sign({ id: usuario.id, correo: usuario.correo }, SECRET_KEY, { expiresIn: '2h' });

      res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo } });
    } catch (compareError) {
      console.error('Error comparing password:', compareError);
      return res.status(500).json({ error: 'Error al verificar contraseña' });
    }
  });
});

// Enviar código (para reenviar) - TAMBIÉN VALIDAR EMAIL AQUÍ
router.post('/enviar-codigo', (req, res) => {
  const { nombre, correo, idioma_preferido, contrasena } = req.body;

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: 'Faltan campos' });
  }

  // Verificar que el email no esté ya registrado
  db.query('SELECT id FROM usuarios WHERE correo = ?', [correo], (err, results) => {
    if (err) {
      console.error('Error checking email:', err);
      return res.status(500).json({ error: 'Error al verificar el correo' });
    }

    if (results.length > 0) {
      return res.status(409).json({ 
        error: 'Este correo ya está registrado',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }

    const codigo = Math.floor(1000000 + Math.random() * 9000000);

    db.query(
      "INSERT INTO codigos_verificacion (correo, codigo, creado_en) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE codigo = ?, creado_en = NOW()",
      [correo, codigo, codigo],
      async (err) => {
        if (err) {
          console.error('Error saving code:', err);
          return res.status(500).json({ error: 'Error al guardar código' });
        }

        try {
          await sendCodeEmail(correo, codigo);
          res.json({ message: 'Código reenviado' });
        } catch (error) {
          console.error('Error sending email:', error);
          res.status(500).json({ error: 'Error al enviar el correo' });
        }
      }
    );
  });
});

// Obtener usuario (requiere token)
router.post('/obtenerusuario', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const correo = decoded.correo;

    db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, results) => {
      if (err) {
        console.error('Error querying user:', err);
        return res.status(500).json({ error: 'Error al consultar la base de datos' });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const { contrasena, ...usuarioSinContrasena } = results[0];
      res.json({ usuario: usuarioSinContrasena });
    });
  } catch (err) {
    console.error('Error verifying token:', err);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
});

// Utilidad para enviar email - CORREGIDO: createTransport (sin "r")
const sendCodeEmail = async (email, code) => {
  try {
    const transporter = nodemailer.createTransport({  // <-- CORREGIDO AQUÍ
      service: "gmail",
      auth: {
        user: "spanglishincmx@gmail.com",
        pass: "mbiq dwoi nokh pywh",
      },
    });

    await transporter.sendMail({
      from: "Spanglish",
      to: email,
      subject: "¡Bienvenido a Spanglish!",
      text: `
        Tu código de verificación es:
        ${code}
        
        ADVERTENCIA: No compartas este código con nadie.
      `,
      html: `
        <p>Tu código de verificación es:</p>
        <h1 style="font-size: 30px; text-align:center;"><strong>${code}</strong></h1>
        <p><em>ADVERTENCIA: No compartas este código con nadie.</em></p>
      `
    });

    console.log(`Email sent successfully to ${email}`);
  } catch (error) {
    console.error('Error in sendCodeEmail:', error);
    throw error;
  }
};

module.exports = router;
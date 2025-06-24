const bcrypt = require('bcrypt');
const nodemailer = require("nodemailer");
const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('./auth');

router.post('/pre-registro', (req, res) => {
  const { nombre, correo, idioma_preferido, contrasena } = req.body;

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

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

              db.query("INSERT INTO ajustes (usuario_id, notificaciones, modo_oscuro, velocidad_voz, voz_activa) VALUES (?, ?, ?, ?, ?)",
                [result.insertId, 0, 0, 1, 0], (err5) => {
                  if (err5) {
                    console.error('Error creating user settings:', err5);
                    return res.status(500).json({ error: 'Error al crear ajustes de usuario' });
                  }
                }
              )

              res.json({ message: 'Usuario creado exitosamente', id: result.insertId });
              
            },
          );
          db.query(
         `INSERT INTO ajustes(usuario_id, notificaciones, modo_oscuro, velocidad_voz, voz_activa)
         VALUES (?, ?, ?, ?, ?)`,
         [result.id, 0,0,1,0],
         (err, result) => {
           if (err) return res.status(500).json({ error: err.message });
           return res.status(201).json({ mensaje: 'Ajustes creados correctamente' });
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

      db.query('SELECT * FROM ajustes WHERE usuario_id = ?', [usuario.id], (err2, ajustesResults) => {
        if (err2) {
          console.error('Error querying user settings:', err2);
          return res.status(500).json({ error: 'Error al consultar ajustes de usuario' });
        }

        if (ajustesResults.length === 0) {
          db.query(
            "INSERT INTO ajustes (usuario_id, notificaciones, modo_oscuro, velocidad_voz, voz_activa) VALUES (?, ?, ?, ?, ?)",
            [usuario.id, 0, 0, 1, 0],
            (err3) => {
              if (err3) {
                console.error('Error creating user settings:', err3);
                return res.status(500).json({ error: 'Error al crear ajustes de usuario' });
              }

              res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo } });
            }
          );
        } else {
          res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo } });
        }
      });
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

    db.query(
      'SELECT id, nombre, correo, idioma_preferido, fecha_registro FROM usuarios WHERE correo = ?',
      [correo],
      (err, results) => {
        if (err) {
          console.error('Error querying user:', err);
          return res.status(500).json({ error: 'Error al consultar la base de datos' });
        }
        if (results.length === 0) {
          return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ usuario: results[0] });
      }
    );
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
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 12px; background: #f4faff; border: 1px solid #d0e8ff;">
          <h2 style="color: #0077cc; text-align: center;">Verifica tu correo</h2>
          
          <p style="font-size: 16px; color: #333; text-align: center;">
            Tu código de verificación es:
          </p>

          <div style="background-color: #e6f0ff; padding: 20px; border-radius: 10px; margin: 20px auto; width: fit-content;">
            <h1 style="font-size: 36px; color: #004a99; margin: 0; text-align: center;">
              <strong>${code}</strong>
            </h1>
          </div>

          <p style="font-size: 14px; color: #666; text-align: center;">
            <em>ADVERTENCIA: No compartas este código con nadie.</em>
          </p>

          <p style="font-size: 12px; color: #aaa; text-align: center; margin-top: 40px;">
            Spanglish © 2025
          </p>
        </div>
      `
    });

    console.log(`Email sent successfully to ${email}`);
  } catch (error) {
    console.error('Error in sendCodeEmail:', error);
    throw error;
  }
};

router.post('/actualizar', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, SECRET_KEY);
  } catch (err) {
    console.error('Token inválido:', err);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const { nombre, idioma_preferido, contrasena_actual, contrasena_nueva, confirmar_contrasena } = req.body;

  if (!nombre || !idioma_preferido) {
    return res.status(400).json({ error: 'Nombre e idioma son obligatorios' });
  }

  // Buscar usuario
  db.query('SELECT * FROM usuarios WHERE correo = ?', [decoded.correo], async (err, results) => {
    if (err) {
      console.error('Error buscando usuario:', err);
      return res.status(500).json({ error: 'Error interno' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = results[0];

    // Si quiere cambiar la contraseña
    if (contrasena_actual || contrasena_nueva || confirmar_contrasena) {
      if (!contrasena_actual || !contrasena_nueva || !confirmar_contrasena) {
        return res.status(400).json({ error: 'Completa todos los campos de contraseña para actualizarla' });
      }

      if (contrasena_nueva.length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
      }

      if (contrasena_nueva !== confirmar_contrasena) {
        return res.status(400).json({ error: 'Las nuevas contraseñas no coinciden' });
      }

      try {
        const match = await bcrypt.compare(contrasena_actual, usuario.contrasena);
        if (!match) {
          return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
        }

        const nueva_hash = await bcrypt.hash(contrasena_nueva, 10);

        db.query(
          'UPDATE usuarios SET nombre = ?, idioma_preferido = ?, contrasena = ? WHERE id = ?',
          [nombre, idioma_preferido, nueva_hash, usuario.id],
          (err2) => {
            if (err2) {
              console.error('Error actualizando usuario:', err2);
              return res.status(500).json({ error: 'Error al actualizar usuario' });
            }

            return res.json({ message: 'Perfil y contraseña actualizados correctamente' });
          }
        );

      } catch (errCompare) {
        console.error('Error procesando contraseña:', errCompare);
        return res.status(500).json({ error: 'Error al procesar la contraseña' });
      }

    } else {
      // Solo actualizar datos
      db.query(
        'UPDATE usuarios SET nombre = ?, idioma_preferido = ? WHERE id = ?',
        [nombre, idioma_preferido, usuario.id],
        (err2) => {
          if (err2) {
            console.error('Error actualizando usuario:', err2);
            return res.status(500).json({ error: 'Error al actualizar usuario' });
          }

          return res.json({ message: 'Perfil actualizado correctamente' });
        }
      );
    }
  });
});

router.get('/obtenerajustes/:usuario_id', async (req, res) => {
  const { usuario_id } = req.params;

  db.query('SELECT * FROM ajustes WHERE usuario_id = ?', [usuario_id], (err, result) => {
    if (err) {
      console.error('Error al obtener ajustes:', err);
      return res.status(500).json({ error: 'Error al obtener ajustes del usuario' });
    }
    if (result.length === 0) {
      return res.status(404).json({ error: 'Ajustes no encontrados para este usuario' });
    }
    res.json(result[0]);
  });
});


module.exports = router;
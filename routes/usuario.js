const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener info de usuario
router.post('/obtenerusuario', (req, res) => {
  const { correo } = req.body;
  if (!correo) {
    return res.status(400).json({ error: 'El correo es requerido' });
  }
  db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error al consultar la base de datos' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(results[0]);
  });
});

// Crear nuevo usuario
router.post('/crearusuario', (req, res) => {
  const { nombre, correo, idioma_preferido } = req.body;
  db.query('INSERT INTO usuarios (nombre, correo, idioma_preferido) VALUES (?, ?, ?)', 
    [nombre, correo, idioma_preferido], 
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ id: result.insertId, nombre, correo, idioma_preferido });
    });
});

module.exports = router;

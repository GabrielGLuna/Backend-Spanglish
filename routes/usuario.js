const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener todos los usuarios
router.get('/', (req, res) => {
  db.query('SELECT * FROM usuarios', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
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

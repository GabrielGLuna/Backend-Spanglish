const express = require('express');
const router = express.Router();
const db = require('../db');

// ingresar ajustes predeterminados
router.post('/', (req, res) => {
  const { usuario_id } = req.body;

  if (!usuario_id) {
    return res.status(400).json({ error: 'usuario_id es requerido' });
  }

  const valores = [usuario_id, 0, 0, 1, 0];

  db.query(
    `INSERT INTO ajustes(usuario_id, notificaciones, modo_oscuro, velocidad_voz, voz_activa)
     VALUES (?, ?, ?, ?, ?)`,
    valores,
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      return res.status(201).json({ mensaje: 'Ajustes creados correctamente' });
    }
  );
});

// modificar un ajuste
router.put('/modificarajuste', (req, res) => {
  const { usuario_id, notificaciones, modo_oscuro, velocidad_voz, voz_activa } = req.body;

  if (!usuario_id) {
    return res.status(400).json({ error: 'usuario_id es requerido' });
  }

  const valores = [notificaciones, modo_oscuro, velocidad_voz, voz_activa, usuario_id];

  db.query(
    `UPDATE ajustes 
     SET notificaciones = ?, modo_oscuro = ?, velocidad_voz = ?, voz_activa = ?
     WHERE usuario_id = ?`,
    valores,
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Ajustes no encontrados para este usuario' });
      }
      return res.status(200).json({
        mensaje: 'Ajustes actualizados correctamente',
        datos: { usuario_id, notificaciones, modo_oscuro, velocidad_voz, voz_activa }
      });
    }
  );
});

module.exports = router;

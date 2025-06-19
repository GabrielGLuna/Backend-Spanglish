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
  const { usuario_id, ...updates } = req.body;

  if(!usuario_id){
    return res.status(400).json({error: 'El usuario_id es obligatorio'})
  }

  const camposPermitidos = ['notificaciones', 'modo_oscuro', 'velocidad_voz', 'voz_activa']
  const camposActualizar = Object.keys(updates).filter(campo => camposPermitidos.includes(campo))
  // Validar que todos los campos estén presentes
  if (
    usuario_id === undefined ||
    notificaciones === undefined ||
    modo_oscuro === undefined ||
    velocidad_voz === undefined ||
    voz_activa === undefined
  ) {
    return res.status(400).json({ error: 'Faltan parámetros en la solicitud' });
  }

  const valores = camposActualizar.map(campo => updates[campo])
  const query = `
    UPDATE ajustes 
    SET
      ${camposActualizar.map(campo => `${campo} = ?`).join(',')}
    WHERE usuario_id = ?
  `;

  db.query(query, [...valores,usuario_id], (err, result) => {
    if (err) {
      console.error('Error al actualizar el ajuste:', err);
      return res.status(500).json({ error: 'Error al actualizar ajuste' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.status(200).json({
      message: 'Ajustes actualizados correctamente',
      data: { usuario_id, notificaciones, modo_oscuro, velocidad_voz, voz_activa }
    });
  });
});

module.exports = router;

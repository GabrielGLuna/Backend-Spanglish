const express = require('express');
const router = express.Router();
const db = require('../db');


// obtener historial de un usuario con id
router.post('/gethistorial', (req, res) => {
  const { id_usuario } = req.body;
  if (!id_usuario) {
    return res.status(400).json({ error: 'El id de usuario es requerido' });
  }
  db.query('SELECT * FROM conversaciones WHERE usuario_id = ?', [id_usuario], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error en la base de datos' });
      print(err);
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'No se encontraron conversaciones' });
    }
    res.json(results);
  });
})

router.post("/borrarconversacion", (req, res) => {
  const { id_conversacion } = req.body;
  if (!id_conversacion) {
    return res.status(400).json({ error: 'El id de la conversación es requerido' })
  }
  db.query("delete from conversaciones where id = ?", [id_conversacion], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error al borrar la conversación' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }
    res.json({ message: 'Conversación borrada' });
  })
})

module.exports = router;

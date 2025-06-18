const express = require('express');
const router = express.Router();
const db = require('../db');


router.post("/add", (req, res) => {
    const { usuario_id, texto_original, texto_traducido, idioma_origen, idioma_destino } = req.body;
    if (!usuario_id || !idioma_origen || !idioma_destino || !texto_traducido || !texto_original) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos: usuario_id, texto, idioma_origen o idioma_destino.' });
    }
    db.query("INSERT INTO conversaciones (usuario_id, texto_original, texto_traducido, idioma_origen, idioma_destino) VALUES (?, ?, ?, ?, ?)", [usuario_id, texto_original, texto_traducido, idioma_origen, idioma_destino], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error al insertar la conversación en la base de datos.' });
        }
        res.status(201).json({ message: 'Conversación agregada correctamente', id: result.insertId });
    });
})

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
      return res.status(200).json({ error: 'No se encontraron conversaciones' });
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
      return res.status(200).json({ error: 'Conversación no encontrada' });
    }
    res.json({ message: 'Conversación borrada' });
  })
})

router.post("/borrarhistorial", (req, res) => {
  const { id_usuario } = req.body;
  if (!id_usuario) {
    return res.status(404).json({ error: "No se encuentra el id del usuario" })
  }
  db.query("delete from conversaciones where usuario_id = ?", [id_usuario], (err, results) => {
    if (results.affectedRows === 0) {
        return res.status(200).json({ error: 'Conversaciones no encontrada' });
      }
      res.json({ message: 'Conversaciones borradas' });
  })
})

module.exports = router;

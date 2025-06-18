const express = require('express');
const router = express.Router();
const db = require('../db');

//ingresar ajustes predeterminados
router.push('/', (req,res)=>{
  const { usuario_id } = req.body
  db.query(`INSERT INTO ajustes(usuario_id, notificaciones, modo_oscuro, velocidad_voz, voz_activa)
    VALUES (?, ?, ?, ?,?)
    `, [usuario_id,0,0,1,0],
    
  )

})
// modificar un ajuste
router.put('/modificarajuste', (req, res) => {
  const { usuario_id, notificaciones, modo_oscuro, velocidad_voz, voz_activa } = req.body;
  db.query('INSERT INTO ajustes (usuario_id, notificaciones, modo_oscuro, velocidad_voz, voz_activa) VALUES (?, ?, ?)', 
    [usuario_id, notificaciones,modo_oscuro, velocidad_voz, voz_activa], 
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ id_usuario, notificaciones, modo_oscuro,velocidad_voz, voz_activa });
    });
});

module.exports = router;

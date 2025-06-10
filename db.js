const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'spanglish'
});

db.connect(err => {
    if (err) {
        console.log("Tenemos un error:", err);
        return;
    }
    console.log("Conexión exitosa a MySQL local");
});

module.exports = db;
const mysql = require('mysql2')

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'spanglish',
    password:'admin1'
})

db.connect(err =>{
    if(err){
        console.log("Tenemos un error", err)
        return;
    }
    console.log("Conexion exitosa a Mysql")
})

module.exports = db;
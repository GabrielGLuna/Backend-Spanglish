const express = require('express')
const cors = require('cors')
const bodyParser =require('body-parser')

const usuarioRoutes = require('./routes/usuario')
const conversacionesRoutes = require('./routes/conversaciones')
const ajustesRoutes = require('./routes/ajustes')
const traduccion = require('./routes/traduccion')


const app = express()
const PORT = 4000

app.use(cors())
app.use(bodyParser.json())

app.use('/usuarios', usuarioRoutes)
app.use('/conversaciones', conversacionesRoutes)
app.use('/ajustes', ajustesRoutes)
app.use('/traduccion', traduccion)


app.listen(PORT,()=>{
    console.log(`servidor corriendo en port ${PORT}`)
})
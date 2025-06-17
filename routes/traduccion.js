const express = require('express');
const router = express.Router();
const translate = require('translate-google'); 


router.post('/traducir', async (req, res) => {
  const { text, sourceLang, targetLang } = req.body;

  if (!text || !sourceLang || !targetLang) {
    return res.status(400).json({ 
      message: 'Faltan parámetros requeridos: text, sourceLang, o targetLang.' 
    });
  }

  console.log(`Solicitud de traducción recibida de ${sourceLang} a ${targetLang}`);

  try {
    const translatedText = await translate(text, { from: sourceLang, to: targetLang });

    res.json({ translatedText: translatedText });

  } catch (error) {
    
    console.error('Error en el servicio de traducción:', error);
    
    const errorMessage = error.message || (typeof error === 'string' ? error : 'Error desconocido durante la traducción.');
    res.status(500).json({ 
      message: 'Error interno al traducir el texto.',
      errorDetails: errorMessage 
    });
  }
});

module.exports = router;

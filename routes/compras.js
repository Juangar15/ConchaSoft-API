// routes/compras.js

const express = require('express');
const router = express.Router();
const compraController = require('../controllers/compraController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('compras'));

router.get('/', compraController.obtenerCompras);
router.get('/:id', compraController.obtenerCompra);
router.post('/completa', compraController.crearCompraCompleta);
router.put('/completa/:id', compraController.actualizarCompraCompleta);

module.exports = router;
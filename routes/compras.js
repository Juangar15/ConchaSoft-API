// routes/compras.js

const express = require('express');
const router = express.Router();
const compraController = require('../controllers/compraController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('compras'), compraController.obtenerCompras);
router.get('/:id', verificarToken, verificarPermiso('compras'), compraController.obtenerCompra);
router.post('/completa', verificarToken, verificarPermiso('compras'), compraController.crearCompraCompleta);
router.put('/completa/:id', verificarToken, verificarPermiso('compras'), compraController.actualizarCompraCompleta);

module.exports = router;
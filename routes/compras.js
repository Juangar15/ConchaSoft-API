// routes/compras.js

const express = require('express');
const router = express.Router();
const compraController = require('../controllers/compraController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_compras'), compraController.obtenerCompras);
router.get('/:id', verificarToken, verificarPermiso('ver_compras'), compraController.obtenerCompra);
router.post('/completa', verificarToken, verificarPermiso('crear_compras'), compraController.crearCompraCompleta);
router.put('/completa/:id', verificarToken, verificarPermiso('editar_compras'), compraController.actualizarCompraCompleta);

module.exports = router;
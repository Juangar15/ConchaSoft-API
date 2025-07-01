const express = require('express');
const router = express.Router();
const ventaProdController = require('../controllers/ventaProdController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

// Obtener todas las relaciones venta-producto
router.get('/', verificarToken, verificarPermiso('ver_ventaProd'), ventaProdController.obtenerVentasProductos);

// Obtener una relación específica por id_venta e id_producto_talla
router.get('/:id_venta/:id_producto_talla', verificarToken, verificarPermiso('ver_ventaProd'), ventaProdController.obtenerVentaProducto);

module.exports = router;
const express = require('express');
const router = express.Router();
const ventaProdController = require('../controllers/ventaProdController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('ventas')); // Usa el módulo 'ventas' ya que es parte de la gestión de ventas

// Obtener todas las relaciones venta-producto
router.get('/', ventaProdController.obtenerVentasProductos);

// Obtener una relación específica por id_venta e id_producto_talla
router.get('/:id_venta/:id_producto_talla', ventaProdController.obtenerVentaProducto);

module.exports = router;
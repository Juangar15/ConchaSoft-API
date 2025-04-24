const express = require('express');
const router = express.Router();
const ventaProdController = require('../controllers/ventaProdController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

// Obtener todas las relaciones venta-producto
router.get('/', verificarToken, verificarPermiso('ver_ventaProd'), ventaProdController.obtenerVentasProductos);

// Obtener una relación específica por id_venta e id_producto_talla
router.get('/:id_venta/:id_producto_talla', verificarToken, verificarPermiso('ver_ventaProd'), ventaProdController.obtenerVentaProducto);

// Crear una nueva relación venta-producto
router.post('/', verificarToken, verificarPermiso('crear_ventaProd'), ventaProdController.crearVentaProducto);

// Actualizar una relación venta-producto
router.put('/:id_venta/:id_producto_talla', verificarToken, verificarPermiso('editar_ventaProd'), ventaProdController.actualizarVentaProducto);

// Eliminar una relación venta-producto
router.delete('/:id_venta/:id_producto_talla', verificarToken, verificarPermiso('eliminar_ventaProd'), ventaProdController.eliminarVentaProducto);

module.exports = router;
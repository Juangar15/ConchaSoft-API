const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_productos'), productoController.obtenerProductos);
router.get('/:id', verificarToken, verificarPermiso('ver_productos'), productoController.obtenerProducto);
router.post('/', verificarToken, verificarPermiso('crear_producto'), productoController.crearProducto);
router.put('/:id', verificarToken, verificarPermiso('editar_producto'), productoController.actualizarProducto);
router.delete('/:id', verificarToken, verificarPermiso('eliminar_producto'), productoController.eliminarProducto);

module.exports = router;
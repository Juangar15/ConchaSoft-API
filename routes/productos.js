const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('productos'), productoController.obtenerProductos);
router.get('/activos', verificarToken, verificarPermiso('productos'), productoController.obtenerProductosActivos);
router.get('/:id', verificarToken, verificarPermiso('productos'), productoController.obtenerProducto);
router.post('/', verificarToken, verificarPermiso('productos'), productoController.crearProducto);
router.put('/:id', verificarToken, verificarPermiso('productos'), productoController.actualizarProducto);
router.delete('/:id', verificarToken, verificarPermiso('productos'), productoController.eliminarProducto);

module.exports = router;
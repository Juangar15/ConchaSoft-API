const express = require('express');
const router = express.Router();
const productoTallaController = require('../controllers/productoTallaController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_productoTalla'), productoTallaController.obtenerProductoTallas);
router.get('/:id', verificarToken, verificarPermiso('ver_productoTalla'), productoTallaController.obtenerProductoTalla);
router.post('/', verificarToken, verificarPermiso('crear_productoTalla'), productoTallaController.crearProductoTalla);
router.put('/:id', verificarToken, verificarPermiso('editar_productoTalla'), productoTallaController.actualizarProductoTalla);
router.delete('/:id', verificarToken, verificarPermiso('eliminar_productoTalla'), productoTallaController.eliminarProductoTalla);

module.exports = router;
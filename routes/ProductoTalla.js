const express = require('express');
const router = express.Router();
const productoTallaController = require('../controllers/productoTallaController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('productoTalla'), productoTallaController.obtenerProductoTallas);
router.get('/:id', verificarToken, verificarPermiso('productoTalla'), productoTallaController.obtenerProductoTalla);
router.post('/', verificarToken, verificarPermiso('productoTalla'), productoTallaController.crearProductoTalla);
router.put('/:id', verificarToken, verificarPermiso('productoTalla'), productoTallaController.actualizarProductoTalla);
router.delete('/:id', verificarToken, verificarPermiso('productoTalla'), productoTallaController.eliminarProductoTalla);

module.exports = router;
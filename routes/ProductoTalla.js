const express = require('express');
const router = express.Router();
const productoTallaController = require('../controllers/productoTallaController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('productos')); // Usa el módulo 'productos' ya que es parte de la gestión de productos

router.get('/', productoTallaController.obtenerProductoTallas);
router.get('/:id', productoTallaController.obtenerProductoTalla);
router.post('/', productoTallaController.crearProductoTalla);
router.put('/:id', productoTallaController.actualizarProductoTalla);
router.delete('/:id', productoTallaController.eliminarProductoTalla);

module.exports = router;
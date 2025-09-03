const express = require('express');
const router = express.Router();
const compraProdController = require('../controllers/compraProdController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('compras')); // Usa el módulo 'compras' ya que es parte de la gestión de compras

router.get('/', compraProdController.obtenerComprasProductos);
router.get('/:id_compra/:id_producto', compraProdController.obtenerCompraProducto);
router.post('/', compraProdController.crearCompraProducto);
router.put('/:id_compra/:id_producto', compraProdController.actualizarCompraProducto);
router.delete('/:id_compra/:id_producto', compraProdController.eliminarCompraProducto);

module.exports = router;
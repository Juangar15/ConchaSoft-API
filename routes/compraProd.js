const express = require('express');
const router = express.Router();
const compraProdController = require('../controllers/compraProdController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_compraProd'), compraProdController.obtenerComprasProductos);
router.get('/:id_compra/:id_producto', verificarToken, verificarPermiso('ver_compraProd'), compraProdController.obtenerCompraProducto);
router.post('/', verificarToken, verificarPermiso('crear_compraProd'), compraProdController.crearCompraProducto);
router.put('/:id_compra/:id_producto', verificarToken, verificarPermiso('editar_compraProd'), compraProdController.actualizarCompraProducto);
router.delete('/:id_compra/:id_producto', verificarToken, verificarPermiso('eliminar_compraProd'), compraProdController.eliminarCompraProducto);

module.exports = router;
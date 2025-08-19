const express = require('express');
const router = express.Router();
const compraProdController = require('../controllers/compraProdController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('compraProd'), compraProdController.obtenerComprasProductos);
router.get('/:id_compra/:id_producto', verificarToken, verificarPermiso('compraProd'), compraProdController.obtenerCompraProducto);
router.post('/', verificarToken, verificarPermiso('compraProd'), compraProdController.crearCompraProducto);
router.put('/:id_compra/:id_producto', verificarToken, verificarPermiso('compraProd'), compraProdController.actualizarCompraProducto);
router.delete('/:id_compra/:id_producto', verificarToken, verificarPermiso('compraProd'), compraProdController.eliminarCompraProducto);

module.exports = router;
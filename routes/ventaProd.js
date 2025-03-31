const express = require('express');
const router = express.Router();
const ventaProdController = require('../controllers/ventaProdController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_ventaProd'), ventaProdController.obtenerVentasProductos);
router.get('/:id_venta/:id_talla', verificarToken, verificarPermiso('ver_ventaProd'), ventaProdController.obtenerVentaProducto);
router.post('/', verificarToken, verificarPermiso('crear_ventaProd'), ventaProdController.crearVentaProducto);
router.put('/:id_venta/:id_talla', verificarToken, verificarPermiso('editar_ventaProd'), ventaProdController.actualizarVentaProducto);
router.delete('/:id_venta/:id_talla', verificarToken, verificarPermiso('eliminar_ventaProd'), ventaProdController.eliminarVentaProducto);

module.exports = router;
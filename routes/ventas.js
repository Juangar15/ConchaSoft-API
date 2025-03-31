const express = require('express');
const router = express.Router();
const ventaController = require('../controllers/ventaController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');


router.get('/', verificarToken, verificarPermiso('ver_ventas'), ventaController.obtenerVentas);
router.get('/:id', verificarToken, verificarPermiso('ver_ventas'), ventaController.obtenerVenta);
router.post('/', verificarToken, verificarPermiso('crear_venta'), ventaController.crearVenta);
router.put('/:id', verificarToken, verificarPermiso('editar_venta'), ventaController.actualizarVenta);
router.delete('/:id', verificarToken, verificarPermiso('eliminar_venta'), ventaController.eliminarVenta);

module.exports = router;
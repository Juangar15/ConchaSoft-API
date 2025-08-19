const express = require('express');
const router = express.Router();
const proveedorController = require('../controllers/proveedorController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('proveedores'), proveedorController.obtenerProveedores);
router.get('/activos', verificarToken, verificarPermiso('proveedores'), proveedorController.obtenerProveedoresActivos);
router.get('/:id', verificarToken, verificarPermiso('proveedores'), proveedorController.obtenerProveedor);
router.post('/', verificarToken, verificarPermiso('proveedores'), proveedorController.crearProveedor);
router.put('/:id', verificarToken, verificarPermiso('proveedores'), proveedorController.actualizarProveedor);
router.delete('/:id', verificarToken, verificarPermiso('proveedores'), proveedorController.eliminarProveedor);

module.exports = router;
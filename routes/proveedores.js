const express = require('express');
const router = express.Router();
const proveedorController = require('../controllers/proveedorController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_proveedores'), proveedorController.obtenerProveedores);
router.get('/:id', verificarToken, verificarPermiso('ver_proveedores'), proveedorController.obtenerProveedor);
router.post('/', verificarToken, verificarPermiso('crear_proveedores'), proveedorController.crearProveedor);
router.put('/:id', verificarToken, verificarPermiso('editar_proveedores'), proveedorController.actualizarProveedor);
router.delete('/:id', verificarToken, verificarPermiso('eliminar_proveedores'), proveedorController.eliminarProveedor);

module.exports = router;
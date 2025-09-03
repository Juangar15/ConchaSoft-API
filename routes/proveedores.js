const express = require('express');
const router = express.Router();
const proveedorController = require('../controllers/proveedorController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('proveedores'));

router.get('/', proveedorController.obtenerProveedores);
router.get('/activos', proveedorController.obtenerProveedoresActivos);
router.get('/:id', proveedorController.obtenerProveedor);
router.post('/', proveedorController.crearProveedor);
router.put('/:id', proveedorController.actualizarProveedor);
router.delete('/:id', proveedorController.eliminarProveedor);

module.exports = router;
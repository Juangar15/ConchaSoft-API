const express = require('express');
const router = express.Router();
const permisoController = require('../controllers/permisoController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('permisos'));

router.get('/', permisoController.obtenerPermisos);
router.get('/:id', permisoController.obtenerPermiso);
router.post('/', permisoController.crearPermiso);
router.put('/:id', permisoController.actualizarPermiso);
router.delete('/:id', permisoController.eliminarPermiso);

module.exports = router;
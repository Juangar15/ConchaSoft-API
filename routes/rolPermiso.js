const express = require('express');
const router = express.Router();
const rolPermisoController = require('../controllers/rolPermisoController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('roles')); // Usa el módulo 'roles' ya que es parte de la gestión de roles

router.get('/', rolPermisoController.obtenerRolPermisos);
router.get('/:id', rolPermisoController.obtenerRolPermiso);
router.post('/', rolPermisoController.crearRolPermiso);
router.delete('/:id', rolPermisoController.eliminarRolPermiso);

module.exports = router;
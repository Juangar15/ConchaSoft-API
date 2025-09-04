const express = require('express');
const router = express.Router();
const rolController = require('../controllers/rolController');
const permisoController = require('../controllers/permisoController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// Verifica acceso al módulo completo "roles"
router.use(verificarToken, verificarAccesoModulo('roles'));

// Rutas CRUD para Roles
router.post('/', rolController.crearRol);
router.get('/', rolController.obtenerRoles);
router.get('/:id', rolController.obtenerRolPorId);
router.put('/:id', rolController.actualizarRol);
router.delete('/:id', rolController.eliminarRol);

// Rutas para gestión de permisos
router.get('/:id/permisos', rolController.obtenerPermisosPorRol);
router.put('/:id/permisos', rolController.asignarPermisosARol);

module.exports = router;
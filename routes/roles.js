// routes/roles.js

const express = require('express');
const router = express.Router();
const rolController = require('../controllers/rolController'); // Usamos rolController
const permisoController = require('../controllers/permisoController'); // Aún lo necesitamos para listar TODOS los permisos
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

// Rutas CRUD para Roles
router.post('/', verificarToken, verificarPermiso('roles'), rolController.crearRol);
router.get('/', verificarToken, verificarPermiso('roles'), rolController.obtenerRoles);
router.get('/:id', verificarToken, verificarPermiso('roles'), rolController.obtenerRolPorId);
router.put('/:id', verificarToken, verificarPermiso('roles'), rolController.actualizarRol);
router.delete('/:id', verificarToken, verificarPermiso('roles'), rolController.eliminarRol);

// **NUEVAS RUTAS PARA LA GESTIÓN DE PERMISOS DE UN ROL ESPECÍFICO**
// Estas rutas ahora usan el rolController para obtener/asignar permisos a un rol
router.get('/:id/permisos', verificarToken, verificarPermiso('permisos'), rolController.obtenerPermisosPorRol);
router.put('/:id/permisos', verificarToken, verificarPermiso('permisos'), rolController.asignarPermisosARol);

// Nota: Si necesitas una ruta para listar *todos* los permisos disponibles en el sistema (no solo los de un rol),
// como la que usa el frontend en el PermisosTable, esa ruta debería seguir estando en `routes/permisos.js`
// y apuntando a `permisoController.obtenerPermisos`. Tu `permisos.js` que mostraste ya lo hace.
// `router.get('/permisos', verificarToken, verificarPermiso('ver_permisos'), permisoController.obtenerPermisos);`

module.exports = router;
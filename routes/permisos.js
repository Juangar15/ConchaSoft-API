const express = require('express');
const router = express.Router();
const permisoController = require('../controllers/permisoController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_permisos'), permisoController.obtenerPermisos);
router.get('/:id', verificarToken, verificarPermiso('ver_permisos'), permisoController.obtenerPermiso);
router.post('/', verificarToken, verificarPermiso('crear_permisos'), permisoController.crearPermiso);
router.put('/:id', verificarToken, verificarPermiso('editar_permisos'), permisoController.actualizarPermiso);
router.delete('/:id', verificarToken, verificarPermiso('eliminar_permisos'), permisoController.eliminarPermiso);

module.exports = router;
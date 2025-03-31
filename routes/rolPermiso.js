const express = require('express');
const router = express.Router();
const rolPermisoController = require('../controllers/rolPermisoController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_rolPermiso'), rolPermisoController.obtenerRolPermisos);
router.get('/:id', verificarToken, verificarPermiso('ver_rolPermiso'), rolPermisoController.obtenerRolPermiso);
router.post('/', verificarToken, verificarPermiso('crear_rolPermiso'), rolPermisoController.crearRolPermiso);
router.delete('/:id', verificarToken, verificarPermiso('eliminar_rolPermiso'), rolPermisoController.eliminarRolPermiso);

module.exports = router;
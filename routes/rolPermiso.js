const express = require('express');
const router = express.Router();
const rolPermisoController = require('../controllers/rolPermisoController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('rolPermiso'), rolPermisoController.obtenerRolPermisos);
router.get('/:id', verificarToken, verificarPermiso('rolPermiso'), rolPermisoController.obtenerRolPermiso);
router.post('/', verificarToken, verificarPermiso('rolPermiso'), rolPermisoController.crearRolPermiso);
router.delete('/:id', verificarToken, verificarPermiso('rolPermiso'), rolPermisoController.eliminarRolPermiso);

module.exports = router;
const express = require('express');
const router = express.Router();
const permisoController = require('../controllers/permisoController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('permisos'), permisoController.obtenerPermisos);
router.get('/:id', verificarToken, verificarPermiso('permisos'), permisoController.obtenerPermiso);
router.post('/', verificarToken, verificarPermiso('permisos'), permisoController.crearPermiso);
router.put('/:id', verificarToken, verificarPermiso('permisos'), permisoController.actualizarPermiso);
router.delete('/:id', verificarToken, verificarPermiso('permisos'), permisoController.eliminarPermiso);

module.exports = router;
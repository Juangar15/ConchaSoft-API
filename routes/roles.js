const express = require('express');
const router = express.Router();
const rolController = require('../controllers/rolController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.post('/', verificarToken, verificarPermiso('crear_roles'), rolController.crearRol);
router.get('/', verificarToken, verificarPermiso('ver_roles'), rolController.obtenerRoles);
router.get('/:id', verificarToken, verificarPermiso('ver_roles'), rolController.obtenerRolPorId);
router.put('/:id', verificarToken, verificarPermiso('editar_roles'), rolController.actualizarRol);
router.delete('/:id', verificarToken, verificarPermiso('eliminar_roles'), rolController.eliminarRol);

module.exports = router;
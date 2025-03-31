const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_usuarios'),
    usuarioController.obtenerUsuarios);
router.get('/:login', verificarToken, verificarPermiso('ver_usuarios'),
    usuarioController.obtenerUsuario);
router.post('/', verificarToken, verificarPermiso('crear_usuarios'), usuarioController.crearUsuario);
router.put('/:login', verificarToken, verificarPermiso('editar_usuarios'), usuarioController.actualizarUsuario);
router.delete('/:login', verificarToken, verificarPermiso('eliminar_usuarios'), usuarioController.eliminarUsuario);

module.exports = router;
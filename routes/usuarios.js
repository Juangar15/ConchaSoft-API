const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('usuarios'),
    usuarioController.obtenerUsuarios);
router.get('/:login', verificarToken, verificarPermiso('usuarios'),
    usuarioController.obtenerUsuario);
router.post('/', verificarToken, verificarPermiso('usuarios'), usuarioController.crearUsuario);
router.put('/:login', verificarToken, verificarPermiso('usuarios'), usuarioController.actualizarUsuario);
router.delete('/:login', verificarToken, verificarPermiso('usuarios'), usuarioController.eliminarUsuario);

module.exports = router;
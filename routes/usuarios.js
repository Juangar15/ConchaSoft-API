const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('usuarios'));

router.get('/', usuarioController.obtenerUsuarios);
router.get('/:login', usuarioController.obtenerUsuario);
router.post('/', usuarioController.crearUsuario);
router.put('/:login', usuarioController.actualizarUsuario);
router.delete('/:login', usuarioController.eliminarUsuario);

module.exports = router;
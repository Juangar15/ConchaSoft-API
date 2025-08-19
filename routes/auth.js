const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

// Rutas de Autenticación existentes
router.post('/register', authController.registrarUsuario);
router.post('/login', authController.iniciarSesion);

// Rutas para la Recuperación de Contraseña
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/verify-reset-code', authController.verifyResetCode);
router.post('/reset-password', authController.resetPassword);

// --- RUTAS PARA GESTIÓN DE USUARIOS (protegidas por token y permisos) ---

// Ruta para obtener datos de un usuario específico (propio o de otro si es admin)
router.get('/users/:login', verificarToken, authController.getUsuarioByLogin);

// Ruta para editar datos de un usuario (propio o de otro si es admin)
router.put('/users/:login', verificarToken, authController.editarUsuario);

// Ruta para crear un nuevo usuario (solo para administradores)
router.post('/users/create', verificarToken, verificarPermiso('usuarios'), authController.crearUsuarioPorAdmin);

// Ruta para obtener todos los usuarios (solo para administradores)
router.get('/users', verificarToken, verificarPermiso('usuarios'), authController.getAllUsers);

// Ruta para eliminar un usuario (solo para administradores)
router.delete('/users/:login', verificarToken, verificarPermiso('usuarios'), authController.deleteUser);

// --- NUEVA RUTA: Alternar el estado activo/inactivo de un usuario (solo para administradores) ---
router.put('/users/:login/toggle-status', verificarToken, verificarPermiso('usuarios'), authController.toggleUserStatus);


module.exports = router;
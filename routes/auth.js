const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Asegúrate de que esta ruta sea correcta

// Rutas de Autenticación existentes
router.post('/register', authController.registrarUsuario);
router.post('/login', authController.iniciarSesion);

// --- Nuevas Rutas para la Recuperación de Contraseña ---

// Ruta para solicitar el restablecimiento de contraseña (envío de código/email)
router.post('/request-password-reset', authController.requestPasswordReset);

// Ruta para verificar el código de restablecimiento
router.post('/verify-reset-code', authController.verifyResetCode);

// Ruta para restablecer la contraseña
router.post('/reset-password', authController.resetPassword);

module.exports = router;
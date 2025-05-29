const db = require('../db'); // Asegúrate de que esta ruta sea correcta para tu conexión a la DB
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Necesario para generar tokens aleatorios
const nodemailer = require('nodemailer'); // Necesario para enviar correos electrónicos
require('dotenv').config(); // Asegúrate de que tus variables de entorno estén cargadas

// --- Configuración del transportador de correo (Nodemailer) ---
// Estas variables (EMAIL_HOST, EMAIL_PORT, etc.) deben estar definidas en tu archivo .env
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587', 10), // Convierte el puerto a número, usa 587 por defecto
  secure: process.env.EMAIL_SECURE === 'true', // true para SSL (puerto 465), false para TLS (puerto 587)
  auth: {
    user: process.env.EMAIL_USER, // Tu usuario SMTP (ej. 'apikey' para SendGrid)
    pass: process.env.EMAIL_PASS, // Tu contraseña SMTP (ej. tu API Key para SendGrid)
  },
});

// --- Funciones de Autenticación Existentes ---

/**
 * Registra un nuevo usuario en la base de datos.
 * Requiere 'login', 'contraseña', 'correo', 'id_rol' en el cuerpo de la solicitud.
 */
exports.registrarUsuario = async (req, res) => {
    try {
        const { login, contraseña, correo, id_rol } = req.body;

        if (!login || !contraseña || !correo || !id_rol) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contraseña, salt);

        await db.query('INSERT INTO usuario (login, contraseña, correo, id_rol) VALUES (?, ?, ?, ?)',
            [login, hashedPassword, correo, id_rol]);

        res.status(201).json({ mensaje: 'Usuario registrado correctamente' });
    } catch (error) {
        console.error('Error al registrar el usuario:', error);
        // Podrías añadir un mensaje más específico si el error es por duplicidad de login/correo
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ error: 'El login o correo electrónico ya existen.' });
        }
        res.status(500).json({ error: 'Error interno del servidor al registrar el usuario.' });
    }
};

/**
 * Inicia sesión para un usuario existente.
 * Requiere 'login' y 'contraseña' en el cuerpo de la solicitud.
 * Genera un JWT al inicio de sesión exitoso.
 */
exports.iniciarSesion = async (req, res) => {
    try {
        const { login, contraseña } = req.body;

        if (!login || !contraseña) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        const [usuarios] = await db.query('SELECT login, contraseña, id_rol FROM usuario WHERE login = ?', [login]);

        if (usuarios.length === 0) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const usuario = usuarios[0];

        const contraseñaValida = await bcrypt.compare(contraseña, usuario.contraseña);
        if (!contraseñaValida) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const token = jwt.sign({ login: usuario.login, id_rol: usuario.id_rol }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ mensaje: 'Inicio de sesión exitoso', token });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
    }
};



/**
 * Solicita el envío de un código de restablecimiento de contraseña al correo electrónico del usuario.
 * Requiere 'email' en el cuerpo de la solicitud.
 */
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const [rows] = await db.execute('SELECT login FROM usuario WHERE login = ?', [email]);
    if (rows.length === 0) {
      // Por seguridad, siempre responde con un mensaje genérico para no revelar si un email existe o no
      return res.status(200).json({ message: 'Si la dirección de correo electrónico está registrada, recibirás un enlace para restablecer tu contraseña.' });
    }

    const user = rows[0];

    // --- Generar un código numérico de 6 dígitos ---
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    // ------------------------------------------------

    // Calcular la fecha de expiración (ej. 15 minutos en el futuro)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Eliminar tokens anteriores para este usuario (buena práctica)
    await db.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.login]);

    // Guardar el token (código numérico) y su expiración en la base de datos
    await db.execute(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.login, resetToken, expiresAt]
    );

    // --- Construir la URL de restablecimiento con email y código como parámetros ---
    // Asegúrate de que process.env.FRONTEND_URL apunte a la URL base de tu frontend (ej. 'https://tu-frontend.onrender.com')
    const resetUrl = `${process.env.FRONTEND_URL}/cambiar-clave?email=${encodeURIComponent(user.login)}&code=${resetToken}`;
    // -------------------------------------------------------------------------------

    // Enviar el correo electrónico con el código numérico y el enlace directo
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, // Debe ser un email verificado en tu servicio SMTP (SendGrid/Mailgun)
      to: user.login,
      subject: 'Restablecimiento de Contraseña - Código de Verificación',
      html: `
        <h1>Restablecimiento de Contraseña</h1>
        <p>Has solicitado restablecer tu contraseña. Tu código de verificación es:</p>
        <h2 style="color: #4CAF50; font-size: 24px; font-weight: bold;">${resetToken}</h2>
        <p>Este código es válido por 15 minutos.</p>
        <p>Puedes ir directamente a restablecer tu contraseña haciendo clic en el siguiente enlace:</p>
        <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Restablecer mi Contraseña</a></p>
        <p>Si el enlace no funciona, o si prefieres, copia y pega el código <strong>${resetToken}</strong> en la página de verificación de tu aplicación.</p>
        <p>Si no solicitaste esto, por favor, ignora este correo.</p>
      `,
    });

    res.status(200).json({ message: 'Si la dirección de correo electrónico está registrada, recibirás un código para restablecer tu contraseña.' });

  } catch (err) {
    console.error('Error al solicitar restablecimiento de contraseña:', err);
    res.status(500).json({ error: 'Error interno del servidor. Por favor, inténtalo de nuevo más tarde.' });
  }
};


exports.verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Correo electrónico y código son requeridos.' });
  }

  try {
    const [rows] = await db.execute(
      'SELECT * FROM password_reset_tokens WHERE user_id = ? AND token = ? AND expires_at > NOW()',
      [email, code]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Código de restablecimiento inválido o expirado.' });
    }

    res.status(200).json({ message: 'Código verificado exitosamente.' });
  } catch (err) {
    console.error('Error al verificar código de restablecimiento:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};


exports.resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Correo electrónico, código y nueva contraseña son requeridos.' });
  }

  try {
    // 1. Verificar el código y la expiración
    const [tokenRows] = await db.execute(
      'SELECT * FROM password_reset_tokens WHERE user_id = ? AND token = ? AND expires_at > NOW()',
      [email, code]
    );

    if (tokenRows.length === 0) {
      return res.status(400).json({ error: 'Código de restablecimiento inválido o expirado. Por favor, reinicia el proceso.' });
    }

    // 2. Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10); // Asegúrate de usar el mismo factor de salado que en el registro

    // 3. Actualizar la contraseña del usuario
    await db.execute('UPDATE usuario SET password = ? WHERE login = ?', [hashedPassword, email]);

    // 4. Eliminar el token de restablecimiento (ya usado)
    await db.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [email]);

    res.status(200).json({ message: 'Contraseña restablecida exitosamente.' });

  } catch (err) {
    console.error('Error al restablecer contraseña:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
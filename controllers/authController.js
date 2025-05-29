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

  if (!email) {
    return res.status(400).json({ error: 'El correo electrónico es requerido.' });
  }

  try {
    // 1. Buscar el usuario por email en la tabla 'usuario'
    const [rows] = await db.query('SELECT login, correo FROM usuario WHERE correo = ?', [email]);
    const user = rows[0];

    // Importante: No revelar si el email existe o no por razones de seguridad.
    // Siempre se envía la misma respuesta genérica.
    if (!user) {
      console.warn(`Intento de recuperación de contraseña para email no registrado: ${email}`);
      return res.status(200).json({ message: 'Si la dirección de correo electrónico está registrada, se ha enviado un código de recuperación.' });
    }

    // 2. Generar un token único y definir su expiración (1 hora)
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();// Genera un token aleatorio de 64 caracteres
    const expiresAt = new Date(Date.now() + 3600000); // 1 hora en milisegundos

    // 3. Eliminar cualquier token antiguo para este usuario y guardar el nuevo
    await db.query('DELETE FROM password_reset_tokens WHERE user_login = ?', [user.login]);
    await db.query(
      'INSERT INTO password_reset_tokens (user_login, token, expires_at) VALUES (?, ?, ?)',
      [user.login, resetToken, expiresAt]
    );

    // 4. Enviar el correo electrónico con el token
    const mailOptions = {
      from: process.env.EMAIL_FROM, // Dirección de correo configurada en .env
      to: email,
      subject: 'Restablecimiento de Contraseña para tu Cuenta',
      html: `
        <p>Hola,</p>
        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta asociada a este correo electrónico.</p>
        <p>Tu código de recuperación es: <strong>${resetToken}</strong></p>
        <p>Este código es válido por 1 hora.</p>
        <p>Si no solicitaste esto, por favor ignora este correo. Tu contraseña no ha sido modificada.</p>
        <p>Gracias,</p>
        <p>El equipo de ConchaSoft</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Si la dirección de correo electrónico está registrada, se ha enviado un código de recuperación.' });

  } catch (error) {
    console.error('Error al solicitar restablecimiento de contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud.' });
  }
};

/**
 * Verifica un código de restablecimiento de contraseña.
 * Requiere 'email' y 'code' en el cuerpo de la solicitud.
 */
exports.verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'El correo electrónico y el código son requeridos.' });
  }

  try {
    // 1. Buscar el token asociado al usuario y al código
    const [rows] = await db.query(
      `SELECT prt.token, prt.expires_at, u.login AS user_login
       FROM password_reset_tokens prt
       JOIN usuario u ON prt.user_login = u.login
       WHERE u.correo = ? AND prt.token = ?`,
      [email, code]
    );
    const tokenRecord = rows[0];

    if (!tokenRecord) {
      return res.status(400).json({ error: 'El código es inválido o no existe.' });
    }

    // 2. Verificar si el token ha expirado
    if (new Date() > new Date(tokenRecord.expires_at)) {
      // Si el token ha expirado, lo eliminamos para limpiar la base de datos
      await db.query('DELETE FROM password_reset_tokens WHERE token = ?', [code]);
      return res.status(400).json({ error: 'El código ha expirado. Por favor, solicita uno nuevo.' });
    }

    // Si el código es válido y no ha expirado, se permite proceder
    res.status(200).json({ message: 'Código verificado exitosamente. Procede a restablecer tu contraseña.', userLogin: tokenRecord.user_login });

  } catch (error) {
    console.error('Error al verificar el código de restablecimiento:', error);
    res.status(500).json({ error: 'Error interno del servidor al verificar el código.' });
  }
};

/**
 * Restablece la contraseña de un usuario usando un código válido.
 * Requiere 'email', 'code' y 'newPassword' en el cuerpo de la solicitud.
 */
exports.resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Correo, código y nueva contraseña son requeridos.' });
  }

  // Opcional: Validaciones de complejidad de la nueva contraseña
  if (newPassword.length < 8) { // Ejemplo: mínimo 8 caracteres
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  // Puedes añadir más reglas de validación (ej. regex para mayúsculas, números, símbolos)

  try {
    // 1. Verificar el código nuevamente (esto es crucial por seguridad)
    const [tokenRows] = await db.query(
      `SELECT prt.token, prt.expires_at, u.login AS user_login
       FROM password_reset_tokens prt
       JOIN usuario u ON prt.user_login = u.login
       WHERE u.correo = ? AND prt.token = ?`,
      [email, code]
    );
    const tokenRecord = tokenRows[0];

    // Si el token no existe, no coincide o ha expirado, se devuelve un error
    if (!tokenRecord || new Date() > new Date(tokenRecord.expires_at)) {
      if (tokenRecord && new Date() > new Date(tokenRecord.expires_at)) {
         await db.query('DELETE FROM password_reset_tokens WHERE token = ?', [code]); // Limpia el token expirado
      }
      return res.status(400).json({ error: 'El código es inválido o ha expirado. Por favor, solicita uno nuevo.' });
    }

    // 2. Hashear la nueva contraseña antes de guardarla
    const hashedPassword = await bcrypt.hash(newPassword, 10); // Costo del salt: 10

    // 3. Actualizar la contraseña del usuario en la tabla 'usuario'
    await db.query('UPDATE usuario SET contraseña = ? WHERE login = ?', [hashedPassword, tokenRecord.user_login]);

    // 4. Invalidar/Eliminar el token de restablecimiento para que no pueda ser reutilizado
    await db.query('DELETE FROM password_reset_tokens WHERE token = ?', [code]);

    res.status(200).json({ message: 'Contraseña restablecida exitosamente. Ahora puedes iniciar sesión con tu nueva contraseña.' });

  } catch (error) {
    console.error('Error al restablecer la contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor al restablecer la contraseña.' });
  }
};
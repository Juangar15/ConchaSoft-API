const db = require('../db'); // Asegúrate de que esta ruta sea correcta para tu conexión a la DB
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Necesario para generar tokens aleatorios
const nodemailer = require('nodemailer'); // Necesario para enviar correos electrónicos
require('dotenv').config(); // Asegúrate de que tus variables de entorno estén cargadas

// --- Configuración del transportador de correo (Nodemailer) ---
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// --- Funciones de Autenticación Existentes ---

/**
 * Registra un nuevo usuario en la base de datos.
 * Requiere 'login', 'contraseña', 'correo', 'id_rol' en el cuerpo de la solicitud.
 * El campo 'activo' se establece automáticamente en 1 (true) por defecto en la DB.
 */
exports.registrarUsuario = async (req, res) => {
    try {
        const { login, contraseña, correo, id_rol } = req.body;

        if (!login || !contraseña || !correo || id_rol === undefined) { // Cambiado id_rol a undefined para permitir 0
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contraseña, salt);

        // La columna 'activo' se añade automáticamente con DEFAULT 1 en la tabla
        await db.query('INSERT INTO usuario (login, contraseña, correo, id_rol) VALUES (?, ?, ?, ?)',
            [login, hashedPassword, correo, id_rol]);

        res.status(201).json({ mensaje: 'Usuario registrado correctamente' });
    } catch (error) {
        console.error('Error al registrar el usuario:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El login o correo electrónico ya existen.' });
        }
        res.status(500).json({ error: 'Error interno del servidor al registrar el usuario.' });
    }
};

/**
 * Inicia sesión para un usuario existente.
 * Requiere 'login' y 'contraseña' en el cuerpo de la solicitud.
 * Genera un JWT al inicio de sesión exitoso y verifica el estado 'activo'.
 */
exports.iniciarSesion = async (req, res) => {
    try {
        const { login, contraseña } = req.body;

        if (!login || !contraseña) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        // --- MODIFICACIÓN: Incluir 'activo' en la consulta SELECT ---
        const [usuarios] = await db.query('SELECT login, contraseña, correo, id_rol, activo FROM usuario WHERE login = ?', [login]);

        if (usuarios.length === 0) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const usuario = usuarios[0];

        // --- MODIFICACIÓN: Verificar el estado 'activo' del usuario ---
        if (!usuario.activo) { // Si 'activo' es 0 (false), denegar el acceso
            return res.status(403).json({ error: 'Tu cuenta está inactiva. Contacta al administrador.' });
        }

        const contraseñaValida = await bcrypt.compare(contraseña, usuario.contraseña);
        if (!contraseñaValida) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }

        // --- MODIFICACIÓN: Incluir 'activo' en el token JWT y la respuesta ---
        const token = jwt.sign({ login: usuario.login, id_rol: usuario.id_rol, activo: usuario.activo }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({
            mensaje: 'Inicio de sesión exitoso',
            token,
            user: {
                login: usuario.login,
                correo: usuario.correo,
                id_rol: usuario.id_rol,
                activo: usuario.activo // Enviar el estado activo también al frontend
            }
        });

    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
    }
};


/**
 * Solicita el envío de un código de restablecimiento de contraseña al correo electrónico del usuario.
 * Requiere 'email' en el cuerpo de la solicitud.
 * Solo permite restablecer si la cuenta está activa.
 */
exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'El correo electrónico es requerido.' });
    }

    try {
        // --- MODIFICACIÓN: Incluir 'activo' en la consulta para restablecimiento ---
        const [rows] = await db.query('SELECT login, correo, activo FROM usuario WHERE correo = ?', [email]);
        const user = rows[0];

        if (!user) {
            console.warn(`Intento de recuperación de contraseña para email no registrado: ${email}`);
            return res.status(200).json({ message: 'Si la dirección de correo electrónico está registrada, se ha enviado un código de recuperación.' });
        }

        // --- MODIFICACIÓN: Verificar si el usuario está activo antes de permitir el restablecimiento ---
        if (!user.activo) {
            return res.status(403).json({ error: 'Tu cuenta está inactiva y no puede restablecer la contraseña. Contacta al administrador.' });
        }

        const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 3600000);

        await db.query('DELETE FROM password_reset_tokens WHERE user_login = ?', [user.login]);
        await db.query(
            'INSERT INTO password_reset_tokens (user_login, token, expires_at) VALUES (?, ?, ?)',
            [user.login, resetToken, expiresAt]
        );

        const mailOptions = {
            from: process.env.EMAIL_FROM,
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
        // --- MODIFICACIÓN: Incluir 'activo' en la verificación del token ---
        const [rows] = await db.query(
            `SELECT prt.token, prt.expires_at, u.login AS user_login, u.activo
             FROM password_reset_tokens prt
             JOIN usuario u ON prt.user_login = u.login
             WHERE u.correo = ? AND prt.token = ?`,
            [email, code]
        );
        const tokenRecord = rows[0];

        if (!tokenRecord) {
            return res.status(400).json({ error: 'El código es inválido o no existe.' });
        }

        // --- MODIFICACIÓN: Verificar si el usuario está activo antes de validar el código ---
        if (!tokenRecord.activo) {
            return res.status(403).json({ error: 'Tu cuenta está inactiva y no puede restablecer la contraseña. Contacta al administrador.' });
        }

        if (new Date() > new Date(tokenRecord.expires_at)) {
            await db.query('DELETE FROM password_reset_tokens WHERE token = ?', [code]);
            return res.status(400).json({ error: 'El código ha expirado. Por favor, solicita uno nuevo.' });
        }

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

    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    try {
        // --- MODIFICACIÓN: Incluir 'activo' en la verificación del token para restablecer la contraseña ---
        const [tokenRows] = await db.query(
            `SELECT prt.token, prt.expires_at, u.login AS user_login, u.activo
             FROM password_reset_tokens prt
             JOIN usuario u ON prt.user_login = u.login
             WHERE u.correo = ? AND prt.token = ?`,
            [email, code]
        );
        const tokenRecord = tokenRows[0];

        if (!tokenRecord || new Date() > new Date(tokenRecord.expires_at)) {
            if (tokenRecord && new Date() > new Date(tokenRecord.expires_at)) {
                await db.query('DELETE FROM password_reset_tokens WHERE token = ?', [code]);
            }
            return res.status(400).json({ error: 'El código es inválido o ha expirado. Por favor, solicita uno nuevo.' });
        }

        // --- MODIFICACIÓN: Verificar si el usuario está activo antes de permitir el cambio de contraseña ---
        if (!tokenRecord.activo) {
            return res.status(403).json({ error: 'Tu cuenta está inactiva y no puede cambiar la contraseña. Contacta al administrador.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query('UPDATE usuario SET contraseña = ? WHERE login = ?', [hashedPassword, tokenRecord.user_login]);

        await db.query('DELETE FROM password_reset_tokens WHERE token = ?', [code]);

        res.status(200).json({ message: 'Contraseña restablecida exitosamente. Ahora puedes iniciar sesión con tu nueva contraseña.' });

    } catch (error) {
        console.error('Error al restablecer la contraseña:', error);
        res.status(500).json({ error: 'Error interno del servidor al restablecer la contraseña.' });
    }
};

// --- FUNCIONES PARA GESTIÓN DE USUARIOS (por Administrador) ---

exports.getUsuarioByLogin = async (req, res) => {
    try {
        const targetLogin = req.params.login;
        const currentUserLogin = req.user.login;
        const currentUserRole = req.user.id_rol;

        if (currentUserRole !== 1 && currentUserLogin !== targetLogin) { // 1 es el ID del rol de Administrador
            return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para ver este perfil.' });
        }

        // --- MODIFICACIÓN: Incluir 'activo' en la consulta SELECT ---
        const [users] = await db.query('SELECT login, correo, id_rol, activo FROM usuario WHERE login = ?', [targetLogin]);

        if (users.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.status(200).json({ user: users[0] });

    } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener datos del usuario.' });
    }
};

exports.editarUsuario = async (req, res) => {
    try {
        const targetLogin = req.params.login;
        // --- MODIFICACIÓN: 'activo' puede ser un campo a editar ---
        const { correo, id_rol, newPassword, activo } = req.body;
        const editorLogin = req.user.login;
        const editorRole = req.user.id_rol;

        if (!targetLogin) {
            return res.status(400).json({ error: 'El login del usuario a editar es obligatorio.' });
        }

        if (editorRole !== 1 && editorLogin !== targetLogin) {
            return res.status(403).json({ error: 'No tienes permisos para editar este usuario.' });
        }

        if (editorRole !== 1 && id_rol !== undefined && parseInt(id_rol) !== editorRole) {
            return res.status(403).json({ error: 'No tienes permisos para cambiar el rol.' });
        }

        // Un administrador no puede desactivarse a sí mismo
        if (targetLogin === editorLogin && editorRole === 1 && activo === 0) { // Si el admin intenta desactivarse a sí mismo
            return res.status(403).json({ error: 'Un administrador no puede desactivar su propia cuenta.' });
        }

        let updateFields = [];
        let queryParams = [];

        if (correo !== undefined) { // Permite que correo sea null si es válido para tu esquema
            updateFields.push('correo = ?');
            queryParams.push(correo);
        }
        if (id_rol !== undefined && editorRole === 1) {
            updateFields.push('id_rol = ?');
            queryParams.push(id_rol);
        }
        if (newPassword) {
            if (newPassword.length < 8) {
                return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            updateFields.push('contraseña = ?');
            queryParams.push(hashedPassword);
        }
        // --- MODIFICACIÓN: Añadir 'activo' a los campos a actualizar si es un admin ---
        if (activo !== undefined && editorRole === 1) { // Solo el admin puede cambiar el estado activo
            updateFields.push('activo = ?');
            queryParams.push(activo);
        }


        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
        }

        queryParams.push(targetLogin);

        const query = `UPDATE usuario SET ${updateFields.join(', ')} WHERE login = ?`;
        await db.query(query, queryParams);

        res.status(200).json({ mensaje: 'Usuario actualizado correctamente.' });

    } catch (error) {
        console.error('Error al editar el usuario:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El correo electrónico ya existe para otro usuario.' });
        }
        res.status(500).json({ error: 'Error interno del servidor al editar el usuario.' });
    }
};

exports.crearUsuarioPorAdmin = async (req, res) => {
    try {
        // --- MODIFICACIÓN: Permitir que el admin establezca el estado 'activo' al crear ---
        const { login, contraseña, correo, id_rol, activo = 1 } = req.body; // Default 1 (activo) si no se provee
        const adminRole = req.user.id_rol;

        if (adminRole !== 1) {
            return res.status(403).json({ error: 'No tienes permisos para crear usuarios.' });
        }

        if (!login || !contraseña || !correo || id_rol === undefined) {
            return res.status(400).json({ error: 'Todos los campos obligatorios (login, contraseña, correo, id_rol) deben ser proporcionados.' });
        }
        if (contraseña.length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contraseña, salt);

        // --- MODIFICACIÓN: Incluir 'activo' en la inserción ---
        await db.query('INSERT INTO usuario (login, contraseña, correo, id_rol, activo) VALUES (?, ?, ?, ?, ?)',
            [login, hashedPassword, correo, id_rol, activo]);

        res.status(201).json({ mensaje: 'Usuario creado correctamente por el administrador.' });
    } catch (error) {
        console.error('Error al crear el usuario por admin:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El login o correo electrónico ya existen.' });
        }
        res.status(500).json({ error: 'Error interno del servidor al crear el usuario.' });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        // --- MODIFICACIÓN: Incluir 'activo' en la consulta SELECT de todos los usuarios ---
        const [users] = await db.query('SELECT login, correo, id_rol, activo FROM usuario');
        res.status(200).json({ users });
    } catch (error) {
        console.error('Error al obtener la lista de usuarios:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener la lista de usuarios.' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { login } = req.params;
        const adminLogin = req.user.login;

        if (login === adminLogin) {
            return res.status(400).json({ error: 'Un administrador no puede eliminarse a sí mismo.' });
        }

        const [result] = await db.query('DELETE FROM usuario WHERE login = ?', [login]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado para eliminar.' });
        }

        res.status(200).json({ message: 'Usuario eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor al eliminar el usuario.' });
    }
};

// --- NUEVA FUNCIÓN: Alternar el estado activo/inactivo de un usuario ---
/**
 * Permite a un administrador activar o desactivar la cuenta de un usuario.
 * Requiere 'login' en los parámetros y 'activo' (0 o 1) en el cuerpo.
 */
exports.toggleUserStatus = async (req, res) => {
    try {
        const { login } = req.params; // El login del usuario a modificar
        const { activo } = req.body; // El nuevo estado (0 para inactivo, 1 para activo)
        const adminLogin = req.user.login; // El login del administrador que realiza la acción

        // Validaciones básicas
        if (activo === undefined || (activo !== 0 && activo !== 1)) {
            return res.status(400).json({ error: 'El estado "activo" debe ser 0 (inactivo) o 1 (activo).' });
        }

        // Evitar que un administrador se desactive a sí mismo
        if (login === adminLogin && activo === 0) {
            return res.status(403).json({ error: 'Un administrador no puede desactivar su propia cuenta.' });
        }

        // Verificar si el usuario existe
        const [users] = await db.query('SELECT login FROM usuario WHERE login = ?', [login]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        // Actualizar el estado 'activo' del usuario
        const [result] = await db.query(
            'UPDATE usuario SET activo = ? WHERE login = ?',
            [activo, login]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ error: 'No se pudo actualizar el estado del usuario. Es posible que el estado ya sea el solicitado.' });
        }

        res.status(200).json({ mensaje: `Usuario ${login} ha sido ${activo ? 'activado' : 'desactivado'} correctamente.` });

    } catch (error) {
        console.error('Error al alternar el estado del usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor al alternar el estado del usuario.' });
    }
};
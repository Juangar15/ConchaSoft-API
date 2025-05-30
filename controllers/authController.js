const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

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
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El login o correo electrónico ya existen.' });
        }
        res.status(500).json({ error: 'Error interno del servidor al registrar el usuario.' });
    }
};

exports.iniciarSesion = async (req, res) => {
    try {
        const { login, contraseña } = req.body;
        if (!login || !contraseña) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }
        const [usuarios] = await db.query('SELECT login, contraseña, correo, id_rol FROM usuario WHERE login = ?', [login]);
        if (usuarios.length === 0) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }
        const usuario = usuarios[0];
        const contraseñaValida = await bcrypt.compare(contraseña, usuario.contraseña);
        if (!contraseñaValida) {
            return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
        }
        // Asegúrate de incluir id_rol en el token
        const token = jwt.sign({ login: usuario.login, id_rol: usuario.id_rol }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({
            mensaje: 'Inicio de sesión exitoso',
            token,
            user: {
                login: usuario.login,
                correo: usuario.correo,
                id_rol: usuario.id_rol // Envía el rol también
            }
        });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
    }
};

exports.requestPasswordReset = async (req, res) => { /* ... (código existente) ... */ };
exports.verifyResetCode = async (req, res) => { /* ... (código existente) ... */ };
exports.resetPassword = async (req, res) => { /* ... (código existente) ... */ };


// --- NUEVAS FUNCIONES PARA GESTIÓN DE USUARIOS ---

exports.getUsuarioByLogin = async (req, res) => {
    try {
        const targetLogin = req.params.login;
        const currentUserLogin = req.user.login; // req.user viene del verificarToken
        const currentUserRole = req.user.id_rol; // req.user viene del verificarToken

        if (currentUserRole !== 1 && currentUserLogin !== targetLogin) { // 1 es el ID del rol de Administrador
            return res.status(403).json({ error: 'Acceso denegado: No tienes permisos para ver este perfil.' });
        }

        const [users] = await db.query('SELECT login, correo, id_rol FROM usuario WHERE login = ?', [targetLogin]);

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
        const { correo, id_rol, newPassword } = req.body;
        const editorLogin = req.user.login;
        const editorRole = req.user.id_rol;

        if (!targetLogin) {
            return res.status(400).json({ error: 'El login del usuario a editar es obligatorio.' });
        }

        // Permisos: Solo admin puede editar otros o cambiar rol. Usuario normal solo se edita a sí mismo (sin cambiar rol).
        if (editorRole !== 1 && editorLogin !== targetLogin) {
            return res.status(403).json({ error: 'No tienes permisos para editar este usuario.' });
        }

        // Si no es administrador, y se intenta cambiar el rol o el rol es diferente al propio
        if (editorRole !== 1 && id_rol !== undefined && parseInt(id_rol) !== editorRole) {
             return res.status(403).json({ error: 'No tienes permisos para cambiar el rol.' });
        }

        let updateFields = [];
        let queryParams = [];

        if (correo) {
            updateFields.push('correo = ?');
            queryParams.push(correo);
        }
        // Solo permitir al administrador cambiar el id_rol
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
        const { login, contraseña, correo, id_rol } = req.body;
        const adminRole = req.user.id_rol;

        if (adminRole !== 1) {
            return res.status(403).json({ error: 'No tienes permisos para crear usuarios.' });
        }

        if (!login || !contraseña || !correo || id_rol === undefined) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
        }
        if (contraseña.length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contraseña, salt);

        await db.query('INSERT INTO usuario (login, contraseña, correo, id_rol) VALUES (?, ?, ?, ?)',
            [login, hashedPassword, correo, id_rol]);

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
    // La verificación de rol (solo admin) se hará en la ruta con el middleware verificarPermiso
    try {
        const [users] = await db.query('SELECT login, correo, id_rol FROM usuario');
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
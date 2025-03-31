const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

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
        res.status(500).json({ error: 'Error al registrar el usuario' });
    }
};

exports.iniciarSesion = async (req, res) => {
    try {
        const { login, contraseña } = req.body;

        if (!login || !contraseña) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        const [usuarios] = await db.query('SELECT * FROM usuario WHERE login = ?', [login]);

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
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
};
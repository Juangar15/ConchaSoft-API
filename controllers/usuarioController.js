const db = require('../db');

exports.obtenerUsuarios = async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM usuario');
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.obtenerUsuario = async (req, res) => {
    try {
        const { login } = req.params;
        const [results] = await db.query('SELECT * FROM usuario WHERE login = ?', [login]);

        if (results.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(results[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.crearUsuario = async (req, res) => {
    try {
        const { login, contraseña, correo, id_rol } = req.body;
        const [result] = await db.query(
            'INSERT INTO usuario (login, contraseña, correo, id_rol) VALUES (?, ?, ?, ?)',
            [login, contraseña, correo, id_rol]
        );

        res.json({ message: 'Usuario creado', id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.actualizarUsuario = async (req, res) => {
    try {
        const { login } = req.params;
        const { contraseña, correo, id_rol } = req.body;

        const [result] = await db.query(
            'UPDATE usuario SET contraseña = ?, correo = ?, id_rol = ? WHERE login = ?',
            [contraseña, correo, id_rol, login]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario actualizado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.eliminarUsuario = async (req, res) => {
    try {
        const { login } = req.params;

        const [result] = await db.query('DELETE FROM usuario WHERE login = ?', [login]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const db = require('../db');

const obtenerPermisos = async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM permiso');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener permisos' });
    }
};

const obtenerPermiso = async (req, res) => {
    const { id } = req.params;
    try {
        const [results] = await db.query('SELECT * FROM permiso WHERE id = ?', [id]);
        if (results.length === 0) {
            return res.status(404).json({ error: 'Permiso no encontrado' });
        }
        res.json(results[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener el permiso' });
    }
};

const crearPermiso = async (req, res) => {
    const { nombre } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    try {
        const [result] = await db.query('INSERT INTO permiso (nombre) VALUES (?)', [nombre]);
        res.status(201).json({ message: 'Permiso creado', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear el permiso' });
    }
};

const actualizarPermiso = async (req, res) => {
    const { id } = req.params;
    const { nombre } = req.body;
    try {
        await db.query('UPDATE permiso SET nombre = ? WHERE id = ?', [nombre, id]);
        res.json({ message: 'Permiso actualizado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar el permiso' });
    }
};

const eliminarPermiso = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM permiso WHERE id = ?', [id]);
        res.json({ message: 'Permiso eliminado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar el permiso' });
    }
};

module.exports = {
    obtenerPermisos,
    obtenerPermiso,
    crearPermiso,
    actualizarPermiso,
    eliminarPermiso
};
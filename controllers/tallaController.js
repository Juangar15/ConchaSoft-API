const db = require('../db');

exports.obtenerTallas = async (req, res) => {
    try {
        const [tallas] = await db.query('SELECT * FROM talla');
        res.json(tallas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las tallas' });
    }
};

exports.obtenerTalla = async (req, res) => {
    try {
        const { id_talla } = req.params;
        const [talla] = await db.query('SELECT * FROM talla WHERE id_talla = ?', [id_talla]);
        if (talla.length === 0) {
            return res.status(404).json({ error: 'Talla no encontrada' });
        }
        res.json(talla[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la talla'});
    }
};

exports.crearTalla = async (req, res) => {
    try {
        const { talla } = req.body;
        if (!talla) {
            return res.status(400).json({ error: 'La talla es obligatoria' });
        }
        await db.query('INSERT INTO talla (talla) VALUES (?)', [talla]);
        res.status(201).json({ mensaje: 'Talla creada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear la talla' });
    }
};

exports.actualizarTalla = async (req, res) => {
    try {
        const { id_talla } = req.params;
        const { talla } = req.body;
        const [result] = await db.query('UPDATE talla SET talla = ? WHERE id_talla = ?', [talla, id_talla]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Talla no encontrada' });
        }
        res.json({ mensaje: 'Talla actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la talla' });
    }
};

exports.eliminarTalla = async (req, res) => {
    try {
        const { id_talla } = req.params;
        const [result] = await db.query('DELETE FROM talla WHERE id_talla = ?', [id_talla]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Talla no encontrada' });
        }
        res.json({ mensaje: 'Talla eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la talla' });
    }
};
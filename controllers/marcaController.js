const db = require('../db');

// Obtener todas las marcas
const obtenerMarcas = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM marca');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener marcas' });
    }
};

// Obtener una marca por ID
const obtenerMarca = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM marca WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Marca no encontrada' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la marca' });
    }
};

// Crear una nueva marca
const crearMarca = async (req, res) => {
    const { marca } = req.body;
    if (!marca) return res.status(400).json({ error: 'El campo marca es obligatorio' });

    try {
        const [result] = await db.query('INSERT INTO marca (marca) VALUES (?)', [marca]);
        res.status(201).json({ id: result.insertId, marca });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear la marca' });
    }
};

// Actualizar una marca
const actualizarMarca = async (req, res) => {
    const { id } = req.params;
    const { marca } = req.body;

    try {
        const [result] = await db.query('UPDATE marca SET marca = ? WHERE id = ?', [marca, id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Marca no encontrada' });

        res.json({ id, marca });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la marca' });
    }
};

// Eliminar una marca
const eliminarMarca = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM marca WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Marca no encontrada' });

        res.json({ message: 'Marca eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la marca' });
    }
};

module.exports = {
    obtenerMarcas,
    obtenerMarca,
    crearMarca,
    actualizarMarca,
    eliminarMarca
};
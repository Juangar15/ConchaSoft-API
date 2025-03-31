const db = require('../db');

// Obtener todas las devoluciones
exports.obtenerDevoluciones = async (req, res) => {
    try {
        const [devoluciones] = await db.query('SELECT * FROM devolucion');
        res.json(devoluciones);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las devoluciones' });
    }
};

// Obtener una devolución por ID
exports.obtenerDevolucion = async (req, res) => {
    try {
        const { id } = req.params;
        const [devolucion] = await db.query('SELECT * FROM devolucion WHERE id = ?', [id]);
        if (devolucion.length === 0) {
            return res.status(404).json({ error: 'Devolución no encontrada' });
        }
        res.json(devolucion[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la devolución' });
    }
};

// Crear una devolución
exports.crearDevolucion = async (req, res) => {
    try {
        const { id_venta, id_cliente, fecha, razon, saldo_a_favor } = req.body;
        if (!id_venta || !id_cliente || !fecha || !razon) {
            return res.status(400).json({ error: 'Todos los campos obligatorios' });
        }
        await db.query(
            'INSERT INTO devolucion (id_venta, id_cliente, fecha, razon, saldo_a_favor) VALUES (?, ?, ?, ?, ?)',
            [id_venta, id_cliente, fecha, razon, saldo_a_favor || 0]
        );
        res.status(201).json({ mensaje: 'Devolución creada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear la devolución' });
    }
};

// Actualizar una devolución
exports.actualizarDevolucion = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_venta, id_cliente, fecha, razon, saldo_a_favor } = req.body;
        const [result] = await db.query(
            'UPDATE devolucion SET id_venta = ?, id_cliente = ?, fecha = ?, razon = ?, saldo_a_favor = ? WHERE id = ?',
            [id_venta, id_cliente, fecha, razon, saldo_a_favor || 0, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Devolución no encontrada' });
        }
        res.json({ mensaje: 'Devolución actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la devolución' });
    }
};

// Eliminar una devolución
exports.eliminarDevolucion = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM devolucion WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Devolución no encontrada' });
        }
        res.json({ mensaje: 'Devolución eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la devolución' });
    }
};
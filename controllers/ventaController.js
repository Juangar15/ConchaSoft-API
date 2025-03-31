const db = require('../db');

exports.obtenerVentas = async (req, res) => {
    try {
        const [ventas] = await db.query('SELECT * FROM venta');
        res.json(ventas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las ventas' });
    }
};

exports.obtenerVenta = async (req, res) => {
    try {
        const { id } = req.params;
        const [venta] = await db.query('SELECT * FROM venta WHERE id = ?', [id]);
        if (venta.length === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        res.json(venta[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la venta' });
    }
};

exports.crearVenta = async (req, res) => {
    try {
        const { fecha, tipo_pago, id_cliente, saldo_a_favor = 0, estado, total } = req.body;
        if (!fecha || !tipo_pago || !id_cliente || !estado || !total) {
            return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos' });
        }

        await db.query(
            'INSERT INTO venta (fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total) VALUES (?, ?, ?, ?, ?, ?)',
            [fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total]
        );

        res.status(201).json({ mensaje: 'Venta creada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear la venta' });
    }
};

exports.actualizarVenta = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total } = req.body;

        const [result] = await db.query(
            'UPDATE venta SET fecha = ?, tipo_pago = ?, id_cliente = ?, saldo_a_favor = ?, estado = ?, total = ? WHERE id = ?',
            [fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        res.json({ mensaje: 'Venta actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la venta' });
    }
};

exports.eliminarVenta = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM venta WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        res.json({ mensaje: 'Venta eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la venta' });
    }
};
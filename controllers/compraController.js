const db = require('../db');

exports.obtenerCompras = async (req, res) => {
    try {
        const [compras] = await db.query(`
            SELECT compra.*, proveedor.nombre AS proveedor
            FROM compra
            INNER JOIN proveedor ON compra.id_proveedor = proveedor.id
        `);
        res.json(compras);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las compras' });
    }
};

exports.obtenerCompra = async (req, res) => {
    try {
        const { id } = req.params;
        const [compra] = await db.query(`
            SELECT compra.*, proveedor.nombre AS proveedor
            FROM compra
            INNER JOIN proveedor ON compra.id_proveedor = proveedor.id
            WHERE compra.id = ?
        `, [id]);

        if (compra.length === 0) {
            return res.status(404).json({ error: 'Compra no encontrada' });
        }

        res.json(compra[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la compra' });
    }
};

exports.crearCompra = async (req, res) => {
    try {
        const { fecha, tipo_pago, total, estado, id_proveedor } = req.body;

        if (!fecha || !tipo_pago || !total || !estado || !id_proveedor) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        const [proveedorExiste] = await db.query('SELECT id FROM proveedor WHERE id = ?', [id_proveedor]);
        if (proveedorExiste.length === 0) {
            return res.status(400).json({ error: 'Proveedor no válido' });
        }

        await db.query(
            'INSERT INTO compra (fecha, tipo_pago, total, estado, id_proveedor) VALUES (?, ?, ?, ?, ?)',
            [fecha, tipo_pago, total, estado, id_proveedor]
        );

        res.status(201).json({ mensaje: 'Compra creada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear la compra' });
    }
};

exports.actualizarCompra = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha, tipo_pago, total, estado, id_proveedor } = req.body;

        if (!fecha || !tipo_pago || !total || !estado || !id_proveedor) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        const [proveedorExiste] = await db.query('SELECT id FROM proveedor WHERE id = ?', [id_proveedor]);
        if (proveedorExiste.length === 0) {
            return res.status(400).json({ error: 'Proveedor no válido' });
        }

        const [result] = await db.query(
            'UPDATE compra SET fecha = ?, tipo_pago = ?, total = ?, estado = ?, id_proveedor = ? WHERE id = ?',
            [fecha, tipo_pago, total, estado, id_proveedor, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Compra no encontrada' });
        }

        res.json({ mensaje: 'Compra actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la compra' });
    }
};

exports.eliminarCompra = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM compra WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Compra no encontrada' });
        }

        res.json({ mensaje: 'Compra eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la compra' });
    }
};
const db = require('../db');

exports.obtenerComprasProductos = async (req, res) => {
    try {
        const [compraProd] = await db.query(`
            SELECT cp.*, c.fecha AS fecha_compra, p.nombre AS producto
            FROM compra_prod cp
            INNER JOIN compra c ON cp.id_compra = c.id
            INNER JOIN producto p ON cp.id_producto = p.id
        `);
        res.json(compraProd);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la relación compra-producto' });
    }
};

exports.obtenerCompraProducto = async (req, res) => {
    try {
        const { id_compra, id_producto } = req.params;
        const [compraProd] = await db.query(`
            SELECT cp.*, c.fecha AS fecha_compra, p.nombre AS producto
            FROM compra_prod cp
            INNER JOIN compra c ON cp.id_compra = c.id
            INNER JOIN producto p ON cp.id_producto = p.id
            WHERE cp.id_compra = ? AND cp.id_producto = ?
        `, [id_compra, id_producto]);

        if (compraProd.length === 0) {
            return res.status(404).json({ error: 'Relación compra-producto no encontrada' });
        }

        res.json(compraProd[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la relación compra-producto' });
    }
};

exports.crearCompraProducto = async (req, res) => {
    try {
        const { id_compra, id_producto, cantidad, precio_unitario, subtotal } = req.body;

        if (!id_compra || !id_producto || !cantidad || !precio_unitario || !subtotal) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        const [compraExiste] = await db.query('SELECT id FROM compra WHERE id = ?', [id_compra]);
        if (compraExiste.length === 0) {
            return res.status(400).json({ error: 'Compra no válida' });
        }

        const [productoExiste] = await db.query('SELECT id FROM producto WHERE id = ?', [id_producto]);
        if (productoExiste.length === 0) {
            return res.status(400).json({ error: 'Producto no válido' });
        }

        await db.query(
            'INSERT INTO compra_prod (id_compra, id_producto, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
            [id_compra, id_producto, cantidad, precio_unitario, subtotal]
        );

        res.status(201).json({ mensaje: 'Compra-Producto agregada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al agregar la compra-producto' });
    }
};

exports.actualizarCompraProducto = async (req, res) => {
    try {
        const { id_compra, id_producto } = req.params;
        const { cantidad, precio_unitario, subtotal } = req.body;

        if (!cantidad || !precio_unitario || !subtotal) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        const [result] = await db.query(
            'UPDATE compra_prod SET cantidad = ?, precio_unitario = ?, subtotal = ? WHERE id_compra = ? AND id_producto = ?',
            [cantidad, precio_unitario, subtotal, id_compra, id_producto]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Relación compra-producto no encontrada' });
        }

        res.json({ mensaje: 'Compra-Producto actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la compra-producto' });
    }
};

exports.eliminarCompraProducto = async (req, res) => {
    try {
        const { id_compra, id_producto } = req.params;
        const [result] = await db.query(
            'DELETE FROM compra_prod WHERE id_compra = ? AND id_producto = ?',
            [id_compra, id_producto]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Relación compra-producto no encontrada' });
        }

        res.json({ mensaje: 'Compra-Producto eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la compra-producto' });
    }
};
const db = require('../db');

exports.obtenerVentasProductos = async (req, res) => {
    try {
        const [ventaProd] = await db.query(`
            SELECT vp.*, v.fecha AS fecha_venta, t.talla AS talla
            FROM venta_prod vp
            INNER JOIN venta v ON vp.id_venta = v.id
            INNER JOIN talla t ON vp.id_talla = t.id_talla
        `);
        res.json(ventaProd);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la relación venta-producto' });
    }
};

exports.obtenerVentaProducto = async (req, res) => {
    try {
        const { id_venta, id_talla } = req.params;
        const [ventaProd] = await db.query(`
            SELECT vp.*, v.fecha AS fecha_venta, t.talla AS talla
            FROM venta_prod vp
            INNER JOIN venta v ON vp.id_venta = v.id
            INNER JOIN talla t ON vp.id_talla = t.id_talla
            WHERE vp.id_venta = ? AND vp.id_talla = ?
        `, [id_venta, id_talla]);

        if (ventaProd.length === 0) {
            return res.status(404).json({ error: 'Relación venta-producto no encontrada' });
        }

        res.json(ventaProd[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la relación venta-producto' });
    }
};

exports.crearVentaProducto = async (req, res) => {
    try {
        const { id_venta, id_talla, cantidad, precio_unitario, subtotal } = req.body;

        if (!id_venta || !id_talla || !cantidad || !precio_unitario || !subtotal) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        const [ventaExiste] = await db.query('SELECT id FROM venta WHERE id = ?', [id_venta]);
        if (ventaExiste.length === 0) {
            return res.status(400).json({ error: 'Venta no válida' });
        }

        const [tallaExiste] = await db.query('SELECT id_talla FROM talla WHERE id_talla = ?', [id_talla]);
        if (tallaExiste.length === 0) {
            return res.status(400).json({ error: 'Talla no válida' });
        }

        await db.query(
            'INSERT INTO venta_prod (id_venta, id_talla, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
            [id_venta, id_talla, cantidad, precio_unitario, subtotal]
        );

        res.status(201).json({ mensaje: 'Venta-Producto agregada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al agregar la venta-producto' });
    }
};

exports.actualizarVentaProducto = async (req, res) => {
    try {
        const { id_venta, id_talla } = req.params;
        const { cantidad, precio_unitario, subtotal } = req.body;

        if (!cantidad || !precio_unitario || !subtotal) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        const [result] = await db.query(
            'UPDATE venta_prod SET cantidad = ?, precio_unitario = ?, subtotal = ? WHERE id_venta = ? AND id_talla = ?',
            [cantidad, precio_unitario, subtotal, id_venta, id_talla]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Relación venta-producto no encontrada' });
        }

        res.json({ mensaje: 'Venta-Producto actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la venta-producto' });
    }
};

exports.eliminarVentaProducto = async (req, res) => {
    try {
        const { id_venta, id_talla } = req.params;
        const [result] = await db.query(
            'DELETE FROM venta_prod WHERE id_venta = ? AND id_talla = ?',
            [id_venta, id_talla]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Relación venta-producto no encontrada' });
        }

        res.json({ mensaje: 'Venta-Producto eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la venta-producto' });
    }
};
const db = require('../db');

exports.obtenerProductoTallas = async (req, res) => {
    try {
        const [productoTallas] = await db.query(`
            SELECT producto_talla.*, producto.nombre AS producto, talla.talla AS talla 
            FROM producto_talla 
            INNER JOIN producto ON producto_talla.id_producto = producto.id
            INNER JOIN talla ON producto_talla.id_talla = talla.id_talla
        `);
        res.json(productoTallas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las combinaciones de producto y talla' });
    }
};

exports.obtenerProductoTalla = async (req, res) => {
    try {
        const { id } = req.params;
        const [productoTalla] = await db.query(`
            SELECT producto_talla.*, producto.nombre AS producto, talla.talla AS talla 
            FROM producto_talla 
            INNER JOIN producto ON producto_talla.id_producto = producto.id
            INNER JOIN talla ON producto_talla.id_talla = talla.id_talla
            WHERE producto_talla.id = ?
        `, [id]);

        if (productoTalla.length === 0) {
            return res.status(404).json({ error: 'Producto-Talla no encontrado' });
        }

        res.json(productoTalla[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la combinación de producto y talla' });
    }
};

exports.crearProductoTalla = async (req, res) => {
    try {
        const { id_producto, id_talla, cantidad } = req.body;

        if (!id_producto || !id_talla || cantidad === undefined) {
            return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos' });
        }

        // Verificar si el producto y la talla existen
        const [productoExiste] = await db.query('SELECT id FROM producto WHERE id = ?', [id_producto]);
        const [tallaExiste] = await db.query('SELECT id_talla FROM talla WHERE id_talla = ?', [id_talla]);

        if (productoExiste.length === 0 || tallaExiste.length === 0) {
            return res.status(400).json({ error: 'Producto o talla no válidos' });
        }

        // Insertar el producto_talla
        await db.query('INSERT INTO producto_talla (id_producto, id_talla, cantidad) VALUES (?, ?, ?)', 
            [id_producto, id_talla, cantidad]);

        res.status(201).json({ mensaje: 'Producto-Talla creado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear la combinación de producto y talla' });
    }
};

exports.actualizarProductoTalla = async (req, res) => {
    try {
        const { id } = req.params;
        const { cantidad } = req.body;

        if (cantidad === undefined) {
            return res.status(400).json({ error: 'El campo cantidad es obligatorio' });
        }

        const [result] = await db.query(
            'UPDATE producto_talla SET cantidad = ? WHERE id = ?', 
            [cantidad, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto-Talla no encontrado' });
        }

        res.json({ mensaje: 'Cantidad actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar la cantidad' });
    }
};

exports.eliminarProductoTalla = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM producto_talla WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto-Talla no encontrado' });
        }

        res.json({ mensaje: 'Producto-Talla eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la combinación de producto y talla' });
    }
};
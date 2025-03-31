const db = require('../db');

exports.obtenerProductos = async (req, res) => {
    try {
        const [productos] = await db.query(`
            SELECT producto.*, marca.marca 
            FROM producto 
            INNER JOIN marca ON producto.id_marca = marca.id
        `);
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
};

exports.obtenerProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const [producto] = await db.query(`
            SELECT producto.*, marca.marca 
            FROM producto 
            INNER JOIN marca ON producto.id_marca = marca.id 
            WHERE producto.id = ?
        `, [id]);

        if (producto.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(producto[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el producto' });
    }
};

exports.crearProducto = async (req, res) => {
    try {
        const { nombre, valor, id_marca, color, estado } = req.body;

        if (!nombre || !valor || !id_marca || estado === undefined) {
            return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos' });
        }

        const [marcaExiste] = await db.query('SELECT id FROM marca WHERE id = ?', [id_marca]);
        if (marcaExiste.length === 0) {
            return res.status(400).json({ error: 'Marca no válida' });
        }

        await db.query('INSERT INTO producto (nombre, valor, id_marca, color, estado) VALUES (?, ?, ?, ?, ?)', 
            [nombre, valor, id_marca, color, estado]);

        res.status(201).json({ mensaje: 'Producto creado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear el producto' });
    }
};

exports.actualizarProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, valor, id_marca, color, estado } = req.body;

        if (!nombre || !valor || !id_marca || estado === undefined) {
            return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos' });
        }

        const [marcaExiste] = await db.query('SELECT id FROM marca WHERE id = ?', [id_marca]);
        if (marcaExiste.length === 0) {
            return res.status(400).json({ error: 'Marca no válida' });
        }

        const [result] = await db.query(
            'UPDATE producto SET nombre = ?, valor = ?, id_marca = ?, color = ?, estado = ? WHERE id = ?', 
            [nombre, valor, id_marca, color, estado, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ mensaje: 'Producto actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el producto' });
    }
};

exports.eliminarProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM producto WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar el producto' });
    }
};
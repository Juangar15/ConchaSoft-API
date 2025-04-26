const db = require('../db');

// Obtener todos los productos con sus tallas
exports.obtenerProductos = async (req, res) => {
    try {
        const [productos] = await db.query(`
            SELECT producto.*, marca.marca 
            FROM producto 
            INNER JOIN marca ON producto.id_marca = marca.id
        `);

        for (const producto of productos) {
            const [tallas] = await db.query(`
                SELECT talla.id_talla, talla.talla AS nombre, producto_talla.cantidad AS stock
                FROM producto_talla
                INNER JOIN talla ON producto_talla.id_talla = talla.id_talla
                WHERE producto_talla.id_producto = ?
            `, [producto.id]);
            producto.tallasDisponibles = tallas;
        }

        res.json(productos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
};

// Obtener un solo producto por ID con sus tallas
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

        const productoData = producto[0];

        const [tallas] = await db.query(`
            SELECT talla.id_talla, talla.talla AS nombre, producto_talla.cantidad AS stock
            FROM producto_talla
            INNER JOIN talla ON producto_talla.id_talla = talla.id_talla
            WHERE producto_talla.id_producto = ?
        `, [id]);

        productoData.tallasDisponibles = tallas;
        res.json(productoData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el producto con tallas' });
    }
};

// Crear un producto
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

// Actualizar producto
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

// Eliminar producto
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
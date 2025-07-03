const db = require('../db');

// Función auxiliar para obtener las tallas y colores de un producto
const obtenerTallasYColoresProducto = async (id_producto) => {
    const [tallasYColores] = await db.query(`
        SELECT
            producto_talla.id AS id_producto_talla,
            talla.id_talla,
            talla.talla AS nombre_talla,
            producto_talla.color,
            producto_talla.cantidad AS stock
        FROM producto_talla
        INNER JOIN talla ON producto_talla.id_talla = talla.id_talla
        WHERE producto_talla.id_producto = ?
    `, [id_producto]);
    return tallasYColores;
};

// ---
// Obtener todos los productos con sus tallas y colores
// ---
exports.obtenerProductos = async (req, res) => {
    try {
        const [productos] = await db.query(`
            SELECT producto.id, producto.nombre, producto.valor, producto.estado, marca.marca AS nombre_marca
            FROM producto
            INNER JOIN marca ON producto.id_marca = marca.id
            ORDER BY producto.nombre ASC
        `);

        for (const producto of productos) {
            producto.variantes = await obtenerTallasYColoresProducto(producto.id);
        }

        res.json(productos);
    } catch (error) {
        ('Error al obtener los productos:', error);
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
};

// ---
// Obtener un solo producto por ID con sus tallas y colores
// ---
exports.obtenerProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const [producto] = await db.query(`
            SELECT producto.id, producto.nombre, producto.valor, producto.estado, marca.marca AS nombre_marca
            FROM producto
            INNER JOIN marca ON producto.id_marca = marca.id
            WHERE producto.id = ?
        `, [id]);

        if (producto.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const productoData = producto[0];
        productoData.variantes = await obtenerTallasYColoresProducto(id);

        res.json(productoData);
    } catch (error) {
        ('Error al obtener el producto:', error);
        res.status(500).json({ error: 'Error al obtener el producto con tallas y colores' });
    }
};

// ---
// Crear un producto y sus variantes (tallas y colores)
// ---
exports.crearProducto = async (req, res) => {
    try {
        const { nombre, valor, id_marca, estado, tallasYColores } = req.body; // 'tallasYColores' es el nuevo array

        if (!nombre || valor === undefined || !id_marca || estado === undefined || !Array.isArray(tallasYColores)) {
            return res.status(400).json({ error: 'Faltan campos obligatorios o el formato de variantes es incorrecto (debe ser un array).' });
        }

        if (tallasYColores.length === 0) {
             return res.status(400).json({ error: 'Se debe especificar al menos una talla y color para el producto.' });
        }

        const [marcaExiste] = await db.query('SELECT id FROM marca WHERE id = ?', [id_marca]);
        if (marcaExiste.length === 0) {
            return res.status(400).json({ error: 'Marca no válida' });
        }

        // Iniciar transacción para asegurar atomicidad
        await db.query('START TRANSACTION');

        const [resultProducto] = await db.query(
            'INSERT INTO producto (nombre, valor, id_marca, estado) VALUES (?, ?, ?, ?)',
            [nombre, valor, id_marca, estado]
        );

        const id_producto_creado = resultProducto.insertId;

        // Insertar cada variante de talla y color
        for (const variante of tallasYColores) {
            const { id_talla, color, cantidad } = variante;

            if (id_talla === undefined || !color || cantidad === undefined) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Cada variante debe tener id_talla, color y cantidad.' });
            }

            const [tallaExiste] = await db.query('SELECT id_talla FROM talla WHERE id_talla = ?', [id_talla]);
            if (tallaExiste.length === 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: `Talla con ID ${id_talla} no válida.` });
            }

            // Usamos REPLACE INTO para manejar si la combinación ya existe (actualizar) o no (insertar)
            // Esto es útil si envías un producto completo y quieres que actualice si ya existe una combinación
            // O INSERT IGNORE si solo quieres insertar nuevas y omitir duplicados
            await db.query(
                'INSERT INTO producto_talla (id_producto, id_talla, color, cantidad) VALUES (?, ?, ?, ?)',
                [id_producto_creado, id_talla, color, cantidad]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ mensaje: 'Producto y sus variantes creados correctamente', id: id_producto_creado });

    } catch (error) {
        await db.query('ROLLBACK'); // Revertir la transacción en caso de error
        ('Error al crear el producto:', error);
        // Manejo de errores específicos si es necesario, ej. duplicado
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ya existe una combinación de producto, talla y color. Si deseas actualizarla, usa la función de actualizar.' });
        }
        res.status(500).json({ error: 'Error al crear el producto' });
    }
};

// ---
// Actualizar producto y sus variantes (tallas y colores)
// ---
exports.actualizarProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, valor, id_marca, estado, tallasYColores } = req.body;

        if (!nombre || valor === undefined || !id_marca || estado === undefined || !Array.isArray(tallasYColores)) {
            return res.status(400).json({ error: 'Faltan campos obligatorios o el formato de variantes es incorrecto (debe ser un array).' });
        }

        if (tallasYColores.length === 0) {
             return res.status(400).json({ error: 'Se debe especificar al menos una talla y color para el producto.' });
        }

        const [marcaExiste] = await db.query('SELECT id FROM marca WHERE id = ?', [id_marca]);
        if (marcaExiste.length === 0) {
            return res.status(400).json({ error: 'Marca no válida' });
        }

        // Verificar si el producto existe
        const [productoExistente] = await db.query('SELECT id FROM producto WHERE id = ?', [id]);
        if (productoExistente.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Iniciar transacción
        await db.query('START TRANSACTION');

        // Actualizar datos del producto principal
        await db.query(
            'UPDATE producto SET nombre = ?, valor = ?, id_marca = ?, estado = ? WHERE id = ?',
            [nombre, valor, id_marca, estado, id]
        );

        // Opcional: Eliminar todas las variantes existentes para el producto y reinsertarlas
        // Esto simplifica la lógica si siempre envías el conjunto completo de variantes
        await db.query('DELETE FROM producto_talla WHERE id_producto = ?', [id]);

        // Insertar/actualizar cada variante de talla y color
        for (const variante of tallasYColores) {
            const { id_talla, color, cantidad } = variante;

            if (id_talla === undefined || !color || cantidad === undefined) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Cada variante debe tener id_talla, color y cantidad.' });
            }

            const [tallaExiste] = await db.query('SELECT id_talla FROM talla WHERE id_talla = ?', [id_talla]);
            if (tallaExiste.length === 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: `Talla con ID ${id_talla} no válida.` });
            }

            // INSERT ... ON DUPLICATE KEY UPDATE es más robusto si no borras todas las variantes
            // Pero como borramos arriba, un INSERT simple es suficiente aquí.
            await db.query(
                'INSERT INTO producto_talla (id_producto, id_talla, color, cantidad) VALUES (?, ?, ?, ?)',
                [id, id_talla, color, cantidad]
            );
        }

        await db.query('COMMIT');
        res.json({ mensaje: 'Producto y sus variantes actualizados correctamente' });

    } catch (error) {
        await db.query('ROLLBACK'); // Revertir la transacción en caso de error
        ('Error al actualizar el producto:', error);
        // Puedes agregar manejo de errores específicos aquí si es necesario
        res.status(500).json({ error: 'Error al actualizar el producto' });
    }
};

// ---
// Eliminar producto
// ---
exports.eliminarProducto = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query('DELETE FROM producto WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        ('Error al eliminar el producto:', error);
        res.status(500).json({ error: 'Error al eliminar el producto' });
    }
};

// ---
// Gestión de variantes de producto (Si quieres endpoints separados para agregar/actualizar/eliminar variantes)
// Estos podrían ser útiles si quieres un control más granular sin actualizar el producto base
// ---

// Añadir una nueva variante (talla y color) a un producto existente
exports.agregarVarianteProducto = async (req, res) => {
    try {
        const { id_producto } = req.params; // ID del producto al que se añade la variante
        const { id_talla, color, cantidad } = req.body;

        if (id_talla === undefined || !color || cantidad === undefined) {
            return res.status(400).json({ error: 'Se requieren id_talla, color y cantidad para la variante.' });
        }

        const [productoExiste] = await db.query('SELECT id FROM producto WHERE id = ?', [id_producto]);
        if (productoExiste.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado para agregar la variante.' });
        }

        const [tallaExiste] = await db.query('SELECT id_talla FROM talla WHERE id_talla = ?', [id_talla]);
        if (tallaExiste.length === 0) {
            return res.status(400).json({ error: `Talla con ID ${id_talla} no válida.` });
        }

        // INSERT IGNORE si quieres que simplemente falle en caso de duplicado sin error 500
        // O INSERT ... ON DUPLICATE KEY UPDATE si quieres que actualice la cantidad si la combinación ya existe
        const [result] = await db.query(
            'INSERT INTO producto_talla (id_producto, id_talla, color, cantidad) VALUES (?, ?, ?, ?)',
            [id_producto, id_talla, color, cantidad]
        );

        res.status(201).json({ mensaje: 'Variante de producto agregada correctamente.' });

    } catch (error) {
        ('Error al agregar variante de producto:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Esta combinación de talla y color ya existe para este producto.' });
        }
        res.status(500).json({ error: 'Error al agregar variante de producto.' });
    }
};

// Actualizar cantidad o color de una variante existente
exports.actualizarVarianteProducto = async (req, res) => {
    try {
        const { id_producto, id_talla_antigua, color_antiguo } = req.params; // Clave primaria compuesta antigua
        const { id_talla_nueva, color_nuevo, cantidad } = req.body; // Nuevos valores y cantidad

        // Validación básica
        if (id_talla_nueva === undefined || !color_nuevo || cantidad === undefined) {
            return res.status(400).json({ error: 'Se requieren id_talla_nueva, color_nuevo y cantidad.' });
        }

        // Verificar que la nueva talla sea válida
        const [tallaExiste] = await db.query('SELECT id_talla FROM talla WHERE id_talla = ?', [id_talla_nueva]);
        if (tallaExiste.length === 0) {
            return res.status(400).json({ error: `Nueva talla con ID ${id_talla_nueva} no válida.` });
        }

        await db.query('START TRANSACTION');

        // Opción 1: Borrar y Reinsertar (más simple para cambios de PK)
        const [deleteResult] = await db.query(
            'DELETE FROM producto_talla WHERE id_producto = ? AND id_talla = ? AND color = ?',
            [id_producto, id_talla_antigua, color_antiguo]
        );

        if (deleteResult.affectedRows === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Variante de producto no encontrada.' });
        }

        const [insertResult] = await db.query(
            'INSERT INTO producto_talla (id_producto, id_talla, color, cantidad) VALUES (?, ?, ?, ?)',
            [id_producto, id_talla_nueva, color_nuevo, cantidad]
        );
        
        await db.query('COMMIT');
        res.json({ mensaje: 'Variante de producto actualizada correctamente.' });

    } catch (error) {
        await db.query('ROLLBACK');
        ('Error al actualizar variante de producto:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'La nueva combinación de talla y color ya existe para este producto.' });
        }
        res.status(500).json({ error: 'Error al actualizar variante de producto.' });
    }
};

// Eliminar una variante (talla y color) de un producto
exports.eliminarVarianteProducto = async (req, res) => {
    try {
        const { id_producto, id_talla, color } = req.params;

        const [result] = await db.query(
            'DELETE FROM producto_talla WHERE id_producto = ? AND id_talla = ? AND color = ?',
            [id_producto, id_talla, color]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Variante de producto no encontrada.' });
        }

        res.json({ mensaje: 'Variante de producto eliminada correctamente.' });
    } catch (error) {
        ('Error al eliminar variante de producto:', error);
        res.status(500).json({ error: 'Error al eliminar variante de producto.' });
    }
};
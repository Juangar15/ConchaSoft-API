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
        console.error('Error al obtener los productos:', error); // Usar console.error para errores
        res.status(500).json({ error: 'Error al obtener los productos' });
    }
};

// ---
// NUEVO ENDPOINT: Obtener solo productos activos (estado = 1)
// ---
exports.obtenerProductosActivos = async (req, res) => {
    try {
        const [productos] = await db.query(`
            SELECT producto.id, producto.nombre, producto.valor, producto.estado, marca.marca AS nombre_marca
            FROM producto
            INNER JOIN marca ON producto.id_marca = marca.id
            WHERE producto.estado = 1
            ORDER BY producto.nombre ASC
        `);

        for (const producto of productos) {
            producto.variantes = await obtenerTallasYColoresProducto(producto.id);
        }

        res.json(productos);
    } catch (error) {
        console.error('Error al obtener los productos activos:', error);
        res.status(500).json({ error: 'Error al obtener los productos activos' });
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
        console.error('Error al obtener el producto:', error);
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
            const { id_talla, color, cantidad } = variante; // Cantidad aquí se inicializará a 0 desde el frontend

            // Validar que id_talla y color existan. La cantidad, como viene del frontend, ya debería ser 0.
            if (id_talla === undefined || !color || cantidad === undefined) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Cada variante debe tener id_talla, color y cantidad.' });
            }

            const [tallaExiste] = await db.query('SELECT id_talla FROM talla WHERE id_talla = ?', [id_talla]);
            if (tallaExiste.length === 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: `Talla con ID ${id_talla} no válida.` });
            }

            await db.query(
                'INSERT INTO producto_talla (id_producto, id_talla, color, cantidad) VALUES (?, ?, ?, ?)',
                [id_producto_creado, id_talla, color, cantidad]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ mensaje: 'Producto y sus variantes creados correctamente', id: id_producto_creado });

    } catch (error) {
        await db.query('ROLLBACK'); // Revertir la transacción en caso de error
        console.error('Error al crear el producto:', error);
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

        // --- Nueva lógica: No permitir desactivar si hay stock ---
        if (estado === 0) { // Si se intenta desactivar el producto
            const [stockResult] = await db.query(
                'SELECT SUM(cantidad) AS total_stock FROM producto_talla WHERE id_producto = ?',
                [id]
            );
            const totalStock = stockResult[0].total_stock || 0;

            if (totalStock > 0) {
                return res.status(400).json({ error: 'No se puede desactivar el producto si tiene stock disponible en alguna de sus variantes.' });
            }
        }
        // --- Fin de nueva lógica ---

        // Iniciar transacción
        await db.query('START TRANSACTION');

        // Actualizar datos del producto principal
        await db.query(
            'UPDATE producto SET nombre = ?, valor = ?, id_marca = ?, estado = ? WHERE id = ?',
            [nombre, valor, id_marca, estado, id]
        );

        // Obtener las variantes actuales del producto para comparar
        const variantesActuales = await obtenerTallasYColoresProducto(id);
        const variantesActualesMap = new Map();
        variantesActuales.forEach(v => {
            variantesActualesMap.set(`${v.id_talla}-${v.color}`, v);
        });

        const variantesAProcesar = []; // Para acumular las variantes a insertar/actualizar
        const variantesAEliminar = new Set(variantesActuales.map(v => `${v.id_talla}-${v.color}`));

        for (const varianteEnviada of tallasYColores) {
            const { id_talla, color } = varianteEnviada;

            if (id_talla === undefined || !color) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Cada variante debe tener id_talla y color.' });
            }

            const [tallaExiste] = await db.query('SELECT id_talla FROM talla WHERE id_talla = ?', [id_talla]);
            if (tallaExiste.length === 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: `Talla con ID ${id_talla} no válida.` });
            }

            const key = `${id_talla}-${color}`;
            // Si la variante enviada ya existe, eliminamos su clave de las que hay que eliminar
            if (variantesAEliminar.has(key)) {
                variantesAEliminar.delete(key);
            }
            // Agregamos la variante enviada para ser procesada (insertada o actualizada)
            // La 'cantidad' aquí será el stock *actual* del backend, no la que envía el frontend al editar
            const existingVariant = variantesActualesMap.get(key);
            variantesAProcesar.push({
                id_talla: id_talla,
                color: color,
                // Si la variante ya existe, mantenemos su stock. Si es nueva, stock es 0.
                cantidad: existingVariant ? existingVariant.stock : 0
            });
        }

        // Eliminar variantes que ya no están en la lista enviada
        for (const key of variantesAEliminar) {
            const [id_talla, color] = key.split('-');
            // Verificar si la variante a eliminar tiene stock > 0
            const [stockVariante] = await db.query(
                'SELECT cantidad FROM producto_talla WHERE id_producto = ? AND id_talla = ? AND color = ?',
                [id, parseInt(id_talla), color]
            );

            if (stockVariante.length > 0 && stockVariante[0].cantidad > 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: `No se puede eliminar la variante (Talla: ${tallasDisponibles.find(t=>t.id_talla===parseInt(id_talla))?.talla}, Color: ${color}) porque tiene stock disponible.` });
            }
            await db.query(
                'DELETE FROM producto_talla WHERE id_producto = ? AND id_talla = ? AND color = ?',
                [id, parseInt(id_talla), color]
            );
        }

        // Insertar o actualizar las variantes de la lista enviada
        for (const variante of variantesAProcesar) {
            await db.query(
                'INSERT INTO producto_talla (id_producto, id_talla, color, cantidad) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE cantidad = VALUES(cantidad)',
                [id, variante.id_talla, variante.color, variante.cantidad]
            );
        }

        await db.query('COMMIT');
        res.json({ mensaje: 'Producto y sus variantes actualizados correctamente' });

    } catch (error) {
        await db.query('ROLLBACK'); // Revertir la transacción en caso de error
        console.error('Error al actualizar el producto:', error);
        res.status(500).json({ error: 'Error al actualizar el producto' });
    }
};

// ---
// Eliminar producto
// ---
exports.eliminarProducto = async (req, res) => {
    try {
        const { id } = req.params;

        // Primero, verificar si el producto tiene stock en alguna de sus variantes
        const [stockResult] = await db.query(
            'SELECT SUM(cantidad) AS total_stock FROM producto_talla WHERE id_producto = ?',
            [id]
        );
        const totalStock = stockResult[0].total_stock || 0;

        if (totalStock > 0) {
            return res.status(400).json({ error: 'No se puede eliminar el producto si tiene stock disponible.' });
        }

        // Si no hay stock, eliminar primero las variantes asociadas (CASCADE DELETE si está configurado en DB)
        // Aunque no se muestra aquí, se asume que tu DB tiene ON DELETE CASCADE en producto_talla
        // o que lo manejarías explícitamente aquí: await db.query('DELETE FROM producto_talla WHERE id_producto = ?', [id]);

        const [result] = await db.query('DELETE FROM producto WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar el producto:', error);
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
        const { id_talla, color, cantidad } = req.body; // Cantidad aquí será el stock inicial para esta variante

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

        const [result] = await db.query(
            'INSERT INTO producto_talla (id_producto, id_talla, color, cantidad) VALUES (?, ?, ?, ?)',
            [id_producto, id_talla, color, cantidad]
        );

        res.status(201).json({ mensaje: 'Variante de producto agregada correctamente.' });

    } catch (error) {
        console.error('Error al agregar variante de producto:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Esta combinación de talla y color ya existe para este producto.' });
        }
        res.status(500).json({ error: 'Error al agregar variante de producto.' });
    }
};

// Actualizar cantidad o color de una variante existente
// NOTA: Este endpoint no debería usarse para actualizar STOCK, solo para cambiar la TALLA/COLOR de una variante existente.
// La actualización de stock debe venir de transacciones de inventario (compras/ventas/ajustes).
exports.actualizarVarianteProducto = async (req, res) => {
    try {
        const { id_producto, id_talla_antigua, color_antiguo } = req.params; // Clave primaria compuesta antigua
        const { id_talla_nueva, color_nuevo, cantidad } = req.body; // Nuevos valores y la cantidad actual

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

        // Obtener el stock actual de la variante que se va a modificar
        const [currentVariant] = await db.query(
            'SELECT cantidad FROM producto_talla WHERE id_producto = ? AND id_talla = ? AND color = ?',
            [id_producto, id_talla_antigua, color_antiguo]
        );

        if (currentVariant.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Variante de producto no encontrada.' });
        }

        const currentStock = currentVariant[0].cantidad;

        // 1. Eliminar la variante antigua
        const [deleteResult] = await db.query(
            'DELETE FROM producto_talla WHERE id_producto = ? AND id_talla = ? AND color = ?',
            [id_producto, id_talla_antigua, color_antiguo]
        );

        if (deleteResult.affectedRows === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Variante de producto no encontrada o no se pudo eliminar.' });
        }

        // 2. Insertar la nueva variante con el STOCK ANTIGUO
        const [insertResult] = await db.query(
            'INSERT INTO producto_talla (id_producto, id_talla, color, cantidad) VALUES (?, ?, ?, ?)',
            [id_producto, id_talla_nueva, color_nuevo, currentStock] // Usa el stock que tenía la variante, no lo que viene en el body
        );

        await db.query('COMMIT');
        res.json({ mensaje: 'Variante de producto actualizada correctamente.' });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error al actualizar variante de producto:', error);
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

        // Verificar si la variante tiene stock antes de eliminarla
        const [varianteStock] = await db.query(
            'SELECT cantidad FROM producto_talla WHERE id_producto = ? AND id_talla = ? AND color = ?',
            [id_producto, id_talla, color]
        );

        if (varianteStock.length === 0) {
            return res.status(404).json({ error: 'Variante de producto no encontrada.' });
        }

        if (varianteStock[0].cantidad > 0) {
            return res.status(400).json({ error: 'No se puede eliminar la variante si tiene stock disponible.' });
        }

        const [result] = await db.query(
            'DELETE FROM producto_talla WHERE id_producto = ? AND id_talla = ? AND color = ?',
            [id_producto, id_talla, color]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Variante de producto no encontrada después de la verificación.' });
        }

        res.json({ mensaje: 'Variante de producto eliminada correctamente.' });
    } catch (error) {
        console.error('Error al eliminar variante de producto:', error);
        res.status(500).json({ error: 'Error al eliminar variante de producto.' });
    }
};

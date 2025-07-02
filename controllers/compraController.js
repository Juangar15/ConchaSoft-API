const db = require('../db');

// compController.js (mejorado para obtener detalles)

exports.obtenerCompras = async (req, res) => {
    try {
        const [compras] = await db.query(`
            SELECT 
                c.id, c.fecha, c.tipo_pago, c.total, c.estado, 
                p.id AS id_proveedor, p.nombre_comercial AS nombre_proveedor, p.razon_social AS razon_social_proveedor
            FROM compra c
            INNER JOIN proveedor p ON c.id_proveedor = p.id
            ORDER BY c.fecha DESC
        `);

        // Opcional: Podrías cargar los detalles de los productos para cada compra aquí
        // Esto puede ser ineficiente si hay muchas compras. Mejor si el detalle se carga en obtenerCompra (singular).
        // For example:
        // for (const compra of compras) {
        // compra.items = await db.query(`
        // SELECT 
        // cp.cantidad, cp.precio_unitario, cp.subtotal,
        // prod.id AS id_producto, prod.nombre AS nombre_producto, prod.valor AS valor_unitario_producto,
        // t.id_talla, t.talla AS nombre_talla,
        // pt.color
        // FROM compra_prod cp
        // INNER JOIN producto_talla pt ON cp.id_producto_talla = pt.id
        // INNER JOIN producto prod ON pt.id_producto = prod.id
        // INNER JOIN talla t ON pt.id_talla = t.id_talla
        // WHERE cp.id_compra = ?
        // `, [compra.id]);
        // }

        res.json(compras);
    } catch (error) {
        console.error('Error al obtener las compras:', error);
        res.status(500).json({ error: 'Error al obtener las compras' });
    }
};

exports.obtenerCompra = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Obtener la cabecera de la compra
        const [compra] = await db.query(`
            SELECT 
                c.id, c.fecha, c.tipo_pago, c.total, c.estado, 
                p.id AS id_proveedor, p.nombre_comercial AS nombre_proveedor, p.razon_social AS razon_social_proveedor, p.documento AS documento_proveedor
            FROM compra c
            INNER JOIN proveedor p ON c.id_proveedor = p.id
            WHERE c.id = ?
        `, [id]);

        if (compra.length === 0) {
            return res.status(404).json({ error: 'Compra no encontrada' });
        }

        const compraData = compra[0];

        // Obtener los detalles de los productos de la compra
        const [items] = await db.query(`
            SELECT 
                cp.id AS id_compra_prod_item, cp.cantidad, cp.precio_unitario, cp.subtotal,
                prod.id AS id_producto, prod.nombre AS nombre_producto, prod.valor AS valor_unitario_actual_producto,
                t.id_talla, t.talla AS nombre_talla,
                pt.color, pt.id AS id_producto_talla // Incluir id_producto_talla para referencia
            FROM compra_prod cp
            INNER JOIN producto_talla pt ON cp.id_producto_talla = pt.id
            INNER JOIN producto prod ON pt.id_producto = prod.id
            INNER JOIN talla t ON pt.id_talla = t.id_talla
            WHERE cp.id_compra = ?
        `, [id]);

        compraData.items = items;

        res.json(compraData);
    } catch (error) {
        console.error('Error al obtener la compra:', error);
        res.status(500).json({ error: 'Error al obtener la compra' });
    }
};


// compController.js (modificado para crear una compra completa)

exports.crearCompraCompleta = async (req, res) => {
    const connection = await db.getConnection(); // Obtener una conexión de pool para transacciones
    try {
        await connection.beginTransaction(); // Iniciar la transacción

        const { fecha, tipo_pago, estado, id_proveedor, productosComprados } = req.body;

        // Validaciones iniciales
        if (!fecha || !tipo_pago || !estado || !id_proveedor || !Array.isArray(productosComprados) || productosComprados.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Faltan campos obligatorios o el formato de productosComprados es incorrecto.' });
        }

        const [proveedorExiste] = await connection.query('SELECT id FROM proveedor WHERE id = ?', [id_proveedor]);
        if (proveedorExiste.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Proveedor no válido.' });
        }

        // 1. Insertar la cabecera de la compra
        const [resultCompra] = await connection.query(
            'INSERT INTO compra (fecha, tipo_pago, total, estado, id_proveedor) VALUES (?, ?, ?, ?, ?)',
            [fecha, tipo_pago, 0, estado, id_proveedor] // Inicialmente total 0, se actualizará después
        );
        const id_compra_creada = resultCompra.insertId;

        let totalGeneralCompra = 0;

        // 2. Insertar los productos de la compra y actualizar el stock
        for (const item of productosComprados) {
            const { id_producto, id_talla, color, cantidad, precio_unitario } = item; // Ahora recibimos id_producto, id_talla, color

            if (id_producto === undefined || id_talla === undefined || !color || cantidad === undefined || precio_unitario === undefined) {
                await connection.rollback();
                return res.status(400).json({ error: 'Cada ítem de compra debe tener id_producto, id_talla, color, cantidad y precio_unitario.' });
            }

            // A. Encontrar el id_producto_talla basado en id_producto, id_talla y color
            const [productoTallaExistente] = await connection.query(
                `SELECT id FROM producto_talla WHERE id_producto = ? AND id_talla = ? AND color = ?`,
                [id_producto, id_talla, color]
            );

            if (productoTallaExistente.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: `La variante de producto (ID Producto: ${id_producto}, Talla: ${id_talla}, Color: ${color}) no existe. `});
            }
            const id_producto_talla = productoTallaExistente[0].id;

            const subtotalItem = cantidad * precio_unitario;
            totalGeneralCompra += subtotalItem;

            // B. Insertar en compra_prod
            await connection.query(
                'INSERT INTO compra_prod (id_compra, id_producto_talla, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                [id_compra_creada, id_producto_talla, cantidad, precio_unitario, subtotalItem]
            );

            // C. Actualizar el stock en producto_talla (incrementar la cantidad)
            await connection.query(
                `UPDATE producto_talla SET cantidad = cantidad + ? WHERE id = ?`,
                [cantidad, id_producto_talla]
            );
        }

        // 3. Actualizar el total en la cabecera de la compra
        await connection.query(
            'UPDATE compra SET total = ? WHERE id = ?',
            [totalGeneralCompra, id_compra_creada]
        );

        await connection.commit(); // Confirmar la transacción
        res.status(201).json({ mensaje: 'Compra creada correctamente y stock actualizado.', id_compra: id_compra_creada });

    } catch (error) {
        await connection.rollback(); // Revertir la transacción en caso de error
        console.error('Error al crear la compra completa:', error);
        res.status(500).json({ error: 'Error al crear la compra completa y actualizar stock.' });
    } finally {
        if (connection) connection.release(); // Liberar la conexión al pool
    }
};

// compController.js (adición para actualizar una compra completa)

exports.actualizarCompraCompleta = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id: id_compra_a_actualizar } = req.params;
        const { fecha, tipo_pago, estado, id_proveedor, productosComprados } = req.body;

        // 1. Validar que la compra exista
        const [compraExistente] = await connection.query('SELECT * FROM compra WHERE id = ?', [id_compra_a_actualizar]);
        if (compraExistente.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Compra no encontrada para actualizar.' });
        }

        // Validaciones de proveedor si es necesario
        if (id_proveedor) { // Si id_proveedor se envía, validar
            const [proveedorExiste] = await connection.query('SELECT id FROM proveedor WHERE id = ?', [id_proveedor]);
            if (proveedorExiste.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'Proveedor no válido.' });
            }
        }

        // 2. Obtener los ítems actuales de la compra
        const [currentItems] = await connection.query(
            `SELECT id, id_producto_talla, cantidad, precio_unitario, subtotal FROM compra_prod WHERE id_compra = ?`,
            [id_compra_a_actualizar]
        );
        const currentItemsMap = new Map();
        currentItems.forEach(item => {
            currentItemsMap.set(item.id_producto_talla, item);
        });

        const newItemsMap = new Map();
        if (Array.isArray(productosComprados)) {
            for (const item of productosComprados) {
                 const { id_producto, id_talla, color, cantidad, precio_unitario } = item;

                if (id_producto === undefined || id_talla === undefined || !color || cantidad === undefined || precio_unitario === undefined) {
                    await connection.rollback();
                    return res.status(400).json({ error: 'Cada ítem de compra debe tener id_producto, id_talla, color, cantidad y precio_unitario.' });
                }

                const [productoTallaExistente] = await connection.query(
                    `SELECT id FROM producto_talla WHERE id_producto = ? AND id_talla = ? AND color = ?`,
                    [id_producto, id_talla, color]
                );

                if (productoTallaExistente.length === 0) {
                    await connection.rollback();
                    return res.status(400).json({ error: `La variante de producto (ID Producto: ${id_producto}, Talla: ${id_talla}, Color: ${color}) no existe.` });
                }
                const id_producto_talla = productoTallaExistente[0].id;
                newItemsMap.set(id_producto_talla, { ...item, id_producto_talla });
            }
        }

        let totalGeneralCompra = 0;

        // 3. Procesar ítems: eliminaciones, actualizaciones y adiciones
        // A. Ítems eliminados (están en currentItems pero no en newItems)
        for (const [id_pt, currentItem] of currentItemsMap.entries()) {
            if (!newItemsMap.has(id_pt)) {
                // Restaurar stock
                await connection.query(
                    `UPDATE producto_talla SET cantidad = cantidad - ? WHERE id = ?`,
                    [currentItem.cantidad, currentItem.id_producto_talla]
                );
                // Eliminar de compra_prod
                await connection.query(
                    `DELETE FROM compra_prod WHERE id = ?`,
                    [currentItem.id] // Usar el ID de la fila de compra_prod para eliminar
                );
            }
        }

        // B. Ítems nuevos o actualizados
        for (const [id_pt, newItem] of newItemsMap.entries()) {
            const currentItem = currentItemsMap.get(id_pt);

            const subtotalItem = newItem.cantidad * newItem.precio_unitario;
            totalGeneralCompra += subtotalItem; // Sumar para el nuevo total

            if (currentItem) {
                // Ítem existente, actualizar si cambió la cantidad o precio_unitario
                if (currentItem.cantidad !== newItem.cantidad || currentItem.precio_unitario !== newItem.precio_unitario) {
                    const stockDiff = newItem.cantidad - currentItem.cantidad;
                    await connection.query(
                        `UPDATE producto_talla SET cantidad = cantidad + ? WHERE id = ?`,
                        [stockDiff, newItem.id_producto_talla]
                    );
                    await connection.query(
                        `UPDATE compra_prod SET cantidad = ?, precio_unitario = ?, subtotal = ? WHERE id_compra = ? AND id_producto_talla = ?`,
                        [newItem.cantidad, newItem.precio_unitario, subtotalItem, id_compra_a_actualizar, newItem.id_producto_talla]
                    );
                }
            } else {
                // Ítem nuevo, insertar y agregar stock
                await connection.query(
                    `INSERT INTO compra_prod (id_compra, id_producto_talla, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)`,
                    [id_compra_a_actualizar, newItem.id_producto_talla, newItem.cantidad, newItem.precio_unitario, subtotalItem]
                );
                await connection.query(
                    `UPDATE producto_talla SET cantidad = cantidad + ? WHERE id = ?`,
                    [newItem.cantidad, newItem.id_producto_talla]
                );
            }
        }

        // 4. Actualizar la cabecera de la compra (incluyendo el nuevo total)
        const updateFields = { total: totalGeneralCompra };
        if (fecha) updateFields.fecha = fecha;
        if (tipo_pago) updateFields.tipo_pago = tipo_pago;
        if (estado) updateFields.estado = estado;
        if (id_proveedor) updateFields.id_proveedor = id_proveedor;

        const updateQueryParts = Object.keys(updateFields).map(key => `${key} = ?`);
        const updateValues = Object.values(updateFields);

        await connection.query(
            `UPDATE compra SET ${updateQueryParts.join(', ')} WHERE id = ?`,
            [...updateValues, id_compra_a_actualizar]
        );

        await connection.commit();
        res.json({ mensaje: 'Compra actualizada correctamente y stock ajustado.' });

    } catch (error) {
        await connection.rollback();
        console.error('Error al actualizar la compra completa:', error);
        res.status(500).json({ error: 'Error al actualizar la compra completa y ajustar stock.' });
    } finally {
        if (connection) connection.release();
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
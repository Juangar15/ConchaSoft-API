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
                cp.id_compra AS id_compra_prod_item, cp.cantidad, cp.precio_unitario, cp.subtotal,
                prod.id AS id_producto, prod.nombre AS nombre_producto, prod.valor AS valor_unitario_actual_producto,
                t.id_talla, t.talla AS nombre_talla,
                pt.color, pt.id AS id_producto_talla
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

        // --- SECCIÓN DE VALIDACIÓN DE PROVEEDOR (ACTUALIZADA) ---
        const [proveedorResult] = await connection.query('SELECT estado FROM proveedor WHERE id = ?', [id_proveedor]);
        
        if (proveedorResult.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'El proveedor seleccionado no existe.' });
        }
        
        const proveedor = proveedorResult[0];
        if (proveedor.estado !== 1) { // Se valida que el estado sea estrictamente 1 (Activo)
            await connection.rollback();
            return res.status(400).json({ error: 'El proveedor seleccionado está inactivo y no puede registrar compras.' });
        }
        // --- FIN DE LA SECCIÓN DE VALIDACIÓN ---

        // 1. Insertar la cabecera de la compra
        const [resultCompra] = await connection.query(
            'INSERT INTO compra (fecha, tipo_pago, total, estado, id_proveedor) VALUES (?, ?, ?, ?, ?)',
            [fecha, tipo_pago, 0, estado, id_proveedor] // Inicialmente total 0, se actualizará después
        );
        const id_compra_creada = resultCompra.insertId;

        let totalGeneralCompra = 0;

        // 2. Insertar los productos de la compra y actualizar el stock
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
                return res.status(400).json({ error: `La variante de producto (ID Producto: ${id_producto}, Talla: ${id_talla}, Color: ${color}) no existe.`});
            }
            const id_producto_talla = productoTallaExistente[0].id;

            const subtotalItem = cantidad * precio_unitario;
            totalGeneralCompra += subtotalItem;

            await connection.query(
                'INSERT INTO compra_prod (id_compra, id_producto_talla, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                [id_compra_creada, id_producto_talla, cantidad, precio_unitario, subtotalItem]
            );

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



exports.actualizarCompraCompleta = async (req, res) => {
    const connection = await db.getConnection(); // Obtener una conexión del pool para transacciones
    try {
        await connection.beginTransaction(); // Iniciar la transacción

        const { id: id_compra_a_actualizar } = req.params;
        const { fecha, tipo_pago, estado, id_proveedor, productosComprados } = req.body;

        // 1. Validar que la compra exista y obtener su estado actual
        const [compraExistenteResult] = await connection.query('SELECT * FROM compra WHERE id = ?', [id_compra_a_actualizar]);
        if (compraExistenteResult.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Compra no encontrada para actualizar.' });
        }
        const compraExistente = compraExistenteResult[0];
        const estadoActualCompra = compraExistente.estado;

        // --- SECCIÓN DE VALIDACIÓN DE PROVEEDOR (NUEVA) ---
        // Si en la petición viene un `id_proveedor` y es diferente al que ya tiene la compra...
        if (id_proveedor !== undefined && id_proveedor !== compraExistente.id_proveedor) {
            const [proveedorResult] = await connection.query('SELECT estado FROM proveedor WHERE id = ?', [id_proveedor]);
            if (proveedorResult.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'El nuevo proveedor seleccionado no existe.' });
            }
            if (proveedorResult[0].estado !== 1) { // Se valida que el estado sea estrictamente 1 (Activo)
                await connection.rollback();
                return res.status(400).json({ error: 'No se puede asignar la compra a un proveedor que está inactivo.' });
            }
        }
        // --- FIN DE LA SECCIÓN DE VALIDACIÓN ---

        // Validar que el 'estado' sea 0 o 1 si se proporciona
        if (estado !== undefined && (estado !== 0 && estado !== 1)) {
            await connection.rollback();
            return res.status(400).json({ error: 'El estado de la compra debe ser 0 (Anulada) o 1 (Completada).' });
        }
        
        // --- Lógica de Manejo de Estado (Anular / Prevenir Des-anulación) ---
        if (estado === 0 && estadoActualCompra === 1) {
            const [itemsToRevert] = await connection.query(
                `SELECT id_producto_talla, cantidad FROM compra_prod WHERE id_compra = ?`,
                [id_compra_a_actualizar]
            );

            for (const item of itemsToRevert) {
                await connection.query(
                    `UPDATE producto_talla SET cantidad = GREATEST(0, cantidad - ?) WHERE id = ?`, // Usar GREATEST para no tener stock negativo
                    [item.cantidad, item.id_producto_talla]
                );
            }
            console.log(`Compra ${id_compra_a_actualizar} anulada y stock revertido.`);

        } else if (estado === 1 && estadoActualCompra === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Una compra anulada no puede ser cambiada a estado "Completada".' });
        }

        // --- Lógica para Actualización de Ítems (solo si la compra está activa/completada y NO se está anulando) ---
        let totalGeneralCompra = compraExistente.total;

        if (estadoActualCompra === 1 && (estado === undefined || estado === 1)) {
            if (Array.isArray(productosComprados)) {
                
                const [currentItems] = await connection.query(
                    `SELECT id_compra, id_producto_talla, cantidad, precio_unitario, subtotal FROM compra_prod WHERE id_compra = ?`,
                    [id_compra_a_actualizar]
                );
                const currentItemsMap = new Map(currentItems.map(item => [item.id_producto_talla, item]));

                const newItemsMap = new Map();
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

                totalGeneralCompra = 0;

                // A. Ítems eliminados
                for (const [id_pt, currentItem] of currentItemsMap.entries()) {
                    if (!newItemsMap.has(id_pt)) {
                        await connection.query(
                            `UPDATE producto_talla SET cantidad = GREATEST(0, cantidad - ?) WHERE id = ?`,
                            [currentItem.cantidad, currentItem.id_producto_talla]
                        );
                        await connection.query(
                            `DELETE FROM compra_prod WHERE id_compra = ? AND id_producto_talla = ?`,
                            [id_compra_a_actualizar, currentItem.id_producto_talla]
                        );
                    }
                }

                // B. Ítems nuevos o actualizados
                for (const [id_pt, newItem] of newItemsMap.entries()) {
                    const currentItem = currentItemsMap.get(id_pt);
                    const subtotalItem = newItem.cantidad * newItem.precio_unitario;
                    totalGeneralCompra += subtotalItem;

                    if (currentItem) { 
                        const stockDiff = newItem.cantidad - currentItem.cantidad;
                        if (stockDiff !== 0) {
                             await connection.query(
                                `UPDATE producto_talla SET cantidad = GREATEST(0, cantidad + ?) WHERE id = ?`,
                                [stockDiff, newItem.id_producto_talla]
                            );
                        }
                        await connection.query(
                            `UPDATE compra_prod SET cantidad = ?, precio_unitario = ?, subtotal = ? WHERE id_compra = ? AND id_producto_talla = ?`,
                            [newItem.cantidad, newItem.precio_unitario, subtotalItem, id_compra_a_actualizar, newItem.id_producto_talla]
                        );
                    } else {
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
            }
        }

        // 4. Actualizar la cabecera de la compra
        const updateFields = {};
        if (fecha !== undefined) updateFields.fecha = fecha;
        if (tipo_pago !== undefined) updateFields.tipo_pago = tipo_pago;
        if (id_proveedor !== undefined) updateFields.id_proveedor = id_proveedor;
        if (estado !== undefined) updateFields.estado = estado;
        
        // Siempre actualiza el total por si los items cambiaron
        updateFields.total = totalGeneralCompra;

        const queryParts = Object.keys(updateFields).map(key => `${key} = ?`);
        const values = Object.values(updateFields);

        if (queryParts.length > 0) {
            await connection.query(
                `UPDATE compra SET ${queryParts.join(', ')} WHERE id = ?`,
                [...values, id_compra_a_actualizar]
            );
        }

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

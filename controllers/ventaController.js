const db = require('../db');

exports.obtenerVentas = async (req, res) => {
    try {
        const [ventas] = await db.query('SELECT * FROM venta');
        res.json(ventas);
    } catch (error) {
        console.error('Error al obtener las ventas:', error);
        res.status(500).json({ error: 'Error al obtener las ventas' });
    }
};

exports.obtenerVenta = async (req, res) => {
    try {
        const { id } = req.params;
        const [venta] = await db.query('SELECT * FROM venta WHERE id = ?', [id]);

        if (venta.length === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }

        const [productosVendidos] = await db.query(`
            SELECT
                vp.cantidad,
                vp.precio_unitario,
                vp.subtotal,
                p.nombre AS nombre_producto,
                t.talla AS nombre_talla
            FROM venta_prod vp
            JOIN producto_talla pt ON vp.id_producto_talla = pt.id
            JOIN producto p ON pt.id_producto = p.id
            JOIN talla t ON pt.id_talla = t.id_talla
            WHERE vp.id_venta = ?
        `, [id]);

        const ventaConProductos = { ...venta[0], productosVendidos };
        res.json(ventaConProductos);

    } catch (error) {
        console.error('Error al obtener la venta con productos:', error);
        res.status(500).json({ error: 'Error al obtener la venta con sus productos' });
    }
};

exports.crearVenta = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { fecha, tipo_pago, id_cliente, saldo_a_favor = 0, estado, total, productos } = req.body;

        if (!fecha || !tipo_pago || !id_cliente || estado === undefined || !total || !Array.isArray(productos) || productos.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos y debe incluir al menos un producto' });
        }

        if (estado !== 'Completado' && estado !== 'Anulado') {
             await connection.rollback();
             return res.status(400).json({ error: 'El estado de la venta debe ser "Completado" o "Anulado"' });
        }

        // Insertar la venta principal
        const [ventaResult] = await connection.execute(
            'INSERT INTO venta (fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total) VALUES (?, ?, ?, ?, ?, ?)',
            [fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total]
        );

        const idVentaCreada = ventaResult.insertId;

        // Iterar sobre los productos de la venta para insertarlos en venta_prod y actualizar stock
        for (const producto of productos) {
            const { id_producto, id_talla, cantidad, valor } = producto; // 'cantidad' aquí es la cantidad vendida de este item

            // Paso 1: Encontrar el id de la tabla pivote producto_talla y obtener su cantidad (stock real)
            const [productoTallaResult] = await connection.execute(
                'SELECT id, cantidad FROM producto_talla WHERE id_producto = ? AND id_talla = ?', // <-- CORREGIDO: USAR 'cantidad' en lugar de 'stock'
                [id_producto, id_talla]
            );

            if (productoTallaResult.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: `No se encontró la combinación de producto (${id_producto}) y talla (${id_talla})` });
            }

            const idProductoTalla = productoTallaResult[0].id;
            const stockCantidadActual = productoTallaResult[0].cantidad; // <-- CORREGIDO: OBTENER DESDE 'cantidad'

            // Validar stock en el backend (solo si la venta está completada)
            if (estado === 'Completado' && stockCantidadActual < cantidad) {
                 await connection.rollback();
                 return res.status(400).json({ error: `Stock insuficiente para el producto (${id_producto}) y talla (${id_talla}). Stock disponible: ${stockCantidadActual}` });
            }

            const precioUnitario = valor; // Asumimos que 'valor' enviado desde Flutter es el precio unitario
            const subtotal = cantidad * precioUnitario;

            // Paso 2: Insertar el detalle del producto en venta_prod
            await connection.execute(
                'INSERT INTO venta_prod (id_venta, id_producto_talla, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                [idVentaCreada, idProductoTalla, cantidad, precioUnitario, subtotal]
            );

            // Paso 3: ACTUALIZAR EL STOCK (cantidad) en producto_talla
            // Solo decrementa el stock si la venta está marcada como 'Completado'
            if (estado === 'Completado') {
                await connection.execute(
                    'UPDATE producto_talla SET cantidad = cantidad - ? WHERE id = ?', // <-- CORREGIDO: USAR 'cantidad' en lugar de 'stock'
                    [cantidad, idProductoTalla]
                );
            }
        }

        // Si todo salió bien, confirma la transacción
        await connection.commit();
        res.status(201).json({ mensaje: 'Venta creada correctamente con sus productos', id_venta: idVentaCreada });

    } catch (error) {
        // Si algo falla, revierte la transacción
        await connection.rollback();
        console.error('Error al crear la venta y sus productos:', error);
         // Intentar enviar un mensaje de error más útil si es un error de base de datos específico
         let clientErrorMessage = 'Error interno al crear la venta y sus productos';
         if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_NO_REFERENCED_ROW_2') { // Códigos comunes de errores de campo o FK
             clientErrorMessage = `Error de base de datos: ${error.sqlMessage || error.message}`;
         } else if (error.message) {
             clientErrorMessage = `Error al crear venta: ${error.message}`;
         }


        res.status(500).json({ error: clientErrorMessage });
    } finally {
        // Siempre libera la conexión
        if (connection) connection.release();
    }
};

// Las otras funciones del controlador de ventas permanecen igual.

// ... (otras funciones como obtenerVentas, obtenerVenta, crearVenta, etc.) ...

exports.anularVenta = async (req, res) => {
    const connection = await db.getConnection(); // Usar una conexión para la transacción
    try {
        await connection.beginTransaction(); // Iniciar la transacción

        const { id } = req.params;

        // Opcional: Verificar el estado actual de la venta antes de anular
        const [currentSale] = await connection.execute('SELECT estado FROM venta WHERE id = ?', [id]);
        if (currentSale.length === 0) {
             await connection.rollback();
             return res.status(404).json({ error: 'Venta no encontrada' });
        }
        if (currentSale[0].estado === 'Anulado') {
             await connection.rollback();
             return res.status(400).json({ error: 'Esta venta ya está anulada' });
        }
         // Podrías añadir una verificación si solo quieres devolver stock de ventas 'Completado'
         const shouldReturnStock = currentSale[0].estado === 'Completado';


        // 1. Actualizar el estado de la venta a 'Anulado'
        const [updateResult] = await connection.execute(
            'UPDATE venta SET estado = ? WHERE id = ?',
            ['Anulado', id]
        );

        if (updateResult.affectedRows === 0) {
             // Esto no debería pasar si la verificación inicial fue exitosa, pero es un seguro
            await connection.rollback();
            return res.status(404).json({ error: 'Venta no encontrada o no se pudo actualizar el estado' });
        }

        // 2. Si la venta estaba completada, devolver el stock
        if (shouldReturnStock) {
             // 2a. Obtener los productos y cantidades vendidas en esta venta
             const [productosVendidos] = await connection.execute(
                 'SELECT id_producto_talla, cantidad FROM venta_prod WHERE id_venta = ?',
                 [id]
             );

             // 2b. Iterar y devolver la cantidad al stock de cada producto
             for (const item of productosVendidos) {
                 const { id_producto_talla, cantidad } = item;

                 // Incrementar el stock (columna 'cantidad') en producto_talla
                 const [stockUpdateResult] = await connection.execute(
                     'UPDATE producto_talla SET cantidad = cantidad + ? WHERE id = ?', // <-- SUMAR la cantidad vendida
                     [cantidad, id_producto_talla]
                 );

                  // Opcional: verificar stockUpdateResult.affectedRows si quieres asegurarte
                  // de que la entrada en producto_talla todavía existe
             }
        }


        // 3. Si todo salió bien (actualización de venta y, si aplica, stock), confirmar transacción
        await connection.commit();
        // Mensaje de éxito más descriptivo
        const successMessage = shouldReturnStock
            ? 'Venta anulada correctamente y stock restaurado.'
            : 'Venta anulada correctamente (no se restauró stock porque no estaba completada).';
        res.json({ mensaje: successMessage });

    } catch (error) {
        // Si algo falla, revertir la transacción
        await connection.rollback();
        console.error('Error al anular la venta y/o restaurar stock:', error);
        // Mensaje de error genérico para el cliente
        let clientErrorMessage = 'Error interno al anular la venta';
         if (error.message) {
             clientErrorMessage = `Error al anular venta: ${error.message}`;
         }
        res.status(500).json({ error: clientErrorMessage });

    } finally {
        // Siempre liberar la conexión
        if (connection) connection.release();
    }
};

// ... (otras funciones como actualizarVenta, eliminarVenta, etc.) ...

exports.actualizarVenta = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha, tipo_pago, id_cliente, saldo_a_favor, total } = req.body;

        const updates = [];
        const values = [];

        if (fecha !== undefined) {
            updates.push('fecha = ?');
            values.push(fecha);
        }
        if (tipo_pago !== undefined) {
            updates.push('tipo_pago = ?');
            values.push(tipo_pago);
        }
        if (id_cliente !== undefined) {
            updates.push('id_cliente = ?');
            values.push(id_cliente);
        }
        if (saldo_a_favor !== undefined) {
            updates.push('saldo_a_favor = ?');
            values.push(saldo_a_favor);
        }
        if (total !== undefined) {
            updates.push('total = ?');
            values.push(total);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
        }

        const sql = `UPDATE venta SET ${updates.join(', ')} WHERE id = ?`;
        values.push(id);

        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        res.json({ mensaje: 'Venta actualizada correctamente' });
    } catch (error) {
        console.error('Error al actualizar la venta:', error);
        res.status(500).json({ error: 'Error al actualizar la venta' });
    }
};

exports.eliminarVenta = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM venta WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        res.json({ mensaje: 'Venta eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar la venta:', error);
        res.status(500).json({ error: 'Error al eliminar la venta' });
    }
};
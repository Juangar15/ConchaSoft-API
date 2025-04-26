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

exports.anularVenta = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(
            'UPDATE venta SET estado = ? WHERE id = ?',
            ['Anulado', id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        res.json({ mensaje: 'Venta anulada correctamente' });
    } catch (error) {
        console.error('Error al anular la venta:', error);
        res.status(500).json({ error: 'Error al anular la venta' });
    }
};

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
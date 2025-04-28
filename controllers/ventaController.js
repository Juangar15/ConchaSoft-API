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

exports.obtenerVentasCompletadas = async (req, res) => {
    try {
        const [ventasCompletadas] = await db.query('SELECT * FROM venta WHERE estado = ?', ['Completado']);
        res.json(ventasCompletadas);
    } catch (error) {
        console.error('Error al obtener las ventas completadas:', error);
        res.status(500).json({ error: 'Error al obtener las ventas completadas' });
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

        // *** CAMBIO AQUÍ: Recibir saldo_a_favor_aplicado y monto_pagado desde Flutter ***
        const { fecha, tipo_pago, id_cliente, saldo_a_favor_aplicado = 0, estado, total, monto_pagado, productos } = req.body;

        // Validaciones iniciales (mantener las existentes)
        if (!fecha || !tipo_pago || !id_cliente || estado === undefined || !total || !Array.isArray(productos) || productos.length === 0 || monto_pagado === undefined) {
            await connection.rollback();
            return res.status(400).json({ error: 'Faltan campos obligatorios o la lista de productos está vacía' });
        }

        if (estado !== 'Completado' && estado !== 'Anulado') {
             await connection.rollback();
             return res.status(400).json({ error: 'El estado de la venta debe ser "Completado" o "Anulado"' });
        }

        // *** NUEVA VALIDACIÓN: Verificar que el saldo a favor aplicado no excede el saldo actual del cliente ***
        // Primero, obtener el saldo actual del cliente (misma lógica que obtenerCliente)
        const [saldoResult] = await connection.execute(`
            SELECT
                COALESCE(SUM(CASE WHEN d.saldo_a_favor > 0 THEN d.saldo_a_favor ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN v.saldo_a_favor > 0 THEN v.saldo_a_favor ELSE 0 END), 0) AS saldo_a_favor_actual
            FROM cliente c
            LEFT JOIN devolucion d ON c.id = d.id_cliente
            LEFT JOIN venta v ON c.id = v.id_cliente
            WHERE c.id = ?
            GROUP BY c.id // Asegurarse de agrupar si un cliente tiene múltiples devoluciones/ventas
        `, [id_cliente]);

         const saldoActualCliente = saldoResult.length > 0 ? (saldoResult[0].saldo_a_favor_actual || 0) : 0;


         // Validar que el saldo aplicado desde el frontend no sea mayor al saldo real disponible
         // También validar que no sea mayor que el total de la venta (aunque Flutter ya valida esto, es buena práctica aquí)
         if (saldo_a_favor_aplicado > saldoActualCliente + 0.001) { // Añadir un pequeño margen por errores de punto flotante
              await connection.rollback();
              // Considerar no revelar el saldo exacto por seguridad, solo decir que es insuficiente
              return res.status(400).json({ error: 'Saldo a favor insuficiente para aplicar este monto.' });
         }
          // Opcional: Validar que saldo_a_favor_aplicado no sea mayor que el total de la venta
         if (saldo_a_favor_aplicado > total + 0.001) { // Tampoco puede exceder el total de los productos
               await connection.rollback();
               return res.status(400).json({ error: 'El monto de saldo a favor aplicado excede el total de la venta.' });
         }


        // Insertar la venta principal
        // *** CAMBIO AQUÍ: Usar saldo_a_favor_aplicado para la columna saldo_a_favor (o el nombre que uses para el saldo usado en esta venta) ***
        // También considera almacenar el monto pagado final si es relevante
        const [ventaResult] = await connection.execute(
            'INSERT INTO venta (fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total, monto_pagado) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [fecha, tipo_pago, id_cliente, saldo_a_favor_aplicado, estado, total, monto_pagado] // Usar saldo_a_favor_aplicado aquí
        );

        const idVentaCreada = ventaResult.insertId;

        // Iterar sobre los productos de la venta para insertarlos en venta_prod y actualizar stock
        for (const producto of productos) {
            const { id_producto, id_talla, cantidad, valor } = producto;

            // Paso 1: Encontrar el id de la tabla pivote producto_talla y obtener su cantidad (stock real)
            const [productoTallaResult] = await connection.execute(
                'SELECT id, cantidad FROM producto_talla WHERE id_producto = ? AND id_talla = ?',
                [id_producto, id_talla]
            );

            if (productoTallaResult.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: `No se encontró la combinación de producto (${id_producto}) y talla (${id_talla})` });
            }

            const idProductoTalla = productoTallaResult[0].id;
            const stockCantidadActual = productoTallaResult[0].cantidad;

            // Validar stock en el backend (solo si la venta está completada)
            if (estado === 'Completado' && stockCantidadActual < cantidad) {
                 await connection.rollback();
                 return res.status(400).json({ error: `Stock insuficiente para el producto (${id_producto}) y talla (${id_talla}). Stock disponible: ${stockCantidadActual}` });
            }

            const precioUnitario = valor;
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
                    'UPDATE producto_talla SET cantidad = cantidad - ? WHERE id = ?',
                    [cantidad, idProductoTalla]
                );
            }
        }

        // Si todo salió bien, confirma la transacción
        await connection.commit();
        res.status(201).json({ mensaje: 'Venta creada correctamente con sus productos', id_venta: idVentaCreada });

    } catch (error) {
        await connection.rollback();
        console.error('Error al crear la venta y sus productos:', error);
        let clientErrorMessage = 'Error interno al crear la venta y sus productos';
        if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_NO_REFERENCED_ROW_2') {
            clientErrorMessage = `Error de base de datos: ${error.sqlMessage || error.message}`;
        } else if (error.message) {
            clientErrorMessage = `Error al crear venta: ${error.message}`;
        }

        res.status(500).json({ error: clientErrorMessage });
    } finally {
        if (connection) connection.release();
    }
};

// Las otras funciones del controlador de ventas permanecen igual.

// ... (otras funciones como obtenerVentas, obtenerVenta, crearVenta, etc.) ...

exports.anularVenta = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;

        // Verificar el estado actual de la venta antes de anular
        const [currentSale] = await connection.execute('SELECT estado, id_cliente, saldo_a_favor FROM venta WHERE id = ?', [id]); // *** CAMBIO AQUÍ: Obtener id_cliente y saldo_a_favor ***
        if (currentSale.length === 0) {
             await connection.rollback();
             return res.status(404).json({ error: 'Venta no encontrada' });
        }
        const { estado: estadoActual, id_cliente: clienteId, saldo_a_favor: saldoUsadoEnVenta } = currentSale[0]; // *** CAMBIO AQUÍ: Extraer valores ***


        if (estadoActual === 'Anulado') {
             await connection.rollback();
             return res.status(400).json({ error: 'Esta venta ya está anulada' });
        }

        const shouldReturnStock = estadoActual === 'Completado';


        // 1. Actualizar el estado de la venta a 'Anulado'
        // *** CAMBIO AQUÍ: También establecer saldo_a_favor a 0 al anular para devolverlo al cliente ***
        const [updateResult] = await connection.execute(
            'UPDATE venta SET estado = ?, saldo_a_favor = ? WHERE id = ?', // *** CAMBIO AQUÍ: Setear saldo_a_favor a 0 ***
            ['Anulado', 0, id] // *** CAMBIO AQUÍ: Pasar 0 como valor para saldo_a_favor ***
        );

        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Venta no encontrada o no se pudo actualizar el estado' });
        }

        // 2. Si la venta estaba completada, devolver el stock (mantener lógica existente)
        if (shouldReturnStock) {
             const [productosVendidos] = await connection.execute(
                 'SELECT id_producto_talla, cantidad FROM venta_prod WHERE id_venta = ?',
                 [id]
             );

             for (const item of productosVendidos) {
                  const { id_producto_talla, cantidad } = item;
                  await connection.execute(
                      'UPDATE producto_talla SET cantidad = cantidad + ? WHERE id = ?',
                      [cantidad, id_producto_talla]
                  );
             }
        }

        // *** NUEVO PASO OPCIONAL/ADICIONAL: Si la lógica del saldo no se basa únicamente en ventas.saldo_a_favor ***
        // Si tu lógica para el saldo a favor del cliente es más compleja y no solo suma devoluciones y resta ventas.saldo_a_favor,
        // podrías necesitar actualizar explícitamente el saldo del cliente aquí.
        // Por ejemplo, si tuvieras una columna 'saldo_a_favor_total' en la tabla cliente:
        // if (saldoUsadoEnVenta > 0) {
        //      await connection.execute(
        //          'UPDATE cliente SET saldo_a_favor_total = saldo_a_favor_total + ? WHERE id = ?',
        //          [saldoUsadoEnVenta, clienteId]
        //      );
        // }
        // Pero si tu saldo se calcula como en obtenerCliente, establecer venta.saldo_a_favor a 0 es suficiente.
        // Dejamos el código asumiendo la lógica de cálculo de obtenerCliente.


        // 3. Si todo salió bien, confirmar transacción
        await connection.commit();
        const successMessage = shouldReturnStock
            ? 'Venta anulada correctamente y stock restaurado.'
            : 'Venta anulada correctamente (no se restauró stock porque no estaba completada).';

        // Incluir un mensaje sobre el saldo si se devolvió
        if (saldoUsadoEnVenta > 0) {
             res.json({ mensaje: `${successMessage} Saldo a favor de \$${saldoUsadoEnVenta.toFixed(2)} devuelto al cliente.` });
        } else {
             res.json({ mensaje: successMessage });
        }


    } catch (error) {
        await connection.rollback();
        console.error('Error al anular la venta y/o restaurar stock:', error);
        let clientErrorMessage = 'Error interno al anular la venta';
         if (error.message) {
             clientErrorMessage = `Error al anular venta: ${error.message}`;
         }
        res.status(500).json({ error: clientErrorMessage });

    } finally {
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
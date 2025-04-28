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
    
            const { fecha, tipo_pago, id_cliente, saldo_a_favor_aplicado = 0, estado, total, productos } = req.body;
    
            // Validaciones iniciales (mantener las existentes)
            if (!fecha || !tipo_pago || !id_cliente || estado === undefined || !total || !Array.isArray(productos) || productos.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'Faltan campos obligatorios o la lista de productos está vacía' });
            }
    
            if (estado !== 'Completado' && estado !== 'Anulado') {
                await connection.rollback();
                return res.status(400).json({ error: 'El estado de la venta debe ser "Completado" o "Anulado"' });
            }
    
            // *** Obtener el saldo actual del cliente para la validación ***
            // Ahora lo leemos directamente de la nueva columna 'saldo_a_favor' en la tabla 'cliente'
            const [clienteSaldoActualRow] = await connection.execute(
                'SELECT saldo_a_favor FROM cliente WHERE id = ?',
                [id_cliente]
            );
    
            if (clienteSaldoActualRow.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: 'Cliente no encontrado para validar saldo.' });
            }
    
            const saldoActualCliente = parseFloat(clienteSaldoActualRow[0].saldo_a_favor);
            console.log(`Backend crearVenta: Saldo actual del cliente ${id_cliente} para validación: ${saldoActualCliente}`); // Log de validación
    
    
            // Validar que el saldo aplicado no sea mayor al saldo real disponible
            if (saldo_a_favor_aplicado > saldoActualCliente + 0.001) { // Añadir un pequeño margen por errores de punto flotante
                await connection.rollback();
                return res.status(400).json({ error: 'Saldo a favor insuficiente para aplicar este monto.' });
            }
            // Opcional: Validar que saldo_a_favor_aplicado no sea mayor que el total de la venta
            if (saldo_a_favor_aplicado > total + 0.001) {
                await connection.rollback();
                return res.status(400).json({ error: 'El monto de saldo a favor aplicado excede el total de la venta.' });
            }
    
    
            // Insertar la venta principal
            const [ventaResult] = await connection.execute(
                'INSERT INTO venta (fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total) VALUES (?, ?, ?, ?, ?, ?)',
                [fecha, tipo_pago, id_cliente, saldo_a_favor_aplicado, estado, total] // saldo_a_favor en tabla venta guarda el monto aplicado en ESTA venta
            );
    
            const idVentaCreada = ventaResult.insertId;
            console.log(`Backend crearVenta: Venta ${idVentaCreada} insertada.`); // Log de inserción venta
    
    
            // Iterar sobre los productos, insertar en venta_prod, actualizar stock...
            for (const producto of productos) {
                const { id_producto, id_talla, cantidad, valor } = producto;
    
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
    
                if (estado === 'Completado' && stockCantidadActual < cantidad) {
                    await connection.rollback();
                    return res.status(400).json({ error: `Stock insuficiente para el producto (${id_producto}) y talla (${id_talla}). Stock disponible: ${stockCantidadActual}` });
                }
    
                const precioUnitario = valor;
                const subtotal = cantidad * precioUnitario;
    
                await connection.execute(
                    'INSERT INTO venta_prod (id_venta, id_producto_talla, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                    [idVentaCreada, idProductoTalla, cantidad, precioUnitario, subtotal]
                );
                console.log(`Backend crearVenta: Insertado producto ${id_producto} (talla ${id_talla}) en venta ${idVentaCreada}.`); // Log inserción producto
    
    
                if (estado === 'Completado') {
                    await connection.execute(
                        'UPDATE producto_talla SET cantidad = cantidad - ? WHERE id = ?',
                        [cantidad, idProductoTalla]
                    );
                    console.log(`Backend crearVenta: Stock de producto_talla ${idProductoTalla} actualizado, restando ${cantidad}.`); // Log stock
                }
            }
    
            // --- NUEVO: Restar el saldo aplicado del campo 'saldo_a_favor' del cliente ---
            if (saldo_a_favor_aplicado > 0) {
                await connection.execute(
                    'UPDATE cliente SET saldo_a_favor = saldo_a_favor - ? WHERE id = ?',
                    [saldo_a_favor_aplicado, id_cliente]
                );
                console.log(`Backend crearVenta: Saldo total del cliente ${id_cliente} actualizado, restando ${saldo_a_favor_aplicado}`); // Log actualización saldo cliente
            }
            // --- FIN NUEVO ---
    
    
            await connection.commit(); // Confirmar transacción
    
            res.status(201).json({ mensaje: 'Venta creada correctamente con sus productos', id_venta: idVentaCreada });
    
        } catch (error) {
            await connection.rollback(); // Revertir transacción si algo falla
            console.error('Error al crear la venta y sus productos:', error);
            let clientErrorMessage = 'Error interno al crear la venta y sus productos';
            // Puedes refinar los mensajes de error aquí si lo deseas
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
    
            // Verificar el estado actual de la venta antes de anular y obtener id_cliente y saldo_a_favor usado
            const [currentSale] = await connection.execute('SELECT estado, id_cliente, saldo_a_favor FROM venta WHERE id = ?', [id]);
            if (currentSale.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: 'Venta no encontrada' });
            }
            const { estado: estadoActual, id_cliente: clienteId, saldo_a_favor: saldoUsadoEnVenta } = currentSale[0];
            console.log(`Backend anularVenta: Anulando venta ${id}. Estado actual: ${estadoActual}, Cliente ID: ${clienteId}, Saldo usado en esta venta: ${saldoUsadoEnVenta}`); // Log inicial
    
            if (estadoActual === 'Anulado') {
                await connection.rollback();
                return res.status(400).json({ error: 'Esta venta ya está anulada' });
            }
    
            const shouldReturnStock = estadoActual === 'Completado';
    
    
            // 1. Actualizar el estado de la venta a 'Anulado' y setear su propio saldo_a_favor a 0 (opcional pero limpia el registro de venta)
            const [updateResult] = await connection.execute(
                'UPDATE venta SET estado = ?, saldo_a_favor = ? WHERE id = ?',
                ['Anulado', 0, id] // Seteamos el saldo usado en la VENTA a 0
            );
    
            if (updateResult.affectedRows === 0) {
                await connection.rollback();
                return res.status(404).json({ error: 'Venta no encontrada o no se pudo actualizar el estado' });
            }
            console.log(`Backend anularVenta: Venta ${id} marcada como Anulada.`); // Log actualización venta
    
    
            // 2. Si la venta estaba completada, devolver el stock
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
                    console.log(`Backend anularVenta: Stock de producto_talla ${id_producto_talla} restaurado, sumando ${cantidad}.`); // Log stock restaurado
                }
            }
    
    
            // --- NUEVO: Sumar el saldo que se usó en esta venta al saldo total del cliente ---
            // Solo si la venta estaba Completada y se usó saldo (> 0)
            if (shouldReturnStock && saldoUsadoEnVenta > 0) {
                await connection.execute(
                    'UPDATE cliente SET saldo_a_favor = saldo_a_favor + ? WHERE id = ?',
                    [saldoUsadoEnVenta, clienteId] // Sumamos el saldo que se había restado al guardar la venta
                );
                console.log(`Backend anularVenta: Saldo total del cliente ${clienteId} actualizado, sumando ${saldoUsadoEnVenta} (saldo de venta anulada).`); // Log actualización saldo cliente
            }
            // --- FIN NUEVO ---
    
    
            await connection.commit(); // Confirmar transacción
    
            const successMessage = shouldReturnStock
                ? 'Venta anulada correctamente y stock restaurado.'
                : 'Venta anulada correctamente (no se restauró stock porque no estaba completada).';
    
            // Mensaje de respuesta para el cliente
             res.json({ mensaje: successMessage });
    
    
        } catch (error) {
            await connection.rollback(); // Revertir transacción
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
const db = require('../db');

exports.obtenerVentas = async (req, res) => {
    try {
        const [ventas] = await db.query('SELECT * FROM venta');
        res.json(ventas);
    } catch (error) {
        ('Error al obtener las ventas:', error);
        res.status(500).json({ error: 'Error al obtener las ventas' });
    }
};

exports.obtenerVentasCompletadas = async (req, res) => {
    try {
        const [ventasCompletadas] = await db.query('SELECT * FROM venta WHERE estado = ?', ['Completado']);
        res.json(ventasCompletadas);
    } catch (error) {
        ('Error al obtener las ventas completadas:', error);
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
        ('Error al obtener la venta con productos:', error);
        res.status(500).json({ error: 'Error al obtener la venta con sus productos' });
    }
};

exports.crearVenta = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        const { fecha, tipo_pago, id_cliente, saldo_a_favor_aplicado = 0, estado, total, productos } = req.body;
        
        // Validaciones iniciales
        if (!fecha || !tipo_pago || !id_cliente || estado === undefined || !total || !Array.isArray(productos) || productos.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Faltan campos obligatorios o la lista de productos está vacía' });
        }
        
        if (estado !== 'Completado' && estado !== 'Anulado') {
            await connection.rollback();
            return res.status(400).json({ error: 'El estado de la venta debe ser "Completado" o "Anulado"' });
        }
        
        // *** MODIFICACIÓN CLAVE: Obtener el saldo actual del cliente de la tabla de movimientos ***
        // Calculamos el saldo actual sumando todos los 'credito' y restando todos los 'debito'
        const [saldoActualClienteRows] = await connection.execute(
            `SELECT
                COALESCE(SUM(CASE WHEN tipo_movimiento = 'credito' THEN monto ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN tipo_movimiento = 'debito' THEN monto ELSE 0 END), 0) AS saldo_actual
            FROM movimiento_saldo_cliente
            WHERE id_cliente = ?`,
            [id_cliente]
        );
        
        const saldoActualCliente = parseFloat(saldoActualClienteRows[0].saldo_actual || 0); // Asegurarse que sea un número
        console.log(`Backend crearVenta: Saldo actual del cliente ${id_cliente} para validación (de movimientos): ${saldoActualCliente}`);
        
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
            [fecha, tipo_pago, id_cliente, saldo_a_favor_aplicado, estado, total]
        );
        
        const idVentaCreada = ventaResult.insertId;
        console.log(`Backend crearVenta: Venta ${idVentaCreada} insertada.`);
        
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
            console.log(`Backend crearVenta: Insertado producto ${id_producto} (talla ${id_talla}) en venta ${idVentaCreada}.`);
        
            if (estado === 'Completado') {
                await connection.execute(
                    'UPDATE producto_talla SET cantidad = cantidad - ? WHERE id = ?',
                    [cantidad, idProductoTalla]
                );
                console.log(`Backend crearVenta: Stock de producto_talla ${idProductoTalla} actualizado, restando ${cantidad}.`);
            }
        }
        
        // --- MODIFICACIÓN CLAVE: Registrar el uso del saldo a favor como un movimiento de 'debito' ---
        if (saldo_a_favor_aplicado > 0) {
            await connection.execute(
                'INSERT INTO movimiento_saldo_cliente (id_cliente, tipo_movimiento, monto, descripcion, referencia_entidad, id_entidad_origen) VALUES (?, ?, ?, ?, ?, ?)',
                [id_cliente, 'debito', saldo_a_favor_aplicado, `Uso de saldo a favor en venta #${idVentaCreada}`, 'venta', idVentaCreada]
            );
            console.log(`Backend crearVenta: Movimiento de débito de saldo a favor (${saldo_a_favor_aplicado}) para cliente ${id_cliente} registrado para venta ${idVentaCreada}.`);
        }
        
        await connection.commit(); // Confirmar transacción
        
        res.status(201).json({ mensaje: 'Venta creada correctamente con sus productos', id_venta: idVentaCreada });
        
    } catch (error) {
        await connection.rollback(); // Revertir transacción si algo falla
        ('Error al crear la venta y sus productos:', error);
        let clientErrorMessage = 'Error interno al crear la venta y sus productos';
        res.status(500).json({ error: clientErrorMessage });
        
    } finally {
        if (connection) connection.release();
    }
};

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
        console.log(`Backend anularVenta: Anulando venta ${id}. Estado actual: ${estadoActual}, Cliente ID: ${clienteId}, Saldo usado en esta venta: ${saldoUsadoEnVenta}`);
        
        if (estadoActual === 'Anulado') {
            await connection.rollback();
            return res.status(400).json({ error: 'Esta venta ya está anulada' });
        }

        // *** IMPORTANTE: Asegúrate de que el ENUM de 'estado' en tu tabla `venta` incluya 'Anulado' ***
        // ALTER TABLE venta MODIFY COLUMN estado ENUM('Completado','Devuelto Parcialmente','Devuelto Totalmente','Anulado') DEFAULT 'Completado';
        
        const shouldReturnStock = estadoActual === 'Completado';
        
        // 1. Actualizar el estado de la venta a 'Anulado' y setear su propio saldo_a_favor a 0
        const [updateResult] = await connection.execute(
            'UPDATE venta SET estado = ?, saldo_a_favor = ? WHERE id = ?',
            ['Anulado', 0, id] // Seteamos el saldo usado en la VENTA a 0
        );
        
        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Venta no encontrada o no se pudo actualizar el estado' });
        }
        console.log(`Backend anularVenta: Venta ${id} marcada como Anulada.`);
        
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
                console.log(`Backend anularVenta: Stock de producto_talla ${id_producto_talla} restaurado, sumando ${cantidad}.`);
            }
        }
        
        // --- MODIFICACIÓN CLAVE: Revertir el movimiento de saldo a favor si se había aplicado ---
        if (saldoUsadoEnVenta > 0) {
            // Buscamos el movimiento de débito asociado a esta venta
            const [movimientoExistente] = await connection.execute(
                'SELECT id FROM movimiento_saldo_cliente WHERE id_cliente = ? AND referencia_entidad = ? AND id_entidad_origen = ? AND tipo_movimiento = ? AND monto = ?',
                [clienteId, 'venta', id, 'debito', saldoUsadoEnVenta]
            );

            if (movimientoExistente.length > 0) {
                // Si encontramos el movimiento, lo eliminamos (o lo marcamos como anulado si prefieres)
                await connection.execute(
                    'DELETE FROM movimiento_saldo_cliente WHERE id = ?',
                    [movimientoExistente[0].id]
                );
                console.log(`Backend anularVenta: Movimiento de débito de saldo a favor (id: ${movimientoExistente[0].id}) eliminado para cliente ${clienteId} por anulación de venta.`);
            } else {
                 // Si por alguna razón no se encontró el movimiento original, creamos un 'credito' para compensar
                 // Esto es un fallback, la eliminación directa es mejor si siempre se espera el movimiento.
                 await connection.execute(
                     'INSERT INTO movimiento_saldo_cliente (id_cliente, tipo_movimiento, monto, descripcion, referencia_entidad, id_entidad_origen) VALUES (?, ?, ?, ?, ?, ?)',
                     [clienteId, 'credito', saldoUsadoEnVenta, `Reversión de uso de saldo a favor por anulación de venta #${id}`, 'venta_anulacion', id]
                 );
                 console.log(`Backend anularVenta: Movimiento de crédito de saldo a favor (${saldoUsadoEnVenta}) para cliente ${clienteId} registrado por anulación de venta ${id}.`);
            }
        }
        
        await connection.commit(); // Confirmar transacción
        
        const successMessage = shouldReturnStock
            ? 'Venta anulada correctamente y stock restaurado.'
            : 'Venta anulada correctamente (no se restauró stock porque no estaba completada).';
        
        res.json({ mensaje: successMessage });
        
    } catch (error) {
        await connection.rollback(); // Revertir transacción
        ('Error al anular la venta y/o restaurar stock:', error);
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
    // Mantengo esta función con la advertencia de que la actualización de total/saldo a favor en ventas completadas es compleja.
    // Si la venta tiene estado 'Completado' o 'Devuelto Parcialmente/Totalmente', solo debería permitir actualizar metadatos no críticos (ej. fecha, tipo_pago si no afecta saldo).
    // Si se modifica el 'total' o 'saldo_a_favor', esto afectará la contabilidad y los movimientos de saldo, lo cual requiere una lógica transaccional mucho más compleja
    // para revertir los movimientos anteriores y generar los nuevos. La recomendación sigue siendo anular y crear una nueva para cambios importantes.

    try {
        const { id } = req.params;
        const { fecha, tipo_pago, id_cliente, saldo_a_favor, total } = req.body;

        const updates = [];
        const values = [];

        // Para cualquier modificación que afecte el stock o el saldo (total, saldo_a_favor),
        // se debería obtener el estado actual de la venta y manejar la reversión/aplicación de movimientos.
        // Esto va más allá de un simple UPDATE SET.

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
            // Si actualizas saldo_a_favor aquí, ¡cuidado! Esto es el saldo_a_favor_aplicado EN ESTA VENTA,
            // no el saldo total del cliente. Si cambias esto, necesitarás actualizar/crear un movimiento_saldo_cliente
            // para reflejar el cambio en el saldo total del cliente. Esta es la parte compleja de actualizar ventas.
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
        ('Error al actualizar la venta:', error);
        res.status(500).json({ error: 'Error al actualizar la venta' });
    }
};

exports.eliminarVenta = async (req, res) => {
    // Como mencionamos, 'eliminar' una venta que afectó stock/saldo no es lo ideal.
    // La función 'anularVenta' ya maneja la reversión.
    // Recomiendo eliminar esta función `eliminarVenta` si 'anularVenta' es tu método definitivo.
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM venta WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        res.json({ mensaje: 'Venta eliminada correctamente' });
    } catch (error) {
        ('Error al eliminar la venta:', error);
        res.status(500).json({ error: 'Error al eliminar la venta' });
    }
};
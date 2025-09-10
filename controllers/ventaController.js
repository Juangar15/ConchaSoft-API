// controllers/ventaController.js

const db = require('../db');

exports.obtenerVentas = async (req, res) => {
    try {
        const [ventas] = await db.query('SELECT v.*, c.nombre, c.apellido FROM venta v JOIN cliente c ON v.id_cliente = c.id ORDER BY v.fecha DESC, v.id DESC');
        res.json(ventas);
    } catch (error) {
        console.error('Error al obtener las ventas:', error);
        res.status(500).json({ error: 'Error al obtener las ventas' });
    }
};

// --- FUNCIÓN RE-INCORPORADA: OBTENER VENTAS COMPLETADAS (O PARCIALMENTE DEVUELTAS) ---
// Útil para el frontend, para mostrar solo las ventas de las que se puede hacer una devolución.
exports.obtenerVentasCompletadas = async (req, res) => {
    try {
        // Incluimos 'Devuelto Parcialmente' porque de estas ventas también se pueden seguir devolviendo productos.
        const [ventasCompletadas] = await db.query("SELECT * FROM venta WHERE estado IN ('Completado', 'Devuelto Parcialmente')");
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
            SELECT vp.id_producto_talla, vp.cantidad, vp.precio_unitario, vp.subtotal, p.nombre AS nombre_producto, t.talla AS nombre_talla, pt.color
            FROM venta_prod vp
            JOIN producto_talla pt ON vp.id_producto_talla = pt.id
            JOIN producto p ON pt.id_producto = p.id
            JOIN talla t ON pt.id_talla = t.id_talla
            WHERE vp.id_venta = ?`, [id]);
        res.json({ ...venta[0], productosVendidos });
    } catch (error) {
        console.error('Error al obtener la venta con productos:', error);
        res.status(500).json({ error: 'Error al obtener la venta con sus productos' });
    }
};

// --- Lógica de creación y anulación (ya corregida) ---

exports.crearVenta = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { fecha, tipo_pago, id_cliente, saldo_a_favor_aplicado = 0, total, productos } = req.body;
        
        if (!fecha || !tipo_pago || !id_cliente || !total || !Array.isArray(productos) || productos.length === 0) {
            throw new Error('Faltan campos obligatorios o la lista de productos está vacía');
        }
        
        const [saldoRows] = await connection.execute(`SELECT COALESCE(SUM(CASE WHEN tipo_movimiento = 'credito' THEN monto ELSE -monto END), 0) AS saldo_actual FROM movimiento_saldo_cliente WHERE id_cliente = ?`, [id_cliente]);
        const saldoActualCliente = parseFloat(saldoRows[0]?.saldo_actual || 0);

        if (saldo_a_favor_aplicado > saldoActualCliente) {
            throw new Error('Saldo a favor insuficiente.');
        }

        const [ventaResult] = await connection.execute('INSERT INTO venta (fecha, tipo_pago, id_cliente, estado, total, monto_saldo_usado) VALUES (?, ?, ?, ?, ?, ?)', [fecha, tipo_pago, id_cliente, 'Completado', total, saldo_a_favor_aplicado]);
        const idVentaCreada = ventaResult.insertId;

        for (const producto of productos) {
            const { id_producto_talla, cantidad, precio_unitario } = producto;
            const [stock] = await connection.execute('SELECT cantidad FROM producto_talla WHERE id = ? FOR UPDATE', [id_producto_talla]);
            if (stock.length === 0 || stock[0].cantidad < cantidad) {
                throw new Error(`Stock insuficiente para el producto_talla ID ${id_producto_talla}.`);
            }
            await connection.execute('INSERT INTO venta_prod (id_venta, id_producto_talla, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)', [idVentaCreada, id_producto_talla, cantidad, precio_unitario, cantidad * precio_unitario]);
            await connection.execute('UPDATE producto_talla SET cantidad = cantidad - ? WHERE id = ?', [cantidad, id_producto_talla]);
        }
        
        if (saldo_a_favor_aplicado > 0) {
            await connection.execute('INSERT INTO movimiento_saldo_cliente (id_cliente, tipo_movimiento, monto, descripcion, referencia_entidad, id_entidad_origen) VALUES (?, ?, ?, ?, ?, ?)', [id_cliente, 'debito', saldo_a_favor_aplicado, `Uso de saldo en venta #${idVentaCreada}`, 'venta', idVentaCreada]);
        }
        
        await connection.commit();
        res.status(201).json({ mensaje: 'Venta creada correctamente', id_venta: idVentaCreada });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error al crear la venta:', error);
        res.status(500).json({ error: error.message || 'Error interno al crear la venta.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.anularVenta = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const [venta] = await connection.execute('SELECT estado, id_cliente, monto_saldo_usado FROM venta WHERE id = ? FOR UPDATE', [id]);
        if (venta.length === 0) throw new Error('Venta no encontrada');
        const { estado: estadoActual, id_cliente, monto_saldo_usado } = venta[0];
        if (estadoActual === 'Anulado') throw new Error('Esta venta ya está anulada');
        
        await connection.execute("UPDATE venta SET estado = 'Anulado', monto_saldo_usado = 0 WHERE id = ?", [id]);
        
        if (estadoActual === 'Completado' || estadoActual === 'Devuelto Parcialmente') {
             const [productosVendidos] = await connection.execute('SELECT id_producto_talla, cantidad FROM venta_prod WHERE id_venta = ?', [id]);
             for (const item of productosVendidos) {
                 await connection.execute('UPDATE producto_talla SET cantidad = cantidad + ? WHERE id = ?', [item.cantidad, item.id_producto_talla]);
             }
        }
        
        if (monto_saldo_usado > 0) {
             await connection.execute('INSERT INTO movimiento_saldo_cliente (id_cliente, tipo_movimiento, monto, descripcion, referencia_entidad, id_entidad_origen) VALUES (?, ?, ?, ?, ?, ?)', [id_cliente, 'credito', monto_saldo_usado, `Reversión de saldo por anulación de venta #${id}`, 'venta_anulacion', id]);
        }
        
        await connection.commit();
        res.json({ mensaje: 'Venta anulada correctamente. Stock y saldo restaurados.' });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error al anular la venta:', error);
        res.status(500).json({ error: error.message || 'Error interno al anular la venta.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.actualizarVenta = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { fecha, tipo_pago, id_cliente } = req.body;

        // Verificar que la venta existe
        const [venta] = await connection.execute('SELECT estado FROM venta WHERE id = ? FOR UPDATE', [id]);
        if (venta.length === 0) {
            throw new Error('Venta no encontrada');
        }

        // Solo permitir actualización de metadatos no críticos
        // No permitir cambios en total, saldo_a_favor, productos, etc.
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

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos válidos para actualizar' });
        }

        const sql = `UPDATE venta SET ${updates.join(', ')} WHERE id = ?`;
        values.push(id);

        const [result] = await connection.execute(sql, values);

        if (result.affectedRows === 0) {
            throw new Error('No se pudo actualizar la venta');
        }

        await connection.commit();
        res.json({ mensaje: 'Venta actualizada correctamente' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error al actualizar la venta:', error);
        res.status(500).json({ error: error.message || 'Error interno al actualizar la venta' });
    } finally {
        if (connection) connection.release();
    }
};

// Función para obtener estadísticas de ventas
exports.obtenerEstadisticasVentas = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;
        
        let whereClause = '';
        let params = [];
        
        if (fecha_inicio && fecha_fin) {
            whereClause = 'WHERE fecha BETWEEN ? AND ?';
            params = [fecha_inicio, fecha_fin];
        }

        // Total de ventas
        const [totalVentas] = await db.query(`
            SELECT 
                COUNT(*) as total_ventas,
                SUM(total) as total_monto,
                AVG(total) as promedio_venta
            FROM venta 
            ${whereClause}
        `, params);

        // Ventas por estado
        const [ventasPorEstado] = await db.query(`
            SELECT 
                estado,
                COUNT(*) as cantidad,
                SUM(total) as monto_total
            FROM venta 
            ${whereClause}
            GROUP BY estado
        `, params);

        // Ventas por tipo de pago
        const [ventasPorTipoPago] = await db.query(`
            SELECT 
                tipo_pago,
                COUNT(*) as cantidad,
                SUM(total) as monto_total
            FROM venta 
            ${whereClause}
            GROUP BY tipo_pago
        `, params);

        // Top 5 clientes
        const [topClientes] = await db.query(`
            SELECT 
                c.nombre,
                c.apellido,
                COUNT(v.id) as total_ventas,
                SUM(v.total) as monto_total
            FROM venta v
            JOIN cliente c ON v.id_cliente = c.id
            ${whereClause}
            GROUP BY v.id_cliente, c.nombre, c.apellido
            ORDER BY monto_total DESC
            LIMIT 5
        `, params);

        res.json({
            resumen: totalVentas[0],
            por_estado: ventasPorEstado,
            por_tipo_pago: ventasPorTipoPago,
            top_clientes: topClientes
        });
    } catch (error) {
        console.error('Error al obtener estadísticas de ventas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de ventas' });
    }
};

// Función para obtener ventas recientes
exports.obtenerVentasRecientes = async (req, res) => {
    try {
        const { limite = 10 } = req.query;
        
        const [ventas] = await db.query(`
            SELECT 
                v.*,
                c.nombre,
                c.apellido,
                COUNT(vp.id_producto_talla) as total_productos
            FROM venta v
            JOIN cliente c ON v.id_cliente = c.id
            LEFT JOIN venta_prod vp ON v.id = vp.id_venta
            GROUP BY v.id
            ORDER BY v.fecha DESC, v.id DESC
            LIMIT ?
        `, [parseInt(limite)]);

        res.json(ventas);
    } catch (error) {
        console.error('Error al obtener ventas recientes:', error);
        res.status(500).json({ error: 'Error al obtener ventas recientes' });
    }
};

module.exports = exports;

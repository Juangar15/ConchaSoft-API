// controllers/devolucionController.js

const db = require('../db');

exports.obtenerDevoluciones = async (req, res) => {
    try {
        const [devoluciones] = await db.query('SELECT d.*, c.nombre, c.apellido FROM devolucion d JOIN cliente c ON d.id_cliente = c.id ORDER BY d.fecha DESC, d.id DESC');
        res.json(devoluciones);
    } catch (error) {
        console.error('Error al obtener las devoluciones:', error);
        res.status(500).json({ error: 'Error al obtener las devoluciones' });
    }
};

// --- FUNCIÓN RE-INCORPORADA: OBTENER DEVOLUCIÓN POR ID ---
// Esencial para ver los detalles de una devolución específica.
exports.obtenerDevolucion = async (req, res) => {
    try {
        const { id } = req.params;
        const [devolucion] = await db.query('SELECT * FROM devolucion WHERE id = ?', [id]);

        if (devolucion.length === 0) {
            return res.status(404).json({ error: 'Devolución no encontrada' });
        }

        // Se obtienen también los productos específicos de esa devolución
        const [productosDevueltos] = await db.query(`
            SELECT dp.cantidad, dp.precio_unitario_devuelto, dp.subtotal_devuelto, p.nombre AS nombre_producto, t.talla AS nombre_talla
            FROM devolucion_prod dp
            JOIN producto_talla pt ON dp.id_producto_talla = pt.id
            JOIN producto p ON pt.id_producto = p.id
            JOIN talla t ON pt.id_talla = t.id_talla
            WHERE dp.id_devolucion = ?`, [id]);
            
        res.json({ ...devolucion[0], productosDevueltos });

    } catch (error) {
        console.error('Error al obtener la devolución:', error);
        res.status(500).json({ error: 'Error al obtener la devolución' });
    }
};

// --- Lógica de creación y anulación (ya corregida) ---

exports.crearDevolucion = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id_venta, razon, productos_devueltos } = req.body;

        const [venta] = await connection.execute('SELECT id_cliente, estado FROM venta WHERE id = ? FOR UPDATE', [id_venta]);
        if (venta.length === 0) throw new Error('La venta original no existe.');
        if (venta[0].estado === 'Anulado' || venta[0].estado === 'Devuelto Totalmente') {
            throw new Error(`La venta ya está en estado '${venta[0].estado}' y no admite más devoluciones.`);
        }
        const id_cliente = venta[0].id_cliente;

        let montoTotalDevuelto = 0;
        for (const prod of productos_devueltos) {
            const [ventaProd] = await connection.execute('SELECT precio_unitario FROM venta_prod WHERE id_venta = ? AND id_producto_talla = ?', [id_venta, prod.id_producto_talla]);
            if (ventaProd.length === 0) throw new Error(`El producto con id_producto_talla ${prod.id_producto_talla} no pertenece a la venta original.`);
            montoTotalDevuelto += prod.cantidad * ventaProd[0].precio_unitario;
        }

        const [devResult] = await connection.execute('INSERT INTO devolucion (id_venta, id_cliente, fecha, razon, estado, monto_total_devuelto) VALUES (?, ?, CURDATE(), ?, ?, ?)', [id_venta, id_cliente, razon, 'Aceptada', montoTotalDevuelto]);
        const id_devolucion = devResult.insertId;

        for (const prod of productos_devueltos) {
            const [ventaProd] = await connection.execute('SELECT precio_unitario FROM venta_prod WHERE id_venta = ? AND id_producto_talla = ?', [id_venta, prod.id_producto_talla]);
            const precio_unitario_devuelto = ventaProd[0].precio_unitario;
            await connection.execute('INSERT INTO devolucion_prod (id_devolucion, id_producto_talla, cantidad, precio_unitario_devuelto, subtotal_devuelto) VALUES (?, ?, ?, ?, ?)', [id_devolucion, prod.id_producto_talla, prod.cantidad, precio_unitario_devuelto, prod.cantidad * precio_unitario_devuelto]);
            await connection.execute('UPDATE producto_talla SET cantidad = cantidad + ? WHERE id = ?', [prod.cantidad, prod.id_producto_talla]);
        }

        if (montoTotalDevuelto > 0) {
            await connection.execute('INSERT INTO movimiento_saldo_cliente (id_cliente, tipo_movimiento, monto, descripcion, referencia_entidad, id_entidad_origen) VALUES (?, ?, ?, ?, ?, ?)', [id_cliente, 'credito', montoTotalDevuelto, `Crédito por devolución de venta #${id_venta}`, 'devolucion', id_devolucion]);
        }

        const [productosComprados] = await connection.execute('SELECT SUM(cantidad) AS total FROM venta_prod WHERE id_venta = ?', [id_venta]);
        const [productosDevueltos] = await connection.execute(`SELECT SUM(dp.cantidad) AS total FROM devolucion_prod dp JOIN devolucion d ON dp.id_devolucion = d.id WHERE d.id_venta = ? AND d.estado = 'Aceptada'`, [id_venta]);
        let nuevoEstadoVenta = (productosDevueltos[0].total >= productosComprados[0].total) ? 'Devuelto Totalmente' : 'Devuelto Parcialmente';
        await connection.execute("UPDATE venta SET estado = ? WHERE id = ?", [nuevoEstadoVenta, id_venta]);
        
        await connection.commit();
        res.status(201).json({ mensaje: 'Devolución procesada correctamente.', id_devolucion });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error al crear la devolución:', error);
        res.status(500).json({ error: error.message || 'Error interno al procesar la devolución.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.anularDevolucion = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const [devolucion] = await connection.execute("SELECT * FROM devolucion WHERE id = ? AND estado = 'Aceptada' FOR UPDATE", [id]);
        if (devolucion.length === 0) throw new Error('Devolución no encontrada o ya fue anulada.');
        const { id_venta, id_cliente, monto_total_devuelto } = devolucion[0];

        const [productosDevueltos] = await connection.execute('SELECT id_producto_talla, cantidad FROM devolucion_prod WHERE id_devolucion = ?', [id]);
        for (const prod of productosDevueltos) {
            await connection.execute('UPDATE producto_talla SET cantidad = cantidad - ? WHERE id = ?', [prod.cantidad, prod.id_producto_talla]);
        }

        if (monto_total_devuelto > 0) {
             await connection.execute('INSERT INTO movimiento_saldo_cliente (id_cliente, tipo_movimiento, monto, descripcion, referencia_entidad, id_entidad_origen) VALUES (?, ?, ?, ?, ?, ?)', [id_cliente, 'debito', monto_total_devuelto, `Reversión por anulación de devolución #${id}`, 'devolucion_anulada', id]);
        }

        await connection.execute("UPDATE devolucion SET estado = 'Anulada' WHERE id = ?", [id]);

        const [productosComprados] = await connection.execute('SELECT SUM(cantidad) AS total FROM venta_prod WHERE id_venta = ?', [id_venta]);
        const [productosAunDevueltos] = await connection.execute(`SELECT SUM(dp.cantidad) AS total FROM devolucion_prod dp JOIN devolucion d ON dp.id_devolucion = d.id WHERE d.id_venta = ? AND d.estado = 'Aceptada'`, [id_venta]);
        const totalDevueltoAhora = productosAunDevueltos[0]?.total || 0;
        const totalComprado = productosComprados[0].total;

        let nuevoEstadoVenta = 'Completado';
        if (totalDevueltoAhora >= totalComprado) {
            nuevoEstadoVenta = 'Devuelto Totalmente';
        } else if (totalDevueltoAhora > 0) {
            nuevoEstadoVenta = 'Devuelto Parcialmente';
        }
        await connection.execute("UPDATE venta SET estado = ? WHERE id = ?", [nuevoEstadoVenta, id_venta]);

        await connection.commit();
        res.json({ mensaje: 'Devolución anulada correctamente. El stock y el saldo del cliente han sido revertidos.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error al anular la devolución:', error);
        res.status(500).json({ error: error.message || 'Error interno al anular la devolución.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = exports;
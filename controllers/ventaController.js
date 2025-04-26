const db = require('../db');

exports.obtenerVentas = async (req, res) => {
    try {
        const [ventas] = await db.query('SELECT * FROM venta');
        res.json(ventas);
    } catch (error) {
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
    // Iniciar una transacción para asegurar la integridad de los datos
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { fecha, tipo_pago, id_cliente, saldo_a_favor = 0, estado, total, productos } = req.body;

        if (!fecha || !tipo_pago || !id_cliente || !estado || !total || !Array.isArray(productos) || productos.isEmpty) {
            return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos y debe incluir al menos un producto' });
        }

        // Insertar la nueva venta en la tabla 'venta'
        const [ventaResult] = await connection.execute(
            'INSERT INTO venta (fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total) VALUES (?, ?, ?, ?, ?, ?)',
            [fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total]
        );

        const idVentaCreada = ventaResult.insertId;

        // Iterar sobre la lista de productos y guardarlos en 'venta_prod'
        for (const producto of productos) {
            const { id_producto, id_talla, cantidad, valor } = producto;

            // Obtener el ID de producto_talla
            const [productoTallaResult] = await connection.execute(
                'SELECT id FROM producto_talla WHERE id_producto = ? AND id_talla = ?',
                [id_producto, id_talla]
            );

            if (productoTallaResult.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: `No se encontró la combinación de producto (${id_producto}) y talla (${id_talla})` });
            }

            const idProductoTalla = productoTallaResult[0].id;
            const precioUnitario = valor;
            const subtotal = cantidad * precioUnitario;

            // Insertar el producto en 'venta_prod'
            await connection.execute(
                'INSERT INTO venta_prod (id_venta, id_producto_talla, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                [idVentaCreada, idProductoTalla, cantidad, precioUnitario, subtotal]
            );
        }

        // Si todo salió bien, confirmar la transacción
        await connection.commit();
        res.status(201).json({ mensaje: 'Venta creada correctamente con sus productos', id_venta: idVentaCreada });

    } catch (error) {
        // Si ocurre algún error, deshacer la transacción
        await connection.rollback();
        console.error('Error al crear la venta y sus productos:', error);
        res.status(500).json({ error: 'Error al crear la venta y sus productos' });
    } finally {
        // Liberar la conexión
        connection.release();
    }
};

exports.actualizarVenta = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total } = req.body;

        const [result] = await db.query(
            'UPDATE venta SET fecha = ?, tipo_pago = ?, id_cliente = ?, saldo_a_favor = ?, estado = ?, total = ? WHERE id = ?',
            [fecha, tipo_pago, id_cliente, saldo_a_favor, estado, total, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        res.json({ mensaje: 'Venta actualizada correctamente' });
    } catch (error) {
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
        res.status(500).json({ error: 'Error al eliminar la venta' });
    }
};
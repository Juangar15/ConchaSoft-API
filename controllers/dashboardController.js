// controllers/dashboardController.js

const db = require('../db');

// Función principal del dashboard - obtiene resumen general
exports.obtenerResumenGeneral = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;
        
        let whereClause = '';
        let params = [];
        
        if (fecha_inicio && fecha_fin) {
            whereClause = 'WHERE fecha BETWEEN ? AND ?';
            params = [fecha_inicio, fecha_fin];
        }

        // Resumen de ventas
        const [resumenVentas] = await db.query(`
            SELECT 
                COUNT(*) as total_ventas,
                SUM(total) as total_monto_ventas,
                AVG(total) as promedio_venta,
                COUNT(CASE WHEN estado = 'Completado' THEN 1 END) as ventas_completadas,
                COUNT(CASE WHEN estado = 'Anulado' THEN 1 END) as ventas_anuladas
            FROM venta 
            ${whereClause}
        `, params);

        // Resumen de devoluciones
        const [resumenDevoluciones] = await db.query(`
            SELECT 
                COUNT(*) as total_devoluciones,
                SUM(monto_total_devuelto) as total_monto_devuelto,
                COUNT(CASE WHEN estado = 'Aceptada' THEN 1 END) as devoluciones_aceptadas
            FROM devolucion d
            ${whereClause}
        `, params);

        // Resumen de productos
        const [resumenProductos] = await db.query(`
            SELECT 
                COUNT(DISTINCT p.id) as total_productos,
                COUNT(DISTINCT pt.id) as total_variantes,
                SUM(pt.cantidad) as stock_total,
                COUNT(CASE WHEN pt.cantidad = 0 THEN 1 END) as productos_sin_stock
            FROM producto p
            LEFT JOIN producto_talla pt ON p.id = pt.id_producto
            WHERE p.estado = 1
        `);

        // Resumen de clientes
        const [resumenClientes] = await db.query(`
            SELECT 
                COUNT(*) as total_clientes,
                COUNT(CASE WHEN activo = 1 THEN 1 END) as clientes_activos
            FROM cliente
        `);

        // Ventas por día (últimos 7 días)
        const [ventasPorDia] = await db.query(`
            SELECT 
                DATE(fecha) as fecha,
                COUNT(*) as cantidad_ventas,
                SUM(total) as monto_total
            FROM venta 
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(fecha)
            ORDER BY fecha DESC
        `);

        // Top 5 productos más vendidos
        const [topProductosVendidos] = await db.query(`
            SELECT 
                p.nombre as nombre_producto,
                t.talla,
                SUM(vp.cantidad) as cantidad_vendida,
                SUM(vp.subtotal) as monto_total
            FROM venta_prod vp
            JOIN producto_talla pt ON vp.id_producto_talla = pt.id
            JOIN producto p ON pt.id_producto = p.id
            JOIN talla t ON pt.id_talla = t.id_talla
            JOIN venta v ON vp.id_venta = v.id
            WHERE v.estado IN ('Completado', 'Devuelto Parcialmente', 'Devuelto Totalmente')
            ${whereClause ? 'AND v.' + whereClause.replace('WHERE ', '') : ''}
            GROUP BY vp.id_producto_talla, p.nombre, t.talla
            ORDER BY cantidad_vendida DESC
            LIMIT 5
        `, params);

        // Alertas de stock bajo
        const [alertasStock] = await db.query(`
            SELECT 
                p.nombre as nombre_producto,
                t.talla,
                pt.cantidad as stock_actual
            FROM producto_talla pt
            JOIN producto p ON pt.id_producto = p.id
            JOIN talla t ON pt.id_talla = t.id_talla
            WHERE pt.cantidad <= 5 AND p.activo = 1
            ORDER BY pt.cantidad ASC
            LIMIT 10
        `);

        res.json({
            ventas: resumenVentas[0],
            devoluciones: resumenDevoluciones[0],
            productos: resumenProductos[0],
            clientes: resumenClientes[0],
            ventas_por_dia: ventasPorDia,
            top_productos_vendidos: topProductosVendidos,
            alertas_stock: alertasStock
        });
    } catch (error) {
        console.error('Error al obtener resumen del dashboard:', error);
        res.status(500).json({ error: 'Error al obtener resumen del dashboard' });
    }
};

// Función para obtener métricas de rendimiento
exports.obtenerMetricasRendimiento = async (req, res) => {
    try {
        const { periodo = '30' } = req.query; // días por defecto
        
        // Comparación con período anterior
        const [comparacionVentas] = await db.query(`
            SELECT 
                'actual' as periodo,
                COUNT(*) as total_ventas,
                SUM(total) as total_monto
            FROM venta 
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            
            UNION ALL
            
            SELECT 
                'anterior' as periodo,
                COUNT(*) as total_ventas,
                SUM(total) as total_monto
            FROM venta 
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY) 
            AND fecha < DATE_SUB(CURDATE(), INTERVAL ? DAY)
        `, [parseInt(periodo), parseInt(periodo) * 2, parseInt(periodo)]);

        // Tasa de devolución
        const [tasaDevolucion] = await db.query(`
            SELECT 
                (COUNT(d.id) / COUNT(v.id)) * 100 as tasa_devolucion_porcentaje,
                COUNT(d.id) as total_devoluciones,
                COUNT(v.id) as total_ventas
            FROM venta v
            LEFT JOIN devolucion d ON v.id = d.id_venta AND d.estado = 'Aceptada'
            WHERE v.fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        `, [parseInt(periodo)]);

        // Métricas de clientes
        const [metricasClientes] = await db.query(`
            SELECT 
                COUNT(DISTINCT v.id_cliente) as clientes_activos,
                AVG(ventas_por_cliente.total_ventas) as promedio_ventas_por_cliente,
                AVG(ventas_por_cliente.monto_total) as promedio_monto_por_cliente
            FROM venta v
            JOIN (
                SELECT 
                    id_cliente,
                    COUNT(*) as total_ventas,
                    SUM(total) as monto_total
                FROM venta 
                WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY id_cliente
            ) ventas_por_cliente ON v.id_cliente = ventas_por_cliente.id_cliente
            WHERE v.fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        `, [parseInt(periodo), parseInt(periodo)]);

        res.json({
            comparacion_ventas: comparacionVentas,
            tasa_devolucion: tasaDevolucion[0],
            metricas_clientes: metricasClientes[0]
        });
    } catch (error) {
        console.error('Error al obtener métricas de rendimiento:', error);
        res.status(500).json({ error: 'Error al obtener métricas de rendimiento' });
    }
};

// Función para obtener gráficos de tendencias
exports.obtenerTendencias = async (req, res) => {
    try {
        const { tipo = 'mensual', meses = 12 } = req.query;
        
        let groupBy = '';
        let dateFormat = '';
        
        switch (tipo) {
            case 'diario':
                groupBy = 'DATE(fecha)';
                dateFormat = '%Y-%m-%d';
                break;
            case 'semanal':
                groupBy = 'YEARWEEK(fecha)';
                dateFormat = '%Y-%u';
                break;
            case 'mensual':
            default:
                groupBy = 'DATE_FORMAT(fecha, "%Y-%m")';
                dateFormat = '%Y-%m';
                break;
        }

        // Tendencias de ventas
        const [tendenciasVentas] = await db.query(`
            SELECT 
                ${groupBy} as periodo,
                COUNT(*) as cantidad_ventas,
                SUM(total) as monto_total,
                AVG(total) as promedio_venta
            FROM venta 
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
            GROUP BY ${groupBy}
            ORDER BY periodo DESC
        `, [parseInt(meses)]);

        // Tendencias de devoluciones
        const [tendenciasDevoluciones] = await db.query(`
            SELECT 
                ${groupBy} as periodo,
                COUNT(*) as cantidad_devoluciones,
                SUM(monto_total_devuelto) as monto_total_devuelto
            FROM devolucion 
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
            GROUP BY ${groupBy}
            ORDER BY periodo DESC
        `, [parseInt(meses)]);

        res.json({
            ventas: tendenciasVentas,
            devoluciones: tendenciasDevoluciones
        });
    } catch (error) {
        console.error('Error al obtener tendencias:', error);
        res.status(500).json({ error: 'Error al obtener tendencias' });
    }
};

// Función para obtener alertas y notificaciones
exports.obtenerAlertas = async (req, res) => {
    try {
        const alertas = [];

        // Stock bajo
        const [stockBajo] = await db.query(`
            SELECT 
                p.nombre as producto,
                t.talla,
                pt.cantidad as stock_actual,
                'stock_bajo' as tipo_alerta,
                'Producto con stock bajo' as mensaje
            FROM producto_talla pt
            JOIN producto p ON pt.id_producto = p.id
            JOIN talla t ON pt.id_talla = t.id_talla
            WHERE pt.cantidad <= 5 AND p.activo = 1
            ORDER BY pt.cantidad ASC
        `);

        // Productos sin stock
        const [sinStock] = await db.query(`
            SELECT 
                p.nombre as producto,
                t.talla,
                'sin_stock' as tipo_alerta,
                'Producto sin stock' as mensaje
            FROM producto_talla pt
            JOIN producto p ON pt.id_producto = p.id
            JOIN talla t ON pt.id_talla = t.id_talla
            WHERE pt.cantidad = 0 AND p.activo = 1
        `);

        // Devoluciones pendientes (si las hay)
        const [devolucionesPendientes] = await db.query(`
            SELECT 
                d.id,
                c.nombre,
                c.apellido,
                d.monto_total_devuelto,
                'devolucion_pendiente' as tipo_alerta,
                'Devolución pendiente de procesar' as mensaje
            FROM devolucion d
            JOIN cliente c ON d.id_cliente = c.id
            WHERE d.estado = 'Pendiente'
        `);

        // Agregar todas las alertas
        alertas.push(...stockBajo, ...sinStock, ...devolucionesPendientes);

        // Ordenar por prioridad
        const prioridades = {
            'sin_stock': 1,
            'stock_bajo': 2,
            'devolucion_pendiente': 3
        };

        alertas.sort((a, b) => (prioridades[a.tipo_alerta] || 4) - (prioridades[b.tipo_alerta] || 4));

        res.json({
            total_alertas: alertas.length,
            alertas: alertas
        });
    } catch (error) {
        console.error('Error al obtener alertas:', error);
        res.status(500).json({ error: 'Error al obtener alertas' });
    }
};

// Función para obtener productos más devueltos (para gráficos)
exports.obtenerProductosMasDevueltos = async (req, res) => {
    try {
        const { limite = 10, fecha_inicio, fecha_fin } = req.query;
        
        let whereClause = '';
        let params = [];
        
        if (fecha_inicio && fecha_fin) {
            whereClause = 'AND d.fecha BETWEEN ? AND ?';
            params = [fecha_inicio, fecha_fin];
        }
        
        const [productos] = await db.query(`
            SELECT 
                p.nombre as nombre_producto,
                t.talla,
                COUNT(dp.id_producto_talla) as veces_devuelto,
                SUM(dp.cantidad) as cantidad_total_devuelta,
                SUM(dp.subtotal_devuelto) as monto_total_devuelto,
                ROUND((COUNT(dp.id_producto_talla) * 100.0 / (
                    SELECT COUNT(*) 
                    FROM devolucion_prod dp2 
                    JOIN devolucion d2 ON dp2.id_devolucion = d2.id 
                    WHERE d2.estado = 'Aceptada' ${whereClause}
                )), 2) as porcentaje_devoluciones
            FROM devolucion_prod dp
            JOIN producto_talla pt ON dp.id_producto_talla = pt.id
            JOIN producto p ON pt.id_producto = p.id
            JOIN talla t ON pt.id_talla = t.talla
            JOIN devolucion d ON dp.id_devolucion = d.id
            WHERE d.estado = 'Aceptada' ${whereClause}
            GROUP BY dp.id_producto_talla, p.nombre, t.talla
            ORDER BY veces_devuelto DESC, cantidad_total_devuelta DESC
            LIMIT ?
        `, [...params, parseInt(limite)]);

        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos más devueltos:', error);
        res.status(500).json({ error: 'Error al obtener productos más devueltos' });
    }
};

// Función para obtener estadísticas de compras (para gráficos)
exports.obtenerEstadisticasCompras = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;
        
        let whereClause = '';
        let params = [];
        
        if (fecha_inicio && fecha_fin) {
            whereClause = 'WHERE c.fecha BETWEEN ? AND ?';
            params = [fecha_inicio, fecha_fin];
        }

        // Resumen general de compras
        const [resumenCompras] = await db.query(`
            SELECT 
                COUNT(*) as total_compras,
                SUM(c.total) as total_monto_compras,
                AVG(c.total) as promedio_compra,
                COUNT(CASE WHEN c.estado = 1 THEN 1 END) as compras_completadas,
                COUNT(CASE WHEN c.estado = 0 THEN 1 END) as compras_anuladas
            FROM compra c
            ${whereClause}
        `, params);

        // Compras por proveedor
        const [comprasPorProveedor] = await db.query(`
            SELECT 
                pr.nombre as nombre_proveedor,
                COUNT(c.id) as total_compras,
                SUM(c.total) as monto_total,
                AVG(c.total) as promedio_compra
            FROM compra c
            JOIN proveedor pr ON c.id_proveedor = pr.id
            ${whereClause}
            GROUP BY c.id_proveedor, pr.nombre
            ORDER BY monto_total DESC
            LIMIT 10
        `, params);

        // Compras por mes (últimos 12 meses)
        const [comprasPorMes] = await db.query(`
            SELECT 
                DATE_FORMAT(c.fecha, '%Y-%m') as mes,
                COUNT(*) as cantidad_compras,
                SUM(c.total) as monto_total
            FROM compra c
            WHERE c.fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            ${whereClause ? 'AND c.fecha BETWEEN ? AND ?' : ''}
            GROUP BY DATE_FORMAT(c.fecha, '%Y-%m')
            ORDER BY mes DESC
        `, params);

        // Top productos más comprados
        const [productosMasComprados] = await db.query(`
            SELECT 
                p.nombre as nombre_producto,
                t.talla,
                SUM(cp.cantidad) as cantidad_comprada,
                SUM(cp.subtotal) as monto_total,
                AVG(cp.precio_unitario) as precio_promedio
            FROM compra_prod cp
            JOIN producto_talla pt ON cp.id_producto_talla = pt.id
            JOIN producto p ON pt.id_producto = p.id
            JOIN talla t ON pt.id_talla = t.talla
            JOIN compra c ON cp.id_compra = c.id
            WHERE c.estado = 1
            ${whereClause ? 'AND c.fecha BETWEEN ? AND ?' : ''}
            GROUP BY cp.id_producto_talla, p.nombre, t.talla
            ORDER BY cantidad_comprada DESC
            LIMIT 10
        `, params);

        res.json({
            resumen: resumenCompras[0],
            por_proveedor: comprasPorProveedor,
            por_mes: comprasPorMes,
            productos_mas_comprados: productosMasComprados
        });
    } catch (error) {
        console.error('Error al obtener estadísticas de compras:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de compras' });
    }
};

// Función para obtener datos para gráficos de comparación
exports.obtenerDatosGraficos = async (req, res) => {
    try {
        const { periodo = '30' } = req.query; // días
        
        // Ventas vs Compras por día (últimos 30 días)
        const [ventasVsCompras] = await db.query(`
            SELECT 
                DATE(v.fecha) as fecha,
                COALESCE(SUM(v.total), 0) as ventas,
                COALESCE(SUM(c.total), 0) as compras,
                COALESCE(SUM(v.total), 0) - COALESCE(SUM(c.total), 0) as diferencia
            FROM (
                SELECT DISTINCT DATE(fecha) as fecha FROM venta 
                WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                UNION
                SELECT DISTINCT DATE(fecha) as fecha FROM compra 
                WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ) fechas
            LEFT JOIN venta v ON DATE(v.fecha) = fechas.fecha AND v.estado IN ('Completado', 'Devuelto Parcialmente', 'Devuelto Totalmente')
            LEFT JOIN compra c ON DATE(c.fecha) = fechas.fecha AND c.estado = 1
            GROUP BY fechas.fecha
            ORDER BY fechas.fecha DESC
        `, [parseInt(periodo), parseInt(periodo)]);

        // Ventas por tipo de pago
        const [ventasPorTipoPago] = await db.query(`
            SELECT 
                tipo_pago,
                COUNT(*) as cantidad_ventas,
                SUM(total) as monto_total,
                ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM venta WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY))), 2) as porcentaje
            FROM venta 
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY tipo_pago
            ORDER BY monto_total DESC
        `, [parseInt(periodo), parseInt(periodo)]);

        // Devoluciones por razón
        const [devolucionesPorRazon] = await db.query(`
            SELECT 
                razon,
                COUNT(*) as cantidad_devoluciones,
                SUM(monto_total_devuelto) as monto_total,
                ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM devolucion WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY))), 2) as porcentaje
            FROM devolucion 
            WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND estado = 'Aceptada'
            GROUP BY razon
            ORDER BY cantidad_devoluciones DESC
        `, [parseInt(periodo), parseInt(periodo)]);

        // Top clientes por monto
        const [topClientes] = await db.query(`
            SELECT 
                c.nombre,
                c.apellido,
                COUNT(v.id) as total_ventas,
                SUM(v.total) as monto_total,
                AVG(v.total) as promedio_venta
            FROM venta v
            JOIN cliente c ON v.id_cliente = c.id
            WHERE v.fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY) 
            AND v.estado IN ('Completado', 'Devuelto Parcialmente', 'Devuelto Totalmente')
            GROUP BY v.id_cliente, c.nombre, c.apellido
            ORDER BY monto_total DESC
            LIMIT 10
        `, [parseInt(periodo)]);

        res.json({
            ventas_vs_compras: ventasVsCompras,
            ventas_por_tipo_pago: ventasPorTipoPago,
            devoluciones_por_razon: devolucionesPorRazon,
            top_clientes: topClientes
        });
    } catch (error) {
        console.error('Error al obtener datos para gráficos:', error);
        res.status(500).json({ error: 'Error al obtener datos para gráficos' });
    }
};

module.exports = exports;

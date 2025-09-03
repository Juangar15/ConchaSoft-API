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
            WHERE p.activo = 1
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

module.exports = exports;

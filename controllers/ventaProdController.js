const db = require('../db');

exports.obtenerVentasProductos = async (req, res) => {
    try {
        const [ventaProd] = await db.query(`
            SELECT vp.*, v.fecha AS fecha_venta, pt.id_producto, pt.id_talla, p.nombre AS nombre_producto, t.talla AS talla
            FROM venta_prod vp
            INNER JOIN venta v ON vp.id_venta = v.id
            INNER JOIN producto_talla pt ON vp.id_producto_talla = pt.id
            INNER JOIN producto p ON pt.id_producto = p.id
            INNER JOIN talla t ON pt.id_talla = t.id_talla
        `);
        res.json(ventaProd);
    } catch (error) {
        ('Error al obtener la relación venta-producto:', error); // Mejor log detallado
        res.status(500).json({ error: 'Error al obtener la relación venta-producto' });
    }
};

exports.obtenerVentaProducto = async (req, res) => {
    try {
        const { id_venta, id_producto_talla } = req.params;
        const [ventaProd] = await db.query(`
            SELECT vp.*, v.fecha AS fecha_venta, pt.id_producto, pt.id_talla, p.nombre AS nombre_producto, t.talla AS talla
            FROM venta_prod vp
            INNER JOIN venta v ON vp.id_venta = v.id
            INNER JOIN producto_talla pt ON vp.id_producto_talla = pt.id
            INNER JOIN producto p ON pt.id_producto = p.id
            INNER JOIN talla t ON pt.id_talla = t.id_talla
            WHERE vp.id_venta = ? AND vp.id_producto_talla = ?
        `, [id_venta, id_producto_talla]);

        if (ventaProd.length === 0) {
            return res.status(404).json({ error: 'Relación venta-producto no encontrada' });
        }

        res.json(ventaProd[0]);
    } catch (error) {
        ('Error al obtener la relación venta-producto específica:', error); // Mejor log detallado
        res.status(500).json({ error: 'Error al obtener la relación venta-producto' });
    }
};

// Se eliminan las funciones crearVentaProducto, actualizarVentaProducto y eliminarVentaProducto
// ya que su lógica de modificación debe ser manejada por el ventaController u otros controladores de alto nivel.
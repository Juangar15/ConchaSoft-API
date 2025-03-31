const db = require('../db');

exports.obtenerProveedores = async (req, res) => {
    try {
        const [proveedores] = await db.query('SELECT * FROM proveedor');
        res.json(proveedores);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los proveedores' });
    }
};

exports.obtenerProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const [proveedor] = await db.query('SELECT * FROM proveedor WHERE id = ?', [id]);
        if (proveedor.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json(proveedor[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el proveedor'});
    }
};

exports.crearProveedor = async (req, res) => {
    try {
        const { nombre, telefono, direccion, estado } = req.body;
        if (!nombre || !telefono || !direccion || (estado !==0 && estado !==1)) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }
        await db.query(
            'INSERT INTO proveedor (nombre, telefono, direccion, estado) VALUES (?, ?, ?, ?)',
            [nombre, telefono, direccion, estado]
        );
        res.status(201).json({ mensaje: 'Proveedor creado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear el proveedor' });
    }
};

exports.actualizarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, telefono, direccion, estado } = req.body;
        const [result] = await db.query(
            'UPDATE proveedor SET nombre = ?, telefono = ?, direccion = ?, estado = ? WHERE id = ?',
            [nombre, telefono, direccion, estado, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json({ mensaje: 'Proveedor actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el proveedor' });
    }
};

exports.eliminarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM proveedor WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json({ mensaje: 'Proveedor eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar el proveedor' });
    }
};
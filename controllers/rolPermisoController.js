const db = require('../db');

exports.obtenerRolPermisos = async (req, res) => {
    try {
        const [rolPermisos] = await db.query(`
            SELECT rol_permiso.*, rol.rol, permiso.nombre AS permiso 
            FROM rol_permiso
            INNER JOIN rol ON rol_permiso.id_rol = rol.id
            INNER JOIN permiso ON rol_permiso.id_permiso = permiso.id
        `);
        res.json(rolPermisos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los permisos de los roles' });
    }
};

exports.obtenerRolPermiso = async (req, res) => {
    try {
        const { id } = req.params;
        const [rolPermiso] = await db.query(`
            SELECT rol_permiso.*, rol.rol, permiso.nombre AS permiso 
            FROM rol_permiso
            INNER JOIN rol ON rol_permiso.id_rol = rol.id
            INNER JOIN permiso ON rol_permiso.id_permiso = permiso.id
            WHERE rol_permiso.id = ?
        `, [id]);

        if (rolPermiso.length === 0) {
            return res.status(404).json({ error: 'Rol-Permiso no encontrado' });
        }

        res.json(rolPermiso[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el rol-permiso' });
    }
};

exports.crearRolPermiso = async (req, res) => {
    try {
        const { id_rol, id_permiso } = req.body;

        if (!id_rol || !id_permiso) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }

        // Verificar si el rol existe
        const [rolExiste] = await db.query('SELECT id FROM rol WHERE id = ?', [id_rol]);
        if (rolExiste.length === 0) {
            return res.status(400).json({ error: 'Rol no válido' });
        }

        // Verificar si el permiso existe
        const [permisoExiste] = await db.query('SELECT id FROM permiso WHERE id = ?', [id_permiso]);
        if (permisoExiste.length === 0) {
            return res.status(400).json({ error: 'Permiso no válido' });
        }

        // Verificar si la relación ya existe
        const [existe] = await db.query('SELECT id FROM rol_permiso WHERE id_rol = ? AND id_permiso = ?', [id_rol, id_permiso]);
        if (existe.length > 0) {
            return res.status(400).json({ error: 'Este permiso ya está asignado a este rol' });
        }

        await db.query('INSERT INTO rol_permiso (id_rol, id_permiso) VALUES (?, ?)', [id_rol, id_permiso]);

        res.status(201).json({ mensaje: 'Rol-Permiso creado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al asignar el permiso al rol' });
    }
};

exports.eliminarRolPermiso = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM rol_permiso WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Rol-Permiso no encontrado' });
        }

        res.json({ mensaje: 'Rol-Permiso eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar el rol-permiso' });
    }
};
const jwt = require('jsonwebtoken');
const db = require('../db');

// Middleware para verificar el token
exports.verificarToken = (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. No hay token' });
    }

    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        req.usuario = decoded; // Guardamos la info del usuario en req
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
};

// Middleware para verificar permisos según el rol
exports.verificarPermiso = (permisoRequerido) => async (req, res, next) => {
    try {
        const { id_rol } = req.usuario; // id_rol viene del token

        // Verificamos si el rol tiene el permiso requerido
        const [permisos] = await db.query(
            `SELECT permiso.nombre 
             FROM rol_permiso 
             INNER JOIN permiso ON rol_permiso.id_permiso = permiso.id 
             WHERE rol_permiso.id_rol = ? AND permiso.nombre = ?`,
            [id_rol, permisoRequerido]
        );

        if (permisos.length === 0) {
            return res.status(403).json({ error: 'Acceso denegado. No tienes permiso' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Error al verificar permisos' });
    }
};
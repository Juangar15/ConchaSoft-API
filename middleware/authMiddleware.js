const jwt = require('jsonwebtoken');
const db = require('../db'); // Asegúrate de que la ruta a tu conexión DB es correcta
require('dotenv').config();

// Middleware para verificar el token JWT y adjuntar la info del usuario a req.user
exports.verificarToken = (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acceso denegado. Formato de token inválido o no proporcionado.' });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        // 'decoded' contendrá { login: usuario.login, id_rol: usuario.id_rol }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // <--- **AQUÍ ESTÁ EL CAMBIO IMPORTANTE: AHORA USA 'req.user'**
        next();
    } catch (error) {
        // En caso de que el token sea inválido o haya expirado
        console.error('Error de verificación de token:', error); // Log para depuración
        res.status(403).json({ error: 'Token inválido o expirado.' });
    }
};

// Middleware para verificar permisos según el nombre del permiso
// Este middleware asume que req.user.id_rol ya está disponible gracias a verificarToken
exports.verificarPermiso = (permisoRequerido) => {
    return async (req, res, next) => {
        // Si verificarToken no se ejecutó, o no pasó el id_rol, esto fallaría.
        // Asegúrate de que verificarToken siempre se ejecute antes de verificarPermiso.
        if (!req.user || req.user.id_rol === undefined) { // <--- **AQUÍ ESTÁ EL CAMBIO: AHORA LEE DE 'req.user'**
            return res.status(403).json({ error: 'Acceso denegado: Información de rol no disponible en el token.' });
        }

        try {
            const idRol = req.user.id_rol; // <--- **AQUÍ ESTÁ EL CAMBIO: AHORA LEE DE 'req.user'**

            // Consultar la base de datos para verificar si el rol tiene el permiso
            const [permisos] = await db.query(
                `SELECT permiso.nombre
                 FROM rol_permiso
                 INNER JOIN permiso ON rol_permiso.id_permiso = permiso.id
                 WHERE rol_permiso.id_rol = ? AND permiso.nombre = ?`,
                [idRol, permisoRequerido]
            );

            if (permisos.length === 0) {
                return res.status(403).json({ error: 'Acceso denegado. No tienes el permiso requerido para esta acción.' });
            }

            next(); // Permite continuar con la ejecución de la ruta
        } catch (error) {
            console.error('Error al verificar permisos:', error);
            res.status(500).json({ error: 'Error interno del servidor al verificar permisos.' });
        }
    };
};
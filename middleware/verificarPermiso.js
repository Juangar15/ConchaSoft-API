const db = require('../db');

const verificarPermiso = (permisoRequerido) => {
    return async (req, res, next) => {
        try {
            const { login } = req.user; // req.user debe estar disponible tras la autenticación
            const [usuario] = await db.query('SELECT id_rol FROM usuario WHERE login = ?', [login]);

            if (usuario.length === 0) {
                return res.status(403).json({ error: 'Usuario no encontrado' });
            }

            const idRol = usuario[0].id_rol;

            // Verificar si el rol tiene el permiso requerido
            const [permiso] = await db.query(`
                SELECT p.nombre 
                FROM rol_permiso rp
                INNER JOIN permiso p ON rp.id_permiso = p.id
                WHERE rp.id_rol = ? AND p.nombre = ?
            `, [idRol, permisoRequerido]);

            if (permiso.length === 0) {
                return res.status(403).json({ error: 'No tienes permiso para realizar esta acción' });
            }

            next(); // Permite continuar con la ejecución de la ruta
        } catch (error) {
            res.status(500).json({ error: 'Error al verificar permisos' });
        }
    };
};

module.exports = verificarPermiso;
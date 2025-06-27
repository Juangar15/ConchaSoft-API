// controllers/rolController.js

const db = require('../db');

// --- Funciones existentes (crearRol, obtenerRoles, obtenerRolPorId, actualizarRol, eliminarRol) ---

const crearRol = async (req, res) => {
    try {
        // Asegúrate de que tu frontend envía 'rol', 'descripcion' y opcionalmente 'estado'.
        // Si no se envía 'estado', la columna con DEFAULT TRUE en la DB lo establecerá.
        const { rol, descripcion, estado } = req.body; 

        if (!rol) {
            return res.status(400).json({ error: "El campo 'rol' es obligatorio" });
        }

        // Si quieres que el backend siempre lo ponga en true al crear, ignora 'estado' del req.body
        // y usa 'true' directamente, o confía en el DEFAULT TRUE de la DB.
        // Si el frontend puede especificarlo, úsalo, si no, defínelo aquí.
        // Para simplicidad y consistencia con un estado por defecto, vamos a pasarlo
        // si viene, o usar true si no.
        const estadoInicial = estado !== undefined ? estado : true; // Si 'estado' no se envía, usa true.

        // Añade 'estado' a la inserción
        const [result] = await db.query(
            "INSERT INTO rol (rol, descripcion, estado) VALUES (?, ?, ?)", 
            [rol, descripcion, estadoInicial]
        );

        // Devuelve el estado en la respuesta
        res.status(201).json({ id: result.insertId, rol, descripcion, estado: estadoInicial });
    } catch (error) {
        console.error("Error al crear rol:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El nombre del rol ya existe.' });
        }
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

const obtenerRoles = async (req, res) => {
    try {
        // 1. Obtener parámetros de consulta
        const { page = 1, limit = 10, search } = req.query; // Valores predeterminados
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);

        // Calcular el OFFSET (el número de filas a saltar)
        const offset = (pageNumber - 1) * limitNumber;

        // 2. Construir la cláusula WHERE para el filtro de búsqueda
        let whereClause = '';
        let queryParams = [];

        if (search) {
            const searchTerm = `%${search}%`; // Para búsquedas con LIKE
            whereClause = `
                WHERE
                    rol LIKE ? OR
                    descripcion LIKE ? 
            `;
            queryParams = [
                searchTerm, searchTerm
            ];

            // Manejar la búsqueda por estado (si 'search' es 'activo' o 'inactivo')
            if (search.toLowerCase() === 'activo') {
                whereClause += (whereClause ? ' OR ' : ' WHERE ') + 'estado = 1'; // 1 para true en MySQL
            } else if (search.toLowerCase() === 'inactivo') {
                whereClause += (whereClause ? ' OR ' : ' WHERE ') + 'estado = 0'; // 0 para false en MySQL
            }
        }

        // 3. Obtener el total de elementos que coinciden con el filtro (sin paginación)
        const [totalRows] = await db.query(`SELECT COUNT(*) AS totalItems FROM rol ${whereClause}`, queryParams);
        const totalItems = totalRows[0].totalItems;

        // 4. Obtener los roles para la página actual con paginación
        const sqlQuery = `
            SELECT
                id, rol, descripcion, estado
            FROM
                rol
            ${whereClause}
            ORDER BY
                rol ASC
            LIMIT ? OFFSET ?;
        `;
        // Los queryParams se extienden con limitNumber y offset para la paginación
        const [roles] = await db.query(sqlQuery, [...queryParams, limitNumber, offset]);

        // No es necesario formatear fechas para roles a menos que tengas campos de fecha
        // const rolesFormateados = roles.map(rol => ({ ...rol })); // Si no hay fechas, no se necesita mapear

        // 5. Devolver los datos y la información de paginación
        res.json({
            roles: roles, // Envía los roles directamente si no necesitas formateo
            totalItems: totalItems,
            currentPage: pageNumber,
            itemsPerPage: limitNumber,
            totalPages: Math.ceil(totalItems / limitNumber),
        });

    } catch (error) {
        console.error("Error al obtener roles con paginación/búsqueda:", error);
        res.status(500).json({ error: "Error interno del servidor al obtener roles" });
    }
};

const obtenerRolPorId = async (req, res) => {
    try {
        const { id } = req.params;
        // Selecciona explícitamente todas las columnas, incluyendo 'estado'
        const [rol] = await db.query("SELECT id, rol, descripcion, estado FROM rol WHERE id = ?", [id]);

        if (rol.length === 0) {
            return res.status(404).json({ error: "Rol no encontrado" });
        }

        res.json(rol[0]);
    } catch (error) {
        console.error("Error al obtener rol:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

const actualizarRol = async (req, res) => {
    try {
        const { id } = req.params;
        // Ahora también esperamos 'estado' del body
        const { rol, descripcion, estado } = req.body; 

        if (!rol) {
            return res.status(400).json({ error: "El campo 'rol' es obligatorio para actualizar." });
        }

        // Valida que 'estado' sea un booleano (opcional, pero buena práctica)
        if (typeof estado !== 'boolean' && estado !== undefined && estado !== null) {
            return res.status(400).json({ error: "El campo 'estado' debe ser un booleano." });
        }

        // Modifica la consulta SQL para incluir la actualización de 'estado'
        const [result] = await db.query(
            "UPDATE rol SET rol = ?, descripcion = ?, estado = ? WHERE id = ?",
            [rol, descripcion, estado, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Rol no encontrado" });
        }

        res.json({ message: "Rol actualizado correctamente" });
    } catch (error) {
        console.error("Error al actualizar rol:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El nombre del rol ya existe.' });
        }
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

const eliminarRol = async (req, res) => {
    try {
        const { id } = req.params;

        // --- PASO 1: Verificar si hay usuarios asociados a este rol ---
        const [usersWithRole] = await db.query('SELECT COUNT(*) AS totalUsers FROM usuario WHERE id_rol = ?', [id]);
        const totalUsers = usersWithRole[0].totalUsers;

        if (totalUsers > 0) {
            return res.status(409).json({ error: `No se puede eliminar el rol porque tiene ${totalUsers} usuarios asociados. Por favor, reasigna o elimina los usuarios de este rol primero.` });
        }

        // --- PASO 2: Opcional, verificar si hay permisos asociados al rol ---
        // (Tu código ya tiene una sección de 'rol_permiso', así que esta verificación es importante)
        const [permissionsWithRole] = await db.query('SELECT COUNT(*) AS totalPermissions FROM rol_permiso WHERE id_rol = ?', [id]);
        const totalPermissions = permissionsWithRole[0].totalPermissions;

        if (totalPermissions > 0) {
             return res.status(409).json({ error: `No se puede eliminar el rol porque tiene ${totalPermissions} permisos asociados. Por favor, desasigna los permisos de este rol primero.` });
        }


        // --- PASO 3: Si no hay usuarios ni permisos asociados, procede con la eliminación del rol ---
        const [result] = await db.query("DELETE FROM rol WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Rol no encontrado." });
        }

        res.json({ message: "Rol eliminado correctamente." });

    } catch (error) {
        console.error("Error al eliminar rol:", error);
        // Si tienes FOREIGN KEY CONSTRAINTS en tu DB, MySQL ya te daría un error
        // pero esta lógica es más explícita y devuelve un mensaje más amigable.
        // El 'ER_ROW_IS_REFERENCED' que tienes comentado ya es una forma de esto,
        // pero la verificación previa te da más control y un mensaje más específico.
        res.status(500).json({ error: "Error interno del servidor al eliminar el rol." });
    }
};

// --- NUEVAS FUNCIONES PARA LA GESTIÓN DE PERMISOS POR ROL (MOVIDAS AQUÍ) ---

/**
 * Obtiene los IDs de los permisos asignados a un rol específico.
 * @param {object} req - Objeto de solicitud.
 * @param {object} res - Objeto de respuesta.
 */
const obtenerPermisosPorRol = async (req, res) => {
    const { id } = req.params; // id del rol

    if (!id) {
        return res.status(400).json({ error: 'ID de rol es obligatorio' });
    }

    try {
        const [results] = await db.query(
            'SELECT id_permiso FROM rol_permiso WHERE id_rol = ?',
            [id]
        );
        // Mapea el resultado a un array de IDs de permisos [1, 5, 8]
        const permisosAsignadosIds = results.map(row => row.id_permiso);
        res.json(permisosAsignadosIds);
    } catch (err) {
        console.error('Error al obtener permisos por rol:', err);
        res.status(500).json({ error: 'Error al obtener permisos asignados al rol' });
    }
};

/**
 * Asigna/desasigna permisos a un rol.
 * Espera un array de `permisoIds` en el cuerpo de la solicitud.
 * Elimina todos los permisos existentes para el rol y luego inserta los nuevos.
 */

const asignarPermisosARol = async (req, res) => {
    const { id } = req.params; // id del rol
    const { permisoIds } = req.body; // Esto debería ser un array de IDs de permisos [1, 2, 5]

    if (!id || !Array.isArray(permisoIds)) {
        return res.status(400).json({ error: 'ID de rol y un array de IDs de permisos son obligatorios.' });
    }

    let connection; // <-- Declara la variable para la conexión aquí

    try {
        // 1. Obtener una conexión individual del pool
        // ¡Esta es la clave! 'connection' tendrá los métodos de transacción
        connection = await db.getConnection(); 

        // 2. Iniciar la transacción con la conexión obtenida
        await connection.beginTransaction(); 

        // 3. Eliminar todos los permisos existentes para este rol
        // Usa 'connection.query' (no 'db.query')
        await connection.query('DELETE FROM rol_permiso WHERE id_rol = ?', [id]);

        // 4. Insertar los nuevos permisos
        if (permisoIds.length > 0) {
            const values = permisoIds.map(permisoId => [id, permisoId]);
            // Usa 'connection.query' (no 'db.query')
            await connection.query('INSERT INTO rol_permiso (id_rol, id_permiso) VALUES ?', [values]);
        }

        // 5. Si todo fue bien, confirma la transacción
        await connection.commit(); 

        res.status(200).json({ message: 'Permisos asignados al rol correctamente.' });

    } catch (err) {
        // 6. Si hubo un error, revierte la transacción
        // Asegúrate de que 'connection' exista antes de intentar el rollback
        if (connection) { 
            try {
                await connection.rollback(); 
            } catch (rollbackError) {
                console.error("Error al intentar deshacer la transacción:", rollbackError);
            }
        }
        console.error('Error al asignar permisos al rol:', err);
        res.status(500).json({ error: 'Error al asignar permisos al rol.', details: err.message }); // Añade detalles para depuración
    } finally {
        // 7. Es crucial liberar la conexión de vuelta al pool en el bloque finally
        if (connection) { // Asegúrate de que la conexión fue establecida
            connection.release(); 
        }
    }
};

module.exports = {
    crearRol,
    obtenerRoles,
    obtenerRolPorId,
    actualizarRol,
    eliminarRol,
    obtenerPermisosPorRol, // Exporta la nueva función
    asignarPermisosARol   // Exporta la nueva función
};
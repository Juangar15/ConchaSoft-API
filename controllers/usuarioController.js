const db = require('../db');
const bcrypt = require('bcrypt'); // Necesitas instalar bcrypt: npm install bcrypt

// --- Configuración de bcrypt ---
const saltRounds = 10; // Número de rondas de sal para el hashing de contraseñas. Un valor de 10-12 es común y seguro.

// --- Helper para validar si un rol existe ---
async function rolExists(id_rol) {
    if (id_rol === null || id_rol === undefined) {
        return true; // Si id_rol es NULL, se considera válido según tu esquema de DB
    }
    const [rows] = await db.query('SELECT id FROM rol WHERE id = ?', [id_rol]);
    return rows.length > 0;
}

// --- Obtener todos los usuarios con búsqueda y paginación (opcionalmente por estado) ---
exports.obtenerUsuarios = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, estado } = req.query; // Añade 'estado' como parámetro de consulta
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);

        if (isNaN(pageNumber) || pageNumber < 1) {
            return res.status(400).json({ error: "El número de página debe ser un entero positivo." });
        }
        if (isNaN(limitNumber) || limitNumber < 1) {
            return res.status(400).json({ error: "El límite de resultados debe ser un entero positivo." });
        }

        const offset = (pageNumber - 1) * limitNumber;

        let whereClauses = [];
        let queryParams = [];

        // Filtro de búsqueda general por texto (LIKE)
        if (search) {
            const searchTerm = `%${search}%`;
            whereClauses.push(`
                (login LIKE ? OR
                correo LIKE ?)
            `); // Puedes añadir más campos si quieres buscar por ellos
            queryParams.push(searchTerm, searchTerm);
        }

        // Filtro por estado específico (si 'estado' es un query param)
        if (estado !== undefined) {
            const estadoValue = parseInt(estado, 10);
            if (isNaN(estadoValue) || (estadoValue !== 0 && estadoValue !== 1)) {
                return res.status(400).json({ error: "El parámetro 'estado' debe ser 0 (inactivo) o 1 (activo)." });
            }
            whereClauses.push('activo = ?'); // Usamos 'activo' para el campo de estado
            queryParams.push(estadoValue);
        }

        const finalWhereClause = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

        // Obtener el total de elementos que coinciden con el filtro
        const [totalRows] = await db.query(`SELECT COUNT(*) AS totalItems FROM usuario ${finalWhereClause}`, queryParams);
        const totalItems = totalRows[0].totalItems;

        // Obtener los usuarios para la página actual con paginación (sin la contraseña)
        const sqlQuery = `
            SELECT login, correo, id_rol, activo
            FROM usuario
            ${finalWhereClause}
            ORDER BY login ASC
            LIMIT ? OFFSET ?;
        `;
        const [results] = await db.query(sqlQuery, [...queryParams, limitNumber, offset]);

        res.json({
            usuarios: results,
            totalItems: totalItems,
            currentPage: pageNumber,
            itemsPerPage: limitNumber,
            totalPages: Math.ceil(totalItems / limitNumber),
        });

    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener usuarios.' });
    }
};

// --- Obtener un usuario por login ---
exports.obtenerUsuario = async (req, res) => {
    try {
        const { login } = req.params;
        // No selecciones la contraseña por seguridad
        const [results] = await db.query('SELECT login, correo, id_rol, activo FROM usuario WHERE login = ?', [login]);

        if (results.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(results[0]);
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener el usuario.' });
    }
};

// --- Crear un nuevo usuario ---
exports.crearUsuario = async (req, res) => {
    try {
        const { login, contraseña, correo, id_rol, activo } = req.body; // Incluye 'activo' en el destructuring

        // --- Validación de entrada ---
        // 'activo' puede ser 0 (falso), por eso se comprueba explícitamente `activo === undefined` o `activo === null`
        if (!login || !contraseña || !correo || activo === undefined || activo === null) {
            return res.status(400).json({ error: 'Login, contraseña, correo y estado (activo) son campos obligatorios.' });
        }

        // Valida el formato del correo
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            return res.status(400).json({ error: 'El formato del correo electrónico no es válido.' });
        }

        // Valida la longitud de la contraseña (mínimo 8 caracteres)
        if (contraseña.length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
        }

        // --- Hashing de la contraseña ---
        const hashedPassword = await bcrypt.hash(contraseña, saltRounds);

        // --- Validación de ID de Rol ---
        if (id_rol !== undefined && id_rol !== null) {
            const roleExists = await rolExists(id_rol);
            if (!roleExists) {
                return res.status(400).json({ error: 'El ID de rol proporcionado no existe.' });
            }
        }

        // --- Inserción con el campo 'activo' y la contraseña hasheada ---
        const [result] = await db.query(
            'INSERT INTO usuario (login, contraseña, correo, id_rol, activo) VALUES (?, ?, ?, ?, ?)',
            [login, hashedPassword, correo, id_rol, activo]
        );

        res.status(201).json({ message: 'Usuario creado exitosamente', login: login });
    } catch (error) {
        // Manejo de errores específicos de MySQL, como duplicados
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.sqlMessage.includes('for key \'PRIMARY\'')) {
                return res.status(409).json({ error: 'El login ya está en uso.' });
            }
            if (error.sqlMessage.includes('for key \'correo\'')) { // Si tienes UNIQUE KEY en 'correo'
                return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
            }
        }
        console.error('Error al crear usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear usuario.' });
    }
};

// --- Actualizar un usuario ---
exports.actualizarUsuario = async (req, res) => {
    try {
        const { login } = req.params;
        // Permite actualizar contraseña, correo, id_rol y el campo 'activo'
        const { contraseña, correo, id_rol, activo } = req.body;

        const updateFields = [];
        const updateValues = [];

        // Hashing de contraseña solo si se proporciona una nueva
        if (contraseña !== undefined) {
            if (contraseña.length < 8) { // Validación de longitud al actualizar
                return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
            }
            const hashedPassword = await bcrypt.hash(contraseña, saltRounds);
            updateFields.push('contraseña = ?');
            updateValues.push(hashedPassword);
        }
        if (correo !== undefined) {
            // Valida el formato del correo al actualizar
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
                return res.status(400).json({ error: 'El formato del correo electrónico no es válido.' });
            }
            updateFields.push('correo = ?');
            updateValues.push(correo);
        }
        if (id_rol !== undefined) {
            if (id_rol !== null) {
                const roleExists = await rolExists(id_rol);
                if (!roleExists) {
                    return res.status(400).json({ error: 'El ID de rol proporcionado no existe.' });
                }
            }
            updateFields.push('id_rol = ?');
            updateValues.push(id_rol);
        }
        // Incluye la actualización del campo 'activo'
        if (activo !== undefined) {
            // Asegúrate que 'activo' sea un booleano (0 o 1)
            if (typeof activo !== 'boolean' && activo !== 0 && activo !== 1) {
                return res.status(400).json({ error: 'El campo "activo" debe ser un booleano (true/false o 0/1).' });
            }
            updateFields.push('activo = ?');
            updateValues.push(activo);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No hay campos para actualizar.' });
        }

        updateValues.push(login); // El último valor es el login para la cláusula WHERE

        const [result] = await db.query(
            `UPDATE usuario SET ${updateFields.join(', ')} WHERE login = ?`,
            updateValues
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario actualizado exitosamente' });
    } catch (error) {
        // Manejo de errores específicos de MySQL, como correo duplicado
        if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage.includes('for key \'correo\'')) {
            return res.status(409).json({ error: 'El correo electrónico ya está registrado para otro usuario.' });
        }
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar usuario.' });
    }
};

// --- Eliminar un usuario ---
// Recomiendo "desactivar" en lugar de "eliminar" para mantener el historial
// pero esta función se mantiene como la pediste para la eliminación física.
exports.eliminarUsuario = async (req, res) => {
    try {
        const { login } = req.params;

        const [result] = await db.query('DELETE FROM usuario WHERE login = ?', [login]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor al eliminar usuario.' });
    }
};

// --- Nueva función para Cambiar Estado (Activar/Desactivar) de Usuario ---
exports.cambiarEstadoUsuario = async (req, res) => {
    try {
        const { login } = req.params;
        const { activo } = req.body; // Se espera que 'activo' sea un booleano (true/false o 0/1)

        if (activo === undefined || (typeof activo !== 'boolean' && activo !== 0 && activo !== 1)) {
            return res.status(400).json({ error: 'El campo "activo" es obligatorio y debe ser un booleano (true/false o 0/1).' });
        }

        const [result] = await db.query(
            'UPDATE usuario SET activo = ? WHERE login = ?',
            [activo, login]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: `Usuario ${activo ? 'activado' : 'desactivado'} exitosamente.` });
    } catch (error) {
        console.error('Error al cambiar estado del usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor al cambiar el estado del usuario.' });
    }
};
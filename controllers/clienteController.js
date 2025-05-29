const db = require('../db'); // Asegúrate de que esta conexión a la base de datos sea la correcta.

// Obtener todos los clientes con búsqueda y paginación
exports.obtenerClientes = async (req, res) => {
    try {
        // 1. Obtener parámetros de consulta
        const { page = 1, limit = 10, search } = req.query; // Valores predeterminados
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);

        // Calcular el OFFSET (el número de filas a saltar)
        const offset = (pageNumber - 1) * limitNumber;

        // 2. Construir la consulta SQL para el filtro de búsqueda
        let whereClause = '';
        let queryParams = [];

        if (search) {
            const searchTerm = `%${search}%`; // Para búsquedas con LIKE
            whereClause = `
                WHERE
                    nombre LIKE ? OR
                    apellido LIKE ? OR
                    correo LIKE ? OR
                    direccion LIKE ? OR
                    municipio LIKE ? OR
                    barrio LIKE ? OR
                    telefono LIKE ? OR
                    documento LIKE ? OR      -- Añadido para búsqueda por documento
                    tipo_documento LIKE ? OR -- Añadido para búsqueda por tipo_documento
                    genero LIKE ?            -- Añadido para búsqueda por genero
            `;
            // Asegúrate de que el número de '?' coincida con el número de parámetros
            queryParams = [
                searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
                searchTerm, searchTerm, searchTerm // Nuevos campos añadidos
            ];

            // Manejar la búsqueda por estado (si 'search' es 'activo' o 'inactivo')
            // Asumiendo que 'estado' es un TINYINT(1) o BOOLEAN en MySQL
            if (search.toLowerCase() === 'activo') {
                whereClause += (whereClause ? ' OR ' : ' WHERE ') + 'estado = 1'; // 1 para true en MySQL
            } else if (search.toLowerCase() === 'inactivo') {
                whereClause += (whereClause ? ' OR ' : ' WHERE ') + 'estado = 0'; // 0 para false en MySQL
            }
        }

        // 3. Obtener el total de elementos que coinciden con el filtro (sin paginación)
        const [totalRows] = await db.query(`SELECT COUNT(*) AS totalItems FROM cliente ${whereClause}`, queryParams);
        const totalItems = totalRows[0].totalItems;

        // 4. Obtener los clientes para la página actual con paginación
        const sqlQuery = `
            SELECT
                id, nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, municipio, barrio, estado
            FROM
                cliente
            ${whereClause}
            ORDER BY
                nombre ASC, apellido ASC
            LIMIT ? OFFSET ?;
        `;
        // Los queryParams para la paginación se añaden al final
        const [clientes] = await db.query(sqlQuery, [...queryParams, limitNumber, offset]);

        // 5. Devolver los datos y el total
        res.json({
            clientes: clientes,
            totalItems: totalItems,
            currentPage: pageNumber,
            itemsPerPage: limitNumber,
            totalPages: Math.ceil(totalItems / limitNumber),
        });

    } catch (error) {
        console.error('Error al obtener los clientes:', error);
        res.status(500).json({ error: 'Error al obtener los clientes' });
    }
};

// Obtener un cliente por ID
exports.obtenerCliente = async (req, res) => {
    try {
        const { id } = req.params;

        // Se añaden los nuevos campos a la consulta SELECT
        const [cliente] = await db.query(
            'SELECT id, nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, municipio, barrio, estado FROM cliente WHERE id = ?',
            [id]
        );

        if (cliente.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const clienteEncontrado = cliente[0];
        res.json(clienteEncontrado);

    } catch (error) {
        console.error('Error al obtener el cliente:', error);
        res.status(500).json({ error: 'Error interno al obtener el cliente' });
    }
};

// Crear un cliente
exports.crearCliente = async (req, res) => {
    try {
        // Se desestructuran los nuevos campos del req.body
        const { nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, municipio, barrio, estado } = req.body;

        // Se actualiza la validación para incluir los nuevos campos obligatorios
        if (!nombre || !apellido || !tipo_documento || !documento || !correo || !fecha_nacimiento || !genero || !direccion || !municipio || estado === undefined) {
            return res.status(400).json({ error: 'Todos los campos obligatorios deben ser proporcionados' });
        }

        // Se actualiza la consulta INSERT para incluir los nuevos campos
        await db.query(
            'INSERT INTO cliente (nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, municipio, barrio, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nombre, apellido, tipo_documento, documento, correo, telefono || null, fecha_nacimiento, genero, direccion, municipio, barrio || null, estado]
        );

        res.status(201).json({ mensaje: 'Cliente creado correctamente' });
    } catch (error) {
        console.error('Error al crear el cliente:', error);
        // Manejo de error específico para duplicidad de documento/correo
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.sqlMessage.includes('documento')) {
                return res.status(409).json({ error: 'El número de documento ya está registrado' });
            }
            if (error.sqlMessage.includes('correo')) {
                return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
            }
        }
        res.status(500).json({ error: 'Error al crear el cliente' });
    }
};

// Actualizar un cliente
exports.actualizarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        // Se desestructuran los nuevos campos del req.body
        const { nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, municipio, barrio, estado } = req.body;

        // Se actualiza la consulta UPDATE para incluir los nuevos campos
        const [result] = await db.query(
            'UPDATE cliente SET nombre = ?, apellido = ?, tipo_documento = ?, documento = ?, correo = ?, telefono = ?, fecha_nacimiento = ?, genero = ?, direccion = ?, municipio = ?, barrio = ?, estado = ? WHERE id = ?',
            [nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, municipio, barrio, estado, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json({ mensaje: 'Cliente actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar el cliente:', error);
        // Manejo de error específico para duplicidad de documento/correo al actualizar
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.sqlMessage.includes('documento')) {
                return res.status(409).json({ error: 'El número de documento ya está registrado para otro cliente' });
            }
            if (error.sqlMessage.includes('correo')) {
                return res.status(409).json({ error: 'El correo electrónico ya está registrado para otro cliente' });
            }
        }
        res.status(500).json({ error: 'Error al actualizar el cliente' });
    }
};

// Eliminar un cliente (sin cambios, ya que no se afectaron sus campos)
exports.eliminarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM cliente WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json({ mensaje: 'Cliente eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar el cliente:', error);
        // Es importante recordar que si hay FKs con ON DELETE RESTRICT,
        // este DELETE fallará si el cliente tiene registros asociados.
        res.status(500).json({ error: 'Error al eliminar el cliente' });
    }
};

module.exports = exports;
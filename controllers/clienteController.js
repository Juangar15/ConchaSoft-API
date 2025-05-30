const db = require('../db'); // Asegúrate de que esta conexión a la base de datos sea la correcta.

// Función auxiliar para formatear la fecha a YYYY-MM-DD
// Esta función se encarga de que, sin importar si la fecha viene como
// "2004-01-21T00:00:00.000Z" (de la DB) o "2004-01-21" (del frontend),
// siempre se transforme a "YYYY-MM-DD".
const formatDateToYYYYMMDD = (dateString) => {
    if (!dateString) return null; // Retorna null si la cadena de fecha es vacía o nula

    try {
        const dateObj = new Date(dateString);

        // Verifica si la fecha es válida. new Date() puede devolver "Invalid Date"
        if (isNaN(dateObj.getTime())) {
            console.warn(`Fecha inválida proporcionada para formateo: ${dateString}`);
            return null; // Retorna null si la fecha no es parseable
        }

        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Los meses son de 0-11, por eso +1
        const day = String(dateObj.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error al formatear la fecha:", dateString, e);
        return null; // En caso de un error inesperado al parsear
    }
};

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
                    departamento LIKE ? OR
                    municipio LIKE ? OR
                    barrio LIKE ? OR
                    telefono LIKE ? OR
                    documento LIKE ? OR
                    tipo_documento LIKE ? OR
                    genero LIKE ?
            `;
            queryParams = [
                searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
                searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm
            ];

            // Manejar la búsqueda por estado (si 'search' es 'activo' o 'inactivo')
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
                id, nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado
            FROM
                cliente
            ${whereClause}
            ORDER BY
                nombre ASC, apellido ASC
            LIMIT ? OFFSET ?;
        `;
        const [clientes] = await db.query(sqlQuery, [...queryParams, limitNumber, offset]);

        // ****** MODIFICACIÓN CLAVE AQUÍ (Para GET: Formatear la fecha para el frontend) ******
        // Mapea los clientes para formatear la fecha de nacimiento
        const clientesFormateados = clientes.map(cliente => ({
            ...cliente,
            // Asegura que fecha_nacimiento siempre esté en YYYY-MM-DD para el frontend
            fecha_nacimiento: formatDateToYYYYMMDD(cliente.fecha_nacimiento)
        }));
        // *************************************************************************************

        // 5. Devolver los datos y el total
        res.json({
            clientes: clientesFormateados, // Usar los clientes formateados
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

        const [cliente] = await db.query(
            'SELECT id, nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado FROM cliente WHERE id = ?',
            [id]
        );

        if (cliente.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        let clienteEncontrado = cliente[0];

        // ****** MODIFICACIÓN CLAVE AQUÍ (Para GET por ID: Formatear la fecha para el frontend) ******
        // Asegura que fecha_nacimiento siempre esté en YYYY-MM-DD para el frontend
        clienteEncontrado.fecha_nacimiento = formatDateToYYYYMMDD(clienteEncontrado.fecha_nacimiento);
        // *********************************************************************************************

        res.json(clienteEncontrado);

    } catch (error) {
        console.error('Error al obtener el cliente:', error);
        res.status(500).json({ error: 'Error interno al obtener el cliente' });
    }
};

// Crear un cliente
exports.crearCliente = async (req, res) => {
    try {
        const { nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado } = req.body;

        if (!nombre || !apellido || !tipo_documento || !documento || !correo || !fecha_nacimiento || !genero || !direccion || !departamento || !municipio || estado === undefined) {
            return res.status(400).json({ error: 'Todos los campos obligatorios (nombre, apellido, tipo_documento, documento, correo, fecha_nacimiento, genero, direccion, departamento, municipio, estado) deben ser proporcionados.' });
        }

        // ****** MODIFICACIÓN CLAVE AQUÍ (Para POST: Formatear la fecha para la DB) ******
        // Asegura que la fecha_nacimiento se guarde en YYYY-MM-DD
        const fechaNacimientoParaDB = formatDateToYYYYMMDD(fecha_nacimiento);
        if (fechaNacimientoParaDB === null && fecha_nacimiento !== null && fecha_nacimiento !== '') {
            // Si el frontend envió un valor pero no se pudo formatear, es un error
            return res.status(400).json({ error: 'Formato de fecha de nacimiento inválido.' });
        }
        // ******************************************************************************

        await db.query(
            'INSERT INTO cliente (nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nombre, apellido, tipo_documento, documento, correo, telefono || null, fechaNacimientoParaDB, genero, direccion, departamento, municipio, barrio || null, estado]
        );

        res.status(201).json({ mensaje: 'Cliente creado correctamente' });
    } catch (error) {
        console.error('Error al crear el cliente:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.sqlMessage.includes('documento')) {
                return res.status(409).json({ error: 'El número de documento ya está registrado' });
            }
            if (error.sqlMessage.includes('correo')) {
                return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
            }
        }
        // Puedes añadir un manejo de error específico para errores de fecha si db.query
        // te da un código de error reconocible para eso. Por ahora, el 500 genérico.
        res.status(500).json({ error: 'Error al crear el cliente' });
    }
};

// Actualizar un cliente
exports.actualizarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado } = req.body;

        // ****** MODIFICACIÓN CLAVE AQUÍ (Para PUT: Formatear la fecha para la DB) ******
        // Asegura que la fecha_nacimiento se guarde en YYYY-MM-DD
        const fechaNacimientoParaDB = formatDateToYYYYMMDD(fecha_nacimiento);
        if (fechaNacimientoParaDB === null && fecha_nacimiento !== null && fecha_nacimiento !== '') {
            return res.status(400).json({ error: 'Formato de fecha de nacimiento inválido.' });
        }
        // ******************************************************************************

        const [result] = await db.query(
            'UPDATE cliente SET nombre = ?, apellido = ?, tipo_documento = ?, documento = ?, correo = ?, telefono = ?, fecha_nacimiento = ?, genero = ?, direccion = ?, departamento = ?, municipio = ?, barrio = ?, estado = ? WHERE id = ?',
            [nombre, apellido, tipo_documento, documento, correo, telefono, fechaNacimientoParaDB, genero, direccion, departamento, municipio, barrio, estado, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json({ mensaje: 'Cliente actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar el cliente:', error);
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
        res.status(500).json({ error: 'Error al eliminar el cliente' });
    }
};

module.exports = exports;
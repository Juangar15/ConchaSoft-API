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
                    telefono LIKE ?
            `;
            queryParams = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];

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
                id, nombre, apellido, correo, direccion, municipio, barrio, telefono, estado
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

// Obtener un cliente por ID (sin referencia a saldo_a_favor)
exports.obtenerCliente = async (req, res) => {
    try {
        const { id } = req.params;

        // Consulta sin saldo_a_favor
        const [cliente] = await db.query(
            'SELECT id, nombre, apellido, correo, direccion, municipio, barrio, telefono, estado FROM cliente WHERE id = ?',
            [id]
        );

        if (cliente.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const clienteSinSaldo = cliente[0]; // Ya no se llama "clienteConSaldo"
        res.json(clienteSinSaldo);

    } catch (error) {
        console.error('Error al obtener el cliente:', error);
        res.status(500).json({ error: 'Error interno al obtener el cliente' });
    }
};

// Crear un cliente (sin cambios, ya que saldo_a_favor no se insertaba)
exports.crearCliente = async (req, res) => {
    try {
        const { nombre, apellido, correo, direccion, municipio, barrio, telefono, estado } = req.body;

        if (!nombre || !apellido || !correo || !direccion || !municipio || estado === undefined) {
            return res.status(400).json({ error: 'Todos los campos obligatorios deben ser proporcionados' });
        }

        await db.query(
            'INSERT INTO cliente (nombre, apellido, correo, direccion, municipio, barrio, telefono, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [nombre, apellido, correo, direccion, municipio, barrio || null, telefono || null, estado]
        );

        res.status(201).json({ mensaje: 'Cliente creado correctamente' });
    } catch (error) {
        console.error('Error al crear el cliente:', error);

        res.status(500).json({ error: 'Error al crear el cliente' });
    }
};

// Actualizar un cliente (sin cambios, ya que saldo_a_favor no se actualizaba directamente)
exports.actualizarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, correo, direccion, municipio, barrio, telefono, estado } = req.body;

        const [result] = await db.query(
            'UPDATE cliente SET nombre = ?, apellido = ?, correo = ?, direccion = ?, municipio = ?, barrio = ?, telefono = ?, estado = ? WHERE id = ?',
            [nombre, apellido, correo, direccion, municipio, barrio, telefono, estado, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json({ mensaje: 'Cliente actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar el cliente:', error);
        res.status(500).json({ error: 'Error al actualizar el cliente' });
    }
};

// Eliminar un cliente (sin cambios)
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
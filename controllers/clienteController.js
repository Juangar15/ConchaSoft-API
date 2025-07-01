const db = require('../db'); // Asegúrate de que esta conexión a la base de datos sea la correcta.

// Función auxiliar para formatear la fecha a YYYY-MM-DD
const formatDateToYYYYMMDD = (dateString) => {
    if (!dateString) return null;

    try {
        const dateObj = new Date(dateString);

        if (isNaN(dateObj.getTime())) {
            return null;
        }

        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    } catch (e) {
        ("Error al formatear la fecha:", dateString, e);
        return null;
    }
};

// --- MODIFICACIÓN CLAVE AQUÍ: Obtener TODOS los clientes (sin paginación ni búsqueda en la API) ---
exports.obtenerClientes = async (req, res) => {
    try {
        // 1. Eliminar los parámetros de paginación y búsqueda del req.query
        // No necesitamos: const { page = 1, limit = 10, search } = req.query;

        // 2. Consulta SQL para obtener todos los clientes
        const sqlQuery = `
            SELECT
                id, nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado
            FROM
                cliente
            ORDER BY
                nombre ASC, apellido ASC; -- Puedes mantener el ordenamiento si lo deseas
        `;
        const [clientes] = await db.query(sqlQuery); // No se pasan queryParams para search, limit, offset

        // Formatear la fecha de nacimiento para cada cliente
        const clientesFormateados = clientes.map(cliente => ({
            ...cliente,
            fecha_nacimiento: formatDateToYYYYMMDD(cliente.fecha_nacimiento)
        }));

        // 3. Devolver solo el array de clientes
        // No se devuelven totalItems, currentPage, etc.
        res.json(clientesFormateados);

    } catch (error) {
        ('Error al obtener los clientes desde la API (sin paginación):', error);
        res.status(500).json({ error: 'Error al obtener los clientes' });
    }
};

// --- Las demás funciones (obtenerCliente por ID, crearCliente, actualizarCliente, eliminarCliente)
//     pueden quedarse como están, ya que su lógica no se ve afectada por este cambio ---

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
        clienteEncontrado.fecha_nacimiento = formatDateToYYYYMMDD(clienteEncontrado.fecha_nacimiento);

        res.json(clienteEncontrado);

    } catch (error) {
        ('Error al obtener el cliente:', error);
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

        const fechaNacimientoParaDB = formatDateToYYYYMMDD(fecha_nacimiento);
        if (fechaNacimientoParaDB === null && fecha_nacimiento !== null && fecha_nacimiento !== '') {
            return res.status(400).json({ error: 'Formato de fecha de nacimiento inválido.' });
        }

        await db.query(
            'INSERT INTO cliente (nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nombre, apellido, tipo_documento, documento, correo, telefono || null, fechaNacimientoParaDB, genero, direccion, departamento, municipio, barrio || null, estado]
        );

        res.status(201).json({ mensaje: 'Cliente creado correctamente' });
    } catch (error) {
        ('Error al crear el cliente:', error);
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
        const { nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado } = req.body;

        const fechaNacimientoParaDB = formatDateToYYYYMMDD(fecha_nacimiento);
        if (fechaNacimientoParaDB === null && fecha_nacimiento !== null && fecha_nacimiento !== '') {
            return res.status(400).json({ error: 'Formato de fecha de nacimiento inválido.' });
        }

        const [result] = await db.query(
            'UPDATE cliente SET nombre = ?, apellido = ?, tipo_documento = ?, documento = ?, correo = ?, telefono = ?, fecha_nacimiento = ?, genero = ?, direccion = ?, departamento = ?, municipio = ?, barrio = ?, estado = ? WHERE id = ?',
            [nombre, apellido, tipo_documento, documento, correo, telefono, fechaNacimientoParaDB, genero, direccion, departamento, municipio, barrio, estado, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json({ mensaje: 'Cliente actualizado correctamente' });
    } catch (error) {
        ('Error al actualizar el cliente:', error);
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

// Eliminar un cliente
exports.eliminarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM cliente WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json({ mensaje: 'Cliente eliminado correctamente' });
    } catch (error) {
        ('Error al eliminar el cliente:', error);
        res.status(500).json({ error: 'Error al eliminar el cliente' });
    }
};

module.exports = exports;
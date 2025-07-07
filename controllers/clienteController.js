// controllers/clienteController.js

const db = require('../db'); // Asegúrate de que la ruta a tu conexión de BD sea correcta.

// Función auxiliar para formatear la fecha a YYYY-MM-DD
const formatDateToYYYYMMDD = (dateString) => {
    if (!dateString) return null;
    try {
        const dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) return null;
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error al formatear la fecha:", dateString, e);
        return null;
    }
};

// --- OBTENER SALDO DE UN CLIENTE (NUEVA FUNCIÓN) ---
// Es la forma correcta y segura de consultar el saldo de un cliente.
exports.obtenerSaldoCliente = async (req, res) => {
    try {
        const { id_cliente } = req.params;

        // La única fuente de verdad: la tabla de movimientos.
        // Suma todos los créditos y resta todos los débitos.
        const [saldoResult] = await db.query(
            `SELECT
                COALESCE(SUM(CASE WHEN tipo_movimiento = 'credito' THEN monto ELSE -monto END), 0) AS saldo_actual
            FROM movimiento_saldo_cliente
            WHERE id_cliente = ?`,
            [id_cliente]
        );

        const saldo_actual = saldoResult[0]?.saldo_actual || 0;

        res.json({ id_cliente, saldo_actual: parseFloat(saldo_actual) });

    } catch (error) {
        console.error('Error al obtener el saldo del cliente:', error);
        res.status(500).json({ error: 'Error interno al obtener el saldo del cliente' });
    }
};

// --- FUNCIONES CRUD ESTÁNDAR (CORREGIDAS SIN SALDO_A_FAVOR) ---

exports.obtenerClientes = async (req, res) => {
    try {
        const sqlQuery = `
            SELECT id, nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado
            FROM cliente
            ORDER BY nombre ASC, apellido ASC;
        `;
        const [clientes] = await db.query(sqlQuery);

        const clientesFormateados = clientes.map(cliente => ({
            ...cliente,
            fecha_nacimiento: formatDateToYYYYMMDD(cliente.fecha_nacimiento)
        }));
        res.json(clientesFormateados);
    } catch (error) {
        console.error('Error al obtener los clientes:', error);
        res.status(500).json({ error: 'Error al obtener los clientes' });
    }
};

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
        console.error('Error al obtener el cliente:', error);
        res.status(500).json({ error: 'Error interno al obtener el cliente' });
    }
};

exports.crearCliente = async (req, res) => {
    try {
        const { nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado } = req.body;

        if (!nombre || !apellido || !tipo_documento || !documento || !correo || !fecha_nacimiento || !genero || !direccion || !departamento || !municipio || estado === undefined) {
            return res.status(400).json({ error: 'Todos los campos obligatorios deben ser proporcionados.' });
        }

        const fechaNacimientoParaDB = formatDateToYYYYMMDD(fecha_nacimiento);

        await db.query(
            'INSERT INTO cliente (nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nombre, apellido, tipo_documento, documento, correo, telefono || null, fechaNacimientoParaDB, genero, direccion, departamento, municipio, barrio || null, estado]
        );
        res.status(201).json({ mensaje: 'Cliente creado correctamente' });
    } catch (error) {
        console.error('Error al crear el cliente:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            const message = error.sqlMessage.includes('documento') 
                ? 'El número de documento ya está registrado' 
                : 'El correo electrónico ya está registrado';
            return res.status(409).json({ error: message });
        }
        res.status(500).json({ error: 'Error al crear el cliente' });
    }
};

exports.actualizarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, tipo_documento, documento, correo, telefono, fecha_nacimiento, genero, direccion, departamento, municipio, barrio, estado } = req.body;
        const fechaNacimientoParaDB = formatDateToYYYYMMDD(fecha_nacimiento);

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
            const message = error.sqlMessage.includes('documento')
                ? 'El número de documento ya está registrado para otro cliente'
                : 'El correo electrónico ya está registrado para otro cliente';
            return res.status(409).json({ error: message });
        }
        res.status(500).json({ error: 'Error al actualizar el cliente' });
    }
};

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

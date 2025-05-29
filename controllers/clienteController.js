const db = require('../db');

// Obtener todos los clientes
exports.obtenerClientes = async (req, res) => {
    try {
        const [clientes] = await db.query('SELECT * FROM cliente');
        res.json(clientes);
    } catch (error) {
        console.error('Error al obtener los clientes:', error);
        res.status(500).json({ error: 'Error al obtener los clientes' });
    }
};

// Obtener un cliente por ID con saldo a favor
// Obtener un cliente por ID, ahora leyendo el saldo directamente del campo en la tabla cliente
exports.obtenerCliente = async (req, res) => {
        try {
            const { id } = req.params;
    
            // *** CONSULTA SIMPLIFICADA: Leer el saldo directamente del campo en la tabla cliente ***
            // Asegúrate de seleccionar todas las columnas que la app Flutter espera recibir, además de saldo_a_favor
            const [cliente] = await db.query(
                'SELECT id, nombre, apellido, correo, direccion, municipio, barrio, telefono, estado FROM cliente WHERE id = ?',
                [id]
            );
    
            if (cliente.length === 0) {
                return res.status(404).json({ error: 'Cliente no encontrado' });
            }
    
            // El resultado ya viene con el campo saldo_a_favor incluido
            const clienteConSaldo = cliente[0];
    
            // Opcional: Log para confirmar que leemos el saldo directamente
            console.log('Backend obtenerCliente: Saldo leído directamente del cliente:', clienteConSaldo.saldo_a_favor);
    
            res.json(clienteConSaldo);
    
        } catch (error) {
            console.error('Error al obtener el cliente:', error); // Error si falla la lectura directa
            res.status(500).json({ error: 'Error interno al obtener el cliente' });
        }
    };

// Crear un cliente
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

// Actualizar un cliente
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
        console.error('Error al eliminar el cliente:', error);
        res.status(500).json({ error: 'Error al eliminar el cliente' });
    }
};

module.exports = exports;
const db = require('../db');

/**
 * @function obtenerProveedores
 * @description Obtiene todos los proveedores de la base de datos.
 * @param {Object} req - Objeto de solicitud de Express.
 * @param {Object} res - Objeto de respuesta de Express.
 */

// Obtiene todos los proveedores activos para usarlos en formularios (ej. en Compras)
exports.obtenerProveedoresActivos = async (req, res) => {
    try {
        const [proveedoresActivos] = await db.query(`
            SELECT id, nombre_comercial, razon_social 
            FROM proveedor 
            WHERE estado = 1 
            ORDER BY nombre_comercial
        `);
        res.json(proveedoresActivos);
    } catch (error) {
        console.error('Error al obtener los proveedores activos:', error);
        res.status(500).json({ error: 'Error al obtener los proveedores activos' });
    }
};


exports.obtenerProveedores = async (req, res) => {
    try {
        // Consulta todos los campos de la tabla proveedor
        const [proveedores] = await db.query('SELECT * FROM proveedor');
        res.json(proveedores);
    } catch (error) {
        ('Error al obtener los proveedores:', error); // Log del error para depuración
        res.status(500).json({ error: 'Error interno del servidor al obtener los proveedores.' });
    }
};

/**
 * @function obtenerProveedor
 * @description Obtiene un proveedor específico por su ID.
 * @param {Object} req - Objeto de solicitud de Express con el ID en params.
 * @param {Object} res - Objeto de respuesta de Express.
 */
exports.obtenerProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        // Consulta un proveedor por su ID
        const [proveedor] = await db.query('SELECT * FROM proveedor WHERE id = ?', [id]);
        if (proveedor.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado.' });
        }
        res.json(proveedor[0]);
    } catch (error) {
        (`Error al obtener el proveedor con ID ${req.params.id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor al obtener el proveedor.' });
    }
};

/**
 * @function crearProveedor
 * @description Crea un nuevo proveedor en la base de datos.
 * @param {Object} req - Objeto de solicitud de Express con los datos del proveedor en body.
 * @param {Object} res - Objeto de respuesta de Express.
 */
exports.crearProveedor = async (req, res) => {
    try {
        const {
            tipo_proveedor,
            nombre_comercial,
            razon_social,
            nombre_contacto,
            tipo_documento,
            documento,
            correo,
            telefono,
            direccion,
            departamento,
            municipio,
            barrio,
            estado
        } = req.body;

        // --- Validación de campos obligatorios comunes ---
        if (!tipo_proveedor || !tipo_documento || !documento || !correo || !telefono || !direccion || !departamento || !municipio || (estado !== 0 && estado !== 1)) {
            return res.status(400).json({ error: 'Faltan campos obligatorios para el proveedor.' });
        }

        // --- Validación específica según el tipo de proveedor ---
        if (tipo_proveedor === 'persona_natural') {
            if (!nombre_comercial) {
                return res.status(400).json({ error: 'Para persona natural, el nombre comercial (nombre) es obligatorio.' });
            }
            // Asegurarse de que razon_social y nombre_contacto sean NULL para persona_natural
            if (razon_social || nombre_contacto) {
                return res.status(400).json({ error: 'Razón social y nombre de contacto no deben ser provistos para persona natural.' });
            }
        } else if (tipo_proveedor === 'empresa') {
            if (!razon_social) {
                return res.status(400).json({ error: 'Para empresa, la razón social es obligatoria.' });
            }
        } else {
            return res.status(400).json({ error: 'Tipo de proveedor inválido. Debe ser "persona_natural" o "empresa".' });
        }

        // --- Inserción en la base de datos ---
        const query = `
            INSERT INTO proveedor (
                tipo_proveedor,
                nombre_comercial,
                razon_social,
                nombre_contacto,
                tipo_documento,
                documento,
                correo,
                telefono,
                direccion,
                departamento,
                municipio,
                barrio,
                estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            tipo_proveedor,
            nombre_comercial,
            razon_social,
            nombre_contacto,
            tipo_documento,
            documento,
            correo,
            telefono,
            direccion,
            departamento,
            municipio,
            barrio,
            estado
        ];

        await db.query(query, values);
        res.status(201).json({ mensaje: 'Proveedor creado correctamente.' });
    } catch (error) {
        // Manejo de errores específicos de la base de datos (ej. duplicados)
        if (error.code === 'ER_DUP_ENTRY') {
            let errorMessage = 'Ya existe un proveedor con el mismo ';
            if (error.message.includes('documento_UNIQUE')) {
                errorMessage += 'documento.';
            } else if (error.message.includes('correo_UNIQUE')) {
                errorMessage += 'correo electrónico.';
            } else {
                errorMessage = 'Error de duplicado en la base de datos.';
            }
            return res.status(409).json({ error: errorMessage }); // 409 Conflict
        }
        ('Error al crear el proveedor:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear el proveedor.' });
    }
};

/**
 * @function actualizarProveedor
 * @description Actualiza un proveedor existente por su ID.
 * Permite actualización parcial de campos.
 * @param {Object} req - Objeto de solicitud de Express con el ID en params y los datos en body.
 * @param {Object} res - Objeto de respuesta de Express.
 */
exports.actualizarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // Se esperan los campos a actualizar en el body

        // Primero, verificar si el proveedor existe
        const [existingProveedor] = await db.query('SELECT * FROM proveedor WHERE id = ?', [id]);
        if (existingProveedor.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado para actualizar.' });
        }

        const currentProveedor = existingProveedor[0];
        const updatedFields = {};
        const queryParams = [];

        // Construir dinámicamente la consulta de actualización
        // Solo incluir los campos que se proporcionaron en el body
        for (const key in updates) {
            // Evitar actualizar el ID y asegurarse de que el campo exista en el modelo
            if (key !== 'id' && currentProveedor.hasOwnProperty(key)) {
                updatedFields[key] = updates[key];
                queryParams.push(`${key} = ?`);
            }
        }

        // Si no hay campos para actualizar, devolver un error
        if (Object.keys(updatedFields).length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos válidos para actualizar.' });
        }

        // --- Validación de la lógica de negocio al actualizar ---
        // Si se intenta cambiar el tipo_proveedor o campos dependientes, se debe validar la coherencia
        if (updates.tipo_proveedor && updates.tipo_proveedor !== currentProveedor.tipo_proveedor) {
            // Si el tipo de proveedor cambia, se podría requerir una validación más estricta
            // Por ejemplo, si cambia a 'persona_natural', 'razon_social' debe ser nulo.
            // Para simplificar, asumimos que el frontend enviará los valores correctos o nulos según el tipo.
        }

        // Si se actualiza el 'estado', validar que sea 0 o 1
        if (updates.hasOwnProperty('estado') && (updates.estado !== 0 && updates.estado !== 1)) {
            return res.status(400).json({ error: 'El campo "estado" debe ser 0 (inactivo) o 1 (activo).' });
        }

        // Si se actualiza el documento o correo, verificar que no haya duplicados
        if (updates.documento && updates.documento !== currentProveedor.documento) {
            const [docCheck] = await db.query('SELECT id FROM proveedor WHERE documento = ? AND id != ?', [updates.documento, id]);
            if (docCheck.length > 0) {
                return res.status(409).json({ error: 'El número de documento ya está registrado por otro proveedor.' });
            }
        }
        if (updates.correo && updates.correo !== currentProveedor.correo) {
            const [emailCheck] = await db.query('SELECT id FROM proveedor WHERE correo = ? AND id != ?', [updates.correo, id]);
            if (emailCheck.length > 0) {
                return res.status(409).json({ error: 'El correo electrónico ya está registrado por otro proveedor.' });
            }
        }

        const query = `UPDATE proveedor SET ${queryParams.join(', ')} WHERE id = ?`;
        const values = [...Object.values(updatedFields), id];

        const [result] = await db.query(query, values);

        if (result.affectedRows === 0) {
            // Esto debería ser capturado por la verificación inicial de existencia,
            // pero es una buena salvaguarda.
            return res.status(404).json({ error: 'Proveedor no encontrado o no se realizaron cambios.' });
        }
        res.json({ mensaje: 'Proveedor actualizado correctamente.' });
    } catch (error) {
        (`Error al actualizar el proveedor con ID ${req.params.id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar el proveedor.' });
    }
};

/**
 * @function eliminarProveedor
 * @description Elimina un proveedor de la base de datos por su ID.
 * @param {Object} req - Objeto de solicitud de Express con el ID en params.
 * @param {Object} res - Objeto de respuesta de Express.
 */
exports.eliminarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM proveedor WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado para eliminar.' });
        }
        res.json({ mensaje: 'Proveedor eliminado correctamente.' });
    } catch (error) {
        (`Error al eliminar el proveedor con ID ${req.params.id}:`, error);
        res.status(500).json({ error: 'Error interno del servidor al eliminar el proveedor.' });
    }
};

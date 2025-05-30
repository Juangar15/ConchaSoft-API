// controllers/rolController.js

const db = require('../db');

// --- Funciones existentes (crearRol, obtenerRoles, obtenerRolPorId, actualizarRol, eliminarRol) ---

const crearRol = async (req, res) => {
    try {
        const { rol, descripcion } = req.body;
        if (!rol) {
            return res.status(400).json({ error: "El campo 'rol' es obligatorio" });
        }

        const [result] = await db.query("INSERT INTO rol (rol, descripcion) VALUES (?, ?)", [rol, descripcion]);

        res.status(201).json({ id: result.insertId, rol, descripcion });
    } catch (error) {
        console.error("Error al crear rol:", error);
        // Manejar error si el nombre del rol ya existe
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'El nombre del rol ya existe.' });
        }
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

const obtenerRoles = async (req, res) => {
    try {
        const [roles] = await db.query("SELECT * FROM rol");
        res.json(roles);
    } catch (error) {
        console.error("Error al obtener roles:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

const obtenerRolPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [rol] = await db.query("SELECT * FROM rol WHERE id = ?", [id]);

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
        const { rol, descripcion } = req.body;

        if (!rol) { // Asegurarse de que el campo rol no esté vacío
            return res.status(400).json({ error: "El campo 'rol' es obligatorio para actualizar." });
        }

        const [result] = await db.query(
            "UPDATE rol SET rol = ?, descripcion = ? WHERE id = ?",
            [rol, descripcion, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Rol no encontrado" });
        }

        res.json({ message: "Rol actualizado correctamente" });
    } catch (error) {
        console.error("Error al actualizar rol:", error);
        if (error.code === 'ER_DUP_ENTRY') { // Manejar si el nuevo nombre de rol ya existe
            return res.status(409).json({ error: 'El nombre del rol ya existe.' });
        }
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

const eliminarRol = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query("DELETE FROM rol WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Rol no encontrado" });
        }

        res.json({ message: "Rol eliminado correctamente" });
    } catch (error) {
        console.error("Error al eliminar rol:", error);
        // Podrías añadir lógica para manejar la eliminación de un rol que tiene usuarios asignados
        if (error.code === 'ER_ROW_IS_REFERENCED' || error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(409).json({ error: 'No se puede eliminar el rol porque está asignado a usuarios o tiene permisos asociados.' });
        }
        res.status(500).json({ error: "Error interno del servidor" });
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

    try {
        await db.beginTransaction(); // Inicia una transacción para asegurar atomicidad

        // 1. Eliminar todos los permisos existentes para este rol
        await db.query('DELETE FROM rol_permiso WHERE id_rol = ?', [id]);

        // 2. Insertar los nuevos permisos
        if (permisoIds.length > 0) {
            // Prepara los valores para la inserción masiva
            const values = permisoIds.map(permisoId => [id, permisoId]);
            await db.query('INSERT INTO rol_permiso (id_rol, id_permiso) VALUES ?', [values]);
        }

        await db.commit(); // Confirma la transacción

        res.status(200).json({ message: 'Permisos asignados al rol correctamente.' });
    } catch (err) {
        await db.rollback(); // Deshace la transacción en caso de error
        console.error('Error al asignar permisos al rol:', err);
        res.status(500).json({ error: 'Error al asignar permisos al rol.' });
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
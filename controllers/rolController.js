const db = require('../db'); 

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
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

module.exports = { crearRol, obtenerRoles, obtenerRolPorId, actualizarRol, eliminarRol };
const db = require('../db');

// Obtener todas las devoluciones
exports.obtenerDevoluciones = async (req, res) => {
    try {
        const [devoluciones] = await db.query('SELECT * FROM devolucion');
        res.json(devoluciones);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las devoluciones' });
    }
};

// Obtener una devolución por ID
exports.obtenerDevolucion = async (req, res) => {
    try {
        const { id } = req.params;
        const [devolucion] = await db.query('SELECT * FROM devolucion WHERE id = ?', [id]);
        if (devolucion.length === 0) {
            return res.status(404).json({ error: 'Devolución no encontrada' });
        }
        res.json(devolucion[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la devolución' });
    }
};

// Crear una devolución
// Crear una devolución (ahora actualiza el saldo total del cliente)
exports.crearDevolucion = async (req, res) => {
        const connection = await db.getConnection(); // Obtener conexión para la transacción
        try {
            await connection.beginTransaction(); // Iniciar transacción
    
            const { id_venta, id_cliente, fecha, razon, saldo_a_favor } = req.body;
    
            // Validaciones iniciales
            if (!id_venta || !id_cliente || !fecha || !razon) {
                await connection.rollback(); // Revertir si falla validación
                return res.status(400).json({ error: 'Faltan campos obligatorios' });
            }
    
            // Asegurarse de que saldo_a_favor es un número
            const montoDevolucionSaldo = parseFloat(saldo_a_favor) || 0;
    
            // Insertar la devolución en la tabla devolucion
            const [devolucionResult] = await connection.execute( // Usar execute en conexión de transacción
                'INSERT INTO devolucion (id_venta, id_cliente, fecha, razon, saldo_a_favor) VALUES (?, ?, ?, ?, ?)',
                [id_venta, id_cliente, fecha, razon, montoDevolucionSaldo]
            );
            const idDevolucionCreada = devolucionResult.insertId;
            console.log(`Backend crearDevolucion: Devolución ${idDevolucionCreada} insertada para cliente ${id_cliente}.`); // Log inserción
    
            // --- NUEVO: Sumar el saldo de la devolución al saldo total del cliente ---
            if (montoDevolucionSaldo > 0) { // Solo actualizamos si la devolución otorga saldo
                 await connection.execute( // Usar execute en conexión de transacción
                     'UPDATE cliente SET saldo_a_favor = saldo_a_favor + ? WHERE id = ?',
                     [montoDevolucionSaldo, id_cliente]
                 );
                 console.log(`Backend crearDevolucion: Saldo total del cliente ${id_cliente} actualizado, sumando ${montoDevolucionSaldo} (devolución).`); // Log actualización saldo cliente
            }
            // --- FIN NUEVO ---
    
    
            await connection.commit(); // Confirmar transacción
    
            res.status(201).json({ mensaje: 'Devolución creada correctamente', id_devolucion: idDevolucionCreada });
    
        } catch (error) {
            await connection.rollback(); // Revertir transacción si falla
            ('Error al crear la devolución:', error);
            res.status(500).json({ error: 'Error al crear la devolución' });
    
        } finally {
            if (connection) connection.release(); // Liberar conexión
        }
    };

// Actualizar una devolución
// exports.actualizarDevolucion = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { id_venta, id_cliente, fecha, razon, saldo_a_favor } = req.body;
//         const [result] = await db.query(
//             'UPDATE devolucion SET id_venta = ?, id_cliente = ?, fecha = ?, razon = ?, saldo_a_favor = ? WHERE id = ?',
//             [id_venta, id_cliente, fecha, razon, saldo_a_favor || 0, id]
//         );

//         if (result.affectedRows === 0) {
//             return res.status(404).json({ error: 'Devolución no encontrada' });
//         }
//         res.json({ mensaje: 'Devolución actualizada correctamente' });
//     } catch (error) {
//         res.status(500).json({ error: 'Error al actualizar la devolución' });
//     }
// };

// Eliminar una devolución
// exports.eliminarDevolucion = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const [result] = await db.query('DELETE FROM devolucion WHERE id = ?', [id]);

//         if (result.affectedRows === 0) {
//             return res.status(404).json({ error: 'Devolución no encontrada' });
//         }
//         res.json({ mensaje: 'Devolución eliminada correctamente' });
//     } catch (error) {
//         res.status(500).json({ error: 'Error al eliminar la devolución' });
//     }
// };

// Anular una devolución (marca como Anulada y resta su saldo del cliente)
exports.anularDevolucion = async (req, res) => {
        const connection = await db.getConnection(); // Obtener conexión para la transacción
        try {
            await connection.beginTransaction(); // Iniciar transacción
    
            const { id } = req.params;
    
            // 1. Obtener los detalles de la devolución ANTES de modificarla para saber el cliente y el saldo que otorgó
            // y verificar su estado actual
            const [devolucionToAnular] = await connection.execute(
                'SELECT id_cliente, saldo_a_favor, estado FROM devolucion WHERE id = ?',
                [id]
            );
    
            if (devolucionToAnular.length === 0) {
                await connection.rollback();
                return res.status(404).json({ error: 'Devolución no encontrada para anular' });
            }
    
            const { id_cliente: clienteId, saldo_a_favor: montoOriginalDevolucion, estado: estadoActual } = devolucionToAnular[0];
            console.log(`Backend anularDevolucion: Anulando devolución ${id}. Cliente ID: ${clienteId}, Saldo original: ${montoOriginalDevolucion}, Estado actual: ${estadoActual}`); // Log inicial
    
    
            if (estadoActual === 'Anulada') {
                await connection.rollback();
                return res.status(400).json({ error: 'Esta devolución ya está anulada' });
            }
    
    
            // 2. Marcar la devolución como 'Anulada' y setear su propio campo saldo_a_favor a 0
            const [updateResult] = await connection.execute(
                'UPDATE devolucion SET estado = ?, saldo_a_favor = ? WHERE id = ?',
                ['Anulada', 0, id] // Marcamos como Anulada y seteamos su saldo a 0 en la tabla devolucion
            );
    
            if (updateResult.affectedRows === 0) {
                // Esto no debería pasar si la encontramos en el paso 1, pero es una seguridad
                await connection.rollback();
                return res.status(500).json({ error: 'Error al actualizar el estado de la devolución.' });
            }
            console.log(`Backend anularDevolucion: Devolución ${id} marcada como Anulada.`); // Log actualización estado
    
    
            // 3. Restar el saldo que esta devolución había sumado originalmente del saldo total del cliente
            // Usamos el montoOriginalDevolucion que leímos antes de setearlo a 0
            if (montoOriginalDevolucion > 0) { // Solo restamos si la devolución original había otorgado saldo
                await connection.execute(
                    'UPDATE cliente SET saldo_a_favor = saldo_a_favor - ? WHERE id = ?',
                    [montoOriginalDevolucion, clienteId] // Restamos el monto que se había sumado al crear la devolución
                );
                console.log(`Backend anularDevolucion: Saldo total del cliente ${clienteId} actualizado, restando ${montoOriginalDevolucion} (devolución anulada).`); // Log actualización saldo cliente
            } else {
                 console.log(`Backend anularDevolucion: Devolución ${id} no tenía saldo a favor (${montoOriginalDevolucion}), no se resta del cliente.`);
            }
    
            // Nota: Si las devoluciones involucran restaurar stock, esa lógica iría aquí, similar a anularVenta.
            // Basado en tu esquema, las devoluciones solo añaden saldo, no restauran stock de ventas,
            // así que no añadimos esa parte aquí.
    
    
            await connection.commit(); // Confirmar transacción
    
            res.json({ mensaje: 'Devolución anulada correctamente' });
    
        } catch (error) {
            await connection.rollback(); // Revertir transacción si falla
            ('Error al anular la devolución:', error);
            res.status(500).json({ error: 'Error al anular la devolución' });
    
        } finally {
            if (connection) connection.release(); // Liberar conexión
        }
    };
const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_clientes'), clienteController.obtenerClientes);
router.get('/:id', verificarToken, verificarPermiso('ver_clientes'), clienteController.obtenerCliente);
router.post('/', verificarToken, verificarPermiso('crear_clientes'), clienteController.crearCliente);
router.put('/:id', verificarToken, verificarPermiso('editar_clientes'), clienteController.actualizarCliente);
router.delete('/:id', verificarToken, verificarPermiso('eliminar_clientes'), clienteController.eliminarCliente);

module.exports = router;
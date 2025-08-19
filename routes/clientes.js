const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('clientes'), clienteController.obtenerClientes);
router.get('/:id', verificarToken, verificarPermiso('clientes'), clienteController.obtenerCliente);
router.get('/saldo/:id_cliente', verificarToken, verificarPermiso('clientes'), clienteController.obtenerSaldoCliente);
router.post('/', verificarToken, verificarPermiso('clientes'), clienteController.crearCliente);
router.put('/:id', verificarToken, verificarPermiso('clientes'), clienteController.actualizarCliente);
router.delete('/:id', verificarToken, verificarPermiso('clientes'), clienteController.eliminarCliente);

module.exports = router;
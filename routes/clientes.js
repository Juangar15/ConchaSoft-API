const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.use(verificarToken, verificarPermiso('clientes'));

router.get('/', clienteController.obtenerClientes);
router.get('/:id', clienteController.obtenerCliente);
router.get('/saldo/:id_cliente', clienteController.obtenerSaldoCliente);
router.post('/', clienteController.crearCliente);
router.put('/:id', clienteController.actualizarCliente);
router.delete('/:id', clienteController.eliminarCliente);

module.exports = router;

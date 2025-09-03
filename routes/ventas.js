const express = require('express');
const router = express.Router();
const ventaController = require('../controllers/ventaController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('ventas'));

router.get('/', ventaController.obtenerVentas);
router.get('/completadas', ventaController.obtenerVentasCompletadas);
router.get('/:id', ventaController.obtenerVenta);
router.post('/', ventaController.crearVenta);
router.put('/:id', ventaController.actualizarVenta);
router.put('/:id/anular', ventaController.anularVenta);


module.exports = router;
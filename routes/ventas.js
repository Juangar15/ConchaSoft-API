const express = require('express');
const router = express.Router();
const ventaController = require('../controllers/ventaController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ventas'), ventaController.obtenerVentas);
router.get('/completadas', verificarToken, verificarPermiso('ventas'), ventaController.obtenerVentasCompletadas); // Nueva ruta
router.get('/:id', verificarToken, verificarPermiso('ventas'), ventaController.obtenerVenta);
router.post('/', verificarToken, verificarPermiso('ventas'), ventaController.crearVenta);
router.put('/:id', verificarToken, verificarPermiso('ventas'), ventaController.actualizarVenta);
router.put('/:id/anular', verificarToken, verificarPermiso('ventas'), ventaController.anularVenta);


module.exports = router;
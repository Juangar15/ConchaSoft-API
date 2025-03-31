const express = require('express');
const router = express.Router();
const compraController = require('../controllers/compraController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_compras'), compraController.obtenerCompras);
router.get('/:id', verificarToken, verificarPermiso('ver_compras'), compraController.obtenerCompra);
router.post('/', verificarToken, verificarPermiso('crear_compras'), compraController.crearCompra);
router.put('/:id', verificarToken, verificarPermiso('editar_compras'), compraController.actualizarCompra);
router.delete('/:id', verificarToken, verificarPermiso('eliminar_compras'), compraController.eliminarCompra);

module.exports = router;
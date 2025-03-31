const express = require('express');
const router = express.Router();
const devolucionController = require('../controllers/devolucionController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_devoluciones'), devolucionController.obtenerDevoluciones);
router.get('/:id', verificarToken, verificarPermiso('ver_devoluciones'), devolucionController.obtenerDevolucion);
router.post('/', verificarToken, verificarPermiso('crear_devoluciones'), devolucionController.crearDevolucion);
router.put('/:id', verificarToken, verificarPermiso('editar_devoluciones'), devolucionController.actualizarDevolucion);
router.delete('/:id', verificarToken, verificarPermiso('eliminar_devoluciones'), devolucionController.eliminarDevolucion);

module.exports = router;
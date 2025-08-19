const express = require('express');
const router = express.Router();
const devolucionController = require('../controllers/devolucionController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('devoluciones'), devolucionController.obtenerDevoluciones);
router.get('/:id', verificarToken, verificarPermiso('devoluciones'), devolucionController.obtenerDevolucion);
router.post('/', verificarToken, verificarPermiso('devoluciones'), devolucionController.crearDevolucion);
router.put('/:id/anular', verificarToken, verificarPermiso('devoluciones'), devolucionController.anularDevolucion);
// router.put('/:id', verificarToken, verificarPermiso('editar_devoluciones'), devolucionController.actualizarDevolucion);
// router.delete('/:id', verificarToken, verificarPermiso('eliminar_devoluciones'), devolucionController.eliminarDevolucion);

module.exports = router;
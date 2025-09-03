const express = require('express');
const router = express.Router();
const devolucionController = require('../controllers/devolucionController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('devoluciones'));

router.get('/', devolucionController.obtenerDevoluciones);
router.get('/:id', devolucionController.obtenerDevolucion);
router.post('/', devolucionController.crearDevolucion);
router.put('/:id/anular', devolucionController.anularDevolucion);
// router.put('/:id', verificarToken, verificarPermiso('editar_devoluciones'), devolucionController.actualizarDevolucion);
// router.delete('/:id', verificarToken, verificarPermiso('eliminar_devoluciones'), devolucionController.eliminarDevolucion);

module.exports = router;
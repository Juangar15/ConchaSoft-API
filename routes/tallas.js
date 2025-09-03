const express = require('express');
const router = express.Router();
const tallaController = require('../controllers/tallaController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');


// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('tallas'));

router.get('/', tallaController.obtenerTallas);
router.get('/:id_talla', tallaController.obtenerTalla);
router.post('/', tallaController.crearTalla);
router.put('/:id_talla', tallaController.actualizarTalla);
router.delete('/:id_talla', tallaController.eliminarTalla);

module.exports = router;
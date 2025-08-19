const express = require('express');
const router = express.Router();
const tallaController = require('../controllers/tallaController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');


router.get('/', verificarToken, verificarPermiso('tallas'), tallaController.obtenerTallas);
router.get('/:id_talla', verificarToken, verificarPermiso('tallas'), tallaController.obtenerTalla);
router.post('/', verificarToken, verificarPermiso('tallas'), tallaController.crearTalla);
router.put('/:id_talla', verificarToken, verificarPermiso('tallas'), tallaController.actualizarTalla);
router.delete('/:id_talla', verificarToken, verificarPermiso('tallas'), tallaController.eliminarTalla);

module.exports = router;
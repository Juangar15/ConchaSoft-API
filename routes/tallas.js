const express = require('express');
const router = express.Router();
const tallaController = require('../controllers/tallaController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');


router.get('/', verificarToken, verificarPermiso('ver_tallas'), tallaController.obtenerTallas);
router.get('/:id_talla', verificarToken, verificarPermiso('ver_tallas'), tallaController.obtenerTalla);
router.post('/', verificarToken, verificarPermiso('crear_tallas'), tallaController.crearTalla);
router.put('/:id_talla', verificarToken, verificarPermiso('editar_tallas'), tallaController.actualizarTalla);
router.delete('/:id_talla', verificarToken, verificarPermiso('eliminar_tallas'), tallaController.eliminarTalla);

module.exports = router;
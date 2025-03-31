const express = require('express');
const router = express.Router();
const marcaController = require('../controllers/marcaController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('ver_marcas'), marcaController.obtenerMarcas);
router.get('/:id', verificarToken, verificarPermiso('ver_marcas'), marcaController.obtenerMarca);
router.post('/', verificarToken, verificarPermiso('crear_marcas'), marcaController.crearMarca);
router.put('/:id', verificarToken, verificarPermiso('editar_marcas'), marcaController.actualizarMarca);
router.delete('/:id', verificarToken, verificarPermiso('eliminar_marcas'), marcaController.eliminarMarca);

module.exports = router;
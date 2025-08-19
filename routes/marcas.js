const express = require('express');
const router = express.Router();
const marcaController = require('../controllers/marcaController');
const { verificarToken, verificarPermiso } = require('../middleware/authMiddleware');

router.get('/', verificarToken, verificarPermiso('marcas'), marcaController.obtenerMarcas);
router.get('/:id', verificarToken, verificarPermiso('marcas'), marcaController.obtenerMarca);
router.post('/', verificarToken, verificarPermiso('marcas'), marcaController.crearMarca);
router.put('/:id', verificarToken, verificarPermiso('marcas'), marcaController.actualizarMarca);
router.delete('/:id', verificarToken, verificarPermiso('marcas'), marcaController.eliminarMarca);

module.exports = router;
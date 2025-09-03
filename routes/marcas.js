const express = require('express');
const router = express.Router();
const marcaController = require('../controllers/marcaController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('marcas'));

router.get('/', marcaController.obtenerMarcas);
router.get('/:id', marcaController.obtenerMarca);
router.post('/', marcaController.crearMarca);
router.put('/:id', marcaController.actualizarMarca);
router.delete('/:id', marcaController.eliminarMarca);

module.exports = router;
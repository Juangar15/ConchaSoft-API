const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// SISTEMA SIMPLIFICADO: Solo verifica acceso al módulo completo
router.use(verificarToken, verificarAccesoModulo('dashboard'));

// Ruta principal del dashboard
router.get('/', dashboardController.obtenerResumenGeneral);

// Métricas de rendimiento
router.get('/metricas', dashboardController.obtenerMetricasRendimiento);

// Tendencias y gráficos
router.get('/tendencias', dashboardController.obtenerTendencias);

// Alertas y notificaciones
router.get('/alertas', dashboardController.obtenerAlertas);

// Productos más devueltos (para gráficos)
router.get('/productos-mas-devueltos', dashboardController.obtenerProductosMasDevueltos);

// Estadísticas de compras (para gráficos)
router.get('/estadisticas-compras', dashboardController.obtenerEstadisticasCompras);

// Datos para gráficos de comparación
router.get('/datos-graficos', dashboardController.obtenerDatosGraficos);

module.exports = router;

const express = require('express');
const cors = require('cors'); // Ya lo tienes importado
const dotenv = require('dotenv');
const db = require('./db');

// ... (todas tus importaciones de rutas)
const usuariosRoutes = require('./routes/usuarios');
const rolesRoutes = require('./routes/roles');
const permisosRoutes = require('./routes/permisos');
const marcasRoutes = require('./routes/marcas');
const tallasRoutes = require('./routes/tallas');
const proveedoresRoutes = require('./routes/proveedores');
const clientesRoutes = require('./routes/clientes');
const ventasRoutes = require('./routes/ventas');
const devolucionesRoutes = require('./routes/devoluciones');
const productosRoutes = require('./routes/productos');
const comprasRoutes = require('./routes/compras');
const compraProdRoutes = require('./routes/compraProd');
const ventaProdRoutes = require('./routes/ventaProd');
const rolPermisoRoutes = require('./routes/rolPermiso');
const productoTallaRoutes = require('./routes/ProductoTalla');
const authRoutes = require('./routes/auth'); // Asegúrate que esta ruta también apunte a 'authRoutes.js'

dotenv.config();

const app = express();

// Middleware para parsear JSON en el cuerpo de las peticiones
app.use(express.json());

// --- Configuración de CORS con Orígenes Específicos ---
// IMPORTANTE: Coloca esto ANTES de definir tus rutas
app.use(cors({
  origin: [
    'http://localhost:5174', // Para tu desarrollo local
    'https://conchasoft-api.onrender.com' // REEMPLAZA con la URL REAL de tu frontend cuando lo despliegues en Render u otro servicio.
                                                 // Por ejemplo: 'https://conchasoft-frontend.onrender.com'
  ],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Permite estos métodos HTTP
  credentials: true, // Si tu frontend necesita enviar cookies o credenciales (ej. JWT en Auth header)
  optionsSuccessStatus: 204 // Para la petición preflight OPTIONS
}));
// --------------------------------------------------------

app.get('/', (req, res) => {
  res.send('API funcionando correctamente');
});

// ... (todas tus rutas app.use)
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/permisos", permisosRoutes);
app.use("/api/marcas", marcasRoutes);
app.use("/api/tallas", tallasRoutes);
app.use("/api/proveedores", proveedoresRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/ventas", ventasRoutes);
app.use("/api/devoluciones", devolucionesRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/compras", comprasRoutes);
app.use("/api/compra_prod", compraProdRoutes);
app.use("/api/venta_prod", ventaProdRoutes);
app.use("/api/rol_permiso", rolPermisoRoutes);
app.use("/api/producto_talla", productoTallaRoutes);
app.use("/api/auth", authRoutes); // Ruta para la autenticación

const PORT = process.env.PORT || 53466; // Tu puerto de Render debería ser definido en la variable de entorno PORT
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
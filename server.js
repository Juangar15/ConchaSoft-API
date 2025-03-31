const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db');

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
const authRoutes = require('./routes/auth');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.get('/',(req,res) => {
    res.send('API funcionando correctamente');
});

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
app.use("/api/rol_permiso",rolPermisoRoutes);
app.use("/api/producto_talla", productoTallaRoutes);
app.use("/api/auth",authRoutes);

const PORT = process.env.PORT||53466;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`)
});
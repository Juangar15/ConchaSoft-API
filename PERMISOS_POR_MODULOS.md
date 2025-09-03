# Sistema de Permisos por Módulos SIMPLIFICADO

## Descripción

Este sistema permite manejar permisos de manera simple por módulos completos. Si un usuario tiene acceso a un módulo, puede realizar todas las operaciones dentro de ese módulo (crear, leer, actualizar, eliminar, etc.).

## Estructura de Permisos

### Formato
Los permisos siguen el formato simple: `modulo`

### Ejemplos de Permisos
```
ventas
productos
usuarios
compras
clientes
proveedores
marcas
tallas
devoluciones
roles
permisos
```

## Middleware Disponible

### verificarAccesoModulo(modulo)
Verifica si el usuario tiene acceso completo al módulo. Si tiene acceso, puede realizar todas las operaciones dentro del módulo.

```javascript
// Ejemplo: Dar acceso completo al módulo ventas
router.use(verificarToken, verificarAccesoModulo('ventas'));
router.get('/', ventaController.obtenerVentas);
router.post('/', ventaController.crearVenta);
router.put('/:id', ventaController.actualizarVenta);
router.put('/:id/anular', ventaController.anularVenta);
```

### Uso en todas las rutas
```javascript
// Todas las rutas del módulo usan el mismo middleware
const express = require('express');
const router = express.Router();
const { verificarToken, verificarAccesoModulo } = require('../middleware/authMiddleware');

// Una sola línea para proteger todo el módulo
router.use(verificarToken, verificarAccesoModulo('ventas'));

// Todas las rutas quedan sin middleware individual
router.get('/', ventaController.obtenerVentas);
router.post('/', ventaController.crearVenta);
router.put('/:id', ventaController.actualizarVenta);
router.delete('/:id', ventaController.eliminarVenta);
```

## Configuración de Base de Datos

### 1. Insertar Permisos por Módulos

```sql
-- Permisos simples por módulo
INSERT INTO permiso (nombre) VALUES 
('ventas'),
('productos'),
('usuarios'),
('compras'),
('clientes'),
('proveedores'),
('marcas'),
('tallas'),
('devoluciones'),
('roles'),
('permisos');
```

### 2. Asignar Permisos a Roles

```sql
-- Ejemplo: Asignar acceso a módulos básicos para un rol "Vendedor"
INSERT INTO rol_permiso (id_rol, id_permiso) 
SELECT 1, id FROM permiso WHERE nombre IN (
    'ventas',
    'productos',
    'clientes'
);

-- Ejemplo: Asignar acceso a más módulos para un rol "Supervisor"
INSERT INTO rol_permiso (id_rol, id_permiso) 
SELECT 2, id FROM permiso WHERE nombre IN (
    'ventas',
    'productos',
    'clientes',
    'compras',
    'proveedores',
    'marcas',
    'tallas',
    'devoluciones'
);

-- Ejemplo: Asignar acceso completo a un rol "Administrador"
INSERT INTO rol_permiso (id_rol, id_permiso) 
SELECT 3, id FROM permiso;
```

## Ejemplos de Configuración de Roles

### Rol: Vendedor
- `ventas` - Acceso completo al módulo de ventas (crear, ver, modificar, anular)
- `productos` - Acceso completo al módulo de productos (crear, ver, modificar, eliminar)
- `clientes` - Acceso completo al módulo de clientes (crear, ver, modificar, eliminar)

### Rol: Supervisor de Ventas
- `ventas` - Acceso completo al módulo de ventas
- `productos` - Acceso completo al módulo de productos
- `clientes` - Acceso completo al módulo de clientes
- `compras` - Acceso completo al módulo de compras
- `proveedores` - Acceso completo al módulo de proveedores
- `marcas` - Acceso completo al módulo de marcas
- `tallas` - Acceso completo al módulo de tallas
- `devoluciones` - Acceso completo al módulo de devoluciones

### Rol: Administrador
- Todos los módulos: `ventas`, `productos`, `usuarios`, `compras`, `clientes`, `proveedores`, `marcas`, `tallas`, `devoluciones`, `roles`, `permisos`

## Ventajas del Sistema Simplificado

1. **Simplicidad**: Un solo permiso por módulo, fácil de entender y administrar
2. **Frontend Friendly**: El frontend solo necesita verificar si el usuario tiene acceso al módulo
3. **Escalabilidad**: Fácil agregar nuevos módulos
4. **Mantenibilidad**: Código más limpio y menos repetitivo
5. **Flexibilidad**: Diferentes niveles de acceso por rol
6. **Seguridad**: Control de acceso por módulo completo

## Migración desde Sistema Anterior

### Antes (Sistema Simple)
```javascript
router.get('/', verificarToken, verificarPermiso('ventas'), ventaController.obtenerVentas);
router.post('/', verificarToken, verificarPermiso('ventas'), ventaController.crearVenta);
router.put('/:id', verificarToken, verificarPermiso('ventas'), ventaController.actualizarVenta);
```

### Después (Sistema Simplificado)
```javascript
// Una sola línea para proteger todo el módulo
router.use(verificarToken, verificarAccesoModulo('ventas'));

router.get('/', ventaController.obtenerVentas);
router.post('/', ventaController.crearVenta);
router.put('/:id', ventaController.actualizarVenta);
```

## Para el Frontend

El frontend solo necesita verificar si el usuario tiene acceso al módulo:

```javascript
// Ejemplo en el frontend
const userPermissions = ['ventas', 'productos', 'clientes'];

// Mostrar módulo solo si el usuario tiene acceso
if (userPermissions.includes('ventas')) {
    // Mostrar menú de ventas
    // Mostrar todas las opciones del módulo ventas
}
```

## Compatibilidad

El sistema anterior (`verificarPermiso`) sigue funcionando para mantener compatibilidad con código existente. Puedes migrar gradualmente al nuevo sistema.

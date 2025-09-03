# Módulos Mejorados: Ventas, Devoluciones y Dashboard

## 📊 **Módulo de Ventas Mejorado**

### **Funcionalidades Principales**
- ✅ **Crear ventas** con transacciones seguras
- ✅ **Anular ventas** con reversión de stock y saldo
- ✅ **Actualizar ventas** (solo metadatos no críticos)
- ✅ **Obtener ventas completadas** para devoluciones
- ✅ **Estadísticas de ventas** detalladas
- ✅ **Ventas recientes** para dashboard

### **Nuevas Rutas Agregadas**
```
GET /api/ventas/estadisticas?fecha_inicio=2024-01-01&fecha_fin=2024-12-31
GET /api/ventas/recientes?limite=10
```

### **Ejemplo de Uso - Estadísticas de Ventas**
```javascript
// Obtener estadísticas de ventas del último mes
const response = await fetch('/api/ventas/estadisticas?fecha_inicio=2024-01-01&fecha_fin=2024-01-31', {
    headers: {
        'Authorization': 'Bearer ' + token
    }
});

const data = await response.json();
console.log(data);
// Respuesta:
// {
//   resumen: {
//     total_ventas: 150,
//     total_monto: 45000,
//     promedio_venta: 300
//   },
//   por_estado: [...],
//   por_tipo_pago: [...],
//   top_clientes: [...]
// }
```

---

## 🔄 **Módulo de Devoluciones Mejorado**

### **Funcionalidades Principales**
- ✅ **Crear devoluciones** con validaciones completas
- ✅ **Anular devoluciones** con reversión de stock y saldo
- ✅ **Estadísticas de devoluciones** detalladas
- ✅ **Devoluciones recientes** para dashboard
- ✅ **Productos más devueltos** para análisis

### **Nuevas Rutas Agregadas**
```
GET /api/devoluciones/estadisticas?fecha_inicio=2024-01-01&fecha_fin=2024-12-31
GET /api/devoluciones/recientes?limite=10
GET /api/devoluciones/productos-mas-devueltos?limite=10
```

### **Ejemplo de Uso - Productos Más Devueltos**
```javascript
// Obtener productos más devueltos
const response = await fetch('/api/devoluciones/productos-mas-devueltos?limite=5', {
    headers: {
        'Authorization': 'Bearer ' + token
    }
});

const data = await response.json();
console.log(data);
// Respuesta:
// [
//   {
//     nombre_producto: "Camiseta",
//     talla: "M",
//     veces_devuelto: 5,
//     cantidad_total_devuelta: 10,
//     monto_total_devuelto: 500
//   }
// ]
```

---

## 📈 **Módulo de Dashboard (NUEVO)**

### **Funcionalidades Principales**
- ✅ **Resumen general** del negocio
- ✅ **Métricas de rendimiento** comparativas
- ✅ **Tendencias** por período (diario, semanal, mensual)
- ✅ **Alertas** de stock bajo y notificaciones
- ✅ **Gráficos** para visualización

### **Rutas del Dashboard**
```
GET /api/dashboard/                    # Resumen general
GET /api/dashboard/metricas?periodo=30 # Métricas de rendimiento
GET /api/dashboard/tendencias?tipo=mensual&meses=12 # Tendencias
GET /api/dashboard/alertas             # Alertas y notificaciones
```

### **Ejemplo de Uso - Resumen General**
```javascript
// Obtener resumen general del dashboard
const response = await fetch('/api/dashboard/', {
    headers: {
        'Authorization': 'Bearer ' + token
    }
});

const data = await response.json();
console.log(data);
// Respuesta:
// {
//   ventas: {
//     total_ventas: 150,
//     total_monto_ventas: 45000,
//     promedio_venta: 300,
//     ventas_completadas: 140,
//     ventas_anuladas: 10
//   },
//   devoluciones: {
//     total_devoluciones: 15,
//     total_monto_devuelto: 3000,
//     devoluciones_aceptadas: 12
//   },
//   productos: {
//     total_productos: 50,
//     total_variantes: 200,
//     stock_total: 1000,
//     productos_sin_stock: 5
//   },
//   clientes: {
//     total_clientes: 100,
//     clientes_activos: 95
//   },
//   ventas_por_dia: [...],
//   top_productos_vendidos: [...],
//   alertas_stock: [...]
// }
```

### **Ejemplo de Uso - Métricas de Rendimiento**
```javascript
// Obtener métricas de rendimiento del último mes
const response = await fetch('/api/dashboard/metricas?periodo=30', {
    headers: {
        'Authorization': 'Bearer ' + token
    }
});

const data = await response.json();
console.log(data);
// Respuesta:
// {
//   comparacion_ventas: [
//     { periodo: 'actual', total_ventas: 150, total_monto: 45000 },
//     { periodo: 'anterior', total_ventas: 120, total_monto: 36000 }
//   ],
//   tasa_devolucion: {
//     tasa_devolucion_porcentaje: 8.5,
//     total_devoluciones: 15,
//     total_ventas: 150
//   },
//   metricas_clientes: {
//     clientes_activos: 45,
//     promedio_ventas_por_cliente: 3.3,
//     promedio_monto_por_cliente: 1000
//   }
// }
```

### **Ejemplo de Uso - Tendencias**
```javascript
// Obtener tendencias mensuales del último año
const response = await fetch('/api/dashboard/tendencias?tipo=mensual&meses=12', {
    headers: {
        'Authorization': 'Bearer ' + token
    }
});

const data = await response.json();
console.log(data);
// Respuesta:
// {
//   ventas: [
//     { periodo: '2024-01', cantidad_ventas: 25, monto_total: 7500, promedio_venta: 300 },
//     { periodo: '2024-02', cantidad_ventas: 30, monto_total: 9000, promedio_venta: 300 }
//   ],
//   devoluciones: [
//     { periodo: '2024-01', cantidad_devoluciones: 2, monto_total_devuelto: 400 },
//     { periodo: '2024-02', cantidad_devoluciones: 3, monto_total_devuelto: 600 }
//   ]
// }
```

### **Ejemplo de Uso - Alertas**
```javascript
// Obtener alertas del sistema
const response = await fetch('/api/dashboard/alertas', {
    headers: {
        'Authorization': 'Bearer ' + token
    }
});

const data = await response.json();
console.log(data);
// Respuesta:
// {
//   total_alertas: 8,
//   alertas: [
//     {
//       producto: "Camiseta",
//       talla: "M",
//       stock_actual: 0,
//       tipo_alerta: "sin_stock",
//       mensaje: "Producto sin stock"
//     },
//     {
//       producto: "Pantalón",
//       talla: "L",
//       stock_actual: 2,
//       tipo_alerta: "stock_bajo",
//       mensaje: "Producto con stock bajo"
//     }
//   ]
// }
```

---

## 🔧 **Configuración de Permisos**

### **Permisos Necesarios**
Asegúrate de que los roles tengan acceso a estos módulos:

```sql
-- Para usuarios con acceso al dashboard
INSERT INTO rol_permiso (id_rol, id_permiso) 
SELECT id_rol, id FROM permiso WHERE nombre IN (
    'ventas',
    'devoluciones', 
    'dashboard'
);
```

### **Roles Recomendados**
- **Vendedor**: `ventas`, `productos`, `clientes`
- **Supervisor**: `ventas`, `devoluciones`, `dashboard`, `productos`, `clientes`, `compras`
- **Administrador**: Todos los módulos

---

## 📱 **Para el Frontend**

### **Componentes Sugeridos**
1. **Dashboard Principal**: Resumen general + alertas
2. **Gráficos de Tendencias**: Ventas y devoluciones por período
3. **Métricas de Rendimiento**: Comparaciones y KPIs
4. **Alertas en Tiempo Real**: Stock bajo, devoluciones pendientes
5. **Tablas de Datos**: Ventas recientes, productos más devueltos

### **Ejemplo de Componente React**
```jsx
import React, { useState, useEffect } from 'react';

const Dashboard = () => {
    const [resumen, setResumen] = useState(null);
    const [alertas, setAlertas] = useState([]);

    useEffect(() => {
        // Cargar resumen general
        fetch('/api/dashboard/', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(res => res.json())
        .then(data => setResumen(data));

        // Cargar alertas
        fetch('/api/dashboard/alertas', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(res => res.json())
        .then(data => setAlertas(data.alertas));
    }, []);

    return (
        <div>
            <h1>Dashboard</h1>
            {resumen && (
                <div>
                    <h2>Resumen</h2>
                    <p>Total Ventas: {resumen.ventas.total_ventas}</p>
                    <p>Monto Total: ${resumen.ventas.total_monto_ventas}</p>
                </div>
            )}
            {alertas.length > 0 && (
                <div>
                    <h2>Alertas ({alertas.length})</h2>
                    {alertas.map(alerta => (
                        <div key={alerta.id} className="alerta">
                            {alerta.mensaje}: {alerta.producto} {alerta.talla}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
```

---

## 🚀 **Próximos Pasos**

1. **Ejecutar el script SQL** actualizado para agregar el permiso `dashboard`
2. **Asignar permisos** a los roles según las necesidades
3. **Implementar el frontend** usando las nuevas rutas
4. **Probar todas las funcionalidades** con diferentes roles
5. **Configurar alertas** según las necesidades del negocio

¡Los módulos están listos para usar! 🎉

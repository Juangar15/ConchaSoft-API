-- Script de migración para el sistema de permisos por módulos SIMPLIFICADO
-- Ejecutar este script para crear los permisos simples por módulo

-- ==============================================
-- PERMISOS SIMPLES POR MÓDULO
-- ==============================================
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
('permisos'),
('dashboard');

-- ==============================================
-- EJEMPLOS DE ASIGNACIÓN DE PERMISOS A ROLES
-- ==============================================

-- NOTA: Ajusta los id_rol según tus roles existentes

-- Ejemplo 1: Rol Vendedor (id_rol = 1)
-- Acceso a módulos básicos para ventas
INSERT INTO rol_permiso (id_rol, id_permiso) 
SELECT 1, id FROM permiso WHERE nombre IN (
    'ventas',
    'productos',
    'clientes'
);

-- Ejemplo 2: Rol Supervisor (id_rol = 2)
-- Acceso a más módulos pero no administración
INSERT INTO rol_permiso (id_rol, id_permiso) 
SELECT 2, id FROM permiso WHERE nombre IN (
    'ventas',
    'productos',
    'clientes',
    'compras',
    'proveedores',
    'marcas',
    'tallas',
    'devoluciones',
    'dashboard'
);

-- Ejemplo 3: Rol Administrador (id_rol = 3)
-- Acceso completo a todos los módulos
INSERT INTO rol_permiso (id_rol, id_permiso) 
SELECT 3, id FROM permiso;

-- ==============================================
-- CONSULTAS ÚTILES PARA VERIFICAR PERMISOS
-- ==============================================

-- Ver todos los permisos disponibles
SELECT 
    id,
    nombre as modulo
FROM permiso 
ORDER BY nombre;

-- Ver permisos asignados a un rol específico
SELECT 
    r.rol,
    p.nombre as modulo
FROM rol_permiso rp
INNER JOIN rol r ON rp.id_rol = r.id
INNER JOIN permiso p ON rp.id_permiso = p.id
WHERE r.id = 1  -- Cambia el ID del rol
ORDER BY p.nombre;

-- Ver qué roles tienen acceso a un módulo específico
SELECT DISTINCT
    r.rol,
    p.nombre as modulo
FROM rol_permiso rp
INNER JOIN rol r ON rp.id_rol = r.id
INNER JOIN permiso p ON rp.id_permiso = p.id
WHERE p.nombre = 'ventas'  -- Cambia el módulo
ORDER BY r.rol;

-- Ver resumen de permisos por rol
SELECT 
    r.rol,
    COUNT(p.nombre) as total_permisos,
    GROUP_CONCAT(p.nombre ORDER BY p.nombre SEPARATOR ', ') as modulos_acceso
FROM rol_permiso rp
INNER JOIN rol r ON rp.id_rol = r.id
INNER JOIN permiso p ON rp.id_permiso = p.id
GROUP BY r.id, r.rol
ORDER BY r.rol;

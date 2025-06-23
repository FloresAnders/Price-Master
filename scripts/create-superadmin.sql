-- SQL Script para crear SuperAdmin (si usas SQL Database)
-- create-superadmin.sql

-- Verificar si ya existe un SuperAdmin
SELECT COUNT(*) as superadmin_count 
FROM users 
WHERE role = 'superadmin' AND is_active = true;

-- Crear SuperAdmin si no existe
INSERT INTO users (
    name,
    password, -- En producción usar hash: bcrypt, argon2, etc.
    role,
    location,
    is_active,
    created_at,
    updated_at,
    created_by,
    creation_method
) 
SELECT 
    'superadmin',
    'super123', -- CAMBIAR POR HASH EN PRODUCCIÓN
    'superadmin',
    'san-jose',
    true,
    NOW(),
    NOW(),
    'system',
    'database_migration'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE role = 'superadmin' AND is_active = true
);

-- Verificar la creación
SELECT 
    id,
    name,
    role,
    location,
    is_active,
    created_at
FROM users 
WHERE role = 'superadmin';

-- Consulta para auditoría de SuperAdmins
SELECT 
    id,
    name,
    role,
    location,
    is_active,
    created_at,
    created_by,
    creation_method,
    CASE 
        WHEN is_active = true THEN '🟢 Activo'
        ELSE '🔴 Inactivo'
    END as status
FROM users 
WHERE role = 'superadmin'
ORDER BY created_at DESC;

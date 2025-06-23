// create-superadmin.js
// Script para crear usuario SuperAdmin directamente

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore';

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBkXkfKRt8aDw6tAqzGJ3MpDGqDfWKyfks",
    authDomain: "price-master-cc9cd.firebaseapp.com",
    projectId: "price-master-cc9cd",
    storageBucket: "price-master-cc9cd.firebasestorage.app",
    messagingSenderId: "659232998454",
    appId: "1:659232998454:web:fab12edc19c0b95080b8e9"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createSuperAdmin() {
    console.log('🚀 Iniciando creación de usuario SuperAdmin...');

    try {
        // Verificar si ya existe un SuperAdmin
        const q = query(collection(db, 'users'), where('role', '==', 'superadmin'));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            console.log('⚠️ Ya existe un usuario SuperAdmin en la base de datos:');
            querySnapshot.forEach((doc) => {
                const user = doc.data();
                console.log(`   👤 ${user.name} (${user.location || 'Sin ubicación'})`);
            });
            return;
        }

        // Crear nuevo SuperAdmin
        const superAdminData = {
            name: 'superadmin',
            password: 'super123',
            role: 'superadmin',
            location: 'san-jose',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const docRef = await addDoc(collection(db, 'users'), superAdminData);
        
        console.log('✅ Usuario SuperAdmin creado exitosamente!');
        console.log(`📋 ID: ${docRef.id}`);
        console.log('🔐 Credenciales:');
        console.log('   👤 Usuario: superadmin');
        console.log('   🔑 Contraseña: super123');
        console.log('   🏢 Ubicación: San José');
        console.log('   🎯 Rol: SuperAdmin');
        console.log('');
        console.log('🎉 ¡Ahora puedes acceder al Editor de Datos en /edit!');

    } catch (error) {
        console.error('❌ Error creando SuperAdmin:', error);
    }
}

// Ejecutar si es llamado directamente
if (typeof window !== 'undefined') {
    // Ejecutar en el navegador
    window.createSuperAdmin = createSuperAdmin;
} else {
    // Ejecutar en Node.js
    createSuperAdmin().then(() => {
        console.log('Script completado.');
        process.exit(0);
    }).catch((error) => {
        console.error('Error en el script:', error);
        process.exit(1);
    });
}

export { createSuperAdmin };

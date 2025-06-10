# Firebase Firestore Integration - Price Master

## Configuración

La configuración de Firebase se encuentra en el archivo `.env` con las siguientes variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain
NEXT_PUBLIC_FIREBASE_DATABASE_URL=tu_database_url
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id
```

## Colecciones

### Locations
- **Colección**: `locations`
- **Estructura**:
  ```typescript
  {
    id?: string;
    label: string;
    value: string;
    names: string[];
  }
  ```

### Sorteos
- **Colección**: `sorteos`
- **Estructura**:
  ```typescript
  {
    id?: string;
    name: string;
  }
  ```

## Servicios Disponibles

### FirestoreService (Genérico)
Servicio base con métodos CRUD genéricos:
- `getAll(collectionName)` - Obtener todos los documentos
- `getById(collectionName, id)` - Obtener documento por ID
- `add(collectionName, data)` - Agregar nuevo documento
- `update(collectionName, id, data)` - Actualizar documento
- `delete(collectionName, id)` - Eliminar documento
- `query(collectionName, conditions, orderBy, limit)` - Consultar con filtros

### LocationsService
Servicio específico para locations:
- `getAllLocations()` - Obtener todas las locations
- `getLocationById(id)` - Obtener location por ID
- `addLocation(location)` - Agregar nueva location
- `updateLocation(id, location)` - Actualizar location
- `deleteLocation(id)` - Eliminar location
- `findLocationsByValue(value)` - Buscar por valor
- `findLocationsByName(name)` - Buscar por nombre
- `getLocationsOrderedByLabel()` - Obtener ordenadas por label

### SorteosService
Servicio específico para sorteos:
- `getAllSorteos()` - Obtener todos los sorteos
- `getSorteoById(id)` - Obtener sorteo por ID
- `addSorteo(sorteo)` - Agregar nuevo sorteo
- `updateSorteo(id, sorteo)` - Actualizar sorteo
- `deleteSorteo(id)` - Eliminar sorteo
- `findSorteosByName(name)` - Buscar por nombre
- `getSorteosOrderedByName()` - Obtener ordenados por nombre
- `searchSorteos(searchTerm)` - Buscar sorteos

## Migración de Datos

### MigrationService
Servicio para migrar datos desde JSON a Firestore:
- `migrateLocations()` - Migrar locations desde JSON
- `migrateSorteos()` - Migrar sorteos desde JSON
- `runAllMigrations()` - Ejecutar todas las migraciones
- `clearAllData()` - Limpiar todos los datos (¡usar con cuidado!)

## Uso

### Ejemplo básico:
```typescript
import { LocationsService, SorteosService } from '@/services/locations';

// Obtener todas las locations
const locations = await LocationsService.getAllLocations();

// Agregar nueva location
const newLocationId = await LocationsService.addLocation({
  label: "NUEVA LOCATION",
  value: "NUEVA_LOCATION",
  names: ["NOMBRE1", "NOMBRE2"]
});

// Obtener todos los sorteos
const sorteos = await SorteosService.getAllSorteos();

// Buscar sorteos
const results = await SorteosService.searchSorteos("TICA");
```

### Ejecutar migración:
```typescript
import { MigrationService } from '@/utils/migration';

// Migrar todos los datos
await MigrationService.runAllMigrations();
```

## Página de Prueba

Visita `/firebase-test` para:
- Ejecutar la migración de datos
- Ver los datos migrados
- Limpiar los datos de Firestore
- Probar la conexión con Firebase

## Estructura de Archivos

```
src/
├── config/
│   └── firebase.ts          # Configuración de Firebase
├── services/
│   ├── firestore.ts         # Servicio genérico de Firestore
│   ├── locations.ts         # Servicio específico de locations
│   └── sorteos.ts           # Servicio específico de sorteos
├── types/
│   └── firestore.ts         # Tipos TypeScript
├── utils/
│   ├── migration.ts         # Utilidades de migración
│   └── firebase-utils.ts    # Utilidades adicionales
└── app/
    └── firebase-test/
        └── page.tsx         # Página de prueba
```

## Notas Importantes

1. **Seguridad**: Asegúrate de configurar las reglas de seguridad en Firebase Console
2. **Índices**: Firestore puede requerir índices para ciertas consultas complejas
3. **Límites**: Firestore tiene límites de lectura/escritura por segundo
4. **Migración**: La migración solo se ejecuta si las colecciones están vacías
5. **Backup**: Usa `FirebaseUtils.backupToJSON()` para crear respaldos

## Reglas de Seguridad Sugeridas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir lectura y escritura para locations y sorteos
    match /{collection}/{document=**} {
      allow read, write: if collection in ['locations', 'sorteos'];
    }
  }
}
```

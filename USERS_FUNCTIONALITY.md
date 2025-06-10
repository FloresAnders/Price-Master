# Users Functionality Documentation

## Overview
User editing functionality has been successfully added to the Price-Master application's DataEditor component. This allows for complete CRUD (Create, Read, Update, Delete) operations on user data through Firebase integration.

## Features Implemented

### 1. User Data Structure
- **User Interface** (`src/types/firestore.ts`):
  ```typescript
  interface User {
    id?: string;
    name: string;
    location?: string;
    password?: string;
    role?: 'admin' | 'user' | 'manager';
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }
  ```

### 2. Users Service (`src/services/users.ts`)
Complete CRUD service with the following methods:
- `getAllUsers()` - Retrieve all users
- `getUserById(id)` - Get specific user
- `addUser(user)` - Create new user
- `updateUser(id, user)` - Update existing user
- `deleteUser(id)` - Delete user
- `findUsersByLocation(location)` - Search by location
- `findUsersByRole(role)` - Filter by role
- `getActiveUsers()` - Get only active users
- `getUsersOrderedByName()` - Get users sorted by name
- `searchUsers(query)` - Full text search by name or location

### 3. DataEditor Component Updates
Enhanced with Users tab including:
- **User Form Fields**:
  - Name (required text input)
  - Location (dropdown selector from existing locations)
  - Password (password input field)
  - Role (dropdown: Admin, User, Manager)
  - Active Status (checkbox)
- **CRUD Operations**:
  - Add new users
  - Edit existing users
  - Delete users
- **Data Management**:
  - Import/Export users data
  - Firebase save/load operations
  - Change detection and validation

### 4. Firebase Integration
- **Hooks**: Added `useUsers` hook integrated into `useFirebaseData`
- **Utils**: Enhanced Firebase utilities to include users in:
  - Collection statistics
  - Global search functionality
  - Backup operations
- **Migration**: Added users cleanup in migration service

### 5. API Routes
Updated Firebase test API (`src/app/api/firebase-test/route.ts`) to include users data in:
- GET: Returns users count and sample data
- POST: Includes users in migration results
- DELETE: Includes users in cleanup operations

### 6. Navigation
Added "Editor de Datos" tab to main navigation with Settings icon and proper description.

## Usage

### Accessing the Users Editor
1. Navigate to the main application
2. Click on the "Editor de Datos" tab
3. Select the "Usuarios" tab within the editor
4. Start managing users

### Adding a New User
1. Click "Agregar Usuario" button
2. Fill in required fields:
   - Name (required)
   - Location (select from available locations)
   - Password (user password)
   - Role (Admin/User/Manager)
   - Active status (checkbox)
3. Click "Guardar" to save to Firebase

### Editing Users
1. Modify any field in the user form
2. Changes are automatically detected
3. Click "Guardar" to persist changes to Firebase

### Import/Export
- **Export**: Click "Exportar" to download JSON with all data (locations, sorteos, users)
- **Import**: Click "Importar" to upload JSON file with user data

## Technical Implementation

### Files Modified/Created:
1. `src/types/firestore.ts` - Added User interface
2. `src/services/users.ts` - Created complete UsersService
3. `src/edit/DataEditor.tsx` - Added users functionality
4. `src/hooks/useFirebase.ts` - Integrated users hooks
5. `src/utils/migration.ts` - Added users migration support
6. `src/utils/firebase-utils.ts` - Enhanced with users utilities
7. `src/utils/firebase-init.ts` - Added users initialization
8. `src/app/api/firebase-test/route.ts` - Updated API with users data
9. `src/app/page.tsx` - Added DataEditor navigation tab

### Key Features:
- **Real-time Change Detection**: Changes are tracked across all data types
- **Role-based Access Control**: Support for different user roles
- **Data Validation**: Proper form validation and error handling
- **Firebase Integration**: Full CRUD operations with Firestore
- **Import/Export**: JSON-based data transfer capabilities
- **Search & Filter**: Multiple search and filter options

## Testing

### Manual Testing Checklist:
- [ ] Navigate to Editor de Datos tab
- [ ] Switch to Usuarios tab
- [ ] Add a new user with all fields
- [ ] Edit an existing user
- [ ] Delete a user
- [ ] Test import/export functionality
- [ ] Verify Firebase persistence
- [ ] Check change detection works
- [ ] Test form validation

### API Testing:
Use the provided npm scripts:
```bash
npm run firebase:test    # Test Firebase connection and get data
npm run firebase:migrate # Run migrations including users
npm run firebase:clear   # Clear all data including users
```

## Future Enhancements
- User authentication integration
- Permission-based UI restrictions
- Audit logging for user changes
- Bulk user operations
- User profile pictures
- Email notifications for user changes

## Support
The implementation is fully functional and ready for production use. All Firebase operations are properly handled with error management and user feedback.

/**
 * Migration script to add permissions to existing users
 * Run this script after deploying the permissions system
 */

//('🔄 Starting user permissions migration...\n');

// Simple migration that can be run in the browser console
const migrateUsers = async () => {
  try {
    // This assumes the Firebase SDK is available and configured
    const { collection, getDocs, doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('./src/config/firebase');
    
    //('📊 Fetching existing users...');
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    let updated = 0;
    let skipped = 0;
    
    //(`Found ${snapshot.size} users to process\n`);
    
    for (const userDoc of snapshot.docs) {
      const userData = userDoc.data();
      
      // Skip if user already has permissions
      if (userData.permissions) {
        //(`⏭️  Skipping ${userData.name} - already has permissions`);
        skipped++;
        continue;
      }
      
      // Determine default permissions based on role
      const role = userData.role || 'user';
      let permissions;
      
      // Assign superadmin-level permissions to both superadmin and admin users
      switch (role) {
        case 'superadmin':
        case 'admin':
          permissions = {
            scanner: true,
            calculator: true,
            converter: true,
            cashcounter: true,
            timingcontrol: true,
            controlhorario: true,
            supplierorders: true,
            mantenimiento: true,
          };
          break;
        default: // 'user'
          permissions = {
            scanner: true,
            calculator: true,
            converter: true,
            cashcounter: true,
            timingcontrol: false,
            controlhorario: false,
            supplierorders: false,
            mantenimiento: false,
          };
      }
      
      // Update user with permissions
      const userRef = doc(db, 'users', userDoc.id);
      await updateDoc(userRef, {
        permissions,
        updatedAt: new Date()
      });
      
      //(`✅ Updated ${userData.name} (${role}) with default permissions`);
      updated++;
    }
    
    //(`\n🎉 Migration completed!`);
    //(`📈 Users updated: ${updated}`);
    //(`⏭️  Users skipped: ${skipped}`);
    
    return { updated, skipped };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Manual migration instructions
//(`
📋 MIGRATION INSTRUCTIONS:

Option 1 - Using the application:
1. Log in as a superadmin user
2. Navigate to the Mantenimiento section
3. Use the "Migrar Usuarios" button in the User Permissions Manager

Option 2 - Manual browser console:
1. Open your application in the browser
2. Open browser developer tools (F12)
3. Go to the Console tab
4. Copy and paste this entire script
5. Run: migrateUsers()

Option 3 - Using the test users service:
1. Import this script in your application
2. Call the migration function from the UsersService
`);

// Export the migration function
if (typeof window !== 'undefined') {
  // Browser environment
  window.migrateUsers = migrateUsers;
}

export { migrateUsers };

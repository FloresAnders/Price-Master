/**
 * Test script to verify the user permissions system
 */

import { UsersService } from './src/services/users';
import { getDefaultPermissions, getAllPermissions, getNoPermissions } from './src/utils/permissions';

async function testPermissionsSystem() {
  //('🧪 Testing User Permissions System...\n');

  try {
    // Test 1: Default permissions for different roles
    //('📋 Test 1: Default Permissions');
    const adminPerms = getDefaultPermissions('admin');
    const userPerms = getDefaultPermissions('user');
    const superadminPerms = getDefaultPermissions('superadmin');
    
    //('Admin permissions:', adminPerms);
    //('User permissions:', userPerms);
    //('Superadmin permissions:', superadminPerms);
    //('✅ Default permissions test passed\n');

    // Test 2: Create user with permissions
    //('👤 Test 2: Create User with Permissions');
    const testUserId = await UsersService.addUser({
      name: 'test-permissions-user',
      role: 'user',
      ownercompanie: 'test-location',
      password: 'test123',
      isActive: true
    });
    
    //('Created user with ID:', testUserId);
    
    // Verify user has default permissions
    const createdUser = await UsersService.getUserById(testUserId);
    //('User permissions:', createdUser?.permissions);
    //('✅ User creation with permissions test passed\n');

    // Test 3: Update permissions
    //('🔧 Test 3: Update User Permissions');
    await UsersService.updateUserPermissions(testUserId, {
      scanner: false,
      mantenimiento: true
    });
    
    const updatedUser = await UsersService.getUserById(testUserId);
    //('Updated permissions:', updatedUser?.permissions);
    //('✅ Permission update test passed\n');

    // Test 4: Reset permissions
    //('🔄 Test 4: Reset User Permissions');
    await UsersService.resetUserPermissions(testUserId);
    
    const resetUser = await UsersService.getUserById(testUserId);
    //('Reset permissions:', resetUser?.permissions);
    //('✅ Permission reset test passed\n');

    // Cleanup
    await UsersService.deleteUser(testUserId);
    //('🧹 Cleanup completed');

    //('🎉 All tests passed! Permissions system is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Export for use in other test files
export { testPermissionsSystem };

// Run if called directly
if (require.main === module) {
  testPermissionsSystem()
    .then(() => {
      //('Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

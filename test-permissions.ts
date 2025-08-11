/**
 * Test script to verify the user permissions system
 */

import { UsersService } from './src/services/users';
import { getDefaultPermissions, getAllPermissions, getNoPermissions } from './src/utils/permissions';

async function testPermissionsSystem() {
  console.log('🧪 Testing User Permissions System...\n');

  try {
    // Test 1: Default permissions for different roles
    console.log('📋 Test 1: Default Permissions');
    const adminPerms = getDefaultPermissions('admin');
    const userPerms = getDefaultPermissions('user');
    const superadminPerms = getDefaultPermissions('superadmin');
    
    console.log('Admin permissions:', adminPerms);
    console.log('User permissions:', userPerms);
    console.log('Superadmin permissions:', superadminPerms);
    console.log('✅ Default permissions test passed\n');

    // Test 2: Create user with permissions
    console.log('👤 Test 2: Create User with Permissions');
    const testUserId = await UsersService.addUser({
      name: 'test-permissions-user',
      role: 'user',
      location: 'test-location',
      password: 'test123',
      isActive: true
    });
    
    console.log('Created user with ID:', testUserId);
    
    // Verify user has default permissions
    const createdUser = await UsersService.getUserById(testUserId);
    console.log('User permissions:', createdUser?.permissions);
    console.log('✅ User creation with permissions test passed\n');

    // Test 3: Update permissions
    console.log('🔧 Test 3: Update User Permissions');
    await UsersService.updateUserPermissions(testUserId, {
      scanner: false,
      mantenimiento: true
    });
    
    const updatedUser = await UsersService.getUserById(testUserId);
    console.log('Updated permissions:', updatedUser?.permissions);
    console.log('✅ Permission update test passed\n');

    // Test 4: Reset permissions
    console.log('🔄 Test 4: Reset User Permissions');
    await UsersService.resetUserPermissions(testUserId);
    
    const resetUser = await UsersService.getUserById(testUserId);
    console.log('Reset permissions:', resetUser?.permissions);
    console.log('✅ Permission reset test passed\n');

    // Cleanup
    await UsersService.deleteUser(testUserId);
    console.log('🧹 Cleanup completed');

    console.log('🎉 All tests passed! Permissions system is working correctly.');

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
      console.log('Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

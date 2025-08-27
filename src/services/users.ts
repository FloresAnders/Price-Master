import { FirestoreService } from './firestore';
import { User } from '../types/firestore';
import { getDefaultPermissions } from '../utils/permissions';

export class UsersService {
  private static readonly COLLECTION_NAME = 'users';

  /**
   * Get all users
   */
  static async getAllUsers(): Promise<User[]> {
    return await FirestoreService.getAll(this.COLLECTION_NAME);
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<User | null> {
    return await FirestoreService.getById(this.COLLECTION_NAME, id);
  }

  /**
   * Add a new user
   */
  static async addUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const userWithTimestamps = {
      ...user,
      isActive: user.isActive ?? true,
      // Add default permissions based on role if not provided
      permissions: user.permissions || getDefaultPermissions(user.role),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return await FirestoreService.add(this.COLLECTION_NAME, userWithTimestamps);
  }

  /**
   * Update a user
   */
  static async updateUser(id: string, user: Partial<User>): Promise<void> {
    const updateData = {
      ...user,
      updatedAt: new Date()
    };
    return await FirestoreService.update(this.COLLECTION_NAME, id, updateData);
  }

  /**
   * Delete a user
   */
  static async deleteUser(id: string): Promise<void> {
    return await FirestoreService.delete(this.COLLECTION_NAME, id);
  }
  /**
   * Find users by location
   */
  static async findUsersByLocation(location: string): Promise<User[]> {
    return await FirestoreService.query(this.COLLECTION_NAME, [
      { field: 'location', operator: '==', value: location }
    ]);
  }
  /**
   * Find users by role
   */  static async findUsersByRole(role: 'admin' | 'user' | 'superadmin'): Promise<User[]> {
    return await FirestoreService.query(this.COLLECTION_NAME, [
      { field: 'role', operator: '==', value: role }
    ]);
  }

  /**
   * Get active users only
   */
  static async getActiveUsers(): Promise<User[]> {
    return await FirestoreService.query(this.COLLECTION_NAME, [
      { field: 'isActive', operator: '==', value: true }
    ]);
  }

  /**
   * Get users ordered by name
   */
  static async getUsersOrderedByName(): Promise<User[]> {
    return await FirestoreService.query(this.COLLECTION_NAME, [], 'name', 'asc');
  }
  /**
   * Search users by name or location
   */
  static async searchUsers(searchTerm: string): Promise<User[]> {
    const users = await this.getAllUsers();
    const searchTermLower = searchTerm.toLowerCase();

    return users.filter(user =>
      user.name.toLowerCase().includes(searchTermLower) ||
      (user.location && user.location.toLowerCase().includes(searchTermLower))
    );
  }

  /**
   * Update user permissions
   */
  static async updateUserPermissions(id: string, permissions: Partial<import('../types/firestore').UserPermissions>): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }

    const currentPermissions = user.permissions || getDefaultPermissions(user.role);
    const updatedPermissions = {
      ...currentPermissions,
      ...permissions
    };

    return await this.updateUser(id, { permissions: updatedPermissions });
  }

  /**
   * Reset user permissions to default based on role
   */
  static async resetUserPermissions(id: string): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }

    const defaultPermissions = getDefaultPermissions(user.role);
    return await this.updateUser(id, { permissions: defaultPermissions });
  }

  /**
   * Migrate existing users to add default permissions
   */
  static async migrateUsersPermissions(): Promise<{ updated: number; skipped: number }> {
    const users = await this.getAllUsers();
    let updated = 0;
    let skipped = 0;

    for (const user of users) {
      if (!user.id) {
        skipped++;
        continue;
      }

      // If user already has permissions, skip
      if (user.permissions) {
        skipped++;
        continue;
      }

      // Add default permissions based on role
      const defaultPermissions = getDefaultPermissions(user.role);
      await this.updateUser(user.id, { permissions: defaultPermissions });
      updated++;
    }

    return { updated, skipped };
  }

  /**
   * Update existing users to ensure they have all available permissions
   * This is useful when new permissions are added to the system
   */
  static async ensureAllPermissions(): Promise<{ updated: number; skipped: number }> {
    const users = await this.getAllUsers();
    let updated = 0;
    let skipped = 0;

    for (const user of users) {
      if (!user.id) {
        skipped++;
        continue;
      }

      const defaultPermissions = getDefaultPermissions(user.role);
      const currentPermissions = user.permissions || {};

      // Check if user is missing any permissions
      let needsUpdate = false;
      const updatedPermissions: import('../types/firestore').UserPermissions = { ...defaultPermissions, ...currentPermissions };

      for (const [permission, defaultValue] of Object.entries(defaultPermissions)) {
        if (!(permission in currentPermissions)) {
          (updatedPermissions as unknown as Record<string, unknown>)[permission] = defaultValue;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await this.updateUser(user.id, { permissions: updatedPermissions });
        updated++;
      } else {
        skipped++;
      }
    }

    return { updated, skipped };
  }
}

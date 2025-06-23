import { FirestoreService } from './firestore';
import { User } from '../types/firestore';

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
   */
  static async findUsersByRole(role: 'admin' | 'user'): Promise<User[]> {
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
}

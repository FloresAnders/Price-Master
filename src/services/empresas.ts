import { FirestoreService } from './firestore';
import { Empresa } from '../types/firestore';

export class EmpresasService {
  private static readonly COLLECTION_NAME = 'empresa';

  static async getAllEmpresas(): Promise<Empresa[]> {
    return await FirestoreService.getAll(this.COLLECTION_NAME);
  }

  /**
   * Add a new empresa. If empresa.id is provided, create with that id.
   */
  static async addEmpresa(empresa: Partial<Empresa> & { id?: string }): Promise<string> {
    if (empresa.id) {
      // Use provided id
      await FirestoreService.addWithId(this.COLLECTION_NAME, empresa.id, {
        ownerId: empresa.ownerId || '',
        name: empresa.name || '',
        ubicacion: empresa.ubicacion || '',
        empleados: empresa.empleados || []
      });
      return empresa.id;
    }

    return await FirestoreService.add(this.COLLECTION_NAME, {
      ownerId: empresa.ownerId || '',
      name: empresa.name || '',
      ubicacion: empresa.ubicacion || '',
      empleados: empresa.empleados || []
    });
  }

  static async updateEmpresa(id: string, empresa: Partial<Empresa>): Promise<void> {
    return await FirestoreService.update(this.COLLECTION_NAME, id, empresa);
  }

  static async deleteEmpresa(id: string): Promise<void> {
    return await FirestoreService.delete(this.COLLECTION_NAME, id);
  }
}

export interface ProductEntry {
  /**
   * Firestore doc id (and also stored in the document for compatibility with JSON exports).
   */
  id: string;
  nombre: string;
  descripcion?: string;
  pesoengramos: number;
  precio: number;
  agent?: {
    name: string;
    phone: string;
  };
  precioxgramo: number;
  createdAt?: string;
  /**
   * Kept as `updateAt` to match the existing JSON model (productos.json).
   */
  updateAt?: string;
}

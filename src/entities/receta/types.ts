export interface RecetaProductoItem {
  productId: string;
  gramos: number;
}

export interface RecetaEntry {
  /**
   * Firestore doc id (and also stored in the document for compatibility with JSON exports).
   */
  id: string;
  nombre: string;
  descripcion?: string;
  productos: RecetaProductoItem[];
  /**
   * IVA como decimal (0.13 = 13%).
   * Opcional por compatibilidad con recetas existentes.
   */
  iva?: number;
  /**
   * Margen como decimal (0.35 = 35%).
   */
  margen: number;

  /**
   * Ruta en Firebase Storage donde se guarda la imagen de la receta.
   * Ej: FoodImages/<nombreReceta>
   */
  imagePath?: string;

  /**
   * URL de descarga (getDownloadURL) de la imagen en Storage.
   */
  imageUrl?: string;
  createdAt?: string;
  /**
   * Kept as `updateAt` to match recetas.json.
   */
  updateAt?: string;
}

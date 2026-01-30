import { FirestoreService } from './firestore';
import type { Empleado } from '../types/firestore';

export class EmpleadosService {
  private static readonly COLLECTION_NAME = 'empleados';

  private static slugifyForId(value: string): string {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'empleado';
    // Keep it Firestore-id friendly (no slashes)
    const cleaned = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    return cleaned || 'empleado';
  }

  static buildEmpleadoId(empresaId: string, empleadoNombre: string): string {
    const eid = String(empresaId || '').trim();
    const slug = this.slugifyForId(empleadoNombre);
    // Avoid '/' in doc ids; company ids typically safe, but sanitize anyway
    const safeEmpresa = eid.replace(/\//g, '_');
    return `${safeEmpresa}__${slug}`;
  }

  private static normalizeEmpleadoDoc(raw: unknown, empresaId: string): Omit<Empleado, 'id'> {
    const obj = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    const nombre = String((obj as any).Empleado ?? (obj as any).name ?? '').trim();
    const ccssRaw = String((obj as any).ccssType ?? '').trim();
    const ccssType: 'TC' | 'MT' = (ccssRaw === 'MT' || ccssRaw === 'TC') ? (ccssRaw as 'TC' | 'MT') : 'TC';
    return {
      empresaId,
      Empleado: nombre,
      ccssType,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static async getByEmpresaId(empresaId: string): Promise<Empleado[]> {
    const id = String(empresaId || '').trim();
    if (!id) return [];
    return await FirestoreService.query(this.COLLECTION_NAME, [
      { field: 'empresaId', operator: '==', value: id },
    ]) as Empleado[];
  }

  static async addEmpleado(empleado: Omit<Empleado, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const empresaId = String(empleado.empresaId || '').trim();
    if (!empresaId) throw new Error('empresaId es requerido para crear un empleado');

    const data: Omit<Empleado, 'id'> = {
      ...this.normalizeEmpleadoDoc(empleado, empresaId),
      // preserve optional ownerId if provided
      ownerId: empleado.ownerId,

      // extra fields
      pagoHoraBruta: empleado.pagoHoraBruta,
      diaContratacion: empleado.diaContratacion,
      paganAguinaldo: empleado.paganAguinaldo,
      cantidadHorasTrabaja: empleado.cantidadHorasTrabaja,
      danReciboPago: empleado.danReciboPago,
      contratoFisico: empleado.contratoFisico,
      espacioComida: empleado.espacioComida,
      brindanVacaciones: empleado.brindanVacaciones,
      incluidoCCSS: empleado.incluidoCCSS,
      incluidoINS: empleado.incluidoINS,
      preguntasExtra: empleado.preguntasExtra,
    };

    return await FirestoreService.add(this.COLLECTION_NAME, data);
  }

  /**
   * Upsert determinístico por (empresaId + Empleado).
   * Útil cuando vienes de una lista embebida (sin id) y quieres empezar a guardar detalles.
   */
  static async upsertEmpleadoByEmpresaAndName(
    empleado: Omit<Empleado, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const empresaId = String(empleado.empresaId || '').trim();
    const nombre = String(empleado.Empleado || '').trim();
    if (!empresaId) throw new Error('empresaId es requerido');
    if (!nombre) throw new Error('Empleado (nombre) es requerido');

    const id = this.buildEmpleadoId(empresaId, nombre);
    const exists = await FirestoreService.exists(this.COLLECTION_NAME, id);

    if (exists) {
      await this.updateEmpleado(id, { ...empleado });
      return id;
    }

    const data: Omit<Empleado, 'id'> = {
      ...this.normalizeEmpleadoDoc(empleado, empresaId),
      ownerId: empleado.ownerId,
      // extra fields
      pagoHoraBruta: empleado.pagoHoraBruta,
      diaContratacion: empleado.diaContratacion,
      paganAguinaldo: empleado.paganAguinaldo,
      cantidadHorasTrabaja: empleado.cantidadHorasTrabaja,
      danReciboPago: empleado.danReciboPago,
      contratoFisico: empleado.contratoFisico,
      espacioComida: empleado.espacioComida,
      brindanVacaciones: empleado.brindanVacaciones,
      incluidoCCSS: empleado.incluidoCCSS,
      incluidoINS: empleado.incluidoINS,
      preguntasExtra: empleado.preguntasExtra,
    };

    await FirestoreService.addWithId(this.COLLECTION_NAME, id, data);
    return id;
  }

  static async updateEmpleado(id: string, patch: Partial<Empleado>): Promise<void> {
    const docId = String(id || '').trim();
    if (!docId) throw new Error('id es requerido para actualizar un empleado');

    const updateData: Partial<Empleado> = {
      ...patch,
      updatedAt: new Date(),
    };

    // Normalizar mínimos
    if (updateData.Empleado !== undefined) {
      updateData.Empleado = String(updateData.Empleado || '').trim();
    }
    if (updateData.ccssType !== undefined) {
      updateData.ccssType = updateData.ccssType === 'MT' ? 'MT' : 'TC';
    }

    return await FirestoreService.update(this.COLLECTION_NAME, docId, updateData);
  }

  static async deleteEmpleado(id: string): Promise<void> {
    const docId = String(id || '').trim();
    if (!docId) return;
    return await FirestoreService.delete(this.COLLECTION_NAME, docId);
  }
}

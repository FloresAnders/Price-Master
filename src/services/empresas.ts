import { FirestoreService } from './firestore';
import { Empresas, EmpresaEmpleado } from '../types/firestore';
import { UsersService } from './users';

export class EmpresasService {
    private static readonly COLLECTION_NAME = 'empresas';

    // Normalize empleados payload to a consistent shape before persisting
    private static normalizeEmpleado(raw: unknown): EmpresaEmpleado {
        const defaultEmp: EmpresaEmpleado = { Empleado: '', hoursPerShift: 8, extraAmount: 0, ccssType: 'TC' };
        if (!raw || typeof raw !== 'object') return defaultEmp;

        const obj = raw as Record<string, unknown>;

        // helper to read possibly-localized or mis-typed keys
        const getString = (...keys: string[]) => {
            for (const k of keys) {
                const val = obj[k];
                if (val !== undefined && val !== null) {
                    return String(val).trim();
                }
            }
            return '';
        };

        const getNumber = (...keys: string[]) => {
            for (const k of keys) {
                const v = obj[k];
                if (v !== undefined && v !== null && v !== '') {
                    const n = Number(v as unknown as number);
                    if (!Number.isNaN(n)) return n;
                }
            }
            return undefined;
        };

        const name = getString('Empleado', 'Empleado ', 'name', 'Name');
        const hours = getNumber('hoursPerShift', 'Horas por turno', 'Horas por turno ', 'hoursPerShift ');
        const extra = getNumber('extraAmount', 'Monto extra', 'Monto extra ', 'extraAmount ');

        // ccssType can come with weird keys or trailing spaces or localized labels
        const ccssCandidates = ['ccssType', 'ccssType ', 'Tipo CCSS', 'Tipo CCSS ', 'tipoCcss', 'ccsstype'];
        let ccss = '';
        for (const k of ccssCandidates) {
            const v = obj[k];
            if (v !== undefined && v !== null) {
                ccss = String(v).trim();
                if (ccss) break;
            }
        }

        // Some payloads may include multiple keys; also check values inside object
        if (!ccss && typeof obj.ccssType === 'string') ccss = (obj.ccssType as string).trim();

        const normalized: EmpresaEmpleado = {
            Empleado: name || '',
            hoursPerShift: typeof hours === 'number' ? hours : 8,
            extraAmount: typeof extra === 'number' ? extra : 0,
            ccssType: (ccss === 'MT' || ccss === 'TC') ? (ccss as 'TC' | 'MT') : 'TC'
        };

        return normalized;
    }

    private static normalizeEmpleados(rawArr: unknown): EmpresaEmpleado[] {
        if (!Array.isArray(rawArr)) return [];
        return (rawArr as unknown[]).map((r) => EmpresasService.normalizeEmpleado(r));
    }

    static async getAllEmpresas(): Promise<Empresas[]> {
        const all = await FirestoreService.getAll(this.COLLECTION_NAME) as Empresas[];
        return all.map(e => ({
            ...e,
            empleados: EmpresasService.normalizeEmpleados(e.empleados as unknown)
        }));
    }

    /**
     * Add a new empresa. If empresa.id is provided, create with that id.
     */
    static async addEmpresa(empresa: Partial<Empresas> & { id?: string }): Promise<string> {
        // If an ownerId is provided, enforce owner's maxCompanies limit (if any)
        const ownerId = empresa.ownerId || '';
        if (ownerId) {
            try {
                const owner = await UsersService.getUserById(ownerId);
                if (owner && typeof owner.maxCompanies === 'number') {
                    // Count existing empresas for this owner
                    const existing = await FirestoreService.query(this.COLLECTION_NAME, [
                        { field: 'ownerId', operator: '==', value: ownerId }
                    ]);
                    const currentCount = existing.length;
                    if (currentCount >= owner.maxCompanies) {
                        throw new Error(`El dueño de tu empresa ha alcanzado el máximo de empresas permitidas, max: (${owner.maxCompanies + 1})`);
                    }
                }
            } catch (err) {
                // If query for owner fails, surface the error
                if (err instanceof Error) throw err;
                throw new Error('Failed to validate owner maxCompanies');
            }
        }
        const empleadosToSave = EmpresasService.normalizeEmpleados(empresa.empleados || []);

        if (empresa.id) {
            // Use provided id
            await FirestoreService.addWithId(this.COLLECTION_NAME, empresa.id, {
                ownerId: empresa.ownerId || '',
                name: empresa.name || '',
                ubicacion: empresa.ubicacion || '',
                empleados: empleadosToSave
            });
            return empresa.id;
        }

        return await FirestoreService.add(this.COLLECTION_NAME, {
            ownerId: empresa.ownerId || '',
            name: empresa.name || '',
            ubicacion: empresa.ubicacion || '',
            empleados: empleadosToSave
        });
    }

    static async updateEmpresa(id: string, empresa: Partial<Empresas>): Promise<void> {
        const patch = { ...empresa } as Partial<Empresas> & Record<string, unknown>;
        if (patch.empleados) {
            patch.empleados = EmpresasService.normalizeEmpleados(patch.empleados as unknown);
        }
        return await FirestoreService.update(this.COLLECTION_NAME, id, patch as Partial<Empresas>);
    }

    static async deleteEmpresa(id: string): Promise<void> {
        return await FirestoreService.delete(this.COLLECTION_NAME, id);
    }
}

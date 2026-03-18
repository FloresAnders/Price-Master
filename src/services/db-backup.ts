import { FirestoreService } from './firestore';
import { decodeFirestoreData, encodeFirestoreData } from '@/utils/firestore-serialization';

export type CollectionBackupDocument = {
  id: string;
  data: Record<string, unknown>;
};

export type CollectionBackup = {
  kind: 'CollectionBackup';
  version: 1;
  exportedAt: string;
  collection: string;
  documents: CollectionBackupDocument[];
};

export class DbBackupService {
  static async exportCollection(collectionName: string): Promise<CollectionBackup> {
    const name = String(collectionName || '').trim();
    if (!name) {
      throw new Error('[DbBackupService.exportCollection] collectionName is required');
    }

    const rawDocs = await FirestoreService.getAll(name);
    const documents: CollectionBackupDocument[] = rawDocs.map((raw) => {
      const { id, ...data } = raw as { id: string } & Record<string, unknown>;
      return {
        id,
        data: encodeFirestoreData(data as Record<string, unknown>),
      };
    });

    return {
      kind: 'CollectionBackup',
      version: 1,
      exportedAt: new Date().toISOString(),
      collection: name,
      documents,
    };
  }

  static async importCollection(backup: CollectionBackup): Promise<{ imported: number }> {
    if (!backup || backup.kind !== 'CollectionBackup') {
      throw new Error('[DbBackupService.importCollection] Invalid backup format');
    }

    const collectionName = String(backup.collection || '').trim();
    if (!collectionName) {
      throw new Error('[DbBackupService.importCollection] backup.collection is required');
    }

    const docs = Array.isArray(backup.documents) ? backup.documents : [];
    let imported = 0;

    for (const entry of docs) {
      const id = String(entry?.id || '').trim();
      if (!id) continue;

      const decoded = decodeFirestoreData((entry.data ?? {}) as Record<string, unknown>);
      await FirestoreService.addWithId(collectionName, id, decoded);
      imported += 1;
    }

    return { imported };
  }
}

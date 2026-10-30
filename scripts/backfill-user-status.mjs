import { pathToFileURL } from "node:url";
import {
  buildUserStatusProjection,
  isSameUserStatusProjection,
  syncUserStatus as syncUserStatusCore,
} from "../functions/modules/user-status-core.js";

const PAGE_SIZE = 200;
const MAX_CONCURRENCY = 10;
const DATABASE_IDS = new Set(["(default)", "restauracion"]);

export function parseUserStatusBackfillArgs(argv) {
  let databaseId;
  let apply = false;
  let applySeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--database") {
      if (databaseId !== undefined) throw new Error("--database may be provided only once.");
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--database requires a value.");
      databaseId = value.trim();
      index += 1;
      continue;
    }
    if (argument === "--apply") {
      if (applySeen) throw new Error("--apply may be provided only once.");
      applySeen = true;
      apply = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!databaseId) throw new Error("--database is required.");
  if (!DATABASE_IDS.has(databaseId)) {
    throw new Error("--database must be exactly (default) or restauracion.");
  }

  return { databaseId, apply, pageSize: PAGE_SIZE, concurrency: MAX_CONCURRENCY };
}

const mapWithConcurrency = async (items, concurrency, operation) => {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await operation(items[index]);
      }
    },
  );
  await Promise.all(workers);
};

export async function runUserStatusBackfill(options, dependencies) {
  const totals = { scanned: 0, created: 0, updated: 0, noop: 0, failed: 0 };
  let afterId = null;

  while (true) {
    const page = await dependencies.listUsersPage({
      databaseId: options.databaseId,
      afterId,
      limit: PAGE_SIZE,
    });
    const userIds = Array.isArray(page.userIds) ? page.userIds : [];
    if (userIds.length === 0) break;

    await mapWithConcurrency(userIds, MAX_CONCURRENCY, async (userId) => {
      totals.scanned += 1;
      try {
        if (!options.apply) {
          const action = await dependencies.inspectUserStatus({
            databaseId: options.databaseId,
            userId,
          });
          if (action === "create") totals.created += 1;
          else if (action === "update") totals.updated += 1;
          else totals.noop += 1;
          return;
        }

        const result = await dependencies.syncUserStatus({
          databaseId: options.databaseId,
          userId,
        });
        if (!result.changed) totals.noop += 1;
        else if (result.created) totals.created += 1;
        else totals.updated += 1;
      } catch (error) {
        totals.failed += 1;
        console.error(`[backfill:user-status] ${userId}:`, error);
      }
    });

    const nextAfterId = page.nextAfterId ?? null;
    if (!nextAfterId) break;
    if (nextAfterId === afterId) throw new Error("Backfill pagination cursor did not advance.");
    afterId = nextAfterId;
  }

  return totals;
}

async function createRuntimeDependencies(databaseId) {
  const [{ applicationDefault, getApps, initializeApp }, firestoreAdmin] =
    await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/firestore"),
    ]);
  const app =
    getApps()[0] ?? initializeApp({ credential: applicationDefault() });
  const db =
    databaseId === "(default)"
      ? firestoreAdmin.getFirestore(app)
      : firestoreAdmin.getFirestore(app, databaseId);
  const selectDatabase = (requestedDatabaseId) => {
    if (requestedDatabaseId !== databaseId) {
      throw new Error("Backfill database changed after initialization.");
    }
    return db;
  };

  return {
    async listUsersPage({ afterId, limit }) {
      let query = db
        .collection("users")
        .orderBy(firestoreAdmin.FieldPath.documentId())
        .limit(limit);
      if (afterId) query = query.startAfter(afterId);
      const snapshot = await query.get();
      return {
        userIds: snapshot.docs.map((document) => document.id),
        nextAfterId:
          snapshot.docs.length === limit
            ? snapshot.docs[snapshot.docs.length - 1].id
            : null,
      };
    },
    async inspectUserStatus({ userId }) {
      const [userSnapshot, statusSnapshot] = await Promise.all([
        db.collection("users").doc(userId).get(),
        db.collection("userStatus").doc(userId).get(),
      ]);
      if (!statusSnapshot.exists) return "create";
      return isSameUserStatusProjection(
        statusSnapshot.data() ?? {},
        buildUserStatusProjection(userSnapshot),
      )
        ? "noop"
        : "update";
    },
    syncUserStatus({ userId }) {
      return syncUserStatusCore({
        databaseId,
        userId,
        getDbByDatabaseId: selectDatabase,
        serverTimestamp: firestoreAdmin.FieldValue.serverTimestamp,
      });
    },
  };
}

async function main() {
  const options = parseUserStatusBackfillArgs(process.argv.slice(2));
  console.log("[backfill:user-status]", {
    databaseId: options.databaseId,
    mode: options.apply ? "apply" : "dry-run",
    pageSize: PAGE_SIZE,
    concurrency: MAX_CONCURRENCY,
  });
  const dependencies = await createRuntimeDependencies(options.databaseId);
  const totals = await runUserStatusBackfill(options, dependencies);
  console.log("[backfill:user-status] totals", totals);
  if (totals.failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("[backfill:user-status] failed", error);
    process.exitCode = 1;
  });
}

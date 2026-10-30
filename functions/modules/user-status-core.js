const normalizeUpdateTime = (value) => {
  if (!value) return null;
  const seconds = Number(value.seconds ?? value._seconds);
  const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds);
  if (Number.isFinite(seconds) && Number.isFinite(nanoseconds)) {
    return `${Math.trunc(seconds)}.${String(Math.trunc(nanoseconds)).padStart(9, '0')}`;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.toMillis === 'function') return new Date(value.toMillis()).toISOString();
  if (typeof value === 'string') return value;
  return null;
};

export const buildUserStatusProjection = (snapshot) => {
  const sourceExists = snapshot?.exists === true;
  const data = sourceExists ? snapshot.data?.() ?? {} : {};

  return {
    sourceExists,
    sourceUpdateTime: sourceExists ? normalizeUpdateTime(snapshot.updateTime) : null,
    isActive: sourceExists ? data.isActive !== false : false,
  };
};

export const isSameUserStatusProjection = (status, projection) =>
  status?.sourceExists === projection.sourceExists &&
  status?.sourceUpdateTime === projection.sourceUpdateTime &&
  status?.isActive === projection.isActive;

const normalizeRevision = (value) => {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.floor(revision) : 0;
};

export const syncUserStatus = async ({
  databaseId,
  userId,
  getDbByDatabaseId,
  serverTimestamp,
}) => {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) throw new Error('userId is required');
  if (typeof getDbByDatabaseId !== 'function' || typeof serverTimestamp !== 'function') {
    throw new Error('Firestore dependencies are required');
  }

  const db = getDbByDatabaseId(databaseId);
  const userRef = db.collection('users').doc(normalizedUserId);
  const statusRef = db.collection('userStatus').doc(normalizedUserId);

  return db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const statusSnapshot = await transaction.get(statusRef);
    const projection = buildUserStatusProjection(userSnapshot);
    const current = statusSnapshot.exists ? statusSnapshot.data() ?? {} : {};
    const revision = normalizeRevision(current.revision);

    if (statusSnapshot.exists && isSameUserStatusProjection(current, projection)) {
      return { changed: false, created: false, revision };
    }

    const nextRevision = revision + 1;
    transaction.set(
      statusRef,
      {
        ...projection,
        revision: nextRevision,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return { changed: true, created: !statusSnapshot.exists, revision: nextRevision };
  });
};

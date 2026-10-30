export function assertConfirmedUnlimitedRead({
  readAll,
  projectId,
  confirmation,
}) {
  if (!readAll) return;
  if (!projectId || confirmation !== projectId) {
    throw new Error(
      `Unlimited Firestore reads require --confirm-project ${projectId}.`,
    );
  }
}

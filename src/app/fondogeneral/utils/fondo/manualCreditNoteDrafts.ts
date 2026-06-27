export type ManualCreditNoteDraft = {
  id: string;
  invoiceNumber: string;
  amount: number;
  observation?: string;
};

type ManualCreditNoteDraftInput = Omit<ManualCreditNoteDraft, "id">;

const MANUAL_CREDIT_NOTE_DRAFT_PREFIX = "manual-nc-draft-";

export function isManualCreditNoteDraftId(id: string): boolean {
  return id.startsWith(MANUAL_CREDIT_NOTE_DRAFT_PREFIX);
}

function getNextManualCreditNoteDraftId(drafts: ManualCreditNoteDraft[]): string {
  const nextNumber =
    drafts.reduce((max, draft) => {
      if (!isManualCreditNoteDraftId(draft.id)) return max;
      const value = Number.parseInt(
        draft.id.slice(MANUAL_CREDIT_NOTE_DRAFT_PREFIX.length),
        10,
      );
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1;
  return `${MANUAL_CREDIT_NOTE_DRAFT_PREFIX}${nextNumber}`;
}

export function appendManualCreditNoteDraft(
  drafts: ManualCreditNoteDraft[],
  draft: ManualCreditNoteDraftInput,
  selectedIds: string[],
): { drafts: ManualCreditNoteDraft[]; selectedIds: string[] } {
  const nextDraft = {
    ...draft,
    id: getNextManualCreditNoteDraftId(drafts),
  };

  return {
    drafts: [...drafts, nextDraft],
    selectedIds: selectedIds.includes(nextDraft.id)
      ? selectedIds
      : [...selectedIds, nextDraft.id],
  };
}

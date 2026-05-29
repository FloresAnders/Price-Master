export const TASKBOARD_COLLECTIONS = {
  workspaces: "taskboardWorkspaces",
  members: "members",
  boards: "boards",
  columns: "columns",
  cards: "cards",
  checklist: "checklist",
  comments: "comments",
  attachments: "attachments",
  activity: "activity",
  labels: "labels",
} as const;

export const buildWorkspaceDocPath = (workspaceId: string) =>
  `${TASKBOARD_COLLECTIONS.workspaces}/${workspaceId}`;

export const buildWorkspaceMembersPath = (workspaceId: string) =>
  `${buildWorkspaceDocPath(workspaceId)}/${TASKBOARD_COLLECTIONS.members}`;

export const buildWorkspaceBoardsPath = (workspaceId: string) =>
  `${buildWorkspaceDocPath(workspaceId)}/${TASKBOARD_COLLECTIONS.boards}`;

export const buildBoardColumnsPath = (workspaceId: string, boardId: string) =>
  `${buildWorkspaceBoardsPath(workspaceId)}/${boardId}/${
    TASKBOARD_COLLECTIONS.columns
  }`;

export const buildBoardCardsPath = (workspaceId: string, boardId: string) =>
  `${buildWorkspaceBoardsPath(workspaceId)}/${boardId}/${
    TASKBOARD_COLLECTIONS.cards
  }`;

export const buildCardChecklistPath = (
  workspaceId: string,
  boardId: string,
  cardId: string,
) =>
  `${buildBoardCardsPath(workspaceId, boardId)}/${cardId}/${
    TASKBOARD_COLLECTIONS.checklist
  }`;

export const buildCardCommentsPath = (
  workspaceId: string,
  boardId: string,
  cardId: string,
) =>
  `${buildBoardCardsPath(workspaceId, boardId)}/${cardId}/${
    TASKBOARD_COLLECTIONS.comments
  }`;

export const buildCardAttachmentsPath = (
  workspaceId: string,
  boardId: string,
  cardId: string,
) =>
  `${buildBoardCardsPath(workspaceId, boardId)}/${cardId}/${
    TASKBOARD_COLLECTIONS.attachments
  }`;

export const buildCardActivityPath = (
  workspaceId: string,
  boardId: string,
  cardId: string,
) =>
  `${buildBoardCardsPath(workspaceId, boardId)}/${cardId}/${
    TASKBOARD_COLLECTIONS.activity
  }`;

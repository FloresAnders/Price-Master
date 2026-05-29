export type TaskboardRole = "owner" | "admin" | "member" | "guest";

export type TaskboardPriority = "low" | "medium" | "high" | "urgent";

export type TaskboardLabel = {
  id: string;
  name: string;
  color: string;
};

export type TaskboardWorkspace = {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
};

export type TaskboardMember = {
  id: string;
  role: TaskboardRole;
  status?: "active" | "invited" | "disabled";
  joinedAt?: string;
};

export type TaskboardBoard = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  visibility?: "private" | "workspace";
  view?: "kanban" | "calendar" | "timeline";
};

export type TaskboardColumn = {
  id: string;
  boardId: string;
  title: string;
  orderKey: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TaskboardCard = {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  labels?: TaskboardLabel[];
  priority?: TaskboardPriority;
  dueDate?: string | null;
  checklistDoneCount?: number;
  checklistTotalCount?: number;
  commentsCount?: number;
  attachmentsCount?: number;
  assignees?: string[];
  orderKey: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TaskboardChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  orderKey: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TaskboardComment = {
  id: string;
  text: string;
  authorId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TaskboardAttachment = {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
  createdAt?: string;
};

export type TaskboardActivity = {
  id: string;
  type:
    | "created"
    | "updated"
    | "moved"
    | "commented"
    | "checked"
    | "assigned"
    | "label"
    | "priority"
    | "due";
  data?: Record<string, unknown>;
  actorId?: string;
  createdAt?: string;
};

export type TaskboardFilters = {
  query?: string;
  assignees?: string[];
  labels?: string[];
  priorities?: TaskboardPriority[];
  due?: "overdue" | "today" | "week" | "none";
};

export type TaskboardColumnWithCards = TaskboardColumn & {
  cards: TaskboardCard[];
};

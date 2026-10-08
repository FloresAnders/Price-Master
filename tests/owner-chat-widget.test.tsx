// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OwnerChatWidget from "@/components/chat/OwnerChatWidget";
import { OWNER_CHAT_PINNED_STORAGE_KEY } from "@/components/chat/ownerChatPresentation";
import type { OwnerChatMessage } from "@/services/owner-chat";

type FloatingAction = {
  onClick: () => void;
};

const testState = vi.hoisted(() => ({
  floatingAction: null as FloatingAction | null,
  messages: [] as OwnerChatMessage[],
  unsubscribe: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: {
      id: "admin-1",
      name: "Admin",
      fullName: "Admin principal",
      role: "admin",
      eliminate: false,
    },
  }),
}));

vi.mock("@/contexts/SessionListenerPreferencesContext", () => ({
  useSessionListenerPreferences: () => ({
    loaded: true,
    preferences: { chatReadMuteState: false },
  }),
}));

vi.mock("@/services/layoutPrefsDb", () => ({
  shouldSubscribeChatReadState: () => false,
}));

vi.mock("@/components/ui/FloatingActionsDock", () => ({
  useFloatingAction: (action: FloatingAction) => {
    testState.floatingAction = action;
  },
}));

vi.mock("@/services/users", () => ({
  UsersService: {
    getAllUsers: vi.fn(async () => []),
    getUserById: vi.fn(async () => null),
  },
}));

vi.mock("@/services/owner-chat", () => ({
  getEffectiveOwnerChatId: () => "admin-1",
  markOwnerChatRead: vi.fn(async () => undefined),
  resolveOwnerChatSenderSchedule: vi.fn(async () => null),
  sendOwnerChatMessage: vi.fn(async () => undefined),
  setOwnerChatMuted: vi.fn(async () => undefined),
  subscribeOwnerChatMessages: (
    _ownerId: string,
    callback: (messages: OwnerChatMessage[]) => void,
  ) => {
    callback(testState.messages);
    return testState.unsubscribe;
  },
  subscribeOwnerChatReadState: () => testState.unsubscribe,
}));

function timestamp(isoDate: string): OwnerChatMessage["createdAt"] {
  const date = new Date(isoDate);
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
  } as OwnerChatMessage["createdAt"];
}

async function openChat(): Promise<void> {
  await waitFor(() => expect(testState.floatingAction).not.toBeNull());
  act(() => testState.floatingAction?.onClick());
  await screen.findByRole("complementary", { name: "Chat del equipo" });
}

describe("ventana del chat", () => {
  beforeEach(() => {
    window.localStorage.clear();
    testState.floatingAction = null;
    testState.unsubscribe.mockReset();
    testState.messages = [
      {
        id: "mensaje-1",
        ownerId: "admin-1",
        senderId: "admin-1",
        senderName: "Admin principal",
        senderRole: "admin",
        text: "Mensaje del primer día",
        createdAt: timestamp("2020-02-03T15:00:00.000Z"),
      },
      {
        id: "mensaje-2",
        ownerId: "admin-1",
        senderId: "user-2",
        senderName: "Usuario",
        senderRole: "admin",
        text: "Otro mensaje del primer día",
        createdAt: timestamp("2020-02-03T16:00:00.000Z"),
      },
      {
        id: "mensaje-3",
        ownerId: "admin-1",
        senderId: "user-2",
        senderName: "Usuario",
        senderRole: "admin",
        text: "Mensaje del segundo día",
        createdAt: timestamp("2020-02-04T15:00:00.000Z"),
      },
    ];
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renderiza un divisor cuando cambia el día de los mensajes", async () => {
    render(<OwnerChatWidget />);
    await openChat();

    const dividers = screen.getAllByRole("separator");
    expect(dividers).toHaveLength(2);
    expect(dividers[0].getAttribute("aria-label")).toBe(
      "Mensajes de lunes, 3 de febrero de 2020",
    );
    expect(dividers[1].getAttribute("aria-label")).toBe(
      "Mensajes de martes, 4 de febrero de 2020",
    );
  });

  it("quita la capa modal al anclar y conserva la preferencia", async () => {
    render(<OwnerChatWidget />);
    await openChat();

    expect(screen.getByRole("button", { name: "Cerrar chat" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Anclar chat" }));

    expect(
      screen.getByRole("button", { name: "Desanclar chat" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Cerrar chat" }),
    ).toBeNull();
    expect(window.localStorage.getItem(OWNER_CHAT_PINNED_STORAGE_KEY)).toBe(
      "true",
    );
  });

  it("restaura el chat anclado desde la preferencia del navegador", async () => {
    window.localStorage.setItem(OWNER_CHAT_PINNED_STORAGE_KEY, "true");

    render(<OwnerChatWidget />);
    await openChat();

    expect(
      await screen.findByRole("button", { name: "Desanclar chat" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Cerrar chat" }),
    ).toBeNull();
  });
});

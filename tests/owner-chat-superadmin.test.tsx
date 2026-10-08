// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OwnerChatWidget from "@/components/chat/OwnerChatWidget";
import type { OwnerChatMessage } from "@/services/owner-chat";
import type { User } from "@/types/firestore";

type FloatingAction = {
  onClick: () => void;
};

const testState = vi.hoisted(() => ({
  floatingAction: null as FloatingAction | null,
  messages: [] as OwnerChatMessage[],
  user: {
    id: "super-1",
    name: "Ada Super",
    fullName: "Ada Super",
    role: "superadmin",
  } as User,
  sendOwnerChatMessage: vi.fn(async () => undefined),
  unsubscribe: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: testState.user,
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
    getAllUsers: vi.fn(async () => [
      {
        id: "admin-1",
        name: "Admin principal",
        fullName: "Admin principal",
        role: "admin",
        eliminate: false,
      },
    ]),
    getUserById: vi.fn(async () => null),
  },
}));

vi.mock("@/services/owner-chat", () => ({
  getEffectiveOwnerChatId: (user: User) => user.ownerId || user.id || "",
  markOwnerChatRead: vi.fn(async () => undefined),
  resolveOwnerChatSenderSchedule: vi.fn(async () => null),
  sendOwnerChatMessage: testState.sendOwnerChatMessage,
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

async function openChat(): Promise<void> {
  await waitFor(() => expect(testState.floatingAction).not.toBeNull());
  act(() => testState.floatingAction?.onClick());
  await screen.findByRole("complementary", { name: "Chat del equipo" });
}

describe("chat de superadmin", () => {
  beforeEach(() => {
    window.localStorage.clear();
    testState.floatingAction = null;
    testState.messages = [];
    testState.sendOwnerChatMessage.mockClear();
    testState.unsubscribe.mockReset();
    testState.user = {
      id: "super-1",
      name: "Ada Super",
      fullName: "Ada Super",
      role: "superadmin",
    } as User;
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("permite enviar al chat del admin seleccionado", async () => {
    render(<OwnerChatWidget />);
    await openChat();

    const input = await screen.findByPlaceholderText("Escribe un mensaje");
    fireEvent.change(input, { target: { value: "Mensaje de soporte" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() =>
      expect(testState.sendOwnerChatMessage).toHaveBeenCalledWith(
        "admin-1",
        testState.user,
        "Mensaje de soporte",
      ),
    );
  });

  it("muestra el nombre y el rol en los mensajes de superadmin", async () => {
    testState.messages = [
      {
        id: "mensaje-superadmin",
        ownerId: "admin-1",
        senderId: "super-1",
        senderName: "Ada Super",
        senderRole: "superadmin",
        text: "Mensaje de soporte",
        createdAt: null,
      },
    ];

    render(<OwnerChatWidget />);
    await openChat();

    expect(screen.getByText("Ada Super · Superadmin")).toBeTruthy();
  });
});


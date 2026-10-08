// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as layoutPrefsDb from "@/services/layoutPrefsDb";

type SessionListenerPreferences = {
  pendingCompanyRequests: boolean;
  chatReadMuteState: boolean;
};

type SessionListenerPreferenceApi = {
  getSessionListenerPreferences?: (
    userId: string,
  ) => Promise<SessionListenerPreferences>;
  setSessionListenerPreference?: (
    userId: string,
    key: keyof SessionListenerPreferences,
    enabled: boolean,
  ) => Promise<void>;
  shouldSubscribePendingCompanyRequests?: (input: {
    loaded: boolean;
    enabled: boolean;
    company: string;
    tabVisible: boolean;
  }) => boolean;
  shouldSubscribeChatReadState?: (input: {
    loaded: boolean;
    enabled: boolean;
    ownerId: string;
    userId: string;
  }) => boolean;
};

const api = layoutPrefsDb as SessionListenerPreferenceApi;

describe("session listener preferences", () => {
  it("defaults both listeners to off when user has no saved preference", async () => {
    expect(typeof api.getSessionListenerPreferences).toBe("function");
    if (!api.getSessionListenerPreferences) return;

    await expect(
      api.getSessionListenerPreferences("new-user-default-off"),
    ).resolves.toEqual({
      pendingCompanyRequests: false,
      chatReadMuteState: false,
    });
  });

  it("persists preferences in IndexedDB separately for each user", async () => {
    expect(typeof api.getSessionListenerPreferences).toBe("function");
    expect(typeof api.setSessionListenerPreference).toBe("function");
    if (
      !api.getSessionListenerPreferences ||
      !api.setSessionListenerPreference
    ) {
      return;
    }

    await api.setSessionListenerPreference(
      "listener-user-a",
      "pendingCompanyRequests",
      true,
    );

    await expect(
      api.getSessionListenerPreferences("listener-user-a"),
    ).resolves.toEqual({
      pendingCompanyRequests: true,
      chatReadMuteState: false,
    });
    await expect(
      api.getSessionListenerPreferences("listener-user-b"),
    ).resolves.toEqual({
      pendingCompanyRequests: false,
      chatReadMuteState: false,
    });
  });

  it("fails closed until pending-request preference is loaded and enabled", () => {
    expect(typeof api.shouldSubscribePendingCompanyRequests).toBe("function");
    if (!api.shouldSubscribePendingCompanyRequests) return;

    expect(
      api.shouldSubscribePendingCompanyRequests({
        loaded: false,
        enabled: true,
        company: "DELIFOOD",
        tabVisible: true,
      }),
    ).toBe(false);
    expect(
      api.shouldSubscribePendingCompanyRequests({
        loaded: true,
        enabled: false,
        company: "DELIFOOD",
        tabVisible: true,
      }),
    ).toBe(false);
    expect(
      api.shouldSubscribePendingCompanyRequests({
        loaded: true,
        enabled: true,
        company: "DELIFOOD",
        tabVisible: true,
      }),
    ).toBe(true);
  });

  it("fails closed until chat-state preference is loaded and enabled", () => {
    expect(typeof api.shouldSubscribeChatReadState).toBe("function");
    if (!api.shouldSubscribeChatReadState) return;

    expect(
      api.shouldSubscribeChatReadState({
        loaded: false,
        enabled: true,
        ownerId: "owner-1",
        userId: "user-1",
      }),
    ).toBe(false);
    expect(
      api.shouldSubscribeChatReadState({
        loaded: true,
        enabled: false,
        ownerId: "owner-1",
        userId: "user-1",
      }),
    ).toBe(false);
    expect(
      api.shouldSubscribeChatReadState({
        loaded: true,
        enabled: true,
        ownerId: "owner-1",
        userId: "user-1",
      }),
    ).toBe(true);
  });
});

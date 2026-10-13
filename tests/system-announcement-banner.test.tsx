// @vitest-environment jsdom

import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { afterEach, describe, expect, it, vi } from "vitest";
import AnnouncementBanner from "@/components/announcements/AnnouncementBanner";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("announcement ticker direction", () => {
  it("travels from outside the right edge to outside the left edge", () => {
    let resizeCallback: ResizeObserverCallback | undefined;

    class ResizeObserverStub implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverStub);

    const { container } = render(
      <AnnouncementBanner
        announcement={{
          id: "announcement-1",
          title: "Actualización",
          detail: "Nuevo contenido disponible",
          type: "info",
          startsAt: null,
          endsAt: null,
          allowDismiss: false,
          priority: 0,
          scope: "global",
          version: 1,
          publishedAt: Timestamp.fromMillis(0),
        }}
      />,
    );

    const viewport = container.querySelector<HTMLElement>(
      ".announcement-ticker-viewport",
    );
    const track = container.querySelector<HTMLElement>(
      ".announcement-ticker-track",
    );
    expect(viewport).not.toBeNull();
    expect(track).not.toBeNull();

    Object.defineProperty(viewport, "clientWidth", { value: 420 });
    Object.defineProperty(track, "scrollWidth", { value: 260 });

    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });

    expect(track?.style.getPropertyValue("--announcement-start")).toBe(
      "420px",
    );
    expect(track?.style.getPropertyValue("--announcement-end")).toBe(
      "-260px",
    );
  });
});

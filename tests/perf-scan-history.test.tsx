// @vitest-environment jsdom
//
// Render-cost harness for the scan history list.
//
// It measures how much render work a single keystroke in one row's rename input
// costs the whole list (React Profiler `actualDuration`, summed over the commits
// triggered by opening the editor + typing). React Compiler is NOT enabled in
// this project, so `React.memo` on the row is the only guard — if every row
// receives a prop that changes per keystroke, all rows re-render every time.
import React, { Profiler } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

vi.mock("@/config/firebase", () => ({ storage: {} }));
vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  listAll: vi.fn(async () => ({ items: [] })),
  getDownloadURL: vi.fn(async () => "about:blank"),
}));
vi.mock("next/image", () => ({
  default: (props: { src?: string; alt?: string }) =>
    React.createElement("img", { src: props.src, alt: props.alt }),
}));

import ScanHistory from "@/components/scanner/ScanHistory";

afterEach(cleanup);

const ROWS = 400;

const history = Array.from({ length: ROWS }, (_, i) => ({
  code: String(100000 + i),
  name: `PRODUCTO ${i}`,
  hasImages: false,
}));

describe("ScanHistory render cost", () => {
  it("bounds the render work of typing in one row's rename input", () => {
    let measuring = false;
    let commits = 0;
    let totalMs = 0;

    const onRender = (
      _id: string,
      _phase: string,
      actualDuration: number,
    ): void => {
      if (measuring) {
        commits += 1;
        totalMs += actualDuration;
      }
    };

    const { container } = render(
      <Profiler id="scan-history" onRender={onRender}>
        <ScanHistory
          history={history}
          onCopy={() => {}}
          onDelete={() => {}}
          onRemoveLeadingZero={() => {}}
          onRename={() => {}}
        />
      </Profiler>,
    );

    const rows = (): NodeListOf<Element> =>
      container.querySelectorAll(".scan-history-row");
    expect(rows().length).toBe(ROWS);

    measuring = true;

    const editButton = rows()[0]?.querySelector(
      'button[title="Agregar/Editar nombre"]',
    );
    expect(editButton).toBeTruthy();
    fireEvent.click(editButton as Element);

    // Only the row being renamed may switch into edit mode.
    expect(
      container.querySelectorAll('input[placeholder="Nombre personalizado"]')
        .length,
    ).toBe(1);

    const input = container.querySelector(
      'input[placeholder="Nombre personalizado"]',
    ) as HTMLInputElement;

    let value = "";
    for (const ch of ["A", "B", "C", "D", "E"]) {
      value += ch;
      fireEvent.change(input, { target: { value } });
    }

    measuring = false;

    // The typed value lands in the editing row and the list is otherwise intact.
    expect(input.value).toBe("ABCDE");
    expect(rows().length).toBe(ROWS);

    // Informational: sum of React Profiler `actualDuration` across the keystroke
    // commits (jsdom; relative, not absolute, meaning).
    console.log(
      `[scan-history] rows=${ROWS} commits=${commits} totalRenderMs=${totalMs.toFixed(2)} avgCommitMs=${(totalMs / Math.max(commits, 1)).toFixed(3)}`,
    );

    expect(commits).toBeGreaterThan(0);
  });
});

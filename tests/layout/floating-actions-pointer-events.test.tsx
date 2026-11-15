// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FloatingActionsDock,
  FloatingActionsProvider,
  useFloatingAction,
} from "@/components/ui/FloatingActionsDock";

const actionClick = vi.fn();

function TestIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} />;
}

function RegisterTestAction() {
  useFloatingAction({
    id: "test-action",
    label: "Acción de prueba",
    Icon: TestIcon,
    onClick: actionClick,
  });
  return null;
}

describe("FloatingActionsDock pointer events", () => {
  beforeEach(() => {
    window.localStorage.clear();
    actionClick.mockClear();
  });

  afterEach(cleanup);

  it("does not block controls behind the collapsed transparent area", async () => {
    render(
      <FloatingActionsProvider>
        <RegisterTestAction />
        <FloatingActionsDock />
      </FloatingActionsProvider>,
    );

    const trigger = await screen.findByRole("button", {
      name: "Abrir acciones",
    });
    const action = screen.getByRole("button", { name: "Acción de prueba" });
    const host = trigger.closest(".fixed");
    const actionGroup = action.parentElement;

    expect(host).not.toBeNull();
    expect(actionGroup).not.toBeNull();
    expect(host).toHaveClass("pointer-events-none");
    expect(trigger.parentElement).toHaveClass("pointer-events-auto");
    expect(actionGroup).toHaveClass("pointer-events-none");

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(actionGroup).toHaveClass("pointer-events-auto");
    });

    fireEvent.click(action);
    expect(actionClick).toHaveBeenCalledOnce();
  });
});

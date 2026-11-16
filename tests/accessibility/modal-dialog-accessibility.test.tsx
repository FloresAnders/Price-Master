// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalDialog } from "@/components/ui/ModalDialog";

describe("ModalDialog accessibility", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    });
  });

  afterEach(() => cleanup());

  it("opens as a named native modal and routes platform dismissal", () => {
    const onRequestClose = vi.fn();
    render(
      <ModalDialog
        open
        aria-labelledby="modal-title"
        onRequestClose={onRequestClose}
      >
        <h2 id="modal-title">Confirmar movimiento</h2>
        <button type="button">Cancelar</button>
      </ModalDialog>,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Confirmar movimiento",
    });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog.hasAttribute("open")).toBe(true);

    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it("blocks platform dismissal when the operation is mandatory", () => {
    const onRequestClose = vi.fn();
    render(
      <ModalDialog
        open
        dismissible={false}
        aria-label="Cierre obligatorio"
        onRequestClose={onRequestClose}
      >
        <button type="button">Guardar</button>
      </ModalDialog>,
    );

    fireEvent(
      screen.getByRole("dialog", { name: "Cierre obligatorio" }),
      new Event("cancel", { cancelable: true }),
    );

    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("uses the native close lifecycle when controlled state closes", () => {
    const closeSpy = vi.spyOn(HTMLDialogElement.prototype, "close");
    const { rerender } = render(
      <ModalDialog open aria-label="Transferencia" onRequestClose={vi.fn()}>
        <button type="button">Guardar</button>
      </ModalDialog>,
    );

    rerender(
      <ModalDialog
        open={false}
        aria-label="Transferencia"
        onRequestClose={vi.fn()}
      >
        <button type="button">Guardar</button>
      </ModalDialog>,
    );

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});

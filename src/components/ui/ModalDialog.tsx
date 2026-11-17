"use client";

import React, { forwardRef, useEffect, useRef } from "react";

type ModalDialogProps = Omit<
  React.DialogHTMLAttributes<HTMLDialogElement>,
  "open" | "onCancel"
> & {
  open: boolean;
  dismissible?: boolean;
  lightDismiss?: boolean;
  onRequestClose: () => void;
};

export const ModalDialog = forwardRef<HTMLDialogElement, ModalDialogProps>(
  function ModalDialog(
    {
      open,
      dismissible = true,
      lightDismiss = false,
      onRequestClose,
      children,
      ...dialogProps
    },
    forwardedRef,
  ) {
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const pressedOutsideRef = useRef(false);

    useEffect(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (open && !dialog.open) dialog.showModal();
      if (!open && dialog.open) dialog.close();

      return () => {
        if (dialog.open) dialog.close();
      };
    }, [open]);

    return (
      <dialog
        {...dialogProps}
        ref={(dialog) => {
          dialogRef.current = dialog;
          if (typeof forwardedRef === "function") forwardedRef(dialog);
          else if (forwardedRef) forwardedRef.current = dialog;
        }}
        data-app-modal="true"
        closedby={
          dismissible ? (lightDismiss ? "any" : "closerequest") : "none"
        }
        onPointerDown={(event) => {
          dialogProps.onPointerDown?.(event);
          const dialog = dialogRef.current;
          if (
            !dialog ||
            !dismissible ||
            !lightDismiss ||
            "closedBy" in HTMLDialogElement.prototype
          ) {
            return;
          }
          const bounds = dialog.getBoundingClientRect();
          pressedOutsideRef.current =
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom;
        }}
        onPointerUp={(event) => {
          dialogProps.onPointerUp?.(event);
          const dialog = dialogRef.current;
          if (
            !dialog ||
            !pressedOutsideRef.current ||
            "closedBy" in HTMLDialogElement.prototype
          ) {
            pressedOutsideRef.current = false;
            return;
          }
          const bounds = dialog.getBoundingClientRect();
          const releasedOutside =
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom;
          pressedOutsideRef.current = false;
          if (releasedOutside) onRequestClose();
        }}
        onCancel={(event) => {
          event.preventDefault();
          if (dismissible) onRequestClose();
        }}
      >
        {open ? children : null}
      </dialog>
    );
  },
);

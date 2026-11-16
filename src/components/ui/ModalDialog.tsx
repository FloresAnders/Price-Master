"use client";

import React, { forwardRef, useEffect, useRef } from "react";

type ModalDialogProps = Omit<
  React.DialogHTMLAttributes<HTMLDialogElement>,
  "open" | "onCancel"
> & {
  open: boolean;
  dismissible?: boolean;
  onRequestClose: () => void;
};

export const ModalDialog = forwardRef<HTMLDialogElement, ModalDialogProps>(
  function ModalDialog(
    {
      open,
      dismissible = true,
      onRequestClose,
      children,
      ...dialogProps
    },
    forwardedRef,
  ) {
    const dialogRef = useRef<HTMLDialogElement | null>(null);

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

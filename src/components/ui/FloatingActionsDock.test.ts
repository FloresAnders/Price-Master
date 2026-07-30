import assert from "node:assert/strict";
import test from "node:test";
import { MoreHorizontal } from "lucide-react";
import { sortVisibleFloatingActions } from "./FloatingActionsDock";

test("sortVisibleFloatingActions removes hidden actions and sorts by order then label", () => {
  const actions = sortVisibleFloatingActions({
    cash: {
      id: "cash",
      label: "Contador",
      Icon: MoreHorizontal,
      onClick: () => undefined,
      order: 20,
      variant: "emerald",
    },
    chat: {
      id: "chat",
      label: "Chat",
      Icon: MoreHorizontal,
      onClick: () => undefined,
      order: 10,
      variant: "primary",
    },
    calculator: {
      id: "calculator",
      label: "Calculadora",
      Icon: MoreHorizontal,
      onClick: () => undefined,
      order: 20,
      variant: "blue",
    },
    hidden: {
      id: "hidden",
      label: "Oculto",
      Icon: MoreHorizontal,
      onClick: () => undefined,
      order: 1,
      variant: "slate",
      visible: false,
    },
  });

  assert.deepEqual(
    actions.map((action) => action.id),
    ["chat", "calculator", "cash"],
  );
});

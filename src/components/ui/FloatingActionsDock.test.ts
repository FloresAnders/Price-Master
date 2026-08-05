import assert from "node:assert/strict";
import test from "node:test";
import { MoreHorizontal } from "lucide-react";
import {
  getFloatingActionsDockBottomOffsetPx,
  shouldRenderFloatingActionsDock,
  sortVisibleFloatingActions,
} from "./FloatingActionsDock.utils.ts";

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

test("shouldRenderFloatingActionsDock hides all floating actions when suppressed", () => {
  const actions = sortVisibleFloatingActions({
    chat: {
      id: "chat",
      label: "Chat",
      Icon: MoreHorizontal,
      onClick: () => undefined,
      order: 10,
      variant: "primary",
    },
  });

  assert.equal(shouldRenderFloatingActionsDock(actions, true), false);
  assert.equal(shouldRenderFloatingActionsDock(actions, false), true);
});

test("getFloatingActionsDockBottomOffsetPx raises dock when back-to-top is visible", () => {
  assert.equal(getFloatingActionsDockBottomOffsetPx(false), 20);
  assert.equal(getFloatingActionsDockBottomOffsetPx(true), 92);
});

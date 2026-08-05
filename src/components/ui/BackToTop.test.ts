import assert from "node:assert/strict";
import test from "node:test";
import {
  isScrollPastBackToTopThreshold,
  shouldMountBackToTopButton,
  shouldRenderBackToTop,
} from "./BackToTop.utils.ts";

test("isScrollPastBackToTopThreshold shows after half the visible viewport", () => {
  assert.equal(
    isScrollPastBackToTopThreshold({
      scrollTop: 499,
      viewportHeight: 1000,
      showAfterViewportRatio: 0.5,
    }),
    false,
  );
  assert.equal(
    isScrollPastBackToTopThreshold({
      scrollTop: 500,
      viewportHeight: 1000,
      showAfterViewportRatio: 0.5,
    }),
    true,
  );
});

test("shouldRenderBackToTop hides while floating actions are suppressed", () => {
  assert.equal(
    shouldRenderBackToTop({
      alwaysVisible: true,
      isPastScrollThreshold: true,
      suppressed: true,
    }),
    false,
  );
  assert.equal(
    shouldRenderBackToTop({
      alwaysVisible: false,
      isPastScrollThreshold: true,
      suppressed: false,
    }),
    true,
  );
});

test("shouldMountBackToTopButton does not keep hidden button focusable", () => {
  assert.equal(shouldMountBackToTopButton(false), false);
  assert.equal(shouldMountBackToTopButton(true), true);
});

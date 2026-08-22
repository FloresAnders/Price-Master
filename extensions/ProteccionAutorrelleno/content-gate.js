(function initContentGate(global) {
  const core =
    global.AutofillProtectionCore ||
    (() => {
      throw new Error("AutofillProtectionCore debe cargarse antes que content-gate.js.");
    })();

  function uniqueFields(fields) {
    return Array.from(
      new Set([...(fields.usernameFields || []), ...(fields.passwordFields || [])]),
    );
  }

  function waitForDocumentRoot(doc, intervalMs = 25) {
    if (doc.documentElement || doc.body) {
      return Promise.resolve(doc.documentElement || doc.body);
    }

    return new Promise((resolve) => {
      const intervalId = global.setInterval(() => {
        const root = doc.documentElement || doc.body;
        if (!root) return;
        global.clearInterval(intervalId);
        resolve(root);
      }, intervalMs);
    });
  }

  function createCredentialGate(options) {
    const doc = options.document || global.document;
    const state = {
      locked: false,
      fields: null,
      scrubIntervalId: null,
      originalFieldState: new Map(),
      removeListeners: [],
    };

    function isProtectedEventTarget(target) {
      if (!state.locked || !state.fields) return false;
      return uniqueFields(state.fields).some((field) => field === target);
    }

    function clearCredentialValues() {
      if (!state.fields) return;
      for (const field of uniqueFields(state.fields)) {
        field.value = "";
        field.setAttribute("data-autofill-protection-cleared", "true");
      }
    }

    function hardenFields() {
      if (!state.fields) return;
      for (const field of uniqueFields(state.fields)) {
        if (!state.originalFieldState.has(field)) {
          state.originalFieldState.set(field, {
            autocomplete: field.getAttribute("autocomplete"),
            readOnly: field.readOnly,
          });
        }
        field.readOnly = true;
        field.setAttribute("autocomplete", "new-password");
      }
    }

    function restoreFields() {
      for (const [field, original] of state.originalFieldState.entries()) {
        field.readOnly = original.readOnly;
        if (original.autocomplete === null) {
          field.removeAttribute("autocomplete");
        } else {
          field.setAttribute("autocomplete", original.autocomplete);
        }
        field.removeAttribute("data-autofill-protection-cleared");
      }
      state.originalFieldState.clear();
    }

    function scrubWhileLocked() {
      if (!state.locked) return;
      state.fields = core.detectCredentialFields(doc);
      hardenFields();
      clearCredentialValues();
    }

    function startScrubber() {
      scrubWhileLocked();
      state.scrubIntervalId = global.setInterval(
        scrubWhileLocked,
        Number(options.scrubIntervalMs || 150),
      );
    }

    function stopScrubber() {
      if (state.scrubIntervalId !== null) {
        global.clearInterval(state.scrubIntervalId);
        state.scrubIntervalId = null;
      }
    }

    function blockFieldEvent(event) {
      if (!isProtectedEventTarget(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      scrubWhileLocked();
    }

    function blockSubmit(event) {
      if (!state.locked) return;
      const form = event.target;
      if (
        state.fields?.passwordFields?.some((field) => field.form === form) ||
        state.fields?.usernameFields?.some((field) => field.form === form)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    function attachBlockers() {
      const captureOptions = { capture: true };
      const fieldEvents = ["beforeinput", "input", "keydown", "paste", "focusin"];
      for (const eventName of fieldEvents) {
        doc.addEventListener(eventName, blockFieldEvent, captureOptions);
        state.removeListeners.push(() =>
          doc.removeEventListener(eventName, blockFieldEvent, captureOptions),
        );
      }
      doc.addEventListener("submit", blockSubmit, captureOptions);
      state.removeListeners.push(() =>
        doc.removeEventListener("submit", blockSubmit, captureOptions),
      );
    }

    function unlock() {
      state.locked = false;
      stopScrubber();
      for (const remove of state.removeListeners.splice(0)) remove();
      restoreFields();
    }

    async function attemptUnlock(password) {
      const ok = await options.verifyPassword(
        password,
        options.settings?.passwordRecord,
      );
      if (ok) unlock();
      return ok;
    }

    async function start() {
      const fields = core.detectCredentialFields(doc);
      if (
        !core.shouldProtectPage({
          settings: options.settings,
          pageUrl: options.pageUrl,
          fields,
        })
      ) {
        return false;
      }

      state.fields = fields;
      state.locked = true;
      attachBlockers();
      startScrubber();
      return true;
    }

    return {
      attemptUnlock,
      isLocked: () => state.locked,
      start,
      unlock,
    };
  }

  const api = { createCredentialGate, waitForDocumentRoot };
  global.AutofillProtectionGate = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);

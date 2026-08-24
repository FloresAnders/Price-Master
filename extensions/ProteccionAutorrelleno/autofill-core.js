(function initAutofillProtectionCore(global) {
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    protectedUrls: [
      "https://contica.app/app/login/",
      "https://www.timemaster.es/",
    ],
    passwordRecord: null,
  });

  function normalizeUrlForMatch(value) {
    try {
      const url = new URL(String(value).trim());
      url.hash = "";
      url.search = "";
      url.protocol = url.protocol.toLowerCase();
      url.hostname = url.hostname.toLowerCase();
      if (!url.pathname) url.pathname = "/";
      if (!url.pathname.endsWith("/")) url.pathname += "/";
      return url.toString();
    } catch {
      return "";
    }
  }

  function isOriginRoot(url) {
    return url.pathname === "/";
  }

  function matchesProtectedUrl(pageUrl, protectedUrls) {
    const normalizedPage = normalizeUrlForMatch(pageUrl);
    if (!normalizedPage) return false;

    const page = new URL(normalizedPage);
    return (Array.isArray(protectedUrls) ? protectedUrls : []).some((entry) => {
      const normalizedEntry = normalizeUrlForMatch(entry);
      if (!normalizedEntry) return false;
      const protectedUrl = new URL(normalizedEntry);
      if (page.origin !== protectedUrl.origin) return false;
      if (isOriginRoot(protectedUrl)) return true;
      return page.pathname === protectedUrl.pathname;
    });
  }

  function detectCredentialFields(root) {
    const scope = root || global.document;
    const isTrackable = (field) =>
      !field.disabled &&
      (!field.readOnly || field.hasAttribute("data-autofill-protection-cleared"));
    const passwordFields = Array.from(
      scope.querySelectorAll('input[type="password"]'),
    ).filter(isTrackable);
    const usernameFields = Array.from(
      scope.querySelectorAll(
        [
          'input[autocomplete="username"]',
          'input[type="email"]',
          'input[type="text"]',
          'input[name*="user" i]',
          'input[name*="email" i]',
          'input[id*="user" i]',
          'input[id*="email" i]',
          'input[name*="login" i]',
          'input[id*="login" i]',
        ].join(","),
      ),
    ).filter(isTrackable);

    return {
      hasUsername: usernameFields.length > 0,
      hasPassword: passwordFields.length > 0,
      usernameFields,
      passwordFields,
    };
  }

  function normalizeSettings(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const protectedUrls = Array.isArray(source.protectedUrls)
      ? source.protectedUrls.filter((url) => normalizeUrlForMatch(url))
      : DEFAULT_SETTINGS.protectedUrls;

    return {
      enabled: source.enabled !== false,
      protectedUrls,
      passwordRecord: source.passwordRecord || null,
    };
  }

  function shouldProtectPage({ settings, pageUrl, fields }) {
    const normalized = normalizeSettings(settings);
    return Boolean(
      normalized.enabled &&
        normalized.passwordRecord &&
        fields?.hasUsername &&
        fields?.hasPassword &&
        matchesProtectedUrl(pageUrl, normalized.protectedUrls),
    );
  }

  function createMaskedSecretInput(input) {
    let secret = "";

    input.type = "text";
    input.autocomplete = "one-time-code";
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("data-1p-ignore", "true");
    input.setAttribute("data-lpignore", "true");
    input.value = "";

    function selection() {
      const start = Math.min(input.selectionStart ?? secret.length, secret.length);
      const end = Math.min(input.selectionEnd ?? start, secret.length);
      return { start, end };
    }

    function render(caret = secret.length) {
      input.value = "•".repeat(secret.length);
      input.setSelectionRange(caret, caret);
    }

    function replaceSelection(replacement) {
      const { start, end } = selection();
      secret = `${secret.slice(0, start)}${replacement}${secret.slice(end)}`;
      render(start + replacement.length);
    }

    input.addEventListener("beforeinput", (event) => {
      if (event.inputType === "insertText" && event.data !== null) {
        event.preventDefault();
        replaceSelection(event.data);
        return;
      }

      if (event.inputType === "deleteContentBackward") {
        event.preventDefault();
        const { start, end } = selection();
        const deleteFrom = start === end ? Math.max(0, start - 1) : start;
        secret = `${secret.slice(0, deleteFrom)}${secret.slice(end)}`;
        render(deleteFrom);
      }
    });

    input.addEventListener("paste", (event) => {
      event.preventDefault();
      replaceSelection(event.clipboardData?.getData("text") || "");
    });

    return {
      clear() {
        secret = "";
        render();
      },
      getValue() {
        return secret;
      },
    };
  }

  function getCrypto() {
    const cryptoApi = global.crypto;
    if (!cryptoApi?.subtle) {
      throw new Error("Web Crypto no esta disponible en este navegador.");
    }
    return cryptoApi;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return global.btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = global.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  async function derivePasswordHash(password, salt, iterations) {
    const cryptoApi = getCrypto();
    const encodedPassword = new TextEncoder().encode(String(password));
    const key = await cryptoApi.subtle.importKey(
      "raw",
      encodedPassword,
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await cryptoApi.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256",
      },
      key,
      256,
    );
    return new Uint8Array(bits);
  }

  function constantTimeEqual(left, right) {
    if (left.length !== right.length) return false;
    let result = 0;
    for (let index = 0; index < left.length; index += 1) {
      result |= left[index] ^ right[index];
    }
    return result === 0;
  }

  async function createPasswordRecord(password) {
    const normalizedPassword = String(password || "");
    if (normalizedPassword.length < 10) {
      throw new Error("La contrasena debe tener al menos 10 caracteres.");
    }

    const cryptoApi = getCrypto();
    const salt = new Uint8Array(16);
    cryptoApi.getRandomValues(salt);
    const iterations = 120000;
    const hash = await derivePasswordHash(
      normalizedPassword,
      salt,
      iterations,
    );

    return {
      salt: bytesToBase64(salt),
      hash: bytesToBase64(hash),
      iterations,
    };
  }

  async function verifyPassword(password, passwordRecord) {
    if (!passwordRecord?.salt || !passwordRecord?.hash) return false;
    const salt = base64ToBytes(passwordRecord.salt);
    const expected = base64ToBytes(passwordRecord.hash);
    const actual = await derivePasswordHash(
      String(password || ""),
      salt,
      Number(passwordRecord.iterations || 120000),
    );
    return constantTimeEqual(actual, expected);
  }

  async function canDisableProtection(settings, password) {
    return verifyPassword(password, settings?.passwordRecord);
  }

  const api = {
    DEFAULT_SETTINGS,
    canDisableProtection,
    createMaskedSecretInput,
    createPasswordRecord,
    detectCredentialFields,
    matchesProtectedUrl,
    normalizeSettings,
    normalizeUrlForMatch,
    shouldProtectPage,
    verifyPassword,
  };

  global.AutofillProtectionCore = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);

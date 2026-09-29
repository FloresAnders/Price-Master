(function initLeerRegistroCore(global) {
  'use strict';

  if (global.LeerRegistroCore) return;

  const DEFAULT_TIMEOUT_MS = 30000;

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function parseMoney(value) {
    const raw = String(value || '')
      .replace(/[^\d,.-]/g, '')
      .trim();

    if (!raw) return null;

    const negative = raw.startsWith('-');
    const unsigned = raw.replace(/-/g, '');
    const commaIndex = unsigned.lastIndexOf(',');
    const dotIndex = unsigned.lastIndexOf('.');
    let decimalSeparator = null;

    if (commaIndex >= 0 && dotIndex >= 0) {
      decimalSeparator = commaIndex > dotIndex ? ',' : '.';
    } else if (commaIndex >= 0) {
      const decimals = unsigned.length - commaIndex - 1;
      decimalSeparator = decimals === 2 ? ',' : null;
    } else if (dotIndex >= 0) {
      const decimals = unsigned.length - dotIndex - 1;
      decimalSeparator = decimals === 2 ? '.' : null;
    }

    let normalized;
    if (decimalSeparator) {
      const separatorIndex = unsigned.lastIndexOf(decimalSeparator);
      const whole = unsigned.slice(0, separatorIndex).replace(/[.,]/g, '');
      const decimals = unsigned.slice(separatorIndex + 1).replace(/[.,]/g, '');
      normalized = `${whole || '0'}.${decimals}`;
    } else {
      normalized = unsigned.replace(/[.,]/g, '');
    }

    const amount = Number(normalized);
    if (!Number.isFinite(amount)) return null;
    return negative ? -amount : amount;
  }

  function getReportDate(now = new Date()) {
    const result = new Date(now.getTime());
    const minutesAfterMidnight = result.getHours() * 60 + result.getMinutes();

    if (minutesAfterMidnight >= 0 && minutesAfterMidnight < 60) {
      result.setDate(result.getDate() - 1);
    }

    return result;
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function formatDateDDMMYYYY(date) {
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  function formatDateISO(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function amountToInputValue(amount) {
    if (!Number.isFinite(amount)) return '';
    return Number.isInteger(amount)
      ? String(amount)
      : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function setNativeValue(element, value) {
    if (!element) throw new Error('No se encontró el campo que debe actualizarse.');

    const prototype =
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (!descriptor?.set) {
      throw new Error('No fue posible escribir en el campo encontrado.');
    }

    descriptor.set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const style = global.getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      current = current.parentElement;
    }
    return element.getClientRects().length > 0;
  }

  function findByText(root, selector, expectedText, options = {}) {
    const normalizedExpected = normalizeText(expectedText);
    const exact = options.exact !== false;

    return Array.from(root.querySelectorAll(selector)).find((element) => {
      if (!isVisible(element)) return false;
      const text = normalizeText(element.textContent || element.value || '');
      return exact ? text === normalizedExpected : text.includes(normalizedExpected);
    }) || null;
  }

  function waitFor(getValue, options = {}) {
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const intervalMs = options.intervalMs || 150;
    const message = options.message || 'La página tardó demasiado en responder.';

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      const check = () => {
        try {
          const value = getValue();
          if (value !== null && value !== undefined && value !== false) {
            resolve(value);
            return;
          }
        } catch (error) {
          reject(error);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(message));
          return;
        }

        global.setTimeout(check, intervalMs);
      };

      check();
    });
  }

  function parseCostaRicaDate(value) {
    const text = String(value || '');
    const yearFirst = text.match(
      /(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?)?/i,
    );
    const dayFirst = yearFirst
      ? null
      : text.match(
          /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?)?/i,
        );
    const match = yearFirst || dayFirst;
    if (!match) return null;

    const day = Number(yearFirst ? match[3] : match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(yearFirst ? match[1] : match[3]);
    let hours = Number(match[4] || 0);
    const minutes = Number(match[5] || 0);
    const seconds = Number(match[6] || 0);
    const meridiem = normalizeText(match[7] || '').replace(/\./g, '');

    if (meridiem.startsWith('p') && hours < 12) hours += 12;
    if (meridiem.startsWith('a') && hours === 12) hours = 0;

    const date = new Date(year, month, day, hours, minutes, seconds, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  global.LeerRegistroCore = Object.freeze({
    amountToInputValue,
    findByText,
    formatDateDDMMYYYY,
    formatDateISO,
    getReportDate,
    isVisible,
    normalizeText,
    parseCostaRicaDate,
    parseMoney,
    setNativeValue,
    waitFor,
  });
})(globalThis);

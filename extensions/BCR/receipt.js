(() => {
  'use strict';

  if (location.protocol !== 'about:') return;

  const MAX_WAIT_MS = 30_000;
  let processing = false;
  let captured = false;
  let observer = null;
  let pollTimer = null;
  let stopTimer = null;

  const normalizeText = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\r/g, '')
      .trim();

  function parseAmount(raw) {
    const normalized = String(raw || '').replace(/[^\d.,]/g, '');
    if (!normalized) return null;
    const comma = normalized.lastIndexOf(',');
    const dot = normalized.lastIndexOf('.');
    let canonical = normalized;
    if (comma >= 0 && dot >= 0) {
      canonical = dot > comma
        ? normalized.replace(/,/g, '')
        : normalized.replace(/\./g, '').replace(',', '.');
    } else if (comma >= 0) {
      const decimals = normalized.length - comma - 1;
      canonical = decimals === 2
        ? normalized.replace(/\./g, '').replace(',', '.')
        : normalized.replace(/,/g, '');
    } else if (dot >= 0) {
      const decimals = normalized.length - dot - 1;
      canonical = decimals === 2 ? normalized : normalized.replace(/\./g, '');
    }
    const amount = Number(canonical);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  function parseReceipt(text) {
    const normalized = normalizeText(text);
    if (!/BANCO DE COSTA RICA/i.test(normalized)) return null;
    const amountMatch = normalized.match(
      /MONTO\s+(?:TOTAL|PAGADO)\s*:\s*[.\s]*([\d.,]+)/i,
    );
    const dateMatch = normalized.match(
      /\bBCR\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\b/i,
    );
    const monto = parseAmount(amountMatch?.[1]);
    if (!monto || !dateMatch) return null;

    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const year = Number(dateMatch[3]);
    const hour = Number(dateMatch[4]);
    const minute = Number(dateMatch[5]);
    const second = Number(dateMatch[6] || 0);
    const calendarCheck = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (
      calendarCheck.getUTCFullYear() !== year ||
      calendarCheck.getUTCMonth() !== month - 1 ||
      calendarCheck.getUTCDate() !== day ||
      calendarCheck.getUTCHours() !== hour ||
      calendarCheck.getUTCMinutes() !== minute ||
      calendarCheck.getUTCSeconds() !== second
    ) {
      return null;
    }
    const paidAt = new Date(calendarCheck.getTime() + 6 * 60 * 60 * 1000);

    return {
      canonicalText: normalized
        .toUpperCase()
        .replace(/\bREIMPRESION DE (?:FACTURAS|RECIBOS|COMPROBANTES)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
      monto,
      paidAt: paidAt.toISOString(),
      hora: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  async function persist(receipt) {
    const response = await chrome.runtime.sendMessage({
      type: 'TM_BCR_QUEUE_RECEIPTS',
      receipts: [receipt],
    });
    if (!response?.ok) throw new Error(response?.error || 'No se pudo guardar la cola.');
  }

  function showCapturedNotice(receipt) {
    const notice = document.createElement('div');
    notice.style.cssText = [
      'position:fixed', 'right:18px', 'bottom:18px', 'z-index:2147483647',
      'padding:11px 13px', 'border-radius:9px', 'background:#052e16',
      'border:1px solid #16a34a', 'color:#dcfce7',
      'font:700 12px Arial,sans-serif', 'box-shadow:0 10px 28px rgba(0,0,0,.3)',
    ].join(';');
    notice.textContent = `TimeMaster guardó ${receipt.hora} · ₡${Number(receipt.monto).toLocaleString('es-CR')}`;
    document.body?.appendChild(notice);
    setTimeout(() => notice.remove(), 4500);
  }

  function stop() {
    observer?.disconnect();
    clearInterval(pollTimer);
    clearTimeout(stopTimer);
  }

  async function attemptCapture() {
    if (captured || processing || !document.body) return;
    const parsed = parseReceipt(document.body.innerText || document.body.textContent || '');
    if (!parsed) return;
    processing = true;
    try {
      const receiptId = await sha256(parsed.canonicalText);
      const receipt = {
        receiptId,
        monto: parsed.monto,
        paidAt: parsed.paidAt,
        hora: parsed.hora,
        capturedAt: Date.now(),
      };
      await persist(receipt);
      captured = true;
      stop();
      showCapturedNotice(receipt);
    } catch (error) {
      console.error('[TimeMaster BCR] No se pudo guardar el comprobante:', error);
    } finally {
      processing = false;
    }
  }

  const start = () => {
    observer = new MutationObserver(() => void attemptCapture());
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    pollTimer = setInterval(() => void attemptCapture(), 500);
    stopTimer = setTimeout(stop, MAX_WAIT_MS);
    void attemptCapture();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

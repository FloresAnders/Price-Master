const THIN_SPACE = "\u202f";

export function normalizeSystemVerificationMoneyInput(raw: string): string {
  if (!raw) return "";

  const stripped = raw.replace(/\s/gu, "").replace(/[^\d.,]/g, "");
  if (!/\d/.test(stripped)) return "";

  const decimalIndex = Math.max(
    stripped.lastIndexOf(","),
    stripped.lastIndexOf("."),
  );
  const hasBothSeparatorStyles = stripped.includes(",") && stripped.includes(".");
  const digitsAfterLastSeparator =
    decimalIndex === -1
      ? ""
      : stripped.slice(decimalIndex + 1).replace(/\D/g, "");
  const hasDecimalSeparator =
    decimalIndex !== -1 &&
    (hasBothSeparatorStyles || digitsAfterLastSeparator.length <= 2);

  const integerDigits = (hasDecimalSeparator
    ? stripped.slice(0, decimalIndex)
    : stripped
  ).replace(/\D/g, "");
  const integerPart = integerDigits.replace(/^0+(?=\d)/, "") || "0";

  if (!hasDecimalSeparator) return integerPart;

  return `${integerPart}.${digitsAfterLastSeparator.slice(0, 2)}`;
}

export function formatSystemVerificationMoneyInput(value: string): string {
  if (!value) return "";

  const normalized = normalizeSystemVerificationMoneyInput(value);
  if (!normalized) return "";

  const [integerPart, fractionPart] = normalized.split(".");
  const groupedInteger = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    THIN_SPACE,
  );

  return normalized.includes(".")
    ? `${groupedInteger},${fractionPart}`
    : groupedInteger;
}

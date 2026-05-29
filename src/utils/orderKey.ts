const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const midpoint = (left: string, right: string) => {
  const leftIdx = CHARSET.indexOf(left);
  const rightIdx = CHARSET.indexOf(right);
  const safeLeft = leftIdx === -1 ? 0 : leftIdx;
  const safeRight = rightIdx === -1 ? CHARSET.length - 1 : rightIdx;
  const mid = Math.floor((safeLeft + safeRight) / 2);
  return CHARSET[mid] || "0";
};

const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export const generateOrderKeyBetween = (
  left?: string,
  right?: string,
) => {
  const safeLeft = left || "";
  const safeRight = right || "";

  if (!safeLeft && !safeRight) return "U" + uid();
  if (!safeLeft) return (CHARSET[Math.max(0, CHARSET.indexOf(safeRight[0]) - 1)] || "0") + "U" + uid();
  if (!safeRight) return safeLeft + "U" + uid();

  const minLength = Math.min(safeLeft.length, safeRight.length);
  for (let i = 0; i < minLength; i += 1) {
    if (safeLeft[i] !== safeRight[i]) {
      const mid = midpoint(safeLeft[i], safeRight[i]);
      if (mid !== safeLeft[i] && mid !== safeRight[i]) {
        return safeLeft.slice(0, i) + mid;
      }
      return safeLeft.slice(0, i + 1) + "U" + uid();
    }
  }

  return safeLeft + "U" + uid();
};

export const generateInitialOrderKeys = (count: number) =>
  Array.from({ length: count }, (_, idx) => `U${idx}`);

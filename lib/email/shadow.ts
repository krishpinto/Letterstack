import type { EmailDocumentSettings } from "./document";

export function hexToRgba(hex: string, opacityPercent: number) {
  const normalized = hex.trim().replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const parsed = Number.parseInt(value, 16);
  if (Number.isNaN(parsed)) {
    return `rgba(0, 0, 0, ${opacityPercent / 100})`;
  }

  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;

  return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
}

export function getEmailContainerShadow(settings: EmailDocumentSettings) {
  if (!settings.shadowEnabled) return "none";

  return `${settings.shadowOffsetX}px ${settings.shadowOffsetY}px ${settings.shadowBlur}px ${settings.shadowSpread}px ${hexToRgba(
    settings.shadowColor,
    settings.shadowOpacity,
  )}`;
}

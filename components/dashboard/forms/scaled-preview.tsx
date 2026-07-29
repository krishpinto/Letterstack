"use client";

import { FormPreview } from "./form-preview";
import type { SignupFormSettingsInput } from "./types";

/**
 * The form art uses fixed pixel sizes, so narrow frames render it oversized
 * and scale down — the thumbnail trick — to keep the preview faithful.
 * Shared by the create-flow template cards and the forms-list cards.
 */
export function ScaledPreview({
  settings,
  scale,
}: {
  settings: SignupFormSettingsInput;
  scale: number;
}) {
  // scale is a percentage (70 → 0.7): the box must be oversized by its
  // reciprocal, also in percent — 70% scale means a 10000/70 ≈ 143% box.
  const inverse = 10000 / scale;
  return (
    <div className="h-full w-full overflow-hidden">
      <div
        // Size/transform are derived from the scale prop — inline by necessity.
        style={{
          width: `${inverse}%`,
          height: `${inverse}%`,
          transform: `scale(${scale / 100})`,
          transformOrigin: "top left",
        }}
      >
        <FormPreview settings={settings} className="h-full w-full" />
      </div>
    </div>
  );
}

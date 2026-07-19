"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { WidgetConfig } from "@/lib/forms/widget";
import { SubscribeWidget } from "./subscribe-widget";

// Presents the hosted form the way its type actually behaves on a customer's
// website: a static form sits centered on the page, a popup opens in a modal
// over a mock page, an animated form slides into the corner. Popup/animated
// draw the mock page behind them so a visitor (usually the owner checking a
// preview) sees the form in the context it was designed for.
//
// All palette values are per-form data (chosen theme/colors), so they can only
// be applied as inline styles — there are no static classes for a
// runtime-chosen palette.
export function HostedFormExperience({ config }: { config: WidgetConfig }) {
  const { colors } = config;

  if (config.formType === "popup") {
    return <PopupExperience config={config} />;
  }
  if (config.formType === "animated") {
    return <AnimatedExperience config={config} />;
  }

  // Static — the plain hosted subscribe page.
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
      style={{ backgroundColor: colors.pageBg }}
    >
      <div className="w-full max-w-md">
        <SubscribeWidget config={config} />
        <PoweredBy color={colors.muted} className="mt-6 text-center" />
      </div>
    </div>
  );
}

/** Faux website content shown behind popup/animated forms for context. */
function PageSkeleton({ config }: { config: WidgetConfig }) {
  const { colors } = config;
  const strong: CSSProperties = { backgroundColor: colors.text, opacity: 0.14 };
  const soft: CSSProperties = { backgroundColor: colors.text, opacity: 0.07 };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none flex min-h-dvh select-none flex-col"
      style={{ backgroundColor: colors.pageBg }}
    >
      {/* Faux site nav */}
      <div
        className="flex items-center justify-between px-6 py-4 sm:px-10"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        <div className="h-3 w-24 rounded-full" style={strong} />
        <div className="flex items-center gap-4">
          <div className="h-2 w-12 rounded-full" style={soft} />
          <div className="h-2 w-12 rounded-full" style={soft} />
          <div
            className="h-6 w-16 rounded-md"
            style={{ backgroundColor: config.accentColor, opacity: 0.5 }}
          />
        </div>
      </div>

      {/* Faux article */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <div className="h-5 w-4/5 rounded-full" style={strong} />
        <div className="mt-3 h-5 w-3/5 rounded-full" style={strong} />
        <div className="mt-8 flex flex-col gap-3">
          {[
            "w-full",
            "w-full",
            "w-11/12",
            "w-full",
            "w-4/5",
            "w-full",
            "w-full",
            "w-2/3",
          ].map((width, index) => (
            <div key={index} className={`h-2.5 rounded-full ${width}`} style={soft} />
          ))}
        </div>
        <div className="mt-10 h-40 w-full rounded-xl" style={soft} />
        <div className="mt-10 flex flex-col gap-3">
          {["w-full", "w-11/12", "w-full", "w-3/4"].map((width, index) => (
            <div key={index} className={`h-2.5 rounded-full ${width}`} style={soft} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The widget with a floating close dot. Card layouts already draw their own
 * box; minimal/inline get a panel so they read as a surface over the page.
 */
function DismissableWidget({
  config,
  onClose,
}: {
  config: WidgetConfig;
  onClose: () => void;
}) {
  const { colors } = config;
  const bare = config.layout !== "card";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close form"
        className="absolute -right-2.5 -top-2.5 z-10 flex size-7 cursor-pointer items-center justify-center rounded-full text-sm leading-none shadow-sm transition-opacity hover:opacity-80"
        style={{
          backgroundColor: colors.bg,
          color: colors.muted,
          border: `1px solid ${colors.border}`,
        }}
      >
        ✕
      </button>
      {bare ? (
        <div
          className="rounded-2xl p-6 shadow-xl"
          style={{
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
          }}
        >
          <SubscribeWidget config={config} />
        </div>
      ) : (
        <div className="[&>div]:shadow-xl">
          <SubscribeWidget config={config} />
        </div>
      )}
    </div>
  );
}

/** Accent-colored pill to bring a dismissed form back. */
function ReopenButton({
  config,
  onClick,
  className,
}: {
  config: WidgetConfig;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 ${className ?? ""}`}
      style={{ backgroundColor: config.accentColor }}
    >
      {config.buttonLabel}
    </button>
  );
}

function PopupExperience({ config }: { config: WidgetConfig }) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(true);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <PageSkeleton config={config} />

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-20 flex items-center justify-center bg-black/45 px-4"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className="w-full max-w-md"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <DismissableWidget config={config} onClose={() => setOpen(false)} />
              <PoweredBy
                color="rgba(255,255,255,0.75)"
                className="mt-4 text-center"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <div className="fixed inset-x-0 bottom-6 z-20 flex justify-center">
          <ReopenButton config={config} onClick={() => setOpen(true)} />
        </div>
      )}
    </div>
  );
}

function AnimatedExperience({ config }: { config: WidgetConfig }) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  // Slide in shortly after load — the "present without interrupting" behavior
  // the type promises on a real site.
  useEffect(() => {
    const timer = setTimeout(() => setOpen(true), reduceMotion ? 0 : 700);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <PageSkeleton config={config} />

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed bottom-5 right-5 z-20 w-[380px] max-w-[calc(100vw-2.5rem)]"
            initial={reduceMotion ? false : { opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <DismissableWidget config={config} onClose={() => setOpen(false)} />
            <PoweredBy
              color={config.colors.muted}
              className="mt-2.5 text-right"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <div className="fixed bottom-6 right-6 z-20">
          <ReopenButton config={config} onClick={() => setOpen(true)} />
        </div>
      )}
    </div>
  );
}

function PoweredBy({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <p className={`text-xs ${className ?? ""}`} style={{ color }}>
      Powered by LetterStack
    </p>
  );
}

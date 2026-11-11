"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { confirmDialog } from "@/components/app-dialogs";
import { leavesPage } from "@/lib/navigation-guard";

/**
 * Ask before leaving a page with unsaved edits.
 *
 * The App Router has no API to block navigation, so this covers the two ways
 * work is usually lost: closing or reloading the tab (beforeunload, where the
 * browser shows its own prompt) and clicking a link (any <a>, including
 * next/link, intercepted in the capture phase before the router sees it). It
 * does not catch the browser's Back button.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const router = useRouter();
  const dirtyRef = useRef(dirty);
  // Set once the person confirms, so the navigation we start isn't
  // intercepted again.
  const leavingRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    function guarding() {
      return dirtyRef.current && !leavingRef.current;
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!guarding()) return;
      event.preventDefault();
      // Legacy browsers need returnValue set; modern ones show their own text.
      event.returnValue = "";
    }

    function onClick(event: MouseEvent) {
      if (!guarding()) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const info = {
        href: anchor.href,
        target: anchor.target,
        hasDownload: anchor.hasAttribute("download"),
      };
      if (!leavesPage(event, info, window.location.href)) return;

      // Stop this navigation; start it again only if they confirm.
      event.preventDefault();
      event.stopPropagation();
      void confirmDialog({
        title: "Leave without saving?",
        description: "Your changes on this page haven't been saved and will be lost.",
        confirmLabel: "Leave",
        cancelLabel: "Stay",
        destructive: true,
      }).then((leave) => {
        if (!leave) return;
        leavingRef.current = true;
        const url = new URL(info.href);
        if (url.origin === window.location.origin) {
          router.push(`${url.pathname}${url.search}${url.hash}`);
        } else {
          window.location.assign(url.href);
        }
      });
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);
}

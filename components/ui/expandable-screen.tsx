"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"

// A trigger that grows into a full-screen panel (a shared-layout morph), and
// behaves as a modal dialog while open:
//   - the panel is rendered in a portal on <body>, so no ancestor's z-index
//     or overflow can trap it under other page chrome,
//   - it has role="dialog", takes focus when it opens and keeps Tab inside,
//   - Escape closes it,
//   - the rest of the page is inert (not clickable, hidden from screen
//     readers) while it is open,
//   - focus goes back to whatever opened it when it closes,
//   - the morph is skipped for people who ask for reduced motion.

// Context
interface ExpandableScreenContextValue {
  isExpanded: boolean
  expand: () => void
  collapse: () => void
  layoutId: string
  triggerRadius: string
  contentRadius: string
  animationDuration: number
  /** The trigger's wrapper element, so focus can return to it on close. */
  triggerRef: RefObject<HTMLDivElement | null>
  /** Called once the panel has unmounted and the page is usable again. */
  afterClose: () => void
}

const ExpandableScreenContext =
  createContext<ExpandableScreenContextValue | null>(null)

function useExpandableScreen() {
  const context = useContext(ExpandableScreenContext)
  if (!context) {
    throw new Error(
      "useExpandableScreen must be used within an ExpandableScreen"
    )
  }
  return context
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableIn(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null
  )
}

// Root Component
interface ExpandableScreenProps {
  children: ReactNode
  defaultExpanded?: boolean
  onExpandChange?: (expanded: boolean) => void
  layoutId?: string
  triggerRadius?: string
  contentRadius?: string
  animationDuration?: number
  lockScroll?: boolean
}

export function ExpandableScreen({
  children,
  defaultExpanded = false,
  onExpandChange,
  layoutId = "expandable-card",
  triggerRadius = "100px",
  contentRadius = "24px",
  animationDuration = 0.3,
  lockScroll = true,
}: ExpandableScreenProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const triggerRef = useRef<HTMLDivElement | null>(null)
  // On close, should focus go back to the trigger's own button?
  const restoreToTrigger = useRef(false)
  // What had focus when the panel opened, to give focus back on close.
  const openedFrom = useRef<{ element: HTMLElement | null; inTrigger: boolean }>({
    element: null,
    inTrigger: false,
  })
  const restoreTo = useRef<HTMLElement | null>(null)
  const onExpandChangeRef = useRef(onExpandChange)
  useEffect(() => {
    onExpandChangeRef.current = onExpandChange
  })

  // Stable identities, so effects elsewhere can depend on them.
  const expand = useCallback(() => {
    const active = document.activeElement as HTMLElement | null
    openedFrom.current = {
      element: active,
      inTrigger: Boolean(active && triggerRef.current?.contains(active)),
    }
    setIsExpanded(true)
    onExpandChangeRef.current?.(true)
  }, [])

  const collapse = useCallback(() => {
    const { element, inTrigger } = openedFrom.current
    // Remember where focus should go back to. afterClose does the focusing,
    // because until the panel has unmounted the page is still inert and a
    // focus() call on it would be ignored.
    restoreToTrigger.current = inTrigger
    restoreTo.current = inTrigger ? null : element
    setIsExpanded(false)
    onExpandChangeRef.current?.(false)
  }, [])

  const afterClose = useCallback(() => {
    // Opened from the trigger: it unmounted while the panel was open and is
    // a new element now, so find its button again. Opened from elsewhere (a
    // nav link, a menu item): that element is still there.
    const element = restoreToTrigger.current
      ? triggerRef.current && focusableIn(triggerRef.current)[0]
      : restoreTo.current
    restoreToTrigger.current = false
    restoreTo.current = null
    if (element?.isConnected) element.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!lockScroll || !isExpanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [isExpanded, lockScroll])

  return (
    <ExpandableScreenContext.Provider
      value={{
        isExpanded,
        expand,
        collapse,
        layoutId,
        triggerRadius,
        contentRadius,
        animationDuration,
        triggerRef,
        afterClose,
      }}
    >
      {/* reducedMotion="user": no morph or slide for people who ask their
          system for reduced motion; the panel just appears. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ExpandableScreenContext.Provider>
  )
}

// Trigger Component
interface ExpandableScreenTriggerProps {
  children: ReactNode
  className?: string
}

export function ExpandableScreenTrigger({
  children,
  className = "",
}: ExpandableScreenTriggerProps) {
  const { isExpanded, expand, layoutId, triggerRadius, triggerRef } =
    useExpandableScreen()

  return (
    <AnimatePresence initial={false}>
      {!isExpanded && (
        <motion.div
          ref={triggerRef}
          className={`inline-block relative ${className}`}
        >
          {/* Background layer with shared layoutId for morphing */}
          <motion.div
            style={{
              borderRadius: triggerRadius,
            }}
            layout
            layoutId={layoutId}
            className="absolute inset-0 transform-gpu will-change-transform"
          />
          {/* Content layer that fades out on expand */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            exit={{ opacity: 0, scale: 0.8 }}
            layout={false}
            onClick={expand}
            className="relative cursor-pointer"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Content Component
interface ExpandableScreenContentProps {
  children: ReactNode
  className?: string
  showCloseButton?: boolean
  closeButtonClassName?: string
  /** Accessible name of the dialog, read out when it opens. */
  label?: string
}

export function ExpandableScreenContent({
  children,
  className = "",
  showCloseButton = true,
  closeButtonClassName = "",
  label = "Dialog",
}: ExpandableScreenContentProps) {
  const {
    isExpanded,
    collapse,
    afterClose,
    layoutId,
    contentRadius,
    animationDuration,
  } = useExpandableScreen()

  // Portals need the document; the panel never renders on the server anyway
  // (it starts closed).
  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence initial={false}>
      {isExpanded && (
        <DialogSurface label={label} onEscape={collapse} onClosed={afterClose}>
          {/* Morphing background with shared layoutId */}
          <motion.div
            layoutId={layoutId}
            transition={{ duration: animationDuration }}
            style={{
              borderRadius: contentRadius,
            }}
            layout
            className={`relative flex h-full w-full overflow-y-auto transform-gpu will-change-transform ${className}`}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="relative z-20 w-full"
            >
              {children}
            </motion.div>

            {showCloseButton && (
              <motion.button
                onClick={collapse}
                className={`absolute right-6 top-6 z-30 flex h-10 w-10 items-center justify-center transition-colors rounded-full ${
                  closeButtonClassName ||
                  "text-primary-foreground bg-transparent hover:bg-primary-foreground/10"
                }`}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </motion.button>
            )}
          </motion.div>
        </DialogSurface>
      )}
    </AnimatePresence>,
    document.body
  )
}

/**
 * The modal behaviour: takes focus on open, keeps Tab inside, closes on
 * Escape, and makes the rest of the page inert while mounted.
 */
function DialogSurface({
  children,
  label,
  onEscape,
  onClosed,
}: {
  children: ReactNode
  label: string
  onEscape: () => void
  onClosed: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.focus({ preventScroll: true })

    // Everything else that is on the page right now goes inert. Popups this
    // dialog opens later (a select's list) are added to <body> afterwards,
    // so they stay usable.
    const others = Array.from(document.body.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && el !== node && !el.inert
    )
    others.forEach((el) => {
      el.inert = true
    })
    return () => {
      others.forEach((el) => {
        el.inert = false
      })
      // Only now can focus go back to an element on the page.
      onClosed()
    }
  }, [onClosed])

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const node = ref.current
    // Keys pressed inside a popup the dialog opened (rendered outside this
    // element) belong to that popup.
    if (!node || !node.contains(event.target as Node)) return

    if (event.key === "Escape") {
      event.stopPropagation()
      onEscape()
      return
    }
    if (event.key !== "Tab") return

    const items = focusableIn(node)
    if (items.length === 0) {
      event.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === node)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 outline-none sm:p-2"
    >
      {children}
    </div>
  )
}

// Background Component (optional)
interface ExpandableScreenBackgroundProps {
  trigger?: ReactNode
  content?: ReactNode
  className?: string
}

export function ExpandableScreenBackground({
  trigger,
  content,
  className = "",
}: ExpandableScreenBackgroundProps) {
  const { isExpanded } = useExpandableScreen()

  if (isExpanded && content) {
    return <div className={className}>{content}</div>
  }

  if (!isExpanded && trigger) {
    return <div className={className}>{trigger}</div>
  }

  return null
}

export { useExpandableScreen }

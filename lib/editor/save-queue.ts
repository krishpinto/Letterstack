// The editor's save state, kept out of React so it can be tested on its own.
//
// Three rules it exists to enforce:
//
// 1. One save in flight at a time. Two PATCHes racing each other can land in
//    either order, so an older document could overwrite a newer one.
// 2. The latest document always gets saved. An edit made while a save is in
//    flight marks the queue dirty again, and the flush loop saves once more
//    after the current request finishes instead of dropping the edit.
// 3. Only a save that really succeeded counts. A failed save leaves the queue
//    dirty, so the unsaved-changes guard stays armed and Retry has something
//    to do.
//
// Every edit bumps a revision number. A save records the revision it was
// started for, and success only ever moves `savedRevision` forward, so a
// response for an older revision can never mark a newer edit as saved.

/** Why a save did not land. */
export type SaveErrorKind =
  /** Network failure, server error, or anything unexpected. Retryable. */
  | "failed"
  /** The session expired. Retryable once the user signs in again. */
  | "unauthorized"
  /** Someone else saved a newer version. Saving again would overwrite it. */
  | "conflict"
  /** The document can no longer be edited (for example, the campaign was sent). */
  | "locked";

/**
 * Thrown by a save function to say why it failed. Any other thrown value is
 * treated as `failed`.
 */
export class SaveError extends Error {
  readonly kind: SaveErrorKind;

  constructor(kind: SaveErrorKind, message: string) {
    super(message);
    this.name = "SaveError";
    this.kind = kind;
  }
}

/** `conflict` and `locked` stop all further saving until the page reloads. */
export function isBlockingError(kind: SaveErrorKind): boolean {
  return kind === "conflict" || kind === "locked";
}

export type SaveStatus =
  /** Nothing to save, and nothing saved yet in this session. */
  | "idle"
  /** Unsaved edits; an autosave is scheduled. */
  | "dirty"
  | "saving"
  /** Everything up to the latest edit is saved. */
  | "saved"
  /** The last save failed and edits are still unsaved. Retryable. */
  | "error"
  /** A conflict or lock. Saving has stopped; only a reload helps. */
  | "blocked";

export type SaveQueueState = {
  status: SaveStatus;
  /** True while the latest edit has not been saved successfully. */
  dirty: boolean;
  /** The most recent failure, cleared by the next successful save. */
  error: { kind: SaveErrorKind; message: string } | null;
};

type Timer = ReturnType<typeof setTimeout>;

export type SaveQueueOptions<D> = {
  /** Persists one document. Resolve on success; throw (ideally a SaveError) on failure. */
  save: (doc: D) => Promise<void>;
  /** How long after the last edit to autosave. */
  delayMs: number;
  /** Called after every state change. */
  onChange?: (state: SaveQueueState) => void;
  /** Injected for tests; defaults to the global timers. */
  setTimer?: (fn: () => void, ms: number) => Timer;
  clearTimer?: (timer: Timer) => void;
};

export type SaveQueue<D> = {
  /** Records a new edit and schedules an autosave. */
  update: (doc: D) => void;
  /**
   * Saves now and keeps saving until the latest edit is stored. Resolves true
   * if everything is saved, false if a save failed. Never rejects. Safe to
   * call while a save is already in flight: it waits for that one first.
   */
  flush: () => Promise<boolean>;
  /** The latest document if it is not saved yet, otherwise null. */
  pendingDocument: () => D | null;
  isDirty: () => boolean;
  getState: () => SaveQueueState;
  /** Cancels a scheduled autosave. Edits stay dirty; flush still works. */
  cancelScheduled: () => void;
};

function toSaveError(err: unknown): SaveError {
  if (err instanceof SaveError) return err;
  const message = err instanceof Error && err.message ? err.message : "Could not save.";
  return new SaveError("failed", message);
}

export function createSaveQueue<D>(initial: D, options: SaveQueueOptions<D>): SaveQueue<D> {
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));

  let latest = initial;
  let revision = 0;
  let savedRevision = 0;
  let everSaved = false;
  let inFlight: Promise<boolean> | null = null;
  let error: SaveError | null = null;
  let blocked = false;
  let timer: Timer | null = null;

  const isDirty = () => revision > savedRevision;

  function getState(): SaveQueueState {
    const dirty = isDirty();
    let status: SaveStatus;
    if (blocked) status = "blocked";
    else if (inFlight) status = "saving";
    else if (dirty && error) status = "error";
    else if (dirty) status = "dirty";
    else status = everSaved ? "saved" : "idle";
    return {
      status,
      dirty,
      error: error ? { kind: error.kind, message: error.message } : null,
    };
  }

  function emit() {
    options.onChange?.(getState());
  }

  function cancelScheduled() {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  }

  async function run(rev: number, doc: D): Promise<boolean> {
    try {
      await options.save(doc);
      // Only ever forwards: a slow response for an old revision cannot
      // claim that a newer edit is saved.
      savedRevision = Math.max(savedRevision, rev);
      everSaved = true;
      error = null;
      return true;
    } catch (err) {
      error = toSaveError(err);
      if (isBlockingError(error.kind)) {
        blocked = true;
        cancelScheduled();
      }
      return false;
    }
  }

  function start(): Promise<boolean> {
    const rev = revision;
    const doc = latest;
    const promise = run(rev, doc).finally(() => {
      // Cleared before anyone awaiting this promise resumes, so the next
      // flush iteration sees the true state.
      inFlight = null;
      emit();
    });
    inFlight = promise;
    emit();
    return promise;
  }

  async function flush(): Promise<boolean> {
    cancelScheduled();
    for (;;) {
      if (blocked) return false;
      if (inFlight) {
        // Wait for the save already running. If it failed, report that
        // rather than immediately firing the same failing request again.
        const ok = await inFlight;
        if (!ok) return false;
        continue;
      }
      if (!isDirty()) return true;
      // Edits that arrive while this save is in flight bump `revision`, so
      // the loop goes round again and saves the newer document.
      const ok = await start();
      if (!ok) return false;
    }
  }

  function update(doc: D) {
    latest = doc;
    revision += 1;
    if (!blocked) {
      cancelScheduled();
      timer = setTimer(() => {
        timer = null;
        void flush();
      }, options.delayMs);
    }
    emit();
  }

  return {
    update,
    flush,
    pendingDocument: () => (isDirty() ? latest : null),
    isDirty,
    getState,
    cancelScheduled,
  };
}

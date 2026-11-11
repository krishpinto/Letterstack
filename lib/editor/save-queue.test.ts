import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSaveQueue, SaveError, type SaveQueueState } from "./save-queue";

// A save function whose calls stay pending until the test settles them, so
// the tests can hold a request "in flight" and edit underneath it.
function controllableSave() {
  const calls: { doc: string; resolve: () => void; reject: (err: unknown) => void }[] = [];
  const save = vi.fn(
    (doc: string) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ doc, resolve, reject });
      }),
  );
  return { save, calls };
}

// Let pending promise callbacks run. setTimeout is faked in these tests, so
// this flushes microtasks without firing any scheduled autosave.
const tick = () => vi.advanceTimersByTimeAsync(0);

describe("createSaveQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts clean and autosaves the latest edit after the delay", async () => {
    const save = vi.fn(async () => {});
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    expect(queue.isDirty()).toBe(false);
    expect(queue.getState().status).toBe("idle");

    queue.update("v1");
    queue.update("v2");
    expect(queue.getState().status).toBe("dirty");
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("v2");
    expect(queue.isDirty()).toBe(false);
    expect(queue.getState().status).toBe("saved");
  });

  it("debounces: each edit pushes the autosave back", async () => {
    const save = vi.fn(async () => {});
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    queue.update("v1");
    await vi.advanceTimersByTimeAsync(1000);
    queue.update("v2");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("v2");
  });

  it("saves an edit made while a save is in flight once that save finishes", async () => {
    const { save, calls } = controllableSave();
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });

    queue.update("v1");
    await vi.advanceTimersByTimeAsync(1500);
    expect(calls).toHaveLength(1);

    // Edit while v1 is still being written. Its own autosave timer fires
    // while the first request is in flight, and must not start a second.
    queue.update("v2");
    await vi.advanceTimersByTimeAsync(1500);
    expect(calls).toHaveLength(1);
    expect(queue.getState().status).toBe("saving");

    calls[0].resolve();
    await tick();
    // The loop picks up the newer document without needing another edit.
    expect(calls).toHaveLength(2);
    expect(calls[1].doc).toBe("v2");
    expect(queue.isDirty()).toBe(true);

    calls[1].resolve();
    await tick();
    expect(queue.isDirty()).toBe(false);
    expect(queue.getState().status).toBe("saved");
  });

  it("never runs two saves at once, even with manual saves", async () => {
    const { save, calls } = controllableSave();
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });

    queue.update("v1");
    const first = queue.flush();
    queue.update("v2");
    const second = queue.flush();
    const third = queue.flush();
    await tick();
    expect(calls).toHaveLength(1);

    calls[0].resolve();
    await tick();
    expect(calls).toHaveLength(2);
    expect(calls[1].doc).toBe("v2");

    calls[1].resolve();
    await expect(Promise.all([first, second, third])).resolves.toEqual([true, true, true]);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("does not mark a newer edit saved when an older save succeeds", async () => {
    const { save, calls } = controllableSave();
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });

    queue.update("v1");
    void queue.flush();
    queue.update("v2");
    calls[0].resolve();
    await tick();

    // v1 is stored, but v2 is not yet, so the document is still dirty and
    // pendingDocument hands back v2 for an unload save.
    expect(queue.isDirty()).toBe(true);
    expect(queue.pendingDocument()).toBe("v2");
  });

  it("stays dirty after a failed save and reports the error", async () => {
    const save = vi.fn(async () => {
      throw new SaveError("failed", "Server error");
    });
    const states: SaveQueueState[] = [];
    const queue = createSaveQueue<string>("v0", {
      save,
      delayMs: 1500,
      onChange: (state) => states.push(state),
    });

    queue.update("v1");
    await expect(queue.flush()).resolves.toBe(false);
    expect(queue.isDirty()).toBe(true);
    expect(queue.pendingDocument()).toBe("v1");
    expect(queue.getState()).toEqual({
      status: "error",
      dirty: true,
      error: { kind: "failed", message: "Server error" },
    });
    expect(states.map((s) => s.status)).toContain("saving");
  });

  it("treats a non-SaveError throw as a retryable failure", async () => {
    const save = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    queue.update("v1");
    await queue.flush();
    expect(queue.getState().error).toEqual({ kind: "failed", message: "Failed to fetch" });
  });

  it("recovers on retry and clears the error", async () => {
    let fail = true;
    const save = vi.fn(async () => {
      if (fail) throw new SaveError("unauthorized", "Session expired");
    });
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    queue.update("v1");
    await queue.flush();
    expect(queue.getState().status).toBe("error");

    fail = false;
    await expect(queue.flush()).resolves.toBe(true);
    expect(queue.getState()).toEqual({ status: "saved", dirty: false, error: null });
  });

  it("retries a failed save on the next edit's autosave", async () => {
    let fail = true;
    const save = vi.fn(async () => {
      if (fail) throw new SaveError("failed", "boom");
    });
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    queue.update("v1");
    await vi.advanceTimersByTimeAsync(1500);
    expect(queue.getState().status).toBe("error");

    fail = false;
    queue.update("v2");
    // The error stays visible until a save actually succeeds.
    expect(queue.getState().status).toBe("error");
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).toHaveBeenLastCalledWith("v2");
    expect(queue.getState().status).toBe("saved");
  });

  it("a waiter does not re-fire a save that just failed", async () => {
    const { save, calls } = controllableSave();
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    queue.update("v1");
    const autosave = queue.flush();
    const exitFlush = queue.flush();
    calls[0].reject(new SaveError("failed", "boom"));
    await expect(autosave).resolves.toBe(false);
    await expect(exitFlush).resolves.toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("stops saving after a conflict, even when edits continue", async () => {
    const save = vi.fn(async () => {
      throw new SaveError("conflict", "Changed elsewhere");
    });
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    queue.update("v1");
    await expect(queue.flush()).resolves.toBe(false);
    expect(queue.getState().status).toBe("blocked");

    queue.update("v2");
    await vi.advanceTimersByTimeAsync(5000);
    await expect(queue.flush()).resolves.toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.isDirty()).toBe(true);
  });

  it("treats a locked document like a conflict", async () => {
    const save = vi.fn(async () => {
      throw new SaveError("locked", "Campaign was sent");
    });
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    queue.update("v1");
    await queue.flush();
    expect(queue.getState().status).toBe("blocked");
    expect(queue.getState().error?.kind).toBe("locked");
  });

  it("flush with nothing to save resolves true without calling save", async () => {
    const save = vi.fn(async () => {});
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    await expect(queue.flush()).resolves.toBe(true);
    expect(save).not.toHaveBeenCalled();
    expect(queue.pendingDocument()).toBeNull();
  });

  it("flush cancels the scheduled autosave so it does not save twice", async () => {
    const save = vi.fn(async () => {});
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    queue.update("v1");
    await queue.flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("discard drops unsaved edits so nothing saves them later", async () => {
    const save = vi.fn(async () => {});
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    queue.update("v1");
    queue.discard();
    expect(queue.isDirty()).toBe(false);
    expect(queue.pendingDocument()).toBeNull();
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).not.toHaveBeenCalled();
  });

  it("cancelScheduled keeps the edit dirty for a later flush", async () => {
    const save = vi.fn(async () => {});
    const queue = createSaveQueue<string>("v0", { save, delayMs: 1500 });
    queue.update("v1");
    queue.cancelScheduled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    expect(queue.pendingDocument()).toBe("v1");
    await queue.flush();
    expect(save).toHaveBeenCalledWith("v1");
  });
});

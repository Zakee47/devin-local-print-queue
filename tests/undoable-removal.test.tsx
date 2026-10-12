import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UNDO_WINDOW_MS,
  useUndoableRemoval,
} from "@/components/admin/useUndoableRemoval";

const sonner = vi.hoisted(() => ({
  toast: vi.fn(),
  dismiss: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(sonner.toast, {
    dismiss: sonner.dismiss,
    error: sonner.error,
    success: sonner.success,
  }),
}));

const fakeWindow = new EventTarget();
const fakeDocument = Object.assign(new EventTarget(), {
  nodeType: 9,
  defaultView: fakeWindow,
});
Object.assign(fakeWindow, {
  document: fakeDocument,
  HTMLIFrameElement: class HTMLIFrameElement {},
});
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const cleanups: Array<() => Promise<void>> = [];

beforeEach(() => {
  globalThis.window = fakeWindow as unknown as Window & typeof globalThis;
  globalThis.document = fakeDocument as unknown as Document;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.useRealTimers();
  if (originalWindow !== undefined) globalThis.window = originalWindow;
  else Reflect.deleteProperty(globalThis, "window");
  if (originalDocument !== undefined) globalThis.document = originalDocument;
  else Reflect.deleteProperty(globalThis, "document");
});

async function mountHook() {
  let current!: ReturnType<typeof useUndoableRemoval>;
  function Harness() {
    current = useUndoableRemoval();
    return null;
  }

  const container = Object.assign(new EventTarget(), {
    nodeType: 1,
    tagName: "DIV",
    namespaceURI: "http://www.w3.org/1999/xhtml",
    ownerDocument: fakeDocument,
  });
  const root = createRoot(container as unknown as Element);
  let unmounted = false;
  const unmount = async () => {
    if (unmounted) return;
    unmounted = true;
    await act(async () => root.unmount());
  };
  cleanups.push(unmount);
  await act(async () => root.render(createElement(Harness)));

  return {
    get current() {
      return current;
    },
    unmount,
  };
}

function undoAction() {
  const options = sonner.toast.mock.calls[0]?.[1] as
    | { action?: { onClick: (event: never) => void } }
    | undefined;
  if (!options?.action) throw new Error("Undo action was not added to the toast");
  return options.action.onClick;
}

describe("useUndoableRemoval", () => {
  it("waits 15 seconds before running and keeps the id pending while waiting", async () => {
    const hook = await mountHook();
    const run = vi.fn().mockResolvedValue(undefined);

    await act(async () =>
      hook.current.schedule({
        id: "guest-1",
        label: "guest@example.com",
        run,
        errorFallback: "Couldn't remove guest",
      })
    );

    expect(hook.current.pending.has("guest-1")).toBe(true);
    expect(run).not.toHaveBeenCalled();
    expect(sonner.toast).toHaveBeenCalledWith(
      "guest@example.com removed",
      expect.objectContaining({
        id: "undoable-removal:guest-1",
        description: "Permanent in 15 seconds",
        duration: UNDO_WINDOW_MS,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 1);
    });
    expect(run).not.toHaveBeenCalled();
    expect(hook.current.pending.has("guest-1")).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(hook.current.pending.has("guest-1")).toBe(false);
    hook.unmount();
  });

  it("undoes before the timeout and never runs the removal", async () => {
    const hook = await mountHook();
    const run = vi.fn().mockResolvedValue(undefined);

    await act(async () =>
      hook.current.schedule({
        id: "participant-1",
        label: "ada",
        run,
        errorFallback: "Couldn't delete",
      })
    );
    await act(async () => undoAction()(undefined as never));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    });

    expect(run).not.toHaveBeenCalled();
    expect(hook.current.pending.has("participant-1")).toBe(false);
    expect(sonner.dismiss).toHaveBeenCalledWith("undoable-removal:participant-1");
    expect(sonner.success).toHaveBeenCalledWith("ada restored");
    hook.unmount();
  });

  it("shows the mutation error and restores the row when removal fails", async () => {
    const hook = await mountHook();
    const run = vi.fn().mockRejectedValue(new Error("Removal failed"));

    await act(async () =>
      hook.current.schedule({
        id: "participant-2",
        label: "grace",
        run,
        errorFallback: "Couldn't delete",
      })
    );
    expect(hook.current.pending.has("participant-2")).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(sonner.error).toHaveBeenCalledWith("Removal failed");
    expect(hook.current.pending.has("participant-2")).toBe(false);
    hook.unmount();
  });

  it("ignores a second schedule for the same id", async () => {
    const hook = await mountHook();
    const firstRun = vi.fn().mockResolvedValue(undefined);
    const secondRun = vi.fn().mockResolvedValue(undefined);

    await act(async () =>
      hook.current.schedule({
        id: "guest-2",
        label: "first@example.com",
        run: firstRun,
        errorFallback: "Couldn't remove guest",
      })
    );
    await act(async () =>
      hook.current.schedule({
        id: "guest-2",
        label: "second@example.com",
        run: secondRun,
        errorFallback: "Couldn't remove guest",
      })
    );

    expect(sonner.toast).toHaveBeenCalledTimes(1);
    expect(hook.current.pending.has("guest-2")).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
    });

    expect(firstRun).toHaveBeenCalledTimes(1);
    expect(secondRun).not.toHaveBeenCalled();
    hook.unmount();
  });
});

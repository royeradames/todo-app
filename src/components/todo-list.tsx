"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm } from "@tanstack/react-form";
import {
  commandSchema,
  moveVisible,
  visibleTodos,
  type Todo,
  type TodoCommand,
  type TodoFilter,
} from "@/lib/todos/model";
import { registerShortcuts } from "@/lib/keyboard";
import { ChevronIcon, CrossIcon, MoonIcon, SunIcon } from "./icons";

const filters: ReadonlyArray<readonly [TodoFilter, string]> = [
  ["all", "All"],
  ["active", "Active"],
  ["completed", "Completed"],
];
const emptyView: Record<TodoFilter, string> = {
  all: "Your list is clear. Add a task above.",
  active: "No active tasks. Nice work.",
  completed: "No completed tasks yet.",
};

/** A pointer drag in progress. Touch waits for a long press so scrolling still works. */
type Drag = {
  id: string;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  active: boolean;
  order: string[];
  timer?: number;
};
/** The control to focus again after a move re-renders the list. */
type Refocus = { id: string; control: string };

// The theme lives on <html data-theme>; watch it so the toggle can say which
// theme is on.
function subscribeTheme(change: () => void) {
  const observer = new MutationObserver(change);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
function readDark() {
  return document.documentElement.dataset.theme === "dark";
}

export function TodoList({
  items,
  change,
  notice,
  loading = false,
}: {
  items: Todo[];
  change: (command: TodoCommand) => Promise<void>;
  notice: string;
  loading?: boolean;
}) {
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [help, setHelp] = useState(false);
  const [moveButtons, setMoveButtons] = useState(false);
  // The task being dragged and the order shown while it moves.
  const [dragging, setDragging] = useState<{
    id: string;
    order: string[];
  } | null>(null);
  const drag = useRef<Drag | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const list = useRef<HTMLUListElement>(null);
  const refocus = useRef<Refocus | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value }) => {
      const parsed = commandSchema.safeParse({
        kind: "add",
        title: value.title,
      });
      if (!parsed.success) {
        setError("Enter a task first.");
        input.current?.focus();
        return;
      }
      try {
        await change(parsed.data);
        form.reset();
        setError("");
        setAnnouncement("Task added.");
      } catch {
        setError(
          "Could not confirm this save. Reconnect and review your list before trying again.",
        );
      }
    },
  });

  const visible = visibleTodos(items, filter);
  const byId = new Map(items.map((item) => [item.id, item]));
  const shown = dragging
    ? dragging.order.flatMap((id) => byId.get(id) ?? [])
    : visible;
  const left = items.filter((item) => !item.completed).length;

  async function act(command: TodoCommand, message: string) {
    try {
      await change(command);
      setAnnouncement(message);
      setError("");
      const removesFocusedControl =
        command.kind === "remove" ||
        command.kind === "clear-completed" ||
        (command.kind === "complete" && filter !== "all");
      if (removesFocusedControl)
        requestAnimationFrame(() => input.current?.focus());
    } catch {
      refocus.current = null;
      setError(
        "Could not confirm the change. Review your list before trying again.",
      );
    }
  }

  function move(fromId: string, toId: string, control?: string) {
    const item = byId.get(fromId);
    if (!item || fromId === toId) return;
    const position = visible.findIndex((task) => task.id === toId) + 1;
    if (control) refocus.current = { id: fromId, control };
    void act(
      { kind: "reorder", ids: moveVisible(items, filter, fromId, toId) },
      `Moved ${item.title} to position ${position} of ${visible.length}.`,
    );
  }

  function step(item: Todo, offset: -1 | 1, control: string) {
    const index = visible.findIndex((task) => task.id === item.id);
    const neighbour = visible[index + offset];
    if (!neighbour) {
      setAnnouncement(
        `${item.title} is already ${offset < 0 ? "first" : "last"}.`,
      );
      return;
    }
    move(item.id, neighbour.id, control);
  }

  // Keep focus on the moved task's control after the list re-renders.
  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    document
      .querySelector<HTMLElement>(
        `[data-task="${target.id}"][data-control="${target.control}"]`,
      )
      ?.focus();
  }, [items]);

  function endDrag() {
    const current = drag.current;
    if (current?.timer) clearTimeout(current.timer);
    drag.current = null;
    setDragging(null);
  }

  function startDrag(row: HTMLLIElement, current: Drag) {
    if (drag.current !== current) return;
    current.active = true;
    try {
      row.setPointerCapture(current.pointerId);
    } catch {}
    setDragging({ id: current.id, order: current.order });
  }

  function dragTo(clientY: number, current: Drag) {
    const others = current.order.filter((id) => id !== current.id);
    let index = others.length;
    for (const [position, id] of others.entries()) {
      const rect = rows.current.get(id)?.getBoundingClientRect();
      if (rect && clientY < rect.top + rect.height / 2) {
        index = position;
        break;
      }
    }
    const next = [...others];
    next.splice(index, 0, current.id);
    if (next.join() === current.order.join()) return;
    current.order = next;
    setDragging({ id: current.id, order: next });
  }

  function drop() {
    const current = drag.current;
    if (!current?.active) return endDrag();
    const finalIndex = current.order.indexOf(current.id);
    const toId = visible[finalIndex]?.id;
    endDrag();
    if (toId) move(current.id, toId);
  }

  // If the row loses pointer capture, the release still ends the drag.
  const dragActive = dragging !== null;
  useEffect(() => {
    if (!dragActive) return;
    const release = () => {
      const current = drag.current;
      if (!current) return;
      if (current.timer) clearTimeout(current.timer);
      drag.current = null;
      setDragging(null);
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [dragActive]);

  // While a touch drag is active, the finger moves the task, not the page.
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const hold = (event: TouchEvent) => {
      if (drag.current?.active) event.preventDefault();
    };
    element.addEventListener("touchmove", hold, { passive: false });
    return () => element.removeEventListener("touchmove", hold);
  }, []);

  // The head script sets data-theme before paint; mirror it so the toggle
  // can say which theme is on.
  const dark = useSyncExternalStore(subscribeTheme, readDark, () => false);
  function theme() {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("todo-theme", next);
    } catch {}
  }

  useEffect(
    () =>
      registerShortcuts(window, {
        "?": () => setHelp((current) => !current),
        n: () => input.current?.focus(),
        escape: () => {
          setHelp(false);
          if (drag.current) endDrag();
        },
      }),
    [],
  );

  const filterButtons = (className: string) => (
    <div className={`filters ${className}`} role="group" aria-label="Filter tasks">
      {filters.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={filter === value}
          onClick={() => {
            setFilter(value);
            const shown = value === "all" ? items : items.filter((item) => (value === "completed") === item.completed);
            setAnnouncement(
              `Showing ${value === "all" ? "all" : value} tasks: ${shown.length} ${shown.length === 1 ? "task" : "tasks"}.`,
            );
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <main id="main" className="todo-main" data-loading={loading ? "" : undefined}>
      <header className="todo-heading">
        <h1>Todo</h1>
        <button
          type="button"
          className="theme-toggle"
          aria-label="Dark theme"
          aria-pressed={dark}
          onClick={theme}
        >
          <span className="icon-moon">
            <MoonIcon />
          </span>
          <span className="icon-sun">
            <SunIcon />
          </span>
        </button>
      </header>
      <form
        method="post"
        className="new-task"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="title">
          {(field) => (
            <>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(submitting) => (
                  <button
                    type="submit"
                    className="check-circle add-task"
                    aria-label="Add task"
                    aria-busy={submitting || undefined}
                  />
                )}
              </form.Subscribe>
              <label className="visually-hidden" htmlFor="new-task">
                Create a new todo
              </label>
              <input
                ref={input}
                id="new-task"
                name="title"
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  if (error) setError("");
                }}
                onBlur={field.handleBlur}
                maxLength={500}
                placeholder="Create a new todo…"
                autoComplete="off"
                enterKeyHint="done"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "task-error" : undefined}
              />
            </>
          )}
        </form.Field>
      </form>
      {error && (
        <p id="task-error" className="notice error" role="alert">
          {error}
        </p>
      )}
      <section
        className="todo-card"
        aria-label="Task list"
        aria-busy={loading || undefined}
      >
        <ul ref={list} className={moveButtons ? "tasks moving" : "tasks"}>
          {shown.map((item) => (
            <li
              key={item.id}
              ref={(row) => {
                if (row) rows.current.set(item.id, row);
                else rows.current.delete(item.id);
              }}
              className={[
                item.completed ? "complete" : "",
                dragging?.id === item.id ? "dragging" : "",
              ].join(" ")}
              onKeyDown={(event) => {
                if (!event.altKey || event.ctrlKey || event.metaKey) return;
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                  return;
                event.preventDefault();
                const control =
                  (event.target as HTMLElement).dataset.control ?? "check";
                step(item, event.key === "ArrowUp" ? -1 : 1, control);
              }}
              onPointerDown={(event) => {
                if (dragging || event.button !== 0) return;
                if ((event.target as HTMLElement).closest("button, input, a"))
                  return;
                const row = event.currentTarget;
                const current: Drag = {
                  id: item.id,
                  pointerId: event.pointerId,
                  pointerType: event.pointerType,
                  startX: event.clientX,
                  startY: event.clientY,
                  active: false,
                  order: visible.map((task) => task.id),
                };
                drag.current = current;
                if (event.pointerType === "touch")
                  current.timer = window.setTimeout(
                    () => startDrag(row, current),
                    300,
                  );
              }}
              onPointerMove={(event) => {
                const current = drag.current;
                if (!current || current.pointerId !== event.pointerId) return;
                if (!current.active) {
                  const distance = Math.hypot(
                    event.clientX - current.startX,
                    event.clientY - current.startY,
                  );
                  if (current.pointerType === "touch") {
                    // Moving before the long press means the person is scrolling.
                    if (distance > 8) endDrag();
                    return;
                  }
                  if (distance < 5) return;
                  startDrag(event.currentTarget, current);
                }
                dragTo(event.clientY, current);
              }}
              onPointerUp={drop}
              onPointerCancel={endDrag}
              onContextMenu={(event) => {
                if (drag.current?.active) event.preventDefault();
              }}
            >
              <input
                type="checkbox"
                className="check-circle"
                data-task={item.id}
                data-control="check"
                checked={item.completed}
                aria-labelledby={`task-${item.id}`}
                onChange={(event) =>
                  void act(
                    {
                      kind: "complete",
                      id: item.id,
                      completed: event.target.checked,
                    },
                    event.target.checked
                      ? "Task completed."
                      : "Task marked active.",
                  )
                }
              />
              <span id={`task-${item.id}`} className="task-title">
                {item.title}
              </span>
              <div className="task-actions">
                {moveButtons && (
                  <>
                    <button
                      type="button"
                      data-task={item.id}
                      data-control="up"
                      aria-label={`Move ${item.title} up`}
                      onClick={() => step(item, -1, "up")}
                    >
                      <ChevronIcon direction="up" />
                    </button>
                    <button
                      type="button"
                      data-task={item.id}
                      data-control="down"
                      aria-label={`Move ${item.title} down`}
                      onClick={() => step(item, 1, "down")}
                    >
                      <ChevronIcon direction="down" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="delete-task"
                  data-task={item.id}
                  data-control="delete"
                  aria-label={`Delete ${item.title}`}
                  onClick={() =>
                    void act({ kind: "remove", id: item.id }, "Task deleted.")
                  }
                >
                  <CrossIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {shown.length === 0 && (
          <p className="empty-list">
            {loading
              ? "Loading your tasks…"
              : items.length === 0
                ? emptyView.all
                : emptyView[filter]}
          </p>
        )}
        {!loading && (
          <div className="list-footer">
            <span aria-live="polite">
              {left} {left === 1 ? "item" : "items"} left
            </span>
            {filterButtons("filters-inline")}
            <button
              type="button"
              className="clear-completed"
              onClick={() =>
                items.some((item) => item.completed)
                  ? void act(
                      { kind: "clear-completed" },
                      "Completed tasks cleared.",
                    )
                  : setAnnouncement("There are no completed tasks to clear.")
              }
            >
              Clear Completed
            </button>
          </div>
        )}
      </section>
      {!loading && filterButtons("filters-card")}
      {notice && (
        <p className="save-state" role="status">
          {notice}
        </p>
      )}
      <p className="reorder-hint">Drag and drop to reorder list</p>
      <p className="reorder-keys">
        Or press Alt with the up or down arrow to move the focused task.
      </p>
      <div className="list-tools">
        <button
          type="button"
          aria-pressed={moveButtons}
          onClick={() => setMoveButtons((value) => !value)}
        >
          Reorder with buttons
        </button>
        <button
          type="button"
          onClick={() => setHelp((value) => !value)}
          aria-expanded={help}
        >
          Keyboard help <kbd>?</kbd>
        </button>
      </div>
      {help && (
        <p className="keyboard-help">
          Press N to create a task. Press ? for help. Escape closes help. Focus
          a task and press Alt with the up or down arrow to move it.
        </p>
      )}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </main>
  );
}

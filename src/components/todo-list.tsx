"use client";
import { useEffect, useRef, useState } from "react";
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

export function TodoList({
  items,
  pending,
  change,
  notice,
  tools,
}: {
  items: Todo[];
  pending: boolean;
  change: (command: TodoCommand) => Promise<void>;
  notice: string;
  tools: React.ReactNode;
}) {
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const drag = useRef<string | null>(null);
  const [help, setHelp] = useState(false);
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value }) => {
      const parsed = commandSchema.safeParse({
        kind: "add",
        title: value.title,
      });
      if (!parsed.success) {
        setError("Enter a task of 1 to 500 characters.");
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
  async function act(command: TodoCommand, message: string) {
    if (pending) return;
    try {
      await change(command);
      setAnnouncement(message);
      setError("");
      const removesFocusedControl =
        command.kind === "remove" ||
        command.kind === "clear-completed" ||
        (command.kind === "complete" && filter !== "all");
      if (removesFocusedControl)
        requestAnimationFrame(() =>
          document.getElementById("new-task")?.focus(),
        );
    } catch {
      setError(
        "Could not confirm the change. Review your list before trying again.",
      );
    }
  }
  function move(from: string, to: string) {
    void act(
      { kind: "reorder", ids: moveVisible(items, filter, from, to) },
      "Task moved.",
    );
  }
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
        n: () => document.getElementById("new-task")?.focus(),
        escape: () => setHelp(false),
      }),
    [],
  );
  return (
    <main id="main" className="todo-main">
      <header className="todo-heading">
        <h1>Todo</h1>
        <button
          className="theme-toggle"
          aria-label="Toggle light and dark theme"
          onClick={theme}
        >
          <span aria-hidden="true">☀</span>
        </button>
      </header>
      <div className="account-links">{tools}</div>
      <form
        method="post"
        className="new-task"
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending) void form.handleSubmit();
        }}
      >
        <form.Field name="title">
          {(field) => (
            <>
              <label className="visually-hidden" htmlFor="new-task">
                Create a new todo
              </label>
              <input
                id="new-task"
                name="title"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                maxLength={500}
                placeholder="Create a new todo…"
                autoComplete="off"
                disabled={pending}
              />
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(submitting) => (
                  <button type="submit" disabled={pending || submitting}>
                    Add<span className="visually-hidden"> task</span>
                  </button>
                )}
              </form.Subscribe>
            </>
          )}
        </form.Field>
      </form>
      {(notice || pending) && (
        <p className="save-state" role="status">
          {pending ? "Saving…" : notice}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <section className="todo-card" aria-label="Task list">
        <ul className="tasks">
          {visible.map((item, index) => (
            <li
              key={item.id}
              className={item.completed ? "complete" : ""}
              draggable={!pending}
              onDragStart={(event) => {
                drag.current = item.id;
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                drag.current = null;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (drag.current && drag.current !== item.id)
                  move(drag.current, item.id);
                drag.current = null;
              }}
            >
              <label className="task-label">
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={pending}
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
                <span>{item.title}</span>
              </label>
              <div className="task-actions">
                <button
                  aria-label={`Move ${item.title} up`}
                  disabled={pending || index === 0}
                  onClick={() => move(item.id, visible[index - 1].id)}
                >
                  ↑
                </button>
                <button
                  aria-label={`Move ${item.title} down`}
                  disabled={pending || index === visible.length - 1}
                  onClick={() => move(item.id, visible[index + 1].id)}
                >
                  ↓
                </button>
                <button
                  className="delete-task"
                  aria-label={`Delete ${item.title}`}
                  disabled={pending}
                  onClick={() =>
                    void act({ kind: "remove", id: item.id }, "Task deleted.")
                  }
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
        {visible.length === 0 && (
          <p className="empty-list">
            {items.length === 0
              ? "Your list is clear. Add a task above."
              : "No tasks in this view."}
          </p>
        )}
        <div className="list-footer">
          <span>
            {(() => {
              const left = items.filter((item) => !item.completed).length;
              return `${left} ${left === 1 ? "item" : "items"} left`;
            })()}
          </span>
          <div className="filters" aria-label="Filter tasks">
            {(["all", "active", "completed"] satisfies TodoFilter[]).map(
              (value) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value === "all"
                    ? "All"
                    : value === "active"
                      ? "Active"
                      : "Completed"}
                </button>
              ),
            )}
          </div>
          <button
            disabled={pending || !items.some((item) => item.completed)}
            onClick={() =>
              void act({ kind: "clear-completed" }, "Completed tasks cleared.")
            }
          >
            Clear completed
          </button>
        </div>
      </section>
      <p className="reorder-hint">
        Drag to reorder, or use each task’s move buttons.
      </p>
      <button
        className="shortcut-help"
        onClick={() => setHelp((value) => !value)}
        aria-expanded={help}
      >
        Keyboard help <kbd>?</kbd>
      </button>
      {help && (
        <p className="keyboard-help">
          Press N to create a task. Press ? for help. Escape closes help. Tab to
          a task’s move buttons to change its order.
        </p>
      )}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </main>
  );
}

"use client";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { applyCommand, type Todo, type TodoCommand } from "@/lib/todos/model";
import {
  localListKey,
  readLocalList,
  sampleTasks,
  writeLocalList,
} from "@/lib/todos/local";
import { TodoList } from "./todo-list";

// localStorage is the single source of truth for the signed-out list. Other
// tabs announce changes with "storage"; this tab announces its own writes.
const thisTab = "todo-local-list-change";
function subscribe(changed: () => void) {
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key === localListKey) changed();
  };
  window.addEventListener("storage", fromOtherTab);
  window.addEventListener(thisTab, changed);
  return () => {
    window.removeEventListener("storage", fromOtherTab);
    window.removeEventListener(thisTab, changed);
  };
}
function storedList() {
  try {
    return localStorage.getItem(localListKey) ?? "";
  } catch {
    return "";
  }
}
// The server cannot see this browser's list, so it renders the loading state.
const notLoaded = () => null;

/**
 * The signed-out list. It lives only in this browser, so it works with no
 * account and no server.
 */
export function LocalTodos({ accounts }: { accounts: boolean }) {
  const raw = useSyncExternalStore(subscribe, storedList, notLoaded);
  // Holds the list only when this browser refuses to store it.
  const [unsaved, setUnsaved] = useState<Todo[] | null>(null);
  const stored = useMemo(() => (raw ? readLocalList(raw) : null), [raw]);
  const items = raw === null ? null : (unsaved ?? stored ?? sampleTasks);
  async function change(command: TodoCommand) {
    const next = applyCommand(items ?? [], command, () => crypto.randomUUID());
    try {
      localStorage.setItem(localListKey, writeLocalList(next));
      setUnsaved(null);
      window.dispatchEvent(new Event(thisTab));
    } catch {
      setUnsaved(next);
    }
  }
  return (
    <TodoList
      items={items ?? []}
      loading={items === null}
      pending={false}
      change={change}
      notice={
        unsaved
          ? "This browser could not save your tasks. They stay until you close this tab."
          : accounts
            ? "Your tasks are saved in this browser."
            : "Accounts are coming soon. Your tasks are saved in this browser only."
      }
      tools={
        accounts ? (
          <Link href="/login?returnTo=%2Ftodos">
            Sign in to keep your tasks on every device
          </Link>
        ) : null
      }
    />
  );
}

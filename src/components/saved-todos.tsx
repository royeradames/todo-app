"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { currentAccountId, signOutOfTodo } from "@/lib/auth-client";
import { requestTodos, TodoApiError } from "@/lib/todos/client";
import type { TodoCommand } from "@/lib/todos/model";
import { TodoList } from "./todo-list";

export function SavedTodos({ ownerId }: { ownerId: string }) {
  const client = useQueryClient();
  const key = ["todos", ownerId];
  const alive = useRef(true);
  const [notice, setNotice] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  // Another tab can sign out or switch accounts; recheck on focus.
  const currentSession = useQuery({
    queryKey: ["account"],
    queryFn: ({ signal }) => currentAccountId(signal),
    refetchOnWindowFocus: true,
  });
  const accountChanged =
    currentSession.isSuccess && currentSession.data !== ownerId;
  const currentAccount = useRef(ownerId);
  useEffect(() => {
    currentAccount.current = accountChanged ? "" : ownerId;
    if (accountChanged) {
      void client.cancelQueries({ queryKey: ["todos", ownerId] });
      client.removeQueries({ queryKey: ["todos", ownerId] });
    }
  }, [accountChanged, client, ownerId]);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => requestTodos(ownerId, undefined, signal),
    enabled: !signedOut && !accountChanged,
    refetchOnWindowFocus: true,
  });
  const mutation = useMutation({
    mutationFn: async (command: TodoCommand) => {
      if (!alive.current || signedOut || accountChanged || !query.data)
        throw new Error("Sign in and reload your list first.");
      return requestTodos(ownerId, { version: query.data.version, command });
    },
    onSuccess: (data) => {
      if (
        alive.current &&
        currentAccount.current === ownerId &&
        data.ownerId === ownerId
      ) {
        client.setQueryData(key, data);
        setNotice("Saved.");
      }
    },
    onError: async (error) => {
      if (!alive.current || currentAccount.current !== ownerId) return;
      setNotice(error.message);
      if (error instanceof TodoApiError && error.status === 401) {
        setSignedOut(true);
        await client.cancelQueries({ queryKey: key });
        client.removeQueries({ queryKey: key });
      } else if (error instanceof TodoApiError && error.status === 409)
        await query.refetch();
    },
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      void client.cancelQueries({ queryKey: ["todos", ownerId] });
      client.removeQueries({ queryKey: ["todos", ownerId] });
    };
  }, [client, ownerId]);
  async function signOut() {
    alive.current = false;
    await client.cancelQueries({ queryKey: key });
    client.removeQueries({ queryKey: key });
    setSignedOut(true);
    try {
      await signOutOfTodo();
      window.location.assign(new URL("/login", window.location.origin).href);
    } catch {
      setNotice("Could not finish signing out. Please try again.");
    }
  }
  if (
    signedOut ||
    accountChanged ||
    (query.error instanceof TodoApiError && query.error.status === 401)
  )
    return (
      <main id="main" className="auth-layout">
        <h1>Your list is hidden.</h1>
        <p role="status">
          {notice ||
            (accountChanged
              ? "Sign in again to open your current account."
              : "Signing out…")}
        </p>
        <Link href="/login">Sign in again</Link>
        <button onClick={() => void signOut()}>Retry sign out</button>
      </main>
    );
  if (!query.data)
    return (
      <main id="main" className="auth-layout">
        <h1>Your tasks</h1>
        <p role="status">
          {query.isPending
            ? "Loading your list…"
            : "Your list could not be loaded."}
        </p>
        {!query.isPending && (
          <button onClick={() => void query.refetch()}>Try again</button>
        )}
      </main>
    );
  return (
    <TodoList
      items={query.data.items}
      pending={mutation.isPending}
      change={(command) => mutation.mutateAsync(command).then(() => undefined)}
      notice={
        query.error
          ? "Your saved list could not be refreshed. Showing the last loaded tasks; try again when connected."
          : notice
      }
      tools={
        <>
          <Link href="/account">Account</Link>
          <button
            disabled={mutation.isPending || query.isFetching}
            onClick={() => void query.refetch()}
          >
            Refresh list
          </button>
          <button onClick={() => void signOut()}>Sign out</button>
        </>
      }
    />
  );
}

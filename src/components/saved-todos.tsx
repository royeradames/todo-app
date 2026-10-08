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
  // A save answered 401: the session ended elsewhere, not by this screen.
  const [sessionLost, setSessionLost] = useState(false);
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
    enabled: !signedOut && !sessionLost && !accountChanged,
    refetchOnWindowFocus: true,
  });
  const mutation = useMutation({
    mutationFn: async (command: TodoCommand) => {
      if (!alive.current || signedOut || sessionLost || accountChanged || !query.data)
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
        setSessionLost(true);
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
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    // Busy, not disabled: a repeat press while signing out does nothing.
    if (signingOut) return;
    setSigningOut(true);
    alive.current = false;
    await client.cancelQueries({ queryKey: key });
    client.removeQueries({ queryKey: key });
    setSignedOut(true);
    try {
      await signOutOfTodo();
      window.location.assign(new URL("/login", window.location.origin).href);
    } catch {
      setNotice("Could not finish signing out. Please try again.");
      setSigningOut(false);
    }
  }
  const sessionEnded =
    query.error instanceof TodoApiError && query.error.status === 401;
  if (!signedOut && (accountChanged || sessionEnded || sessionLost))
    // Another tab signed out or switched accounts. Nothing to sign out here;
    // reopening the list shows whichever account this browser now holds.
    return (
      <main id="main" className="auth-layout">
        <h1>Your list is hidden.</h1>
        <p role="status">
          {accountChanged && currentSession.data
            ? "This browser switched to another account in a different tab."
            : "You were signed out in another tab or your session ended."}
        </p>
        <a className="button primary" href="/todos">
          Open your current list
        </a>
      </main>
    );
  if (signedOut)
    return (
      <main id="main" className="auth-layout">
        <h1>Your list is hidden.</h1>
        <p role="status">{notice || "Signing out…"}</p>
        {notice && (
          <button
            className="button"
            aria-busy={signingOut || undefined}
            onClick={() => void signOut()}
          >
            {signingOut ? "Signing out…" : "Try signing out again"}
          </button>
        )}
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
            aria-busy={query.isFetching || undefined}
            onClick={() => {
              // Busy, not disabled: ignore presses while a save or refresh runs.
              if (mutation.isPending || query.isFetching) return;
              void query.refetch();
            }}
          >
            {query.isFetching ? "Refreshing…" : "Refresh list"}
          </button>
          <button
            aria-busy={signingOut || undefined}
            onClick={() => void signOut()}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </>
      }
    />
  );
}

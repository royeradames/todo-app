"use client";
import { useEffect, useState } from "react";
import { QrCode } from "./qr-code";
import { companionClient, returnPath } from "@/lib/auth-client";
type LoginRequest = Awaited<ReturnType<typeof companionClient.start>>;
type State =
  | { kind: "idle" | "starting" | "denied" | "expired" }
  | { kind: "waiting"; request: LoginRequest }
  | { kind: "error"; message: string };
export function PhoneLogin({ returnTo }: { returnTo: string | null }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [remaining, setRemaining] = useState(0);
  async function start() {
    setState({ kind: "starting" });
    try {
      const request = await companionClient.start();
      setRemaining(
        Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 1000)),
      );
      setState({ kind: "waiting", request });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not start phone approval.",
      });
    }
  }
  useEffect(() => {
    if (state.kind !== "waiting") return;
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil((state.request.expiresAt - Date.now()) / 1000),
      );
      setRemaining(seconds);
      if (!seconds) setState({ kind: "expired" });
    }, 1000);
    async function poll() {
      try {
        const result = await companionClient.poll();
        if (!active) return;
        if (result.status === "approved") {
          window.location.assign(returnPath(returnTo));
          return;
        }
        if (result.status === "denied" || result.status === "expired") {
          setState({ kind: result.status });
          return;
        }
        timeout = setTimeout(
          () => void poll(),
          Math.max(
            1000,
            state.kind === "waiting" ? state.request.interval * 1000 : 3000,
          ),
        );
      } catch (error) {
        if (active)
          setState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "Connection interrupted. Make a new code to try again.",
          });
      }
    }
    timeout = setTimeout(() => void poll(), state.request.interval * 1000);
    return () => {
      active = false;
      clearTimeout(timeout);
      clearInterval(tick);
    };
  }, [state, returnTo]);
  if (state.kind === "waiting")
    return (
      <div className="stack">
        <h3>Approve from your signed-in device.</h3>
        <p className="card-description">
          Scan this code, or open Approve a device on a signed-in browser and
          enter the code below. Only approve a request you started.
        </p>
        <QrCode
          value={state.request.verificationUri}
          description="Open device approval with the public request code"
        />
        <p className="device-code" data-testid="device-code">
          {state.request.userCode}
        </p>
        <p className="code-caption" role="status">
          Waiting for approval · {Math.floor(remaining / 60)}:
          {String(remaining % 60).padStart(2, "0")} remaining
        </p>
        <p className="hint">
          Keep this page open while you approve from your signed-in device.
        </p>
      </div>
    );
  return (
    <div className="stack">
      <div className="method-illustration" aria-hidden="true">
        ▤
      </div>
      <h3>A signed-in device can let you in.</h3>
      <p className="card-description">
        Use the account that is already signed in on your phone or another
        browser. Review the request before approving.
      </p>
      {state.kind === "error" && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      {state.kind === "denied" && (
        <p className="notice warning" role="status">
          This request was denied. No new session was created.
        </p>
      )}
      {state.kind === "expired" && (
        <p className="notice warning" role="status">
          This code expired. Create a fresh code to try again.
        </p>
      )}
      <button
        className="button primary full"
        onClick={() => void start()}
        disabled={state.kind === "starting"}
      >
        {state.kind === "starting"
          ? "Creating request…"
          : state.kind === "idle"
            ? "Create approval code"
            : "Create a new code"}
        <span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { AuthForm } from "./form";
import { companionClient } from "@/lib/auth-client";
type State =
  | { kind: "enter" }
  | {
      kind: "review";
      request: Awaited<ReturnType<typeof companionClient.details>>;
    }
  | { kind: "done"; decision: "approve" | "deny" };
export function Approve({ initialCode }: { initialCode: string }) {
  const [state, setState] = useState<State>({ kind: "enter" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function decide(decision: "approve" | "deny") {
    if (state.kind !== "review") return;
    setPending(true);
    setError("");
    try {
      await companionClient.decide({
        decision,
        userCode: state.request.userCode,
      });
      setState({ kind: "done", decision });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not answer this request.",
      );
    } finally {
      setPending(false);
    }
  }
  if (state.kind === "done")
    return (
      <div className="stack">
        <span className="status-pill">
          {state.decision === "approve" ? "Approved" : "Denied"}
        </span>
        <h2>
          {state.decision === "approve"
            ? "You can return to the other device."
            : "The request was denied."}
        </h2>
        <p className="card-description">
          {state.decision === "approve"
            ? "Only the browser that started this request can finish signing in."
            : "No session will be created for this request."}
        </p>
        <Link className="button primary" href="/account">
          Back to account<span aria-hidden="true">↗</span>
        </Link>
      </div>
    );
  if (state.kind === "review")
    return (
      <div className="stack">
        <h2>Is this your request?</h2>
        <p className="card-description">
          Another browser is asking to sign in to{" "}
          <strong>{state.request.appName}</strong> with your account.
        </p>
        <p className="device-code">{state.request.userCode}</p>
        <p className="notice warning">
          Match this code with the device in front of you. Deny it if someone
          sent you this request or you did not start it.
        </p>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="row">
          <button
            className="button danger"
            disabled={pending}
            onClick={() => void decide("deny")}
          >
            Deny
          </button>
          <button
            className="button primary"
            disabled={pending}
            onClick={() => void decide("approve")}
          >
            {pending ? "Please wait…" : "Approve sign-in"}
          </button>
        </div>
      </div>
    );
  return (
    <>
      <h2>Enter the device code</h2>
      <p className="card-description">
        Use the code shown on the browser you want to sign in. You will review
        it before approving.
      </p>
      <AuthForm
        fields={[
          {
            name: "code",
            label: "Approval code",
            value: initialCode,
            autoComplete: "off",
          },
        ]}
        schema={z.object({
          code: z.string().min(1, "Enter the code from your other browser."),
        })}
        submit="Review request"
        onSubmit={async ({ code }) => {
          const request = await companionClient.details(
            code.trim().toUpperCase(),
          );
          setState({ kind: "review", request });
        }}
      />
      <div className="form-footer">
        <Link href="/account">Back to account</Link>
      </div>
    </>
  );
}

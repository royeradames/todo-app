"use client";
import { useForm } from "@tanstack/react-form";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { z } from "zod";

const subscribeToHydration = () => () => {};

type Field = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  inputMode?: "numeric" | "text";
  value?: string;
};
type Feedback =
  | { kind: "idle" }
  | { kind: "error" | "success"; message: string };
export function AuthForm({
  fields,
  schema,
  submit,
  onSubmit,
  children,
}: {
  fields: Field[];
  schema: z.ZodObject<Record<string, z.ZodString>>;
  submit: string;
  onSubmit: (values: Record<string, string>) => Promise<string | void>;
  children?: ReactNode;
}) {
  const id = useId();
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const form = useForm({
    defaultValues: Object.fromEntries(
      fields.map((field) => [field.name, field.value || ""]),
    ),
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setFeedback({ kind: "idle" });
      try {
        const message = await onSubmit(value);
        if (message) setFeedback({ kind: "success", message });
      } catch (error) {
        setFeedback({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
        });
      }
    },
  });
  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      noValidate
    >
      {fields.map((definition) => (
        <form.Field key={definition.name} name={definition.name}>
          {(field) => {
            const fieldId = `${id}-${definition.name}`;
            const errors = field.state.meta.errors.flatMap((error) =>
              error ? [typeof error === "string" ? error : error.message] : [],
            );
            return (
              <div className="field">
                <label htmlFor={fieldId}>{definition.label}</label>
                <input
                  id={fieldId}
                  name={definition.name}
                  type={definition.type || "text"}
                  value={field.state.value}
                  autoComplete={definition.autoComplete}
                  inputMode={definition.inputMode}
                  disabled={!ready}
                  aria-invalid={errors.length > 0}
                  aria-describedby={
                    definition.hint || errors.length
                      ? `${fieldId}-hint`
                      : undefined
                  }
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                {(definition.hint || errors.length > 0) && (
                  <div
                    id={`${fieldId}-hint`}
                    className={errors.length ? "field-error" : "hint"}
                  >
                    {errors.length ? errors.join(" ") : definition.hint}
                  </div>
                )}
              </div>
            );
          }}
        </form.Field>
      ))}
      {children}
      {feedback.kind !== "idle" && (
        <p
          className={`notice ${feedback.kind}`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <button
            className="button primary"
            type="submit"
            disabled={!ready || isSubmitting}
          >
            {isSubmitting ? "Please wait…" : submit}
            <span aria-hidden="true">↗</span>
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}

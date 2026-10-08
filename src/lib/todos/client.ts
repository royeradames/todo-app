import { z } from "zod";
import { snapshotSchema, type TodoCommand } from "./model";
export class TodoApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requestTodos(
  ownerId: string,
  input?: { version: number; command: TodoCommand },
  signal?: AbortSignal,
) {
  const ambiguous = input
    ? "The save was not confirmed. Refresh your list before trying again."
    : "Your list could not be refreshed. Check your connection and try again.";
  try {
    const response = await fetch("/api/todos", {
      method: input ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      ...(input
        ? {
            headers: {
              "content-type": "application/json",
              "x-todo-account": ownerId,
            },
            body: JSON.stringify(input),
          }
        : {}),
    });
    if (!response.ok)
      throw new TodoApiError(
        response.status,
        response.status === 401
          ? "Your session ended or your account changed. Sign in again."
          : response.status === 409
            ? "Your list changed in another tab. Review the refreshed list and try again."
            : ambiguous,
      );
    const data = snapshotSchema
      .extend({ ownerId: z.string() })
      .parse(await response.json());
    if (data.ownerId !== ownerId)
      throw new TodoApiError(401, "Your account changed. Sign in again.");
    return data;
  } catch (error) {
    if (signal?.aborted || error instanceof TodoApiError) throw error;
    throw new TodoApiError(0, ambiguous);
  }
}

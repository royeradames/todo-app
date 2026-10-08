import { z } from "zod";
import { mutationSchema } from "./model";
export class BadTodoRequest extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function readTodoMutation(request: Request, origin: string) {
  if (request.headers.get("origin") !== origin)
    throw new BadTodoRequest(403, "This request came from another site.");
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new BadTodoRequest(415, "Send a JSON task change.");
  const limit = 64 * 1024;
  const length = Number(request.headers.get("content-length"));
  if (length > limit)
    throw new BadTodoRequest(413, "This change is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new BadTodoRequest(400, "A task change is required.");
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new BadTodoRequest(413, "This change is too large.");
      }
      parts.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.byteLength;
  }
  try {
    return mutationSchema.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)),
    );
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      error instanceof SyntaxError ||
      error instanceof TypeError
    )
      throw new BadTodoRequest(400, "That task change is invalid.");
    throw error;
  }
}

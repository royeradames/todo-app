import * as z from "zod/mini";
import { maxTodos, todoSchema, type Todo } from "./model";

/**
 * The signed-out list lives only in this browser's localStorage. Stored data
 * is parsed like any other input: a damaged or foreign value is ignored.
 */
export const localListKey = "todo-local-list";
const storedSchema = z.object({
  version: z.literal(1),
  items: z
    .array(todoSchema)
    .check(
      z.maxLength(maxTodos),
      z.refine(
        (items) => new Set(items.map((item) => item.id)).size === items.length,
      ),
    ),
});

export function readLocalList(raw: string | null): Todo[] | null {
  if (!raw) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.items : null;
  } catch {
    return null;
  }
}

export function writeLocalList(items: readonly Todo[]) {
  return JSON.stringify({ version: 1, items });
}

/** The design's sample tasks, shown the first time this browser opens Todo. */
export const sampleTasks: Todo[] = [
  ["Complete online JavaScript course", true],
  ["Jog around the park 3x", false],
  ["10 minutes meditation", false],
  ["Read for 1 hour", false],
  ["Pick up groceries", false],
  ["Complete Todo App on Frontend Mentor", false],
].map(([title, completed], index) => ({
  id: `00000000-0000-4000-8000-00000000000${index + 1}`,
  title: title as string,
  completed: completed as boolean,
}));

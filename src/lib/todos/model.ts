import * as z from "zod/mini";

export const maxTodos = 500;
export const todoSchema = z.object({
  id: z.uuid(),
  title: z.string().check(z.trim(), z.minLength(1), z.maxLength(500)),
  completed: z.boolean(),
});
export type Todo = z.infer<typeof todoSchema>;
export const commandSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("add"), title: todoSchema.shape.title }),
  z.strictObject({
    kind: z.literal("complete"),
    id: z.uuid(),
    completed: z.boolean(),
  }),
  z.strictObject({ kind: z.literal("remove"), id: z.uuid() }),
  z.strictObject({ kind: z.literal("clear-completed") }),
  z.strictObject({
    kind: z.literal("reorder"),
    ids: z.array(z.uuid()).check(z.maxLength(maxTodos)),
  }),
]);
export type TodoCommand = z.infer<typeof commandSchema>;
export type TodoFilter = "all" | "active" | "completed";
export class InvalidTodoChange extends Error {}

export function applyCommand(
  items: readonly Todo[],
  command: TodoCommand,
  newId: () => string,
): Todo[] {
  switch (command.kind) {
    case "add":
      if (items.length >= maxTodos)
        throw new InvalidTodoChange(
          "This list has reached its 500-item limit.",
        );
      return [
        ...items,
        { id: newId(), title: command.title, completed: false },
      ];
    case "clear-completed":
      return items.filter((item) => !item.completed);
    case "complete":
    case "remove":
      if (!items.some((item) => item.id === command.id))
        throw new InvalidTodoChange("That task is no longer available.");
      return command.kind === "remove"
        ? items.filter((item) => item.id !== command.id)
        : items.map((item) =>
            item.id === command.id
              ? { ...item, completed: command.completed }
              : item,
          );
    case "reorder": {
      const byId = new Map(items.map((item) => [item.id, item]));
      if (
        command.ids.length !== items.length ||
        new Set(command.ids).size !== items.length
      )
        throw new InvalidTodoChange("The task order is out of date.");
      return command.ids.map((id) => {
        const item = byId.get(id);
        if (!item)
          throw new InvalidTodoChange("The task order is out of date.");
        return item;
      });
    }
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}
export function visibleTodos(items: readonly Todo[], filter: TodoFilter) {
  return items.filter(
    (item) =>
      filter === "all" ||
      (filter === "completed" ? item.completed : !item.completed),
  );
}
export function moveVisible(
  items: readonly Todo[],
  filter: TodoFilter,
  fromId: string,
  toId: string,
): string[] {
  const visible = visibleTodos(items, filter).map((item) => item.id);
  const from = visible.indexOf(fromId),
    to = visible.indexOf(toId);
  if (from < 0 || to < 0)
    throw new InvalidTodoChange("That task is not in this filter.");
  visible.splice(to, 0, ...visible.splice(from, 1));
  const included = new Set(visible);
  let index = 0;
  return items.map((item) =>
    included.has(item.id) ? visible[index++] : item.id,
  );
}

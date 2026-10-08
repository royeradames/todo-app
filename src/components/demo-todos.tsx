"use client";
import Link from "next/link";
import { useState } from "react";
import { applyCommand, type Todo } from "@/lib/todos/model";
import { TodoList } from "./todo-list";

const examples: Todo[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Complete online JavaScript course",
    completed: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    title: "Jog around the park 3x",
    completed: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    title: "10 minutes meditation",
    completed: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    title: "Read for 1 hour",
    completed: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    title: "Pick up groceries",
    completed: false,
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    title: "Complete Todo App on Frontend Mentor",
    completed: false,
  },
];
export function DemoTodos() {
  const [items, setItems] = useState(examples);
  return (
    <TodoList
      items={items}
      pending={false}
      change={async (command) =>
        setItems((current) =>
          applyCommand(current, command, () => crypto.randomUUID()),
        )
      }
      notice="Demo tasks. Changes stay in this tab."
      tools={
        <Link href="/login?returnTo=%2Ftodos">
          Sign in to save across devices
        </Link>
      }
    />
  );
}

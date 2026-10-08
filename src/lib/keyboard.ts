// Copied/adapted from Royer UI catalog's keyboard guard. Keep registration
// separate from page state so the same small family pattern can be reused.
export function registerShortcuts(
  target: Window,
  actions: Readonly<Record<string, () => void>>,
) {
  function handle(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    )
      return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(
        "input,textarea,select,[contenteditable]:not([contenteditable=false])",
      )
    )
      return;
    const action = actions[event.key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    action();
  }
  target.addEventListener("keydown", handle);
  return () => target.removeEventListener("keydown", handle);
}

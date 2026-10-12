# Todo

My solution to the [Frontend Mentor Todo app challenge](https://www.frontendmentor.io/challenges/todo-app-Su1_KokOW), live at https://todo-app.royeradames.com. It's a list saved only in this browser (localStorage): add, complete, delete and clear tasks, filter All, Active and Completed, drag to reorder, and switch between light and dark themes. It starts from the design's sample tasks and needs no account, server or settings.

The Todo I use every day is a separate private app in my Breakthrough suite, with sign-in and saved lists. This repository is only the Frontend Mentor solution.

## Run it

```bash
npm ci
npm run dev   # http://127.0.0.1:4325
```

## Checks

- `npm run typecheck`, `npm run lint`, `npm test`: types, static checks, the list model and storage, and `tests/unit/fm-solution-only.test.ts`, which keeps sign-in packages and settings out of this solution.
- `npm run test:browser`: the list on `next dev` at 320 px, the skip link and keyboard shortcuts (`TODO_TEST_PORT` overrides 4325).
- `npm run build`, then `npm run test:production`: the production build. The whole list journey works (add, complete, filter, delete, clear, mouse and keyboard reordering, reload, theme) with no console errors, painted content stays in place while the list loads, and no sign-in page or account API exists (`TODO_PRODUCTION_TEST_PORT` overrides 4327).

`setup.json` records that the app needs no settings; `npm run test:setup` checks the code reads none.

## Design

Official starter: `frontendmentorio/todo-app` at `ab67102eff4ea8c9aa616038660fc811eb72255d`. Supplied source stills are in `reference/design`, images in `public/images`. Layout, spacing, icons, check circles, hover-revealed delete and the separate mobile filter card follow the official design. Two deliberate deviations: text is at least 16px (the design uses 12–14px), and muted, completed and accent colours are adjusted just enough to reach 4.5:1 contrast.

Keyboard shortcuts adapt the existing Royer UI guard pattern in a small utility: N focuses a new task, ? opens help and Escape closes it. Drag a task with the mouse, or long-press and drag on touch. Alt with the up or down arrow moves the focused task and keeps focus on it, and "Reorder with buttons" shows move buttons for a single-pointer alternative.

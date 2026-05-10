# OptionDesk

A local-first options trading strategy journal and analytics dashboard.

## Package Manager

**This project uses [npm](https://www.npmjs.com/).** Do not use `bun`, `yarn`, or `pnpm`.

```sh
npm install      # install dependencies
npm run dev      # start dev server
npm run build    # production build
npm run lint     # ESLint check
npm run format   # Prettier format
```

Using any other package manager will create a conflicting lockfile (`bun.lock`, `yarn.lock`, `pnpm-lock.yaml`) which is blocked by `.gitignore`.

## Tech Stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [TanStack Start](https://tanstack.com/start) (routing + SSR)
- [Vite 7](https://vitejs.dev/) (bundler)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Zustand](https://zustand-demo.pmnd.rs/) (state, persisted to localStorage)
- [Recharts](https://recharts.org/) (charts)
- [shadcn/ui](https://ui.shadcn.com/) (component primitives)
- [Zod](https://zod.dev/) (validation)

## Data

All data is stored locally in your browser's `localStorage`. Nothing is sent to any server.

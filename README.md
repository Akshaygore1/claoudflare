# dubbed.ai

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, React Router, Hono, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **React Router** - Declarative routing for React
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **tRPC** - End-to-end type-safe APIs
- **workers** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Vite+** - Unified Vite toolchain, workspace task runner, linting, and formatting

## Getting Started

First, install the dependencies:

```bash
bun install
```

Copy the example env files before starting local development:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
cp packages/infra/.env.example packages/infra/.env
```

Fill those local `.env` files with your own values or configure the same variables through Cloudflare/Alchemy secrets for deployment. Never commit real `.env` files. If any credential has appeared in a shared script, log, issue, or commit, rotate it outside the repo.

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your local `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

## Admin Provisioning

Public sign-up no longer grants admin access based on email. Every new user is created as `role = 'user'` with `approval_status = 'pending'`.

Provision the first admin explicitly after that user signs up:

```sql
update "user"
set role = 'admin', approval_status = 'approved', approved_at = now()
where email = '<admin-email>';
```

If all admin accounts are removed, recover by promoting an existing user with the same SQL update. If no user exists yet, create one through normal sign-up first, then run the update.

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@dubbed-i/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Deployment

### Cloudflare via Alchemy

- Target: web + server
- Dev: bun run dev
- Deploy: bun run deploy
- Destroy: bun run destroy

For more details, see the guide on [Deploying to Cloudflare with Alchemy](https://www.better-t-stack.dev/docs/guides/cloudflare-alchemy).

### GitHub Actions CI/CD

The workflow in `.github/workflows/ci.yml` validates every pull request to `main` and deploys production after changes are pushed to `main`. Production deploys use the GitHub Environment named `production`, so you can require manual approval before `bun run deploy` runs.

Validation runs:

```bash
bun install --frozen-lockfile
bun run check
bun run test
bun run build
```

Production deployment runs:

```bash
bun install --frozen-lockfile
bun run deploy
```

Set up GitHub Actions:

1. Open your GitHub repository.
2. Go to `Settings > Actions > General`.
3. Enable GitHub Actions if it is disabled.
4. Go to `Settings > Secrets and variables > Actions`.
5. Add repository secrets named `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `BETTER_AUTH_SECRET`.
6. Add repository variables named `CORS_ORIGIN`, `BETTER_AUTH_URL`, and `ADMIN_EMAIL`.
7. Go to `Settings > Environments`.
8. Create an environment named `production`.
9. Enable required reviewers on the `production` environment if you want manual approval before deploy.
10. Go to `Settings > Branches`.
11. Add a branch protection rule for `main`.
12. Enable `Require status checks to pass before merging` and select the `Validate` check.

Cloudflare token requirements:

- `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID.
- `CLOUDFLARE_API_TOKEN`: an API token that can manage Cloudflare Workers, D1, and R2 resources for this account.
- `BETTER_AUTH_SECRET`: a long random secret used by Better Auth.

Deployment environment variables:

- `CORS_ORIGIN`: the production web URL allowed to call the API.
- `BETTER_AUTH_URL`: the production server URL used by Better Auth.
- `ADMIN_EMAIL`: the email address to treat as the configured admin email.

`VITE_SERVER_URL` is not required in GitHub because `packages/infra/alchemy.run.ts` binds it from the deployed server URL automatically.

## Git Hooks and Formatting

- Optional native Vite+ hooks: `bun run hooks:setup`
- Docs: [Vite+ commit hooks](https://viteplus.dev/guide/commit-hooks)
- Run checks: `bun run check`

## Project Structure

```
dubbed.ai/
├── apps/
│   ├── web/         # Frontend application (React + React Router)
│   └── server/      # Backend API (Hono, TRPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI
- `bun run check`: Run Vite+ format/lint checks and workspace TypeScript checks
- `bun run lint`: Run Vite+ lint checks
- `bun run format`: Run Vite+ formatting
- `bun run staged`: Run Vite+ checks against staged files
- `bun run hooks:setup`: Install Vite+ native Git hooks with `vp config`

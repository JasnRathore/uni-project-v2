# Runtime configuration

This reference inventories build/runtime configuration, environment
expectations, and app-level runtime assets. It does not describe database
service internals or frontend component behavior.

## Exact source coverage

- `package.json` and `package-lock.json` — runtime dependencies and npm scripts.
- `next.config.mjs` — Next.js build-check behavior.
- `tsconfig.json` — TypeScript and import alias configuration.
- `eslint.config.mjs` — ESLint presets and ignore list.
- `postcss.config.mjs` — CSS build plugin.
- `.env.example` and `.gitignore` — documented environment names and ignored
  runtime/build artifacts.
- `README.md` — generated development/deployment guidance.
- `app/globals.css`, `app/shadcn-tailwind.css`, `app/favicon.ico`, and
  `public/{file.svg,globe.svg,next.svg,vercel.svg,window.svg}` — global CSS
  imports and static assets.

## Package and toolchain

`package.json` pins Next.js `16.3.7`, React/React DOM `19.2.8`, and TypeScript
5.x. `package-lock.json` is the npm dependency lockfile. The scripts are:

| Script | Command | Scope |
| --- | --- | --- |
| `dev` | `next dev` | Development server. |
| `build` | `next build` | Production build. |
| `start` | `next start` | Serves the production build. |
| `lint` | `eslint` | Lints the repository using the flat config. |
| `typecheck` | `tsc --noEmit` | Runs TypeScript without emitting output. |
| `test` | `node --test tests/schema.test.js` | Runs only `tests/schema.test.js`; the other test files are not included by this npm script. |

`next.config.mjs` sets both `typescript.ignoreBuildErrors` and
`eslint.ignoreDuringBuilds` to `true`. Thus `next build` does not serve as the
typecheck/lint gate; run the explicit scripts if those checks are required.
The API handler explicitly selects the Node.js runtime. The app also imports
`next/font/google`, so font resolution/download requirements for a clean build
depend on the environment.

`tsconfig.json` enables strict checking, JavaScript imports, bundler module
resolution, and the `@/*` alias to the repository root. The ESLint flat config
combines Next core-web-vitals and TypeScript presets, ignoring `.next`, `out`,
`build`, and `next-env.d.ts`. PostCSS loads `@tailwindcss/postcss`; the app
global stylesheet imports Tailwind, animation utilities, and the local
`shadcn-tailwind.css` custom variants/utilities.

## Environment and static assets

`.env.example` documents:

- `DATABASE_TARGET=local` as the sample target, with `LOCAL_DATABASE_URL=file:local.db`.
- `DATABASE_TARGET=turso` requiring `TURSO_DATABASE_URL` and
  `TURSO_AUTH_TOKEN`.
- `JWT_SECRET` for the API token signing/verification flow.
- `NEXT_PUBLIC_APP_URL` is not in the example but is read by the API adapter
  for its allowed CORS origin, with a localhost fallback.
- `PORT=3001` is described in the sample as an optional local API server port.
  The package scripts do not pass a port and no app/library reference to
  `process.env.PORT` was found; whether another local tool consumes it is
  unknown.

Only `.env.example` is inventory evidence; actual secrets and environment
values vary by deployment. `.gitignore` excludes environment files except
`.env.example`, local `local.db`, Next output, build output, and Vercel's
`.vercel` folder. Global CSS and the listed SVG/favicon files are app/static
assets, not route handlers.

## Deployment evidence and unknowns

The README is the stock create-next-app guide: it documents local
`npm run dev`, a default browser URL, and links to Vercel deployment guidance.
It is not evidence of a configured production target. No Dockerfile,
Compose/Procfile, Vercel/Netlify/Fly/Render configuration, or `.github`
workflow was present in the repository inventory. Hosting topology, provisioned
environment variables, health probe configuration, and production runtime
limits remain unknown.

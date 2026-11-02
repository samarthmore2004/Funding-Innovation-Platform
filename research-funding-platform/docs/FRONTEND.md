# Frontend architecture

The web client is a React 19 single-page application built with Vite 8 and styled with Tailwind CSS 4
(CSS-first configuration in `src/index.css`). It is written in plain JavaScript and consumes the REST API
documented in [`API.md`](API.md). Every number, chart and list on screen comes from an API response — there are
no hard-coded metrics.

## Stack

| Concern | Choice |
|---|---|
| UI library | React 19 (function components, hooks) |
| Routing | react-router-dom 7 (`BrowserRouter`, nested routes, `React.lazy` code splitting per page) |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite`; indigo/violet primary, slate neutrals |
| Charts | Recharts 3, wrapped in `src/components/charts/` |
| HTTP | axios instance in `src/api/client.js` |
| Icons | lucide-react |

## Folder layout

```
frontend/
  index.html, vite.config.js, Dockerfile, nginx.conf, .env.example
  public/favicon.svg
  src/
    main.jsx            # providers: BrowserRouter → ToastProvider → AuthProvider → App
    App.jsx             # route table (lazy pages)
    index.css           # Tailwind import + design tokens (@theme)
    api/                # client.js + one service module per backend module (auth, users, profile, funding,
                        # recommendations, research, patents, technology, innovation, commercialization,
                        # dashboard, notifications, reports, admin) and an index barrel
    auth/               # AuthContext (session, login/register/logout, role helpers), ProtectedRoute, RoleRoute
    layouts/            # PublicLayout, AppLayout (sidebar/topbar), NotificationBell, UserMenu, navigation config
    components/
      ui/               # design system primitives
      charts/           # Recharts wrappers + palette + ChartFrame (chart/table toggle)
      domain/           # feature components shared by pages (badges, cards, score breakdown, forms)
    pages/              # one file per page; dashboard/, profile/, research/, patents/, admin/ hold page sections
    utils/              # formatters, enum labels, hooks, taxonomy cache, validation helpers
```

## Routes

| Path | Page | Access |
|---|---|---|
| `/` | Landing page (modules, roles, how it works, data transparency) | public |
| `/login`, `/register` | Sign-in / registration (role choice: researcher, startup founder, innovation manager) | public |
| `/oauth/callback` | Completes optional Google/GitHub OAuth2 sign-in (`#access_token=` / `#error=`) | public |
| `/app` | Role-based dashboard (researcher, startup, manager, admin views; admins/managers can preview other views) | signed in |
| `/app/profile` | Research profile, interests, organization; publications (incl. DOI import), patents, research history | signed in |
| `/app/funding`, `/app/funding/:id` | Funding discovery (search, filters, sorting, pagination, tracking) and detail (eligibility, match, source attribution) | signed in; create/edit for managers & admins, delete for admins |
| `/app/recommendations` | Personalised recommendations with match score, similarity, eligibility, matched terms, feedback | signed in |
| `/app/research` | Publication trends, live OpenAlex topic trend, emerging topics, hotspots, citation analytics, publication explorer, personal analytics | signed in |
| `/app/patents`, `/app/patents/:id` | Patent search, filing trends, assignees & competitor comparison, clusters, innovation map, live PatentsView search | signed in |
| `/app/technology`, `/app/technology/:key` | Technology areas, emerging technologies, opportunity quadrant, adoption tracking, competitive monitoring | signed in |
| `/app/innovation`, `/app/innovation/:id` | Innovation projects, scoring, what-if preview, score breakdown and history, matched funding | signed in |
| `/app/commercialization` | Commercialization pathways, productization ideas, licensing targets, partners, funding, risks | signed in |
| `/app/portfolio` | Portfolio analytics and pipeline board | innovation manager, admin |
| `/app/notifications` | Notification centre (filters, mark read, delete, run alert engine) | signed in |
| `/app/reports` | Report preview and CSV / Excel / PDF downloads, report history | signed in |
| `/app/settings` | Account, notification preferences, password change, data export, account deletion | signed in |
| `/app/admin` | Platform analytics, users, recommendation monitoring, datasets (import/sync), audit logs, system & jobs, broadcast | admin |

## Authentication flow

1. `POST /api/auth/login` (or `/register`) returns `{access_token, user}`; the token is stored in
   `localStorage["rfip_token"]` (wrapped in try/catch so a blocked storage only shortens the session).
2. The axios request interceptor adds `Authorization: Bearer <token>`.
3. On reload, `AuthProvider` restores the session with `GET /api/auth/me`. Only a 401/403 discards the token; if
   the API is unreachable the user sees a "can't reach the platform" screen with **Try again** instead of being
   signed out.
4. Any later 401 (expired token) clears the session and redirects to `/login` with a "session expired" notice,
   returning to the original page after sign-in.
5. `ProtectedRoute` guards `/app/*`; `RoleRoute` guards manager/admin pages and explains why access is denied.
   The backend enforces the same roles — the client-side checks are only for navigation.

Social sign-in buttons appear only for providers that `GET /api/auth/oauth/providers` reports as `enabled`.

## Design system (`src/components/ui`)

`Button`, `Card`/`CardHeader`, `Badge`, `Field`/`Input`/`Select`/`Textarea`/`Checkbox`/`Toggle`, `TagInput`,
`Modal`/`Drawer`, `ConfirmDialog`, `Table`, `Pagination`, `Tabs`/`SegmentedControl`, `Spinner`/`LoadingState`,
`EmptyState`, `ErrorState`, `Alert`, `StatCard`, `PageHeader`, `ScoreGauge`, `ProgressBar`, `Toast`
(`useToast()`). Every data view handles loading, empty and error states; destructive actions use
`ConfirmDialog`; dialogs trap initial focus, close on Escape and restore focus to the trigger.

## Charts and colour

* Palette: the validated categorical palette in `components/charts/palette.js`
  (`#2a78d6, #eb6834, #1baf7a, #eda100, #e87ba4, #008300, #6250d6, #e34948`), checked for colour-vision-deficiency
  separation against the white card surface. Hues are assigned in fixed order and **follow the entity**
  (`useStableColors`), so filtering never repaints the remaining series.
* Magnitude uses a single blue sequential ramp (heatmap); scatter plots use emphasis (accent vs grey) rather
  than many hues; status colours appear only with an icon and a label.
* Marks: bars ≤ 24 px with 4 px rounded ends, 2 px lines, hairline solid grid, one y-axis per chart (no dual axes).
* Every multi-series chart has a legend, tooltips lead with the value, and `ChartFrame` offers a **Table** view
  so every value is readable without hovering.

## Data transparency in the UI

* Funding records show a source badge: **Verified source** (with official link and verification date),
  **Illustrative sample** (explicit warning: not a real opportunity), **Imported** or **Internal program**.
* Patent pages show a banner whenever illustrative (synthetic) patent records are present.
* The innovation score always appears with its formula, weights, component explanations and the heuristic
  disclaimer.

## Configuration

| Variable | Used by | Default |
|---|---|---|
| `VITE_API_BASE_URL` | browser bundle (build time) | `/api` |
| `VITE_PROXY_TARGET` | `vite` dev/preview proxy | `http://localhost:8000` |
| `VITE_PORT` | `vite` dev server port | `5173` |

## Build and verification notes

* `npm run build` produces `dist/`; pages are split into separate chunks, Recharts lives in a shared chunk
  (~342 kB, ~101 kB gzip).
* During development the UI was exercised page-by-page in a browser against a contract-shaped mock of the API
  (all routes, the four dashboard views, admin tabs, modals, sign-in/out, session-expiry and API-outage paths).
  Every frontend call was also cross-checked against the backend's OpenAPI snapshot (`docs/openapi.json`):
  96 of 96 method/path pairs exist.
* Windows: keep the checkout in a short path (or enable long paths) — see `frontend/README.md`.

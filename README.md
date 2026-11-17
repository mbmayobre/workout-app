# Workout

One app for the gym instead of three: a rest timer and stopwatch, a set
counter, the workout of the day, an exercise library, a weekly plan that can
shuffle itself, and progress tracking for lifts and body weight.

It is a mobile-first web app. It runs in any browser, is designed for a
phone, and can be installed to the home screen so it opens full-screen and
works with no signal.

## What it does

| Screen | What you do there |
|---|---|
| **Today** | See today's workout. Swap one exercise, shuffle the whole day, and start, pause, finish, or reset the workout. |
| **Active workout** | One exercise at a time: rest timer or stopwatch, set counter, weight and reps inputs, sets logged so far. Tap the clock to pause. |
| **Plan** | Give each weekday one or more workout types (chest, legs, full body, cardio, kettlebell…), choose how many exercises, pin the ones you always want. |
| **Exercises** | Browse, search, and filter the library by muscle group and equipment. Add your own. |
| **Progress** | Log body weight and see the trend, see finished workouts, and see a personal best and history for every exercise. |
| **Timers** | A standalone stopwatch and countdown. |
| **Settings** | lb/kg, km/mi, rest length, cloud sync sign-in, backup export and import. |

The bottom tab bar (Today, Plan, Exercises, Progress, Settings) is on every
screen, including mid-workout.

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open the address it prints (usually http://localhost:5173). To see it as a
phone, open your browser's developer tools and switch on device emulation, or
open the same address from your phone while both are on the same Wi-Fi
(`npm run dev -- --host`).

The app works straight away with data stored on the device. Cloud sync is
optional and takes about five minutes to set up: see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server with live reload. |
| `npm run build` | Type-check, then build the production app into `dist/`. |
| `npm run preview` | Serve the built `dist/` locally, to test the real thing (including offline support). |
| `npm test` | Run the unit tests once. |
| `npm run test:watch` | Re-run tests as files change. |
| `npm run typecheck` | Type-check only. |
| `npm run lint` | Run the linter. |
| `npm run icons` | Regenerate the app icons in `public/`. |

## How the code is organised

```
src/
  main.tsx            Entry point: mounts the app.
  App.tsx             Route table: which screen shows for which URL.
  index.css           Colours and global styles (Tailwind is configured here).

  db/                 Everything about stored data.
    types.ts            The shape of every record. Start here.
    db.ts               The database, its tables, and sync configuration.
    seed.ts             Built-in exercises, default week, default settings.
    hooks.ts            How screens READ data (live queries).
    actions.ts          How screens CHANGE data (every write is here).
    backup.ts           JSON export and import.

  lib/                Logic with no screen and no database access.
    shuffle.ts          Choosing exercises for a day. Has tests.
    timers.ts           Rest timer, stopwatch, workout clock.
    units.ts            lb/kg, km/mi, and number formatting.
    stats.ts            Personal bests and chart data.
    dates.ts            Local-date helpers.
    labels.ts           Display names for stored codes.
    device.ts           Beep, vibrate, keep-screen-awake.

  components/         Reusable pieces of UI.
    ui.tsx              Buttons, chips, inputs, cards.
    Layout.tsx          Page frame and bottom tab bar.
    TimerCards.tsx      Rest countdown and stopwatch displays.
    TrendChart.tsx      Line chart (loaded on demand via LazyTrendChart.tsx).

  pages/              One file per screen.

docs/                 Longer explanations (see below).
scripts/              One-off tooling (icon generator).
```

A rule that keeps this tidy: **dependencies point downwards**. Pages use
components, `db/`, and `lib/`. Components use `lib/`. `lib/` uses only the
types from `db/types.ts`. Nothing in `lib/` or `db/` imports from a page.

## Documentation

Every source file starts with a comment explaining what it is for and why it
is built that way. The longer documents are:

| Document | Read it when you want to… |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Understand how the pieces fit together and why each tool was chosen. |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Know what is stored, in what units, and how to change the schema safely. |
| [docs/SHUFFLE.md](docs/SHUFFLE.md) | Understand or adjust how exercises are picked. |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Put the app on Vercel and turn on cloud sync. |

## Tech stack

TypeScript, React, Vite, Tailwind CSS, Dexie (IndexedDB) with Dexie Cloud
for sync, React Router, Recharts, and vite-plugin-pwa. Tests use Vitest.
The reasons for each are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

# Architecture

How the app is put together, and why.

## The big picture

```
┌──────────────────────────── your phone ────────────────────────────┐
│                                                                     │
│   pages/  ──reads──▶  db/hooks.ts  ──▶┐                             │
│     │                                 ├──▶  IndexedDB (via Dexie)   │
│     └────writes───▶  db/actions.ts ──▶┘            ▲                │
│     │                                              │ background     │
│     └────uses─────▶  lib/  (shuffle, timers,       ▼ sync           │
│                             units, stats)    Dexie Cloud add-on     │
└──────────────────────────────────────────────────┬──────────────────┘
                                                   │ when online
                                                   ▼
                                          Dexie Cloud server
                                                   ▲
                                                   │
                                        your other devices
```

There is **no backend of our own**. The app is a set of static files
(HTML, CSS, JavaScript) that any static host can serve. All logic runs in the
browser.

## Local-first storage

Every read and write goes to **IndexedDB**, a database built into every
browser, on the device itself. We use the **Dexie** library because
IndexedDB's own API is awkward.

Consequences:

- **It is instant.** No request leaves the phone when you log a set.
- **It works offline.** A gym basement with no signal makes no difference.
- **Sync is a separate, optional layer.** The **Dexie Cloud** add-on watches
  the local database and copies changes to a server in the background, and
  pulls changes made on other devices. Screens never know or care whether
  sync is on.

Without sync, clearing the browser's site data would delete everything. With
sync, the server holds a full copy: sign in again and it all comes back.
That protection is the reason sync is part of the design rather than an
extra. The JSON backup in Settings is a second, independent safety net.

Sync is switched on by one environment variable. See
[DEPLOYMENT.md](DEPLOYMENT.md).

## Reading and writing data

Two files form the only doorway between screens and the database:

- **`db/hooks.ts` (reads).** Each hook wraps Dexie's `useLiveQuery`, which
  runs a query and automatically re-runs it when the underlying data
  changes. If you log a set, every screen showing sets updates by itself.
  The same happens when a change arrives from another device via sync.
- **`db/actions.ts` (writes).** Every change to stored data is a function
  here. Screens call `logSet(...)` or `reshuffleDay(...)`; they never write
  to a table directly.

Why bother with the indirection? Because the rules live in one place. "A
built-in exercise is archived rather than deleted" is written once, in
`deleteExercise`, instead of being remembered by every screen that has a
delete button.

## Pure logic in `lib/`

Anything that is plain calculation lives in `lib/` as **pure functions**:
they take values in and return values out, with no database and no screen.
The shuffle algorithm, unit conversion, and personal-best calculations are
all like this.

Pure functions are easy to test (give input, check output) and easy to
trust. `lib/shuffle.test.ts` runs the shuffle rules against the real
exercise library across 50 random seeds per rule.

## Timers

`lib/timers.ts` is the one place with an unusual design, for a reason worth
knowing.

A timer that counts "one more second" on a tick falls behind on a phone,
because phones pause JavaScript when the screen locks or you switch apps.
So the timers store **timestamps**, not counts:

- The rest timer stores *when it ends*. Remaining time is `endsAt − now`.
- The stopwatch stores *when it started* plus time banked before a pause.

Whenever the screen draws, it works the display out from the current time,
so it is correct however long the page was asleep.

Timer state is kept in `localStorage`, not the database: it belongs to this
device only (a rest timer on your phone should not appear on your laptop),
and it survives an accidental reload mid-workout.

**Known limit:** the "rest over" beep and vibration are produced by the page
itself. If the phone is locked or the app is in the background when the rest
ends, the alert fires when you return, not at the exact moment. The active
workout screen keeps the screen awake (where the browser supports it) so
this rarely matters in practice. True background alerts would need push
notifications, which is a possible later addition.

## Units

Measurements are stored in one canonical unit each (kilograms, metres,
seconds) and converted only when displayed or typed. Switching between lb
and kg therefore never rewrites history, and an exercise can have its own
unit (kettlebells are labelled in kg) without special cases in storage.
Details in [DATA-MODEL.md](DATA-MODEL.md).

## Screens and navigation

`App.tsx` is the route table. Every route uses one layout, **`AppLayout`**
in `components/Layout.tsx`, so the bottom tab bar (Today, Plan, Exercises,
Progress, Settings) is always visible and every section is one tap away,
even mid-workout.

Sub-screens keep their parent tab highlighted: an exercise editor lights up
Exercises, and the active workout and timers light up Today. Each tab's
`sections` list in `Layout.tsx` decides this. Sub-screens also show a back
arrow in their header.

A screen can add its own bar above the tab bar by rendering it after its
`<Page>`; the active workout does this for Previous / Next.

## Workout lifecycle

A workout on the Today screen is in one of four states:

| State | How you get there | Controls shown |
|---|---|---|
| Not started | Nothing logged yet today, or the last workout was finished | Start workout |
| In progress | Start workout, or any set logged | Continue, Pause, Finish, Reset |
| Paused | Pause on Today, or tap the clock on the workout screen | Resume, Finish, Reset |
| Finished | Finish workout | A summary card, then "Start another workout" |

- **Pause** stops the workout clock, and any running rest timer or
  stopwatch with it. The clock is in `lib/timers.ts` and stores timestamps,
  so paused time is simply left out of the total.
- **Finish** saves a `WorkoutSession` record (duration, sets, exercises)
  and stops all timers. The sets themselves were already saved as you
  logged them.
- **Reset** asks first, then deletes the sets logged in the current
  workout and stops all timers. Workouts already finished today are not
  touched.

Which sets belong to the current workout is worked out, not stored: they
are today's sets logged after today's most recent finished workout
(`inProgressLogs` in `lib/stats.ts`). That keeps working when sets were
logged on another device. The logic is in `finishWorkout` and
`resetWorkout` in `db/actions.ts`.

The app is designed for a phone first. On wider screens the same single
column is centred with a maximum width. There is no separate desktop design
to maintain.

## Styling

Tailwind CSS v4. Colours are defined once as named tokens in
`src/index.css` (`surface`, `ink`, `accent`…) and components use the tokens
(`bg-surface`, `text-soft`), never raw colour values. The app is dark by
default and switches to a light palette when the device is in light mode; only
the token values change.

Shared controls live in `components/ui.tsx`. Everything tappable is at least
44px tall.

## Installable and offline (PWA)

`vite-plugin-pwa` (configured in `vite.config.ts`) generates two things at
build time:

- A **web app manifest**: the name, icon, and colours used when the app is
  added to a home screen.
- A **service worker**: a script the browser keeps that caches the app's
  files, so the app opens with no connection.

Updates: when a new version is deployed, the service worker downloads it in
the background and it takes effect the next time the app is opened.

The service worker only exists in production builds. To test offline
behaviour locally, use `npm run build` then `npm run preview`.

## Why these tools

| Tool | Why |
|---|---|
| **TypeScript** | Catches mistakes in data shapes (a set without a date, kg where lb was meant) before the app runs. |
| **React** | The most widely used UI library, so answers and examples are easy to find. |
| **Vite** | Fast development server and a simple production build. |
| **Tailwind CSS** | Styles sit next to the markup they affect; quick to build mobile layouts. |
| **Dexie + Dexie Cloud** | Local-first storage with sync added by a plugin rather than by building a server. |
| **React Router** | Standard URL-based navigation, so the back button and reloads behave. |
| **Recharts** | Simple line charts. Loaded only on the Progress screens to keep the first load small. |
| **Vitest** | Test runner that shares Vite's configuration. |
| **Vercel** | Free static hosting with deploys on every push. |

## Adding things

**A new field on a record:** add it to `db/types.ts`. If you need to query
by it, add an index in a new `db.version(n)` block in `db/db.ts` (see
[DATA-MODEL.md](DATA-MODEL.md)).

**A new way to change data:** add a function to `db/actions.ts` and call it
from the screen.

**A new screen:** create `pages/SomethingPage.tsx`, then add a `<Route>` in
`App.tsx` under the layout that fits.

**A new built-in exercise:** add a line to `seedExercises` in `db/seed.ts`.
It appears for existing users the next time they open the app.

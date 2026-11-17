# Data model

What the app stores. The authoritative definitions are the TypeScript types
in [`src/db/types.ts`](../src/db/types.ts); this document explains them.

## Tables

| Table | One record is… | How many |
|---|---|---|
| `exercises` | An exercise in the library | Dozens |
| `planDays` | One weekday of the weekly plan | Always 7 |
| `setLogs` | One logged set, or one cardio effort | Grows over time |
| `bodyWeights` | One body-weight measurement | At most one per day |
| `settings` | App preferences | Always 1 |
| `sessions` | A finished workout's summary | One per finished workout |

## Units

Everything is stored in one canonical unit and converted for display:

| Measurement | Stored as | Field names |
|---|---|---|
| Weight | kilograms | `weightKg` |
| Distance | metres | `distanceM` |
| Time | seconds | `seconds`, `defaultSeconds`, `restSeconds` |
| Calendar day | `'YYYY-MM-DD'` in local time | `date` |
| Moment in time | milliseconds since 1970 | `at` |

The unit is part of the field name on purpose, so it is never ambiguous.
Conversion happens in [`src/lib/units.ts`](../src/lib/units.ts).

Dates are local, not UTC: a workout at 9pm in New York belongs to that
evening, not to the next day as it would in UTC.

## IDs

All IDs are strings.

- **Records you create** (your own exercises, set logs, body weights) get a
  random UUID. Random IDs cannot collide between devices, which sync needs.
- **Built-in records** have fixed IDs beginning with `#`: `#ex-bench-press`,
  `#day-1`, `#settings`. Dexie Cloud treats a `#` ID as private to the
  signed-in user. That means the built-in records on your phone and on your
  laptop are recognised as the *same* records and merge, instead of syncing
  into two copies of everything.

## Exercise

```ts
{
  id: '#ex-kb-swing',
  name: 'Kettlebell swing',
  kind: 'strength',            // 'strength' | 'bodyweight' | 'cardio'
  equipment: 'kettlebell',
  primary: ['legs', 'back'],   // what it mainly trains
  secondary: ['core', 'shoulders'],
  fullBody: false,             // true for whole-body moves
  logMode: 'reps',             // count sets in 'reps' or 'time'
  weightUnit: 'kg',            // optional override of the app setting
  defaultSets: 3,
  defaultReps: 15,
  defaultSeconds: 30,
}
```

- **`kind`** decides what a set records. `strength`: weight plus reps or
  time. `bodyweight`: reps or time. `cardio`: time, with optional distance
  and calories.
- **`primary` / `secondary`** drive shuffling. A muscle-group day only
  considers `primary`. Full-body days count `secondary` at half weight.
- **Kettlebell is equipment**, not a muscle group, so it can cut across all
  of them.
- **`archived`** (optional) marks a built-in exercise that was "deleted". It
  is hidden rather than removed so that first-run setup does not add it
  back, and so old logs can still show its name. Exercises you created are
  deleted for real.

## PlanDay

```ts
{
  id: '#day-6',
  weekday: 6,                       // 0 = Sunday … 6 = Saturday
  types: ['fullBody', 'cardio'],    // empty array = rest day
  count: 6,                         // how many exercises
  style: 'balanced',                // 'balanced' | 'compound' | 'focused'
  picks: [
    { exerciseId: '#ex-squat', pinned: true, sets: 4, reps: 6, seconds: 30 },
    …
  ],
  lastPickIds: ['#ex-leg-press'],   // replaced by the last shuffle
}
```

- **`picks`** is the day's current exercise list. It stays the same until
  you shuffle or edit, so the week's workouts are stable.
- **`pinned`** picks survive every shuffle.
- Each pick carries its **own** target `sets` / `reps` / `seconds`, copied
  from the exercise's defaults when added. Changing a target on one day does
  not affect another day or the exercise itself.
- **`lastPickIds`** lets the next shuffle avoid what it just replaced.

How `picks` are chosen is described in [SHUFFLE.md](SHUFFLE.md).

## SetLog

```ts
{
  id: '3f2c…',
  exerciseId: '#ex-bench-press',
  date: '2026-11-16',
  at: 1794883671333,
  weightKg: 83.91,     // 185 lb
  reps: 8,
}
```

Only the fields that apply are present: `weightKg` for weighted exercises,
`reps` or `seconds` depending on the exercise's `logMode`, and `seconds`
with optional `distanceM` / `calories` for cardio.

**Sets are saved the moment you log them**, not when the workout ends, so
nothing is lost if the app closes mid-workout. The set counter on the
workout screen is a plain count of today's logs for that exercise. Tapping −
on the counter deletes the most recent one.

Set logs point at an exercise by ID but are never deleted along with it, so
removing an exercise from the library keeps your history. ("Reset workout"
on Today is the one action that deletes sets in bulk, and it asks first.)

## WorkoutSession

```ts
{
  id: '9c1e…',
  date: '2026-11-17',
  title: 'Back',            // the plan day's title at the time
  startedAt: 1794930100000,
  finishedAt: 1794933000000,
  activeSeconds: 2650,      // excludes pauses
  setCount: 16,
  exerciseCount: 4,
}
```

Written by "Finish workout". It is a summary: the sets stay in `setLogs`.
It records what the sets alone cannot, mainly how long the workout took,
and marks the workout as done.

There is no "workout in progress" record. Sets on a day that were logged
after that day's latest `finishedAt` belong to the workout in progress (see
`inProgressLogs` in [`src/lib/stats.ts`](../src/lib/stats.ts)). Because
this is worked out from synced data, it stays correct across devices.

`activeSeconds` comes from the workout clock on the device you finish on.
If you finish on a device that has no clock running (the sets were logged
elsewhere), it falls back to the time between the first and last set.

## BodyWeightEntry

```ts
{ id: 'a81b…', date: '2026-11-16', weightKg: 80.92 }
```

One per day: logging again on the same day replaces that day's entry.

## Settings

```ts
{
  id: '#settings',
  weightUnit: 'lb',
  distanceUnit: 'km',
  restSeconds: 90,
  autoRest: true,     // start the rest timer when a set is logged
  sound: true,        // beep when a timer ends
}
```

## What is NOT in the database

Running timers (rest countdown, stopwatch, workout clock) are stored in the
browser's `localStorage` under the key `workout.timers`. They are
device-specific and short-lived, so they are deliberately not synced. See
[`src/lib/timers.ts`](../src/lib/timers.ts).

## Indexes

Declared in [`src/db/db.ts`](../src/db/db.ts):

```ts
db.version(1).stores({
  exercises:   'id, name, kind, equipment',
  planDays:    'id, weekday',
  setLogs:     'id, date, exerciseId, [exerciseId+date]',
  bodyWeights: 'id, date',
  settings:    'id',
})

// Version 2 added finished-workout summaries.
db.version(2).stores({
  sessions: 'id, date, finishedAt',
})
```

Version 2 is a working example of the "Changing the schema" rules below: it
adds a table in a new version block and leaves version 1 untouched.

The first name is the primary key; the rest are indexes, which is what makes
a field searchable with `.where()`. Fields not listed are still stored. The
compound index `[exerciseId+date]` answers "this exercise's sets today" in
one lookup.

## Changing the schema

Adding a **field** needs no schema change: add it to the type and start
writing it. Old records simply will not have it, so make it optional or
handle `undefined`.

Adding an **index**, or reshaping existing data, needs a new version. Never
edit a version that has already been used; add another below it:

```ts
db.version(2)
  .stores({
    setLogs: 'id, date, exerciseId, [exerciseId+date], at', // new index
  })
  .upgrade(async (transaction) => {
    // Optional: rewrite existing records to the new shape.
    await transaction.table('setLogs').toCollection().modify((log) => {
      log.note ??= ''
    })
  })
```

Dexie runs the upgrade once on each device the next time the app opens.

Two rules once other devices hold data:

1. **Never change a primary key** of an existing table. Create a new table
   and copy the data across.
2. **Keep changes backwards-compatible where you can.** A phone that has
   not yet updated may still be syncing records in the old shape.

If the backup file layout changes too, bump `BACKUP_VERSION` in
[`src/db/backup.ts`](../src/db/backup.ts) and handle the older version in
`importBackup`.

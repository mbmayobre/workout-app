/**
 * The database.
 *
 * Storage is "local-first":
 *
 *   screen  <->  IndexedDB on this device  <->  Dexie Cloud (optional)
 *
 * Every read and write goes to IndexedDB, the database built into the
 * browser, through the Dexie library. That is why the app is instant and
 * works with no signal. When a Dexie Cloud URL is configured, the Dexie Cloud
 * add-on copies changes to the server in the background and pulls changes
 * made on other devices. Screens never talk to the network themselves.
 *
 * Sync is switched on by setting VITE_DEXIE_CLOUD_URL (see .env.example and
 * docs/DEPLOYMENT.md). Without it the app is fully usable but local-only.
 */
import Dexie, { type EntityTable, type Table } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import { seedExercises, seedPlanDays, defaultSettings } from './seed'
import type { BodyWeightEntry, Exercise, PlanDay, SetLog, Settings, WorkoutSession } from './types'

/** The sync server address, or undefined when sync is not set up. */
const cloudUrl: string | undefined = import.meta.env.VITE_DEXIE_CLOUD_URL || undefined

/** True when this build was configured with a Dexie Cloud database. */
export const syncEnabled = Boolean(cloudUrl)

/**
 * The Dexie instance plus the type of each table, so that
 * `db.exercises.get(id)` is known to return an Exercise.
 */
export type WorkoutDb = Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  planDays: EntityTable<PlanDay, 'id'>
  setLogs: EntityTable<SetLog, 'id'>
  bodyWeights: EntityTable<BodyWeightEntry, 'id'>
  settings: EntityTable<Settings, 'id'>
  sessions: EntityTable<WorkoutSession, 'id'>
}

export const db = new Dexie('workout', {
  // The add-on is only loaded when there is a server to talk to.
  addons: syncEnabled ? [dexieCloud] : [],
}) as WorkoutDb

/**
 * Schema.
 *
 * Each string lists the primary key first, then the fields that are INDEXED
 * (searchable with `.where()`). Fields that are not listed are still stored;
 * they just cannot be queried directly. Only index what a query needs.
 *
 * - `id` (not `++id`): string IDs we generate ourselves. Auto-incrementing
 *   numbers would collide between devices once sync is on.
 * - `[exerciseId+date]`: a compound index, used to fetch "today's sets for
 *   this exercise" in one step.
 *
 * To change the schema later, add a NEW `db.version(2).stores({...})` block
 * below this one; never edit a version that has shipped. See
 * docs/DATA-MODEL.md, "Changing the schema".
 */
db.version(1).stores({
  exercises: 'id, name, kind, equipment',
  planDays: 'id, weekday',
  setLogs: 'id, date, exerciseId, [exerciseId+date]',
  bodyWeights: 'id, date',
  settings: 'id',
})

// Version 2 adds finished-workout summaries. Only the new table is listed;
// the others carry over from version 1 unchanged.
db.version(2).stores({
  sessions: 'id, date, finishedAt',
})

if (cloudUrl) {
  db.cloud.configure({
    databaseUrl: cloudUrl,
    // The app can be used before signing in; data syncs once you do.
    requireAuth: false,
    // Keep the local database name the same with or without sync, so data
    // entered before sync was configured is not left behind.
    nameSuffix: false,
  })
}

/**
 * First-run setup: make sure the built-in records exist.
 *
 * Adds any built-in exercise, plan day, or settings record that is missing.
 * It only ADDS and never overwrites, so your edits to built-in records are
 * kept. It runs:
 *
 * - every time the database opens, so exercises added to the seed list in a
 *   later release show up for existing users;
 * - after every sync (when sync is on). On a device that has just signed
 *   in, this runs only once your saved data has downloaded, so it fills
 *   real gaps instead of competing with your saved plan.
 *
 * Runs are queued one after another: two overlapping runs could both decide
 * the same record is missing and both try to add it.
 */
let seeding: Promise<void> = Promise.resolve()

export function ensureBuiltIns(): Promise<void> {
  seeding = seeding.then(seedMissing, seedMissing)
  return seeding
}

async function seedMissing(): Promise<void> {
  const addMissing = async <T extends { id: string }>(table: Table<T, string>, items: T[]) => {
    const found = await table.bulkGet(items.map((item) => item.id))
    const missing = items.filter((_, index) => !found[index])
    if (missing.length > 0) await table.bulkAdd(missing)
  }
  try {
    // `db.table(name)` returns the loosely typed form of a table, which lets
    // one helper work for all three.
    await addMissing(db.table('exercises'), seedExercises)
    await addMissing(db.table('planDays'), seedPlanDays)
    await addMissing(db.table('settings'), [defaultSettings])
  } catch (error) {
    // Most likely a record arrived from sync between the check and the add.
    // Nothing is lost: the next run fills anything still missing.
    console.warn('Adding built-in records failed; it will be retried.', error)
  }
}

db.on('ready', () => {
  void ensureBuiltIns()
})

if (cloudUrl) {
  db.cloud.events.syncComplete.subscribe(() => {
    void ensureBuiltIns()
  })
}

/**
 * Sign in to cloud sync, without letting a fresh device overwrite your data.
 *
 * WHY THIS EXISTS: on the first sign-in on a device, Dexie Cloud uploads
 * every record already stored there. The app creates a default plan and
 * settings the moment it first opens, so on a new phone those defaults
 * would be uploaded over the plan and settings you already have in the
 * cloud.
 *
 * So, before signing in: if this device holds nothing you created (no
 * logged sets, body weights, or exercises of your own), its built-in
 * records are cleared first. Nothing is uploaded, your saved data
 * downloads, and `ensureBuiltIns` then adds only what the cloud does not
 * have (for a brand-new account, that is everything).
 *
 * If you DID use this device before signing in, its data is kept and
 * uploaded, as Dexie Cloud normally does. Its plan days and settings then
 * replace the ones in the cloud.
 */
export async function signIn(): Promise<void> {
  const user = await db.cloud.currentUser.getValue()
  if (!user.isLoggedIn) {
    const [sets, weights, ownExercises] = await Promise.all([
      db.setLogs.count(),
      db.bodyWeights.count(),
      db.exercises.filter((exercise) => !exercise.id.startsWith('#')).count(),
    ])
    if (sets + weights + ownExercises === 0) {
      // Signed out, so these deletions are local only: Dexie Cloud does not
      // record changes for upload until you are signed in.
      await db.transaction('rw', db.exercises, db.planDays, db.settings, async () => {
        await db.exercises.clear()
        await db.planDays.clear()
        await db.settings.clear()
      })
    }
  }
  try {
    await db.cloud.login()
  } finally {
    // If sign-in was cancelled, put the built-in records straight back.
    await ensureBuiltIns()
  }
}

/** A new globally unique ID for a user-created record. */
export function newId(): string {
  return crypto.randomUUID()
}

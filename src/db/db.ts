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
import type { BodyWeightEntry, Exercise, PlanDay, SetLog, Settings } from './types'

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
 * Runs every time the database opens, not just the first time, so that
 * exercises added to the seed list in a later release show up for existing
 * users. It only ADDS missing records and never overwrites, so your edits to
 * a built-in exercise are kept.
 */
db.on('ready', async () => {
  const addMissing = async <T extends { id: string }>(table: Table<T, string>, items: T[]) => {
    const found = await table.bulkGet(items.map((item) => item.id))
    const missing = items.filter((_, index) => !found[index])
    if (missing.length > 0) await table.bulkAdd(missing)
  }
  // `db.table(name)` returns the loosely typed form of a table, which lets
  // one helper work for all three.
  await addMissing(db.table('exercises'), seedExercises)
  await addMissing(db.table('planDays'), seedPlanDays)
  await addMissing(db.table('settings'), [defaultSettings])
})

/** A new globally unique ID for a user-created record. */
export function newId(): string {
  return crypto.randomUUID()
}

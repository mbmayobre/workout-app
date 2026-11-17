/**
 * Backup: export everything to a JSON file, and import it back.
 *
 * This is independent of cloud sync. It gives you a copy of your data that
 * you hold yourself, and a way to move data without an account.
 */
import { db } from './db'
import type { BodyWeightEntry, Exercise, PlanDay, SetLog, Settings } from './types'

/** Bump this if the backup file layout ever changes, and handle old versions in `importBackup`. */
const BACKUP_VERSION = 1

export interface BackupFile {
  app: 'workout'
  version: number
  exportedAt: string
  exercises: Exercise[]
  planDays: PlanDay[]
  setLogs: SetLog[]
  bodyWeights: BodyWeightEntry[]
  settings: Settings[]
}

/** Read every table into one plain object. */
export async function createBackup(): Promise<BackupFile> {
  return {
    app: 'workout',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    exercises: await db.exercises.toArray(),
    planDays: await db.planDays.toArray(),
    setLogs: await db.setLogs.toArray(),
    bodyWeights: await db.bodyWeights.toArray(),
    settings: await db.settings.toArray(),
  }
}

/** Create a backup and hand it to the browser as a file download. */
export async function downloadBackup(): Promise<void> {
  const backup = await createBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `workout-backup-${backup.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Import a backup file.
 *
 * Import MERGES: records in the file are written over records with the same
 * ID, and anything already in the app that is not in the file is left alone.
 * Nothing is deleted, so importing the same file twice is harmless.
 *
 * Returns the number of records written. Throws an Error with a readable
 * message if the file is not a backup from this app.
 */
export async function importBackup(text: string): Promise<number> {
  let data: Partial<BackupFile>
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  if (data.app !== 'workout' || typeof data.version !== 'number') {
    throw new Error("That file isn't a backup from this app.")
  }
  if (data.version > BACKUP_VERSION) {
    throw new Error('That backup was made by a newer version of the app. Update the app and try again.')
  }

  // Only rows that at least have a string id are accepted.
  const rows = <T extends { id: string }>(value: T[] | undefined): T[] =>
    Array.isArray(value) ? value.filter((row) => row && typeof row.id === 'string') : []

  const exercises = rows(data.exercises)
  const planDays = rows(data.planDays)
  const setLogs = rows(data.setLogs)
  const bodyWeights = rows(data.bodyWeights)
  const settings = rows(data.settings)

  // One transaction: either the whole import succeeds or none of it is saved.
  await db.transaction('rw', [db.exercises, db.planDays, db.setLogs, db.bodyWeights, db.settings], async () => {
    await db.exercises.bulkPut(exercises)
    await db.planDays.bulkPut(planDays)
    await db.setLogs.bulkPut(setLogs)
    await db.bodyWeights.bulkPut(bodyWeights)
    await db.settings.bulkPut(settings)
  })
  return exercises.length + planDays.length + setLogs.length + bodyWeights.length + settings.length
}

/**
 * Settings: units, rest timer behaviour, cloud sync, and backup.
 */
import { useObservable } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { Page } from '../components/Layout'
import { Button, Card, PageHeader, SectionLabel, Segmented, Toggle } from '../components/ui'
import { updateSettings } from '../db/actions'
import { downloadBackup, importBackup } from '../db/backup'
import { db, signIn, syncEnabled } from '../db/db'
import { useSettings } from '../db/hooks'
import type { DistanceUnit, WeightUnit } from '../db/types'
import { formatDuration } from '../lib/units'

export function SettingsPage() {
  const settings = useSettings()

  return (
    <Page>
      <PageHeader title="Settings" />

      <SectionLabel>Units</SectionLabel>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <span>Weight</span>
          <div className="w-40">
            <Segmented<WeightUnit>
              label="Weight unit"
              value={settings.weightUnit}
              onChange={(weightUnit) => updateSettings({ weightUnit })}
              options={[
                { value: 'lb', label: 'lb' },
                { value: 'kg', label: 'kg' },
              ]}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Distance</span>
          <div className="w-40">
            <Segmented<DistanceUnit>
              label="Distance unit"
              value={settings.distanceUnit}
              onChange={(distanceUnit) => updateSettings({ distanceUnit })}
              options={[
                { value: 'km', label: 'km' },
                { value: 'mi', label: 'mi' },
              ]}
            />
          </div>
        </div>
        <p className="text-sm text-soft">
          Switching units only changes what is shown. Your history is converted, never altered.
        </p>
      </Card>

      <SectionLabel>Rest timer</SectionLabel>
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span>Rest between sets</span>
          <div className="flex items-center gap-2">
            <Button onClick={() => updateSettings({ restSeconds: Math.max(15, settings.restSeconds - 15) })}>−15s</Button>
            <span className="digits w-12 text-center text-lg font-semibold">{formatDuration(settings.restSeconds)}</span>
            <Button onClick={() => updateSettings({ restSeconds: Math.min(600, settings.restSeconds + 15) })}>+15s</Button>
          </div>
        </div>
        <Toggle label="Start rest when a set is logged" checked={settings.autoRest} onChange={(autoRest) => updateSettings({ autoRest })} />
        <Toggle label="Beep when a timer ends" checked={settings.sound} onChange={(sound) => updateSettings({ sound })} />
      </Card>

      <SectionLabel>Sync</SectionLabel>
      {syncEnabled ? <SyncCard /> : <SyncNotConfiguredCard />}

      <SectionLabel>Backup</SectionLabel>
      <BackupCard />
    </Page>
  )
}

/** Shown when the app was built without a Dexie Cloud URL. */
function SyncNotConfiguredCard() {
  return (
    <Card>
      <p>Sync isn't set up yet, so your data is stored on this device only.</p>
      <p className="mt-2 text-sm text-soft">
        To turn it on, follow "Set up cloud sync" in docs/DEPLOYMENT.md in the project. Until then, use a backup
        file to protect your data.
      </p>
    </Card>
  )
}

/**
 * Sign-in state and sync status. Only rendered when sync is configured,
 * because `db.cloud` does not exist otherwise.
 */
function SyncCard() {
  // `db.cloud.currentUser` and `syncState` are "observables": values that
  // change over time. `useObservable` re-renders when they do.
  const user = useObservable(db.cloud.currentUser)
  const syncState = useObservable(db.cloud.syncState)
  const [error, setError] = useState('')

  const run = async (action: () => Promise<unknown>) => {
    setError('')
    try {
      await action()
    } catch (problem) {
      // Closing the sign-in dialog rejects the promise; that is not worth an error message.
      if (!(problem instanceof Error) || problem.name === 'AbortError') return
      setError("Couldn't reach the sync service. Check your connection and try again.")
    }
  }

  const STATUS_TEXT: Record<string, string> = {
    'not-started': 'Waiting to sync',
    connecting: 'Connecting…',
    connected: 'Up to date',
    disconnected: 'Offline. Changes are saved here and sync when you are back online.',
    error: "Couldn't sync. It retries automatically.",
    offline: 'Offline. Changes are saved here and sync when you are back online.',
  }

  return (
    <Card>
      {user?.isLoggedIn ? (
        <>
          <p>Signed in as {user.email}</p>
          <p className="mt-1 text-sm text-soft">{STATUS_TEXT[syncState?.status ?? ''] ?? 'Syncing…'}</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => run(() => db.cloud.sync())}>Sync now</Button>
            <Button variant="ghost" onClick={() => run(() => db.cloud.logout())}>
              Sign out
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>Sign in to back up your data and see it on your other devices.</p>
          <p className="mt-1 text-sm text-soft">
            You get a one-time code by email. Your saved data then downloads to this device.
          </p>
          <Button className="mt-3" onClick={() => run(signIn)}>
            Sign in
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}
    </Card>
  )
}

function BackupCard() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return
    try {
      const count = await importBackup(await file.text())
      setFailed(false)
      setMessage(`Imported ${count} records.`)
    } catch (problem) {
      setFailed(true)
      setMessage(problem instanceof Error ? problem.message : "Couldn't read that file.")
    }
    // Clear the input so choosing the same file again still triggers onChange.
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <Card>
      <p className="text-sm text-soft">
        A backup file holds everything: exercises, plan, logged sets, and body weight. Importing merges it with
        what is already here and never deletes anything.
      </p>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => downloadBackup()}>Export backup</Button>
        <Button onClick={() => fileInput.current?.click()}>Import backup</Button>
      </div>
      {/* Hidden real file input; the button above opens it. */}
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => onFileChosen(event.target.files?.[0])}
      />
      {message && (
        <p role={failed ? 'alert' : 'status'} className={failed ? 'mt-2 text-sm text-bad' : 'mt-2 text-sm text-good'}>
          {message}
        </p>
      )}
    </Card>
  )
}

# Deployment

Two separate jobs:

1. **Host the app on Vercel** so you can open it on your phone.
2. **Set up cloud sync** so your data is backed up and appears on all your
   devices.

You can do them in either order. The app works without sync, but until sync
is on, data lives only in the browser of one device, and clearing that
browser's site data would delete it.

---

## 1. Host on Vercel

The app is a static site: `npm run build` produces a `dist/` folder of plain
files. [`vercel.json`](../vercel.json) already tells Vercel how to build and
serve it.

### One-time setup

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Vite. Leave the defaults (build command `npm run build`,
   output directory `dist`) and deploy.

After that, every push to `main` deploys automatically, and every other
branch gets its own preview URL.

### What `vercel.json` does

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

The app handles its own URLs in the browser (`/plan`, `/workout`…). Those
are not real files on the server, so without this rule, reloading the page
on `/plan` would give a 404. The rewrite sends every unknown URL to
`index.html`, and the app then shows the right screen. Real files (scripts,
icons) are still served normally.

### Install it on your phone

Open the Vercel URL on your phone, then:

- **iPhone (Safari):** Share → Add to Home Screen.
- **Android (Chrome):** menu → Install app (or Add to Home screen).

It then opens full-screen from its own icon and works offline.

---

## 2. Set up cloud sync (Dexie Cloud)

Sync uses [Dexie Cloud](https://dexie.org/cloud/). The free tier covers up
to three users, which is enough for personal use. Check
[their pricing page](https://dexie.org/cloud/pricing) for current limits.

### Step 1: create your database

Run this in the project folder:

```bash
npx dexie-cloud create
```

It asks for your email, sends you a one-time code, and creates a database.
It writes two files into the project folder:

| File | Contains | Commit it? |
|---|---|---|
| `dexie-cloud.json` | The database URL | No |
| `dexie-cloud.key` | A client ID and **secret** for administering the database | **Never** |

Both are already listed in `.gitignore`. Keep `dexie-cloud.key` somewhere
safe (a password manager): it is what lets you manage the database from the
command line later.

### Step 2: allow your app's addresses

The database only accepts connections from web addresses you approve. Run
this once for each address the app is served from:

```bash
npx dexie-cloud whitelist http://localhost:5173
```

```bash
npx dexie-cloud whitelist https://YOUR-APP.vercel.app
```

Replace the second one with your real Vercel address. If you add a custom
domain later, whitelist that too. Vercel preview deployments have their own
addresses and will not sync unless you whitelist them as well.

### Step 3: tell the app the database URL

Open `dexie-cloud.json` and copy the URL (it looks like
`https://abc123xyz.dexie.cloud`).

**For local development**, copy `.env.example` to `.env.local` and fill it in:

```
VITE_DEXIE_CLOUD_URL=https://abc123xyz.dexie.cloud
```

Restart `npm run dev` afterwards; environment variables are read at startup.

**For Vercel**, go to the project's **Settings → Environment Variables** and
add `VITE_DEXIE_CLOUD_URL` with the same value, for the Production
environment. Then redeploy (Deployments → the latest one → Redeploy),
because the value is baked into the app when it is built.

The URL is not a secret. It is included in the app's JavaScript, which
anyone can read. Your data is protected by the email sign-in, not by hiding
the URL. The secret is `dexie-cloud.key`, which never leaves your computer.

### Step 4: sign in

In the app: **Settings → Sync → Sign in**. Enter your email, then the code
you are sent. Everything already on the device is uploaded. Do the same on
each other device and your data appears there.

Signing in is once per device. After that, sync runs by itself whenever the
app is open and online.

### How sync behaves

- **Offline:** everything works; changes are stored on the device and sent
  when a connection returns.
- **Two devices changed the same thing:** changes are merged field by field.
  If both changed the same field, the later change wins.
- **Cleared browser data, or a new phone:** open the app, sign in, and your
  data downloads again.
- **Before signing in:** the app is fully usable, with data on that device
  only.

### Using the database from another computer

To manage the same database from a different machine:

```bash
npx dexie-cloud connect https://abc123xyz.dexie.cloud
```

---

## Backups

Independent of sync, **Settings → Backup → Export backup** downloads a JSON
file with everything. **Import backup** merges a file back in: records in
the file overwrite records with the same ID, and nothing else is deleted.

Worth doing occasionally even with sync on, so that you hold a copy that
does not depend on any service.

---

## Troubleshooting

**Settings says "Sync isn't set up yet".**
The app was built without `VITE_DEXIE_CLOUD_URL`. Locally, check
`.env.local` and restart the dev server. On Vercel, check the environment
variable and redeploy.

**Sign-in fails, or sync never completes.**
The address you are using is probably not whitelisted. It must match
exactly, including `https://` and with no trailing slash. Run the
`whitelist` command for it.

**A page reload shows a 404 on Vercel.**
`vercel.json` is missing or was changed. The rewrite rule above is what
makes deep links work.

**The app does not update after a deploy.**
The service worker serves the cached version first and updates in the
background. Close the app completely and open it again.

**Testing offline support locally.**
The service worker is not active under `npm run dev`. Use:

```bash
npm run build
```

```bash
npm run preview
```

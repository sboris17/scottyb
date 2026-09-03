# Build 2: accounts and sync

Build 1 is counting only, on purpose. This is what to do when you want
accounts and a backend, and it is deliberately ordered so nothing breaks your
ability to archive.

Everything here is off by default. With `Enable accounts` unticked, the app
behaves exactly as it does now.

## 1. Supabase project

1. Create a project at supabase.com (free tier is fine).
2. SQL Editor → New query → paste `Packages/PushSync/schema.sql` → Run.
   This creates the tables **and** the row-level security policies. The
   policies are the important half: the anon key ships inside the app and
   grants nothing on its own, so RLS is the only thing keeping one user out
   of another's data.
3. Project Settings → API. Copy the **Project URL** and the **anon public**
   key. Never the `service_role` key — that one bypasses RLS entirely.

```sh
cp App/Resources/Supabase.example.plist App/Resources/Supabase.plist
# fill in both values; Supabase.plist is gitignored
```

## 2. Sign in with Apple

Order matters here. Enabling the entitlement before the capability exists on
the App ID makes archiving fail with a provisioning error.

1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers →
   your App ID → tick **Sign In with Apple** → Save.
2. Supabase dashboard → Authentication → Providers → Apple → enable, and fill
   in your Services ID / Team ID / Key as it prompts.
3. The entitlement is already enabled in `project.yml`, so there is nothing
   to edit — but it only works once step 1 above is saved. Until then every
   build fails with a provisioning error naming the entitlement rather than
   the missing capability.

   If you need to build before setting the capability up, comment it out:

   ```sh
   sed -i '' 's|^        CODE_SIGN_ENTITLEMENTS|        # CODE_SIGN_ENTITLEMENTS|' project.yml
   xcodegen generate
   ```

4. `xcodegen generate`, then in Xcode confirm Signing & Capabilities shows
   Sign in with Apple without a red error.

## 3. Try it

Profile → Testing → **Enable accounts (preview)** → an Account section
appears with the Apple button.

If it is not configured you get a plain explanation rather than a button that
silently does nothing.

## How syncing behaves

One rule decides everything else: **the phone is the source of truth and a
workout is never lost.** Somebody who has just done fifty push-ups in a
basement with no signal has earned that record, and no amount of network
trouble may take it away.

So the local database is written first and unconditionally. Syncing is
something that happens to it afterwards, and a failure to sync is a normal
state rather than an error — the workout stays exactly where it is, still
marked as needing to go.

- A workout is marked synced **only after the server accepts it**, never
  before. Anything unsent is retried later.
- Retries happen when the app comes back to the foreground, when a workout
  finishes, and when you sign in. There is no spinner blocking anything.
- Uploads are upserts keyed on the workout's own id, so a retry after a
  dropped connection updates the same row instead of duplicating a workout.
- Signing in reconciles both ways: everything recorded before the account
  existed goes up, and anything from another device comes down.
- Rows already on the phone are never overwritten by the server. A workout
  log is append-only in practice, so there is nothing to reconcile and
  overwriting could only ever lose something.

Profile shows the state plainly — `Everything synced`, `3 waiting to sync`,
or the reason it failed — with a **Sync now** button. "Waiting to sync" is
deliberately not styled as a warning, because nothing is at risk.

## What is still not built

- Conflict resolution for the same account editing on two devices. Today the
  local copy always wins and remote-only rows are added; that is correct for
  an append-only log and wrong the moment workouts become editable.
- Profile and program enrolment are not synced, only workouts. The tables
  exist in `schema.sql`; nothing writes to `profiles` from the client yet.
- Any social feature. Friends and leaderboards need a second look at the
  schema, not just a sync call.
- None of the sync paths have run against a real Supabase project yet. The
  pieces are unit-tested (`Packages/PushSync`, 18 tests) but the first run
  against live tables is the one that finds the surprises — expect to hit at
  least one, and the failure will be visible in Profile rather than silent.

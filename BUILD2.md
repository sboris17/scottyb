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
3. Only now, uncomment this line in `project.yml`:

   ```yaml
   CODE_SIGN_ENTITLEMENTS: App/Push.entitlements
   ```

4. `xcodegen generate`, then in Xcode confirm Signing & Capabilities shows
   Sign in with Apple without a red error.

## 3. Try it

Profile → Testing → **Enable accounts (preview)** → an Account section
appears with the Apple button.

If it is not configured you get a plain explanation rather than a button that
silently does nothing.

## What exists and what does not

Built and tested (`Packages/PushSync`, 18 tests):

- Apple identity-token exchange with Supabase, including the nonce handling
- Token refresh, transparent and ahead of expiry
- Keychain storage for tokens
- Upsert-based upload and filtered download of workout sessions
- Timestamp decoding that survives Postgres emitting fractional seconds

Not built yet:

- Actually calling `SyncService` after a workout finishes. The client is
  ready; nothing calls it. This is deliberate — it should be written against
  a real project once the tables exist, so the failure modes (offline, an
  expired token, a rejected row) can be exercised rather than guessed at.
- Conflict resolution for the same account on two devices.
- Any social feature. Friends and leaderboards need a second look at the
  schema, not just a sync call.

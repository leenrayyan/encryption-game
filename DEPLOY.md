# Deploying Signal Lock (Netlify + Firebase — free)

The game is a static frontend (hosted on **Netlify**) plus a **Firebase Realtime
Database** that syncs everything live. Both are free forever (Netlify free tier +
Firebase Spark plan, no credit card).

There is **no server to run**. The Screen page (`/screen`) is the "brain": it runs
the game and writes state to Firebase. Keep that page open on the host laptop for
the whole event.

---

## 1. Create the Firebase project (one time, ~3 min)

1. Go to <https://console.firebase.google.com> → **Add project**. Name it anything
   (e.g. `signal-lock`). You can disable Google Analytics.
2. In the left sidebar: **Build → Realtime Database → Create Database**.
   - Pick a location.
   - Start in **test mode** (or set the rules below).
3. Set the database rules (Realtime Database → **Rules** tab) to:

   ```json
   {
     "rules": {
       "sessions": { "$code": { ".read": true, ".write": true } }
     }
   }
   ```

   > These are open (fine for a short one-off event). The database only ever holds
   > transient game state — no personal data, and **answers are never stored in it**.

4. Get your web config: **Project settings (gear) → General → Your apps → Web app
   (`</>`)**. Register an app; Firebase shows a `firebaseConfig` object. Keep it open.

---

## 2. Deploy to Netlify (~3 min)

1. Go to <https://app.netlify.com> → **Add new site → Import an existing project** →
   connect GitHub → pick `leenrayyan/encryption-game`.
2. Netlify reads `netlify.toml` automatically (build command + publish dir are set).
3. Before the first deploy, add **Environment variables**
   (Site configuration → Environment variables → Add) from your `firebaseConfig`:

   | Netlify variable | firebaseConfig field |
   |------------------|----------------------|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_DATABASE_URL` | `databaseURL` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

   > `databaseURL` looks like `https://<project>-default-rtdb.firebaseio.com`. If it
   > isn't in the config snippet, copy it from the Realtime Database page.

4. **Deploy**. You get a URL like `https://your-site.netlify.app`.
   (After changing env vars, trigger a fresh deploy so they're picked up.)

---

## 3. Run the event

- **Host laptop / projector:** open `https://your-site.netlify.app/screen`. It shows a
  QR code + join code. Leave this page open — it runs the game.
- **Players:** scan the QR or go to `.../play`, enter the code, name, and team name.
  First on a team = Operator, second = Cryptographer, alone = Solo.
- Press **Start Mission** once. Rounds auto-advance from there.

---

## Local development / testing (optional)

Uses the Firebase emulator instead of a real project (needs JDK 21+):

```bash
# terminal 1 — emulator
firebase emulators:start --only database --project demo-signal-lock

# terminal 2 — client (client/.env.local already has VITE_USE_EMULATOR=1)
npm run dev:client
```

Open <http://localhost:5173/screen> and <http://localhost:5173/play>.

---

## Notes
- Keep the `/screen` tab open for the whole event — it's the authority. If it
  reloads mid-game, the in-progress round's answers are lost (scores already saved
  are fine). Don't reload it once you've pressed Start.
- Free Firebase allows 100 simultaneous connections — plenty for this event.

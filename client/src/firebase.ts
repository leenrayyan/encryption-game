import { initializeApp } from "firebase/app";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";

// Set VITE_USE_EMULATOR=1 to run against the local Firebase emulator (for dev/
// testing, no real project needed). Otherwise reads the real project config
// from Vite env vars (VITE_FIREBASE_*), set as Netlify environment variables.
const useEmulator = import.meta.env.VITE_USE_EMULATOR === "1";

const config = useEmulator
  ? {
      projectId: "demo-signal-lock",
      databaseURL: "https://demo-signal-lock-default-rtdb.firebaseio.com",
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

const app = initializeApp(config);
export const db = getDatabase(app);

if (useEmulator) {
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
}

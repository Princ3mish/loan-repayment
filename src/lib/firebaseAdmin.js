import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function normaliseEnvString(value) {
  if (!value) return value;
  let s = value.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return s;
}

function getAdminApp() {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const projectId = normaliseEnvString(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = normaliseEnvString(process.env.FIREBASE_CLIENT_EMAIL);
  const rawKey = normaliseEnvString(process.env.FIREBASE_PRIVATE_KEY);
  const privateKey = rawKey ? rawKey.replace(/\\n/g, "\n") : undefined;

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getAdminAuth() {
  const app = getAdminApp();
  return getAuth(app);
}

/* ============================================================================
 * One-time first-admin (Librarian) bootstrap.
 *
 * Creates a Firebase Auth user (or reuses an existing one) and writes the
 * `admin` role document at /roles/{uid}, which the security rules and the app
 * use to authorise the Librarian console. The Admin SDK bypasses Firestore
 * rules, so this is the supported way to create the very first admin.
 *
 * Prerequisites:
 *   1. Create a Firebase project with Firestore and Email/Password auth enabled.
 *   2. Download a service-account key (Project settings -> Service accounts ->
 *      "Generate new private key") and save it as serviceAccountKey.json in the
 *      project root (it is git-ignored), OR point GOOGLE_APPLICATION_CREDENTIALS
 *      at the key file.
 *
 * Usage:
 *   node scripts/createAdmin.js <email> <password>
 *   # or
 *   npm run create-admin -- <email> <password>
 * ========================================================================== */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node scripts/createAdmin.js <email> <password>');
  process.exit(1);
}
if (password.length < 6) {
  console.error('Password must be at least 6 characters (Firebase requirement).');
  process.exit(1);
}

// Initialise the Admin SDK from a local key file or default credentials.
const keyPath = resolve(__dirname, '..', 'serviceAccountKey.json');
if (existsSync(keyPath)) {
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  initializeApp({ credential: applicationDefault() });
} else {
  console.error(
    'No credentials found. Place serviceAccountKey.json in the project root\n' +
      'or set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file.'
  );
  process.exit(1);
}

const auth = getAuth();
const db = getFirestore();

async function main() {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`Reusing existing auth user: ${user.uid}`);
  } catch {
    user = await auth.createUser({ email, password, emailVerified: true });
    console.log(`Created auth user: ${user.uid}`);
  }

  await db.collection('roles').doc(user.uid).set({ role: 'admin', email });
  console.log(`Granted "admin" role to ${email}.`);

  // Seed the settings document if it does not exist.
  const settingsRef = db.collection('settings').doc('app');
  if (!(await settingsRef.get()).exists) {
    await settingsRef.set({
      firmName: 'Izy Global Partners LLP',
      loanPeriodDays: 14,
      renewalLengthDays: 14,
      allowRenewals: true,
    });
    console.log('Seeded default settings.');
  }

  console.log('\nDone. The Librarian can now sign in at /login.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});

/* ============================================================================
 * One-time first-admin (Librarian) bootstrap for the local SQLite backend.
 *
 * Creates (or updates the password of) an admin user. There is no public
 * sign-up; this is the supported way to create the Librarian account.
 *
 * Usage:
 *   npm run create-admin -- <email> <password>
 *   # or
 *   node server/createAdmin.js <email> <password>
 * ========================================================================== */

import bcrypt from 'bcryptjs';
import { db } from './db.js';

const [, , emailArg, password] = process.argv;
if (!emailArg || !password) {
  console.error('Usage: node server/createAdmin.js <email> <password>');
  process.exit(1);
}
if (password.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const hash = bcrypt.hashSync(password, 10);

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE id = ?').run(hash, 'admin', existing.id);
  console.log(`Updated existing admin: ${email}`);
} else {
  db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(email, hash, 'admin');
  console.log(`Created admin: ${email}`);
}

console.log('Done. The Librarian can now sign in at the app login page.');
process.exit(0);

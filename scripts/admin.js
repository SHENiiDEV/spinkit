#!/usr/bin/env node
/**
 * CLI tool for managing SpinKit admin accounts.
 *
 * Usage:
 *   node scripts/admin.js list
 *   node scripts/admin.js create <username> <password> [role]
 *   node scripts/admin.js reset <username> <new_password>
 */
try { if (typeof process.loadEnvFile === 'function') process.loadEnvFile(); } catch {}

const { dbService } = require('../src/db/database');
const { hashPassword } = require('../src/services/security');
const { listAdmins, createAdmin } = require('../src/services/admin');

const [cmd, username, password, role] = process.argv.slice(2);

function help() {
  console.log(`
SpinKit Admin CLI
=================
Usage:
  node scripts/admin.js list
  node scripts/admin.js create <username> <password> [owner|admin|viewer]
  node scripts/admin.js reset  <username> <new_password>
`);
  process.exit(1);
}

if (!cmd || cmd === '--help' || cmd === '-h') help();

if (cmd === 'list') {
  const admins = listAdmins();
  console.log('\n--- Admin Users ---');
  if (!admins.length) {
    console.log('No admin users found.');
  } else {
    for (const a of admins) {
      console.log(`ID: ${a.id} | User: ${a.username.padEnd(16)} | Role: ${a.role.padEnd(8)} | Created: ${a.created_at}`);
    }
  }
  console.log('');
  process.exit(0);
}

if (cmd === 'create') {
  if (!username || !password) {
    console.error('Error: username and password required.');
    help();
  }
  const r = role || 'admin';
  try {
    createAdmin(username, password, r, 'cli');
    console.log(`\n✔ Admin "${username}" created with role "${r}"!\n`);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

if (cmd === 'reset') {
  if (!username || !password) {
    console.error('Error: username and new password required.');
    help();
  }
  if (password.length < 10) {
    console.error('Error: password must be at least 10 characters.');
    process.exit(1);
  }
  const res = dbService.db.prepare('UPDATE admin_users SET pass_hash = ? WHERE username = ?').run(hashPassword(password), username);
  if (!res.changes) {
    console.error(`\n❌ Admin user "${username}" not found.\n`);
    process.exit(1);
  }
  dbService.db.prepare('DELETE FROM admin_sessions WHERE admin_id = (SELECT id FROM admin_users WHERE username = ?)').run(username);
  console.log(`\n✔ Password for "${username}" has been successfully updated!\n`);
  process.exit(0);
}

help();

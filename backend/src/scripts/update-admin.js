#!/usr/bin/env node
/**
 * Script to update admin user password with bcrypt encryption
 * Usage: node update-admin.js <username> <new-password> [db-path]
 */

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.length < 2 || args.length > 3) {
  console.error(
    'Usage: node update-admin.js <username> <new-password> [db-path]',
  );
  process.exit(1);
}

const [username, newPassword, customDbPath] = args;

async function updateAdmin() {
  try {
    let dbPath;

    if (customDbPath) {
      // Use manually specified database path
      if (!fs.existsSync(customDbPath)) {
        console.error(
          `Error: Database file not found at specified path: ${customDbPath}`,
        );
        process.exit(1);
      }
      dbPath = customDbPath;
      console.log(`Using custom database path: ${dbPath}\n`);
    } else {
      // Try default locations
      const dockerPath = '/app/data/plex-guard.db';
      const backendPath = path.join(process.cwd(), 'plex-guard.db');
      const rootPath = path.join(process.cwd(), 'backend', 'plex-guard.db');

      if (fs.existsSync(dockerPath)) {
        dbPath = dockerPath;
      } else if (fs.existsSync(backendPath)) {
        dbPath = backendPath;
      } else if (fs.existsSync(rootPath)) {
        dbPath = rootPath;
      } else {
        console.error('Error: Cannot find database file in default locations.');
        console.error('\nYou can specify a custom path as the third argument:');
        console.error(
          '  node update-admin.js <username> <new-password> <db-path>',
        );
        process.exit(1);
      }
      console.log(`Using database: ${dbPath}\n`);
    }

    //validate password requirements
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};:'",./<>?\\|~])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};:'",./<>?\\|~]{12,128}$/;
    if (!passwordRegex.test(newPassword)) {
      console.error(
        'Error: Password must be 12-128 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.',
      );
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Connect to database
    const db = new sqlite3.Database(dbPath);

    // Update user
    db.run(
      'UPDATE admin_users SET passwordHash = ?, updatedAt = datetime("now") WHERE username = ?',
      [passwordHash, username],
      function (err) {
        if (err) {
          console.error('Error updating user:', err);
          process.exit(1);
        }

        if (this.changes === 0) {
          console.log(`No user found with username: ${username}`);
          process.exit(1);
        }

        console.log(`  Successfully updated password for user: ${username}`);
        console.log(`  Rows affected: ${this.changes}`);

        db.close();
      },
    );
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateAdmin();

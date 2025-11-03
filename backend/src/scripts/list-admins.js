#!/usr/bin/env node
/**
 * Script to list all admin users
 * Usage: node list-admins.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function listAdmins() {
  try {
    const dockerPath = '/app/data/plex-guard.db';
    const backendPath = path.join(process.cwd(), 'plex-guard.db');
    const rootPath = path.join(process.cwd(), 'backend', 'plex-guard.db');
    let dbPath;

    if (fs.existsSync(dockerPath)) {
      dbPath = dockerPath;
    } else if (fs.existsSync(backendPath)) {
      dbPath = backendPath;
    } else if (fs.existsSync(rootPath)) {
      dbPath = rootPath;
    } else {
      console.error('Error: Cannot find database file.');
      process.exit(1);
    }

    console.log(`Using database: ${dbPath}\n`);

    // Connect to database
    const db = new sqlite3.Database(dbPath);

    // Query all admin users
    db.all(
      'SELECT id, username, email, createdAt, updatedAt FROM admin_users ORDER BY createdAt',
      [],
      function (err, rows) {
        if (err) {
          console.error('Error fetching users:', err);
          process.exit(1);
        }

        if (rows.length === 0) {
          console.log('No admin users found.');
          db.close();
          return;
        }

        console.log(`Found ${rows.length} admin user(s):\n`);

        rows.forEach((row, index) => {
          console.log(`[${index + 1}] Admin User`);
          console.log(`    ID:         ${row.id}`);
          console.log(`    Username:   ${row.username}`);
          console.log(`    Email:      ${row.email || 'N/A'}`);
          console.log(`    Created:    ${row.createdAt}`);
          console.log(`    Updated:    ${row.updatedAt}`);
          console.log('');
        });

        db.close();
      },
    );
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listAdmins();

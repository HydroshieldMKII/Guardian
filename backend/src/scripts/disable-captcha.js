#!/usr/bin/env node
/**
 * Script to disable Cloudflare Turnstile captcha
 * Usage: node disable-captcha.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function disableCaptcha() {
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
      console.error('Looked in:');
      console.error('  - ' + dockerPath);
      console.error('  - ' + backendPath);
      console.error('  - ' + rootPath);
      process.exit(1);
    }

    console.log(`Using database: ${dbPath}\n`);

    // Connect to database
    const db = new sqlite3.Database(dbPath);

    // Clear both Turnstile settings
    const settingsToDisable = [
      'CLOUDFLARE_TURNSTILE_SITE_KEY',
      'CLOUDFLARE_TURNSTILE_SECRET_KEY',
    ];

    let updateCount = 0;

    for (const key of settingsToDisable) {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE app_settings SET value = ? WHERE key = ?',
          ['', key],
          function (err) {
            if (err) {
              reject(err);
            } else {
              if (this.changes > 0) {
                console.log(` Cleared ${key}`);
                updateCount++;
              } else {
                console.log(`  ${key} not found in database`);
              }
              resolve();
            }
          },
        );
      });
    }

    db.close();

    console.log(`\n Captcha disabled successfully!`);
  } catch (error) {
    console.error('\n Error:', error);
    process.exit(1);
  }
}

disableCaptcha();

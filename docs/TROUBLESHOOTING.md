# Troubleshooting

**Lost admin access**

```bash
docker compose exec guardian node backend/src/scripts/list-admins.js
docker compose exec guardian node backend/src/scripts/update-admin.js "USERNAME" "NEW_PASSWORD"
```

**Locked out by captcha**

```bash
docker compose exec guardian node backend/src/scripts/disable-captcha.js
```

**Problem after an update**: the data volume keeps `plex-guard.db.pre-migration`, a copy taken
before the last database change. Restore it over `plex-guard.db` and run the previous image tag.

**Cannot connect to Plex**: check that the server is reachable from the container, the token is
valid and the SSL settings match the server.

**Notifications not arriving**: use the test buttons in Settings, then check credentials and spam
filtering.

**Reset emails not arriving**: confirm SMTP works, `APP_URL` is set and the admin account has an
email address.

Otherwise, open an [issue](https://github.com/HydroshieldMKII/Guardian/issues).

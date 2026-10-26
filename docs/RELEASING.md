# Releasing

The git tag is the version. CD builds the image with `GUARDIAN_VERSION=<tag>`.

## Automatic

Every Monday `release.yml` ships the next patch when the last release is at least 13 days old,
something in the image changed, and the repository variable `RELEASE_PAUSED` is not `true`.

It runs full CI, creates the release, smoke-tests the image on amd64 and arm64, pushes `:vX.Y.Z`,
then moves `:latest`, `:vX.Y` and `:vX`. Any failure stops before `:latest` moves.

## Manual

**Actions → Release → Run workflow** on `main` with `bump` (`patch`, `minor`, `major`) and an
optional `prerelease` suffix (`rc.1`). Pre-releases never move `:latest`.

Before a minor or major, merge a PR updating `version` in `backend/package.json`. Builds without
a tag (dev servers, source builds) report that version.

## Rollback

1. **Actions → Release rollback** with the last good tag. It re-points `:latest` and that tag's
   `:vX.Y` and `:vX`.
2. Revert the faulty PR, or the next release ships it again.

Migrations are not undone by a rollback; fix forward.

## Release notes

Grouped by PR label (`.github/release.yml`), set from the PR title prefix. Add `skip-changelog`
to leave a PR out.

## Setup

Secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `CODECOV_TOKEN`.

Labels: `feature`, `enhancement`, `bug`, `security`, `dependencies`, `skip-changelog`, `backend`,
`frontend`, `docker`, `ci`. Branch rules on `main` require the `ci` check.

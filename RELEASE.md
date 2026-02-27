# Release Process

How to cut a new release of ELVES.

## Prerequisites

- Push access to `mvmcode/elves`
- GitHub CLI (`gh`) installed
- Rust toolchain and Node.js 20+ on your machine

## Steps

### 1. Update version numbers

Bump the version in all three locations:

```bash
# src-tauri/Cargo.toml → [package] version
# src-tauri/tauri.conf.json → "version"
# package.json → "version"
```

### 2. Commit the version bump

```bash
git add -A
git commit -m "chore(release): bump version to X.Y.Z"
git push origin main
```

### 3. Create and push a tag

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z — brief description of what changed"
git push origin vX.Y.Z
```

This triggers the `release.yml` workflow which:
- Builds the macOS DMG via `tauri-apps/tauri-action`
- Creates a draft GitHub Release with the DMG attached

### 4. Edit and publish the release

1. Go to [GitHub Releases](https://github.com/mvmcode/elves/releases)
2. Find the draft release for `vX.Y.Z`
3. Review the auto-generated release notes, edit as needed
4. Click **Publish release**

### 5. Update Homebrew cask (when tap is set up)

After the release is published:

```bash
# Get the sha256 of the DMG
shasum -a 256 ELVES_vX.Y.Z_aarch64.dmg

# Update packaging/homebrew/elves.rb with new version and sha256
# Push to the homebrew-tap repo
```

## Auto-Updater

ELVES includes `tauri-plugin-updater` which checks GitHub Releases for new versions. Users on an older version will see an update prompt automatically.

The updater reads from the GitHub Releases API endpoint configured in `tauri.conf.json` under `plugins.updater`.

## CI Pipeline

Every push to `main` and every PR runs the CI pipeline (`.github/workflows/ci.yml`):
- Frontend: lint, typecheck, tests (ubuntu-latest)
- Backend: cargo check, cargo test (macos-latest)

Merging to `main` requires CI to pass.

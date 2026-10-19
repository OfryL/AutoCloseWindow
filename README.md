<img width="1005" height="305" alt="image" src="https://gist.github.com/user-attachments/assets/2bdd7c14-db2a-4ba6-b6f7-7adaa01cb19d" />

# Auto Close Window (autoTabCloser)

A userscript that automatically closes browser windows/tabs when specific text patterns are detected on the page. Useful for OAuth callbacks, AWS SSO windows, and other temporary pages.

## Table of Contents

- [Auto Close Window (autoTabCloser)](#auto-close-window-autotabcloser)
  - [Table of Contents](#table-of-contents)
  - [1. Features](#1-features)
  - [2. Installation](#2-installation)
  - [3. Configuration](#3-configuration)
  - [4. Settings Backup (Gist Sync)](#4-settings-backup-gist-sync)
    - [4.1 One-Time Setup](#41-one-time-setup)
    - [4.2 How Sync Works](#42-how-sync-works)
  - [5. Storage Keys](#5-storage-keys)
  - [6. License](#6-license)
  - [7. Changelog](#7-changelog)

## 1. Features

- Pattern-based detection: closes the tab when any configured text pattern appears on the page
- Countdown overlay before closing, with an optional Abort button
- Configurable detection delay after page load
- Full-screen settings dialog with tabs: Patterns, Config, Advanced, Sync, Credits
- Light/dark/auto theme with a header toggle
- Autosave with save-state indicators
- Settings backup/sync to a secret GitHub Gist (see [Section 4](#4-settings-backup-gist-sync))

## 2. Installation

1. Install a userscript manager (Tampermonkey, Violentmonkey, or Safari Userscripts).
2. Install `autoTabCloser.user.js` from this folder (open the raw file and let the manager pick it up, or paste it into a new script).
3. Accept the requested permissions (storage, `GM_xmlhttpRequest` for gist sync, clipboard).
4. Firefox only: set `dom.allow_scripts_to_close_windows` to `true` in `about:config`, otherwise `window.close()` is blocked.

## 3. Configuration

Open the settings dialog via the userscript manager menu: **Configure Auto-Close Patterns**.

| Tab | Contents |
|---|---|
| Patterns | One text pattern per line; the page closes when any pattern is found (case-insensitive). Reset to defaults available. |
| Config | Debug mode (console logging), show/hide the Abort button during countdown. |
| Advanced | Countdown duration (1-60 s) and detection delay after page load (0-10000 ms). |
| Sync | Settings backup to a secret GitHub Gist (see below). |
| Credits | Version, author, requirements, full changelog. |

## 4. Settings Backup (Gist Sync)

All settings (patterns, debug, countdown, delay, abort button, theme) live only in the userscript manager's storage. The Sync tab backs them up to a **secret GitHub Gist** and keeps multiple browsers/machines in sync.

### 4.1 One-Time Setup

Everything happens inside the Sync tab:

1. Open [github.com/settings/developers](https://github.com/settings/developers) and create a **New OAuth App** (any homepage and callback URL — they are unused).
2. Open the created app and check **Enable Device Flow**. No client secret is needed.
3. Paste the **Client ID** into the Sync tab field.
4. Click **Connect GitHub**: a short code is shown (and copied to the clipboard), github.com/login/device opens, enter the code and authorize the `gist` scope. The token is stored automatically and the first backup pushes immediately.

On a second browser/machine, repeat step 4 only (the Client ID travels with the settings payload's gist once you pull, but pasting it again is also fine) — connecting pulls the existing settings down.

### 4.2 How Sync Works

- **Auto-push**: every settings save schedules a push after a 2 s debounce.
- **Pull on open**: opening the settings dialog pulls the gist first (raced against a 4 s timeout so the dialog never blocks).
- **Last-writer-wins**: each local change stamps an `updatedAt` timestamp; the newer side wins. Manual **Pull Now** refuses to clobber newer local settings.
- **Failure-safe**: sync errors never block local saves. A deleted gist is recreated on the next push; a revoked token shows a "reconnect" hint.
- The payload is a single `autoTabCloser.settings.json` file in the gist; the OAuth token, client ID, and gist id are never included in it.

## 5. Storage Keys

| Key | Purpose |
|---|---|
| `autoCloseStrings` | Detection patterns (string array) |
| `autoCloseDebug` | Debug logging flag |
| `autoCloseCountdown` | Countdown seconds |
| `autoCloseDelay` | Detection delay (ms) |
| `autoCloseShowAbort` | Show Abort button flag |
| `autoCloseTheme` | Theme (`auto`/`light`/`dark`) |
| `autoCloseOauthClientId` | OAuth App Client ID (sync) |
| `autoCloseGistToken` | OAuth access token (sync, never synced) |
| `autoCloseGistId` | Backing gist id (sync) |
| `autoCloseLastSync` | Last successful sync timestamp (display) |
| `autoCloseUpdatedAt` | Last local mutation timestamp (conflict resolution) |

## 6. License

MIT — see the header of `autoTabCloser.user.js`.

## 7. Changelog

### 2026-08-23

- **Added**: Initial README for the script folder
- **Changed**: Script moved from `archive/private/scripts/` into its own `autoTabCloser/` folder
- **Added** (script v1.7): Sync tab — settings backup to a secret GitHub Gist via one-click OAuth device flow (auto-push on save, pull on open, last-writer-wins)

For the full per-version script history, see the Credits tab inside the settings dialog.


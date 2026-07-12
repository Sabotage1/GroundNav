# LLBG GroundNav

LLBG GroundNav is a local airside-operations simulator with four synchronized surfaces:

- **Vehicle app** — an Android/phone interface for receiving, acknowledging and completing tower instructions.
- **Tower console** — a live LLBG fleet map, route composer, STOP/HOLD commands and runway-crossing authorization queue.
- **Pushback control** — Terminal 3 tug/aircraft assignments, startup positions, final headings and reusable routes.
- **Admin editor** — password-protected holding-point, startup-position and pushback-preset editing.

The Mac hosts one Node server on the local network. Every screen uses the same persisted state and receives live updates over WebSockets.

> **Simulation only — not for operational use.** The supplied raster charts are not surveyed or georeferenced. Default holding gates and startup positions were digitized from the images for testing and must be operationally reviewed before any real-world use.

## Run on this Mac

Requirements: Node.js 20+.

```bash
npm install
npm run build
npm start
```

Open:

- Workstation selector: <http://localhost:4173>
- Tower: <http://localhost:4173/tower>
- Pushback: <http://localhost:4173/pushback>
- Admin: <http://localhost:4173/admin>
- Vehicle: <http://localhost:4173/vehicle>

The server binds to `0.0.0.0:4173`. On this Mac's current network it is also reachable at:

```text
http://10.0.0.179:4173
```

The address can change when Wi-Fi changes. Find the current address with:

```bash
ipconfig getifaddr en0
```

If macOS asks whether Node may accept incoming connections, allow it for same-Wi-Fi Android testing.

## Android app

Install the current release-signed APK from the private [GroundNav releases page](https://github.com/Sabotage1/GroundNav/releases/latest). Version 0.2.0 is preconfigured for `http://10.0.0.179:4173`. If the Mac address changes:

1. Start GroundNav on the Mac with `npm start`.
2. Put the Android device on the same Wi-Fi.
3. In the vehicle app, open the vehicle menu → **Mac server**.
4. Enter `http://<current-mac-ip>:4173` and reconnect.

The app also shows a connection setup page automatically if it cannot reach the host.

To rebuild the APK on this Mac:

```bash
VITE_GROUNDNAV_SERVER=http://<current-mac-ip>:4173 npm run android:apk
```

The build uses Capacitor 7 and Java 21. The generated APK is at `android/app/build/outputs/apk/debug/app-debug.apk`.

The web client is also an installable PWA when served through a secure HTTPS origin. Plain LAN HTTP remains useful for UI simulation but browsers generally require HTTPS for PWA installation and geolocation.

## One-click private GitHub updates

The private repository contains a [Build and publish Android update workflow](https://github.com/Sabotage1/GroundNav/actions/workflows/android-release.yml). To publish the next update:

1. Open the repository's **Actions** tab.
2. Select **Build and publish Android update**.
3. Press **Run workflow**. The server URL field is optional.

The workflow automatically increments the latest release's patch version, builds with Java 21, signs the APK with the stable GroundNav release key, verifies it, and publishes the APK plus its SHA-256 file as a private GitHub Release.

In the Android vehicle menu, press **Check for Android update**. GroundNav opens the private repository's latest release in the system browser. Sign in to GitHub if requested, download the APK, and approve Android's update prompt.

The first GitHub-signed build must replace the earlier debug-signed test build: uninstall the debug build once, install the `v0.2.0` APK from GitHub, and all later releases will update in place because they use the same signing certificate.

## Test credentials

```text
Admin password: 1337
```

This is deliberately a test credential. Change `ADMIN_PASSWORD` before exposing the server beyond a private test network.

## Core test flow

1. Open `/tower` on the Mac.
2. Open `/vehicle` on Android and select `OPS 21`.
3. On the tower, select `OPS 21`, press **Draw route**, then click ordered map points.
4. Send the assignment. The vehicle must acknowledge it before starting.
5. If the route crosses a seeded hold gate, the vehicle stops at that segment and requests authorization.
6. Authorize it from the tower's runway-crossing queue.
7. The vehicle confirms the runway is vacated and continues.

For pushback, open `/pushback`, select a tug, aircraft/stand, startup point, allowed final direction and preset or custom route, then transmit it. The same vehicle app switches to pushback mode for the assigned tug.

## Map data

- `public/maps/llbg-airport.png` — supplied full LLBG airport chart.
- `public/maps/terminal-3.png` — supplied Terminal 3 pushback chart.
- 37 red-bar locations are seeded as authorization-required holding gates.
- 24 readable Terminal 3 startup circles are seeded with chart-relative headings.
- Points are stored as normalized `0–100` X/Y image coordinates so overlays remain aligned at every screen size.

Ambiguous holding bars are marked **needs review** in the admin list. Startup positions support any combination of N, NE, E, SE, S, SW, W and NW.

## Persistence and reset

Runtime state is stored in `data/state.json` and survives server restarts. The admin API has a reset operation used by the test suite; deleting `data/state.json` while the server is stopped also restores the seeded state on the next launch.

## Verification commands

```bash
npm test
npm run lint
npm run build
```

The included tests cover route/hold detection, authorization locking and unlocking, pre-hold movement, latched STOP behavior, and multi-direction startup positions.

## Production requirements

Before real airside use, replace the raster charts with authoritative airport GIS/AIP data, add surveyed WGS84 calibration and route graphs, authenticated tower/vehicle identities, encrypted transport, auditable controller roles, redundant positioning/datalink, clearance expiry/revocation rules, formal operational validation, and airport/regulatory approval. Ordinary phone GPS and this prototype must never be used as runway-incursion protection or as a substitute for radio/ATC instructions.

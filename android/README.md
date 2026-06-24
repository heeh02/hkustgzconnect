# hkustgzconnect — Android (Phase 2, planned)

> Status: **skeleton / plan only — not yet a working APK.** Desktop (dmg/exe) is the shipping target today.

Android cannot spawn a helper binary and expose a SOCKS proxy the way the desktop app does. A real
Android client must implement the platform `VpnService` and feed packets to/from the engine. The good
news: **the engine is already published as a gomobile AAR** — `zju-connect-android-aar.zip` in the
[zju-connect releases](https://github.com/Mythologyli/zju-connect/releases) — so we don't re-implement
the Sangfor protocol; we wrap it.

## Architecture
```
┌─────────────── Android app (Kotlin) ───────────────┐
│  UI (login / toggle / port)                          │
│  HkustgzVpnService : android.net.VpnService          │
│     • establishes a TUN (VpnService.Builder)         │
│     • routes 10.0.0.0/8 (campus + HPC 10.120/16)     │
│     • hands the tun fd to the engine                 │
│  zju-connect.aar  (gomobile)  ── EasyConnect login + │
│     tun-mode packet pump (no Rosetta; native arm64)  │
└──────────────────────────────────────────────────────┘
```

## Build path (when we tackle Phase 2)
1. `gomobile bind` is already done upstream → just drop `zju-connect.aar` into `app/libs/`.
2. Kotlin `VpnService` subclass: build a TUN, restrict routes to campus subnets, pass the fd to the
   AAR's tun entrypoint, run login with the same params the desktop uses
   (`server_address=remote.hkust-gz.edu.cn`, `username`, `password`).
3. Minimal UI: account login (stored via Android Keystore / EncryptedSharedPreferences), a connect
   toggle, and a port/route advanced screen.
4. Package APK via Gradle in a separate `android-build.yml` workflow (Android SDK + NDK on CI).

## Why it's deferred
- Requires Android Studio + SDK/NDK + a device/emulator to verify the VPN actually carries traffic —
  **cannot be validated on the build machine in this session**.
- The route/tun handling and battery/standby behaviour need on-device testing to be trustworthy.

Tracking: see the root README "Roadmap".

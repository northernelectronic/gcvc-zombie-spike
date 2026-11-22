# GCVC United Zombie Spike - build notes

One GCVC United hitter at the net, a constant feed of sets, cartoon zombie volleyball players shuffling down 3 lanes.
Swipe at the top of her jump to spike; the swipe direction picks the lane. three.js + Vite, wrapped with Capacitor 8.
App ID: `com.moncada.gcvczombies`  ·  Display name: `Zombie Spike`  ·  Portrait only.

## Layout
- `src/main.js` game loop: waves, zombies, set feed, swipe timing, spikes, power-ups, HUD, menus, quality tiers, test hooks
- `src/athlete.js` skinned characters (Quaternius Universal Base Character + hair, baked kit textures, procedural poses)
- `src/gym.js` procedural gym / court / net / scoreboard / ball · `src/audio.js` synthesized sound · `src/haptics.js` vibration
- `public/woman.glb`, `public/hair-*.glb`, `public/anims.glb` character + clips (made by `tools/prep-ubc.mjs` from the UBC pack)
- `public/kits/*.jpg` baked skin+uniform textures (hitter, setter, 6 zombie kits, normal/roughness) - `tools/bake-kits.py`
- `resources/` icon + splash sources (`tools/make-icons.py`, then `npx @capacitor/assets generate --assetPath resources`)
- `dist/` static web build (relative paths, runs from any folder / GitHub Pages)
- `android/` signed release via `android/keystore.properties` -> `keys/` · `ios/` Capacitor iOS project · `codemagic.yaml` cloud-Mac build -> TestFlight
- `keys/` Android upload keystore `gcvczombies-release.jks` (alias `gcvczombies`) + `keystore-password.txt` (PRIVATE - back up, never publish)
- `shots/` headless-Chrome screenshots · `tools/test.mjs` automated play test (touch swipes via CDP)

## Commands (Linux box)
```
export JAVA_HOME=$HOME/sdk/jdk ANDROID_HOME=$HOME/sdk/android PATH=$HOME/sdk/jdk/bin:$PATH
npm run build && npx cap sync           # web build + copy into native projects
cd android && ./gradlew assembleRelease bundleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk  (copied to GCVCZombieSpike.apk)
# AAB: android/app/build/outputs/bundle/release/app-release.aab (copied to GCVCZombieSpike.aab)
(cd dist && python3 -m http.server 8777) & node tools/test.mjs   # play test + screenshots into shots/
```
URL options: `?quality=high|medium|low` forces a graphics tier (default Auto adapts to frame time) ·
`?slow=0.4` slows game time (used by the test harness) · `?proof=title|play|hit` frozen staged scenes for screenshots.

## Tuning (src/main.js)
- `WIN` timing windows in seconds from the top of the jump (perfect / good / ok). Perfect = 3 damage + knockback, good = 2, ok = 1.
- `ZTYPES` zombie HP / speed / size: walker 2 HP, libero 1 HP fast, blocker 6 HP slow, swatter 3 HP (swats back non-perfect hits), boss every 5th wave.
- `startWave()` wave size (6 + 2 per wave), spawn interval and speed scaling.

## iPhone / TestFlight (no Mac needed)
Codemagic workflow `ios-testflight` in `codemagic.yaml`: needs the Apple Developer Program, an App Store Connect app with
bundle ID `com.moncada.gcvczombies`, and an App Store Connect API key added to Codemagic as `GCVCZombiesASC`.
Put the numeric Apple ID in `APP_STORE_APPLE_ID`, push to `main`, then add Lila's Apple ID as a TestFlight tester.

## Google Play
Create app "GCVC United Zombie Spike", upload `GCVCZombieSpike.aab` (Play App Signing; `keys/` is the upload key). Audience includes
children -> Families policy; the game collects no data (a one-page privacy policy saying so is still required).

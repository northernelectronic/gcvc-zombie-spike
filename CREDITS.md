# GCVC United Zombie Spike - Credits

Game design & code: made for Mike Moncada, Lila and the GCVC United club.

## Club artwork
- GCVC United logo (title screen, centre-court medallion, banners, jersey crest): supplied by the club (Mike Moncada).

## 3D characters & animation
- Characters (hitter, setter and all zombies): **Universal Base Characters** by **Quaternius** (https://quaternius.com) - **CC0 1.0** (public domain).
  Female body, eyes, eyebrows and hair meshes (long, buns, buzzed) from the pack. Uniforms, numbers, crest, zombie skin, bruises,
  rips and glowing eyes are painted onto the texture in code (`tools/bake-kits.py`); the ponytail is procedural.
- Animation clips (idle, jog, run, jump): *Universal Animation Library* by **Quaternius** - **CC0 1.0**.
  Spike cock/swing, zombie shuffle, blocker arms-up and hit reactions are procedural layers in `src/athlete.js`.

## Gym, court, effects
- Original procedural geometry, shaders and canvas textures: court, net, zombie gate, mist, motes, particles, ball machine, volleyball.
- App icon and splash: original, drawn in code (`tools/make-icons.py`).

## Sound
- All sound effects synthesized live with the Web Audio API (`src/audio.js`). No audio files.

## Fonts
- Oswald and Bebas Neue (SIL Open Font License 1.1) via @fontsource. Barlow Condensed (OFL 1.1) for jersey numbers baked into textures.

## Libraries
- three.js (MIT), Vite (MIT), Capacitor + @capacitor/haptics (MIT), glTF-Transform (MIT, asset prep only).

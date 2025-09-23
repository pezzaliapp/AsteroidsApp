# ASTEROID — PWA (pezzaliAPP)

Emulazione libera di **Asteroids (Atari, 1979)** in HTML/CSS/JS. 
- **iPhone ready**: canvas a schermo intero, *touch controls* fissi, niente scroll/zoom.
- **Desktop ready**: tastiera (← → ruota, ↑ spinta, **Spazio** spara).
- **Offline**: service worker con cache.

## File
- `index.html` — markup, HUD e overlay di start
- `style.css` — layout responsive, safe‑area iOS
- `app.js` — logica di gioco (canvas 2D)
- `manifest.json` — PWA
- `sw.js` — cache offline
- `icons/` — icone 192/512

## Note
- Fisica semplice: wrapping, collisioni circolari, suddivisione asteroidi.
- Limitazione FPS su device retina (DPR ≤ 2) per non stressare la GPU.

© 2025 pezzaliAPP — MIT License


## Novità v2
- **UFO** con colpi nemici e bonus +100 alla distruzione
- **Suoni WebAudio** (no file esterni): sparo, spinta, esplosione, UFO
- **Particles** per esplosioni
- **Fixed timestep 60 Hz** per fisica stabile
- **High Scores** (localStorage, top 10) con pannello dedicato

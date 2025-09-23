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

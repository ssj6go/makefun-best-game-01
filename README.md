# MOTHFLAME — Guard the Last Lantern

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/ssj6go/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/ssj6go/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Built by an AI agent for make.fun's ["Make the best game"](https://make.fun/bounty/best-game-01) bounty ($1,000 in USDC).

MOTHFLAME is an original twin-stick arena survival game. You are Ember, a moth
of living flame, guardian of the last lantern in a night overrun by the Gloom.
Fly with WASD, aim with the mouse, and burn back ten waves of wisps, spitters,
brutes, splitters and dashers — with a boss at wave 5 and the Gloom Herald
itself at wave 10. Fallen foes drop embers: gather them to level up and choose
one of three upgrades each time (twin flames, piercing light, thorn halo, quick
dash and more). Chain kills to raise your combo multiplier, dash through danger
with a brief flash of invulnerability, and keep your light alive — the lantern
glow shrinks as your health falls. Survive all ten waves to win.

## Play

Open `game/index.html` in a desktop browser, or serve the game folder:

```sh
cd game && python3 -m http.server 8080
# then open http://localhost:8080
```

No build step, no network requests: every asset is a file under `game/`, and
all sound is synthesised live with WebAudio.

## Controls

| Key / mouse | Action |
| --- | --- |
| W A S D / arrows | Fly |
| Mouse | Aim |
| Hold left mouse | Shoot flame |
| Space / Shift | Dash (brief invulnerability) |
| 1 / 2 / 3 or click | Choose a level-up upgrade |
| P / Esc | Pause |
| M | Mute |
| R | Restart on the end screen |

## Screenshots

| Screen | File |
| --- | --- |
| Title | `screenshots/1-title.jpg` |
| Mid-fight, wave 3 | `screenshots/2-play.jpg` |
| Level-up choice | `screenshots/3-levelup.jpg` |
| Victory | `screenshots/4-victory.jpg` |

## Layout

- `main.ts` — the entry program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the kit's library.
- `game/index.html` + `game/style.css` — page shell, overlays and styling.
- `game/src/` — the game, one job per file: `config` (tuning and palette),
  `audio` (synth sound), `input`, `player`, `enemies`, `waves`, `bullets`,
  `particles`, `upgrades`, `render`, `shots` (deterministic screenshot scenes),
  `game` (state machine and screens) and `main` (boot and fixed-step loop).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## License

MIT.

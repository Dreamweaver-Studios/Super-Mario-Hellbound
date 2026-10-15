# Super Mario Hellbound

A browser run-and-gun platformer by **Dreamweaver Studios**. Mario blasts his way through three levels (the Jungle, the Graveyard and Hell itself) to face the Fire Skull.

## Play

Open `index.html` in a browser. It's a single page with no build step and no dependencies. To serve it locally (needed for sound effects, which browsers won't load from `file://`):

```
python -m http.server
```

then visit <http://localhost:8000>. The game also runs as-is on GitHub Pages.

**Controls:** ← → or A D to move · Space, W or ↑ to jump · ↓ or S to crouch · X or J to shoot (hold for auto) · P pause · R restart level · M sound. On touch screens, on-screen buttons appear.

## Levels

1. **Jungle**: aliens that take 3 shots, moving logs, an elevator to a high ledge.
2. **Graveyard**: reapers that climb out of their graves as you approach.
3. **Hell**: fire-breathing hell beasts in a cave of fire, ending in the Fire Skull boss fight.

## Scoring

| | Points |
|---|---|
| Coin | 10 |
| Ember | 30 |
| 1-up mushroom | 100 |
| Alien or reaper | 200 |
| Hell beast | 300 |
| Fire Skull | 1000 |
| All embers in a level | 500 bonus |
| Level cleared without dying | 200 bonus |
| Level cleared without taking damage | 500 bonus |

Health mushrooms restore 2 HP (blue ones 4 HP) and are worth no points.

## Files

- `index.html`: the whole game: code, levels and styles.
- `sprites/`, `bg/`, `img/`, `music/`, `sfx/`: every image and sound it loads.
- `levelcheck.js`: checks level layouts for misplaced coins, enemies and blocks: `node levelcheck.js index.html`

## Credits

- **Music composed by Bert Cole**: [bitbybitsound.com](https://bitbybitsound.com)
- **Sprites and environments:** Goldenfrank0 (DeviantArt), ansimuz (itch.io: Gothicvania, Warped), Anokolisa (itch.io: Hero's Journey), Jesse Munguia (itch.io: Jungle Asset Pack)
- **Sound effects:** beetpro, Fronbondi_Skegs, freesound_community and Universfield on Pixabay

Super Mario is a trademark of Nintendo. This is a non-commercial fan game.

#ifndef LEVEL_TYPES_H
#define LEVEL_TYPES_H

#include <stdint.h>

// Shapes of the generated level data (world pixels, origin at the level's top-left)
struct point { int x; int y; };
struct mush_def { int x; int y; bool blue; };
struct enemy_def { int x; int y; int w; int h; int a; int b; int kind; };  // a..b = patrol range of e.x; kind: -1 = the level's foe, else a FOE_ (main.cpp)
struct mover_def { int x0; int y0; int x1; int y1; int w; int period; };
struct check_def { int x; int y; int row; };

// Everything about one level. foe: 0 alien, 1 reaper, 2 hell beast. theme: 0 jungle, 1 graveyard, 2 hell (backdrops,
// music, darkness; the GBA-only World 1-2 to 1-4 are jungle). A boss level has no door until the boss dies.
struct level_info
{
    const char* name;
    int width, bg_width, foe, theme;
    const uint8_t* grid;
    const point* coins; int coins_n;
    const point* embers; int embers_n;
    const mush_def* mushrooms; int mushrooms_n;
    const point* oneup_blocks; int oneup_blocks_n;
    const enemy_def* enemies; int enemies_n;
    const mover_def* movers; int movers_n;
    const check_def* checks; int checks_n;
    point start;
    bool has_door; point door;
    bool has_boss; int boss_gate; point boss_door;
    int block_coins;   // coins in each cracked block
    point star_block;  // the cracked block holding the level's star (tiles; one per level, 2026-10-18)
    point flame_item;  // where the flamethrower pickup stands (tiles), or {-1, -1}: World 1-1 only (2026-10-18)
    point rocket_item; // where the rocket launcher pickup stands (tiles), or {-1, -1}: World 1-2 only (2026-10-19)
};

#endif

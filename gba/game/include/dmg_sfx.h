#ifndef DMG_SFX_H
#define DMG_SFX_H

// Chiptune blips on the GBA's own sound channels, standing in for the web game's Web Audio tone() calls.
// Square tones use channels 1 and 2; triangle and sawtooth tones use the wave channel (3).
namespace dmg_sfx
{
    enum class wave { square, triangle, sawtooth };

    void init();

    // Plays a tone that slides from freq to freq2 (0 = no slide) over `frames` frames, after `delay` frames.
    // volume is the web game's gain (around 0.02-0.06); it is mapped onto the GBA's 0-15 envelope.
    void tone(int freq, int frames, wave type, int freq2, int volume_permille, int delay = 0);

    void update();  // call once per frame
    void stop_all();
}

#endif

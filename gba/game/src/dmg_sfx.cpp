#include "dmg_sfx.h"

#include <stdint.h>

namespace dmg_sfx
{

namespace
{
    // Sound registers (GBATEK names)
    volatile uint16_t& SOUND1CNT_L = *reinterpret_cast<volatile uint16_t*>(0x04000060);
    volatile uint16_t& SOUND1CNT_H = *reinterpret_cast<volatile uint16_t*>(0x04000062);
    volatile uint16_t& SOUND1CNT_X = *reinterpret_cast<volatile uint16_t*>(0x04000064);
    volatile uint16_t& SOUND2CNT_L = *reinterpret_cast<volatile uint16_t*>(0x04000068);
    volatile uint16_t& SOUND2CNT_H = *reinterpret_cast<volatile uint16_t*>(0x0400006C);
    volatile uint16_t& SOUND3CNT_L = *reinterpret_cast<volatile uint16_t*>(0x04000070);
    volatile uint16_t& SOUND3CNT_H = *reinterpret_cast<volatile uint16_t*>(0x04000072);
    volatile uint16_t& SOUND3CNT_X = *reinterpret_cast<volatile uint16_t*>(0x04000074);
    volatile uint16_t& SOUNDCNT_L = *reinterpret_cast<volatile uint16_t*>(0x04000080);
    volatile uint16_t& SOUNDCNT_H = *reinterpret_cast<volatile uint16_t*>(0x04000082);
    volatile uint16_t& SOUNDCNT_X = *reinterpret_cast<volatile uint16_t*>(0x04000084);
    volatile uint32_t* const WAVE_RAM = reinterpret_cast<volatile uint32_t*>(0x04000090);

    struct note
    {
        int freq;       // Hz << 8
        int freq_end;   // Hz << 8
        float f;        // current frequency (Hz) while sliding
        float mult;     // per-frame ratio: f * mult^frames = freq_end
        int frames;
        int age;
        int delay;
        int channel;    // 1, 2 or 3; 0 = free slot
        wave type;
        int volume;     // 0..15
    };

    constexpr int max_notes = 16;
    note notes[max_notes];
    int next_square = 0;
    wave loaded_wave = wave::square;   // what's in wave RAM (square = nothing yet)

    void load_wave(wave type)
    {
        if(loaded_wave == type)
        {
            return;
        }

        // Stop channel 3, select bank 1 for playback so the CPU writes bank 0, write 32 4-bit samples
        SOUND3CNT_L = 0x40;
        uint8_t samples[32];

        for(int i = 0; i < 32; ++i)
        {
            if(type == wave::triangle)
            {
                samples[i] = uint8_t(i < 16 ? i : 31 - i);
            }
            else
            {
                samples[i] = uint8_t(i / 2);
            }
        }

        for(int i = 0; i < 4; ++i)
        {
            uint32_t word = 0;

            for(int b = 0; b < 4; ++b)
            {
                int s = i * 8 + b * 2;
                word |= uint32_t((samples[s] << 4) | samples[s + 1]) << (b * 8);
            }

            WAVE_RAM[i] = word;
        }

        loaded_wave = type;
    }

    // Square channels: rate = 2048 - 131072 / f
    int square_rate(int freq8)
    {
        int f = freq8 >> 8;

        if(f < 64)
        {
            f = 64;
        }

        int rate = 2048 - 131072 / f;
        return rate < 0 ? 0 : rate > 2047 ? 2047 : rate;
    }

    // Wave channel: a 32-sample wave plays at 65536 / (2048 - rate) Hz
    int wave_rate(int freq8)
    {
        int f = freq8 >> 8;

        if(f < 32)
        {
            f = 32;
        }

        int rate = 2048 - 65536 / f;
        return rate < 0 ? 0 : rate > 2047 ? 2047 : rate;
    }

    // n-th root of r (r > 0) by bisection, for the per-frame slide ratio
    float nth_root(float r, int n)
    {
        float lo = r < 1 ? r : 1, hi = r < 1 ? 1 : r;

        for(int i = 0; i < 24; ++i)
        {
            float mid = (lo + hi) / 2, p = 1;

            for(int k = 0; k < n; ++k)
            {
                p *= mid;
            }

            (p < r ? lo : hi) = mid;
        }

        return (lo + hi) / 2;
    }

    void start(note& n)
    {
        int vol = n.volume;
        // Envelope: decrease one step every `step` 64ths of a second, so it fades out over roughly the note's length
        int step = (n.frames * 64) / (60 * (vol > 0 ? vol : 1));
        step = step < 1 ? 1 : step > 7 ? 7 : step;

        if(n.channel == 1)
        {
            SOUND1CNT_L = 0x0008;   // no sweep
            SOUND1CNT_H = uint16_t((vol << 12) | (step << 8) | (2 << 6));   // 50% duty, envelope down
            SOUND1CNT_X = uint16_t(0x8000 | square_rate(n.freq));
        }
        else if(n.channel == 2)
        {
            SOUND2CNT_L = uint16_t((vol << 12) | (step << 8) | (2 << 6));
            SOUND2CNT_H = uint16_t(0x8000 | square_rate(n.freq));
        }
        else
        {
            load_wave(n.type);
            SOUND3CNT_L = 0x80;   // enabled, playing bank 0
            SOUND3CNT_H = uint16_t(vol >= 10 ? 0x2000 : vol >= 5 ? 0x4000 : 0x6000);   // 100% / 50% / 25%
            SOUND3CNT_X = uint16_t(0x8000 | wave_rate(n.freq));
        }
    }

    void silence(int channel)
    {
        if(channel == 1)
        {
            SOUND1CNT_H = 0;
            SOUND1CNT_X = 0x8000;
        }
        else if(channel == 2)
        {
            SOUND2CNT_L = 0;
            SOUND2CNT_H = 0x8000;
        }
        else if(channel == 3)
        {
            SOUND3CNT_L = 0;
        }
    }
}

void init()
{
    SOUNDCNT_X = SOUNDCNT_X | 0x80;   // master sound on (Maxmod also needs it)
    // DMG channels 1-3 to both speakers at full DMG volume
    SOUNDCNT_L = uint16_t(0x7700 | (0x7 << 4) | 0x7);
    SOUNDCNT_H = uint16_t((SOUNDCNT_H & ~0x3) | 0x2);

    for(note& n : notes)
    {
        n.channel = 0;
    }
}

void tone(int freq, int frames, wave type, int freq2, int volume_permille, int delay)
{
#if defined(SMHB_NO_DMG) || defined(SMHB_NO_SFX)
    return;   // diagnostic ROM (build.ps1 -Variant): no synth tones
#endif
    note* slot = nullptr;

    for(note& n : notes)
    {
        if(! n.channel)
        {
            slot = &n;
            break;
        }
    }

    if(! slot)
    {
        return;
    }

    slot->freq = freq << 8;
    slot->freq_end = freq2 << 8;
    slot->frames = frames < 1 ? 1 : frames;
    slot->age = -1;
    slot->delay = delay;
    slot->type = type;
    // web gain 0.06 -> full volume, then 3/4 of that: the sound effects were turned down at the user's request
    int vol = (volume_permille * 15 * 3 / 4 + 30) / 60;
    slot->volume = vol < 2 ? 2 : vol > 15 ? 15 : vol;

    if(type == wave::square)
    {
        slot->channel = 1 + (next_square++ & 1);
    }
    else
    {
        slot->channel = 3;
    }
}

void update()
{
    for(note& n : notes)
    {
        if(! n.channel)
        {
            continue;
        }

        if(n.delay > 0)
        {
            --n.delay;
            continue;
        }

        if(n.age < 0)
        {
            // A newer note on the same channel takes it over
            for(note& other : notes)
            {
                if(&other != &n && other.channel == n.channel && other.age >= 0)
                {
                    other.channel = 0;
                }
            }

            n.age = 0;

            if(n.freq_end)
            {
                // Exponential slide, like Web Audio's exponentialRampToValueAtTime
                n.f = float(n.freq >> 8);
                n.mult = nth_root(float(n.freq_end) / float(n.freq), n.frames);
            }

            start(n);
            continue;
        }

        ++n.age;

        if(n.age >= n.frames + 2)
        {
            silence(n.channel);
            n.channel = 0;
            continue;
        }

        if(n.freq_end && n.age <= n.frames)
        {
            n.f *= n.mult;
            int f = int(n.f * 256);

            if(n.channel == 1)
            {
                SOUND1CNT_X = uint16_t(square_rate(f));
            }
            else if(n.channel == 2)
            {
                SOUND2CNT_H = uint16_t(square_rate(f));
            }
            else
            {
                SOUND3CNT_X = uint16_t(wave_rate(f));
            }
        }
    }
}

void stop_all()
{
    for(note& n : notes)
    {
        if(n.channel)
        {
            silence(n.channel);
            n.channel = 0;
        }
    }
}

}

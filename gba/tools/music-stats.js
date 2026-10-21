// Loudness profile of each level track: peak, RMS, high percentiles, and how much of the 8-bit range the music uses
// after the build's peak normalisation (low "8-bit RMS steps" means quiet music buried in quantisation noise).
const fs = require('fs'), path = require('path');
(async () => {
  const { MPEGDecoder } = require('mpg123-decoder');
  for (const f of ['battle-with-beasts', 'temple-of-tomb', 'spiders-grotto', 'final-showdown']) {
    const dec = new MPEGDecoder(); await dec.ready;
    const r = dec.decode(new Uint8Array(fs.readFileSync(path.resolve(__dirname, '../../music', f + '.mp3')))); dec.free();
    const ch = r.channelData, n = ch[0].length, mono = new Float32Array(n);
    for (let i = 0; i < n; i++) mono[i] = (ch[0][i] + (ch[1] || ch[0])[i]) / 2;
    let peak = 0, sq = 0; const abs = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = Math.abs(mono[i]); abs[i] = a; peak = Math.max(peak, a); sq += mono[i] * mono[i]; }
    const rms = Math.sqrt(sq / n); abs.sort();
    const pct = q => abs[Math.floor(q * (n - 1))];
    // Quiet passages: RMS of the quietest 25% of one-second windows
    const win = r.sampleRate, wins = []; for (let s = 0; s + win <= n; s += win) { let w = 0; for (let i = s; i < s + win; i++) w += mono[i] * mono[i]; wins.push(Math.sqrt(w / win)); }
    wins.sort((a, b) => a - b); const quiet = wins[Math.floor(wins.length * 0.25)];
    console.log(`${f.padEnd(20)} ${(n / r.sampleRate).toFixed(0)}s @${r.sampleRate}  peak ${peak.toFixed(2)}  99.9% ${pct(0.999).toFixed(2)}  rms ${rms.toFixed(3)}  crest ${(peak / rms).toFixed(1)}  ` +
      `8-bit rms steps ${(rms / peak * 127).toFixed(1)}  quiet-25% steps ${(quiet / peak * 127).toFixed(1)}`);
  }
})();

// Decodes .ogg (Vorbis) files the way build-assets.js does and reports what comes back.
//   node tools\test-ogg.js <file.ogg> [more.ogg ...]
const fs = require('fs'), path = require('path');
(async () => {
  const { OggVorbisDecoder } = await import('@wasm-audio-decoders/ogg-vorbis');
  for (const f of process.argv.slice(2)) {
    const buf = fs.readFileSync(path.resolve(f));
    const dec = new OggVorbisDecoder(); await dec.ready;
    try {
      const r = await dec.decodeFile(new Uint8Array(buf));
      let peak = 0; for (const c of r.channelData) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
      console.log(`${path.basename(f)}: ${buf.length} bytes -> ${r.samplesDecoded} samples @ ${r.sampleRate} Hz ` +
        `(${(r.samplesDecoded / r.sampleRate).toFixed(1)}s), ${r.channelData.length} ch, peak ${peak.toFixed(3)}, errors ${r.errors ? r.errors.length : 0}`);
    } catch (e) { console.log(`${path.basename(f)}: threw ${e.message}`); }
    dec.free();
  }
})();

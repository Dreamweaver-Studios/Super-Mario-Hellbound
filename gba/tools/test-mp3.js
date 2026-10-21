// Tries decoding each sound effect MP3 with a fresh decoder and reports what comes back.
const fs = require('fs'), path = require('path');
(async () => {
  const { MPEGDecoder } = require('mpg123-decoder');
  for (const f of ['sfx/jump.mp3', 'sfx/machine-gun.mp3', 'sfx/coin.mp3', 'sfx/death.mp3']) {
    const buf = fs.readFileSync(path.resolve(__dirname, '../..', f));
    const dec = new MPEGDecoder(); await dec.ready;
    try {
      const r = dec.decode(new Uint8Array(buf));
      console.log(`${f}: ${buf.length} bytes -> ${r.samplesDecoded} samples @ ${r.sampleRate} Hz, ${r.channelData.length} ch, errors ${r.errors ? r.errors.length : 0}; head ${buf.slice(0, 4).toString('hex')}`);
    } catch (e) { console.log(`${f}: threw ${e.message}`); }
    dec.free();
  }
})();

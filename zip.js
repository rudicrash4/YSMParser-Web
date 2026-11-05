/* Small dependency-free ZIP writer (store/no compression), for browser output files. */
(() => {
  const encoder = new TextEncoder();
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((date.getSeconds() >> 1) & 31),
      date: (((year - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31)
    };
  }
  function header(size) { return new Uint8Array(size); }
  function write16(view, offset, value) { view.setUint16(offset, value, true); }
  function write32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
  window.createZipBlob = function(files) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const stamp = dosDateTime();
    for (const file of files) {
      const name = encoder.encode(file.name.replace(/\\/g, '/'));
      const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
      const crc = crc32(data);
      const local = header(30 + name.length);
      const lv = new DataView(local.buffer);
      write32(lv, 0, 0x04034B50); write16(lv, 4, 20); write16(lv, 6, 0x0800);
      write16(lv, 8, 0); write16(lv, 10, stamp.time); write16(lv, 12, stamp.date);
      write32(lv, 14, crc); write32(lv, 18, data.length); write32(lv, 22, data.length);
      write16(lv, 26, name.length); write16(lv, 28, 0);
      local.set(name, 30);
      chunks.push(local, data);

      const entry = header(46 + name.length);
      const cv = new DataView(entry.buffer);
      write32(cv, 0, 0x02014B50); write16(cv, 4, 20); write16(cv, 6, 20);
      write16(cv, 8, 0x0800); write16(cv, 10, 0); write16(cv, 12, stamp.time); write16(cv, 14, stamp.date);
      write32(cv, 16, crc); write32(cv, 20, data.length); write32(cv, 24, data.length);
      write16(cv, 28, name.length); write16(cv, 30, 0); write16(cv, 32, 0);
      write16(cv, 34, 0); write16(cv, 36, 0); write32(cv, 38, 0); write32(cv, 42, offset);
      entry.set(name, 46); central.push(entry);
      offset += local.length + data.length;
    }
    const centralOffset = offset;
    let centralSize = 0;
    for (const entry of central) { chunks.push(entry); centralSize += entry.length; }
    const end = header(22);
    const ev = new DataView(end.buffer);
    write32(ev, 0, 0x06054B50); write16(ev, 4, 0); write16(ev, 6, 0);
    write16(ev, 8, central.length); write16(ev, 10, central.length);
    write32(ev, 12, centralSize); write32(ev, 16, centralOffset); write16(ev, 20, 0);
    chunks.push(end);
    return new Blob(chunks, { type: 'application/zip' });
  };
})();

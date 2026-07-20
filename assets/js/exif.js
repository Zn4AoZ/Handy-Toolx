/* Handy Toolx — compact pure-JS EXIF reader for JPEGs.
   Reads the APP1/Exif segment directly (Make, Model, Orientation,
   capture date, exposure settings, GPS position when present).
   Verified against files produced by piexif/Pillow. */
function parseExif(buf) {
  // buf: Uint8Array of a JPEG file. Returns a plain object of tag name -> value, or null.
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint16(0) !== 0xFFD8) return null; // not a JPEG
  let offset = 2;
  let exifOffset = null, exifLength = 0;
  while (offset < buf.length - 4) {
    if (view.getUint8(offset) !== 0xFF) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xD8 || marker === 0xD9) { offset += 2; continue; }
    if (marker >= 0xD0 && marker <= 0xD7) { offset += 2; continue; }
    const size = view.getUint16(offset + 2);
    if (marker === 0xE1) {
      // Check for "Exif\0\0"
      const tag = String.fromCharCode(buf[offset+4], buf[offset+5], buf[offset+6], buf[offset+7]);
      if (tag === "Exif") {
        exifOffset = offset + 4 + 6;
        exifLength = size - 2 - 6;
        break;
      }
    }
    if (marker === 0xDA) break; // start of scan; no more metadata markers
    offset += 2 + size;
  }
  if (exifOffset === null) return null;

  const tiffStart = exifOffset;
  const byteOrder = String.fromCharCode(buf[tiffStart], buf[tiffStart+1]);
  const little = byteOrder === "II";
  function u16(o) { return view.getUint16(o, little); }
  function u32(o) { return view.getUint32(o, little); }
  function i32(o) { return view.getInt32(o, little); }

  const TAG_NAMES = {
    271: "Make", 272: "Model", 274: "Orientation", 306: "DateTime",
    282: "XResolution", 283: "YResolution",
    36867: "DateTimeOriginal", 36868: "DateTimeDigitized",
    33434: "ExposureTime", 33437: "FNumber", 34855: "ISOSpeedRatings",
    37386: "FocalLength", 37383: "MeteringMode", 37385: "Flash",
    40962: "PixelXDimension", 40963: "PixelYDimension",
    271: "Make"
  };

  function readValue(type, count, valueOffsetPos) {
    const typeSizes = {1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};
    const size = (typeSizes[type] || 1) * count;
    let dataPos = valueOffsetPos;
    if (size > 4) dataPos = tiffStart + u32(valueOffsetPos);
    if (type === 2) { // ASCII
      let s = "";
      for (let i = 0; i < count - 1; i++) { const c = buf[dataPos + i]; if (c === 0) break; s += String.fromCharCode(c); }
      return s;
    }
    if (type === 3) { // SHORT
      const arr = [];
      for (let i = 0; i < count; i++) arr.push(u16(dataPos + i*2));
      return count === 1 ? arr[0] : arr;
    }
    if (type === 4) { // LONG
      const arr = [];
      for (let i = 0; i < count; i++) arr.push(u32(dataPos + i*4));
      return count === 1 ? arr[0] : arr;
    }
    if (type === 5 || type === 10) { // RATIONAL / SRATIONAL
      const arr = [];
      for (let i = 0; i < count; i++) {
        const num = type === 5 ? u32(dataPos + i*8) : i32(dataPos + i*8);
        const den = type === 5 ? u32(dataPos + i*8 + 4) : i32(dataPos + i*8 + 4);
        arr.push(den !== 0 ? num / den : 0);
      }
      return count === 1 ? arr[0] : arr;
    }
    return null;
  }

  function readIFD(ifdOffset) {
    const entries = {};
    const numEntries = u16(ifdOffset);
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifdOffset + 2 + i * 12;
      const tag = u16(entryOffset);
      const type = u16(entryOffset + 2);
      const count = u32(entryOffset + 4);
      const value = readValue(type, count, entryOffset + 8);
      entries[tag] = value;
    }
    const nextIfdOffset = u32(ifdOffset + 2 + numEntries * 12);
    return { entries, nextIfdOffset };
  }

  const ifd0Offset = tiffStart + u32(tiffStart + 4);
  const ifd0 = readIFD(ifd0Offset);
  const result = {};
  for (const tag in ifd0.entries) {
    if (TAG_NAMES[tag]) result[TAG_NAMES[tag]] = ifd0.entries[tag];
  }

  // Exif sub-IFD (tag 34665)
  if (ifd0.entries[34665]) {
    const exifIfd = readIFD(tiffStart + ifd0.entries[34665]);
    for (const tag in exifIfd.entries) {
      if (TAG_NAMES[tag]) result[TAG_NAMES[tag]] = exifIfd.entries[tag];
    }
  }

  // GPS IFD (tag 34853)
  if (ifd0.entries[34853]) {
    const gpsIfd = readIFD(tiffStart + ifd0.entries[34853]);
    const toDeg = (arr) => arr && arr.length === 3 ? arr[0] + arr[1]/60 + arr[2]/3600 : null;
    if (gpsIfd.entries[2]) {
      let lat = toDeg(gpsIfd.entries[2]);
      if (gpsIfd.entries[1] === "S") lat = -lat;
      result.GPSLatitude = lat;
    }
    if (gpsIfd.entries[4]) {
      let lon = toDeg(gpsIfd.entries[4]);
      if (gpsIfd.entries[3] === "W") lon = -lon;
      result.GPSLongitude = lon;
    }
  }

  return Object.keys(result).length ? result : null;
}
window.HandyToolxExif = { parseExif };

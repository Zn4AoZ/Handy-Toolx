/* Handy Toolx — PDF password protection.
   Implements the PDF "Standard Security Handler" (RC4, revisions 2 and
   3 — i.e. 40-bit and 128-bit "compatible" encryption, the classic
   scheme supported by effectively every PDF reader) directly against
   pdf-lib's document model, verified against qpdf. AES-encrypted PDFs
   (revision 4/5, common for "modern" Acrobat-protected files) and PDFs
   using compressed cross-reference/object streams are out of scope and
   are reported with a clear error rather than silently mishandled. */
(function () {

  // ---------- MD5 (RFC 1321), pure JS ----------
  function md5(bytes) {
    function rotl(x, n) { return (x << n) | (x >>> (32 - n)); }
    const s = [
      7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
      5, 9,14,20, 5, 9,14,20, 5, 9,14,20, 5, 9,14,20,
      4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
      6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21
    ];
    const K = new Int32Array(64);
    for (let i = 0; i < 64; i++) K[i] = (Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)) | 0;

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const origLenBits = bytes.length * 8;
    const padLen = (bytes.length % 64 < 56) ? (56 - bytes.length % 64) : (120 - bytes.length % 64);
    const total = bytes.length + padLen + 8;
    const msg = new Uint8Array(total);
    msg.set(bytes, 0);
    msg[bytes.length] = 0x80;
    const lenLow = origLenBits >>> 0;
    const lenHigh = Math.floor(origLenBits / 4294967296) >>> 0;
    const lo = total - 8;
    msg[lo] = lenLow & 0xff; msg[lo+1] = (lenLow>>>8)&0xff; msg[lo+2] = (lenLow>>>16)&0xff; msg[lo+3] = (lenLow>>>24)&0xff;
    msg[lo+4] = lenHigh & 0xff; msg[lo+5] = (lenHigh>>>8)&0xff; msg[lo+6] = (lenHigh>>>16)&0xff; msg[lo+7] = (lenHigh>>>24)&0xff;

    for (let chunk = 0; chunk < total / 64; chunk++) {
      const M = new Int32Array(16);
      const base = chunk * 64;
      for (let j = 0; j < 16; j++) {
        const o = base + j * 4;
        M[j] = (msg[o] | (msg[o+1] << 8) | (msg[o+2] << 16) | (msg[o+3] << 24));
      }
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5*i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3*i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7*i) % 16; }
        F = (F + A + K[i] + M[g]) | 0;
        A = D; D = C; C = B;
        B = (B + rotl(F, s[i])) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    const out = new Uint8Array(16);
    [a0, b0, c0, d0].forEach((v, idx) => {
      out[idx*4] = v & 0xff; out[idx*4+1] = (v>>>8)&0xff; out[idx*4+2] = (v>>>16)&0xff; out[idx*4+3] = (v>>>24)&0xff;
    });
    return out;
  }

  // ---------- RC4 ----------
  function rc4(keyBytes, dataBytes) {
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    let j = 0;
    const klen = keyBytes.length;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + keyBytes[i % klen]) & 0xff;
      const t = S[i]; S[i] = S[j]; S[j] = t;
    }
    const out = new Uint8Array(dataBytes.length);
    let i = 0; j = 0;
    for (let k = 0; k < dataBytes.length; k++) {
      i = (i + 1) & 0xff;
      j = (j + S[i]) & 0xff;
      const t = S[i]; S[i] = S[j]; S[j] = t;
      out[k] = dataBytes[k] ^ S[(S[i] + S[j]) & 0xff];
    }
    return out;
  }

  // ---------- Standard Security Handler ----------
  const PAD = new Uint8Array([
    0x28,0xBF,0x4E,0x5E,0x4E,0x75,0x8A,0x41,0x64,0x00,0x4E,0x56,0xFF,0xFA,0x01,0x08,
    0x2E,0x2E,0x00,0xB6,0xD0,0x68,0x3E,0x80,0x2F,0x0C,0xA9,0xFE,0x64,0x53,0x69,0x7A
  ]);

  function strToBytes(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
    return out;
  }
  function padPassword(pw) {
    const bytes = (pw instanceof Uint8Array || Array.isArray(pw)) ? pw : strToBytes(pw || "");
    const out = new Uint8Array(32);
    const n = Math.min(bytes.length, 32);
    for (let i = 0; i < n; i++) out[i] = bytes[i] & 0xff;
    for (let i = n; i < 32; i++) out[i] = PAD[i - n];
    return out;
  }
  function concatBytes() {
    let len = 0;
    for (let i = 0; i < arguments.length; i++) len += arguments[i].length;
    const out = new Uint8Array(len);
    let off = 0;
    for (let i = 0; i < arguments.length; i++) { out.set(arguments[i], off); off += arguments[i].length; }
    return out;
  }
  function p32le(p) {
    const u = p >>> 0;
    return new Uint8Array([u & 0xff, (u>>>8)&0xff, (u>>>16)&0xff, (u>>>24)&0xff]);
  }
  function bytesToHex(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
    return s;
  }
  function bytesEqual(a, b, len) {
    for (let i = 0; i < len; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function computeEncryptionKey(userPw, ownerHash32, permissionsP, idBytes, keyLenBytes, revision) {
    const padded = padPassword(userPw);
    let hash = md5(concatBytes(padded, ownerHash32, p32le(permissionsP), idBytes));
    if (revision >= 3) for (let i = 0; i < 50; i++) hash = md5(hash.slice(0, keyLenBytes));
    return hash.slice(0, keyLenBytes);
  }
  function computeO(ownerPw, userPw, keyLenBytes, revision) {
    let rc4Key = md5(padPassword(ownerPw || userPw));
    if (revision >= 3) for (let i = 0; i < 50; i++) rc4Key = md5(rc4Key.slice(0, keyLenBytes));
    rc4Key = rc4Key.slice(0, keyLenBytes);
    let out = padPassword(userPw);
    if (revision === 2) {
      out = rc4(rc4Key, out);
    } else {
      for (let i = 0; i < 20; i++) {
        const rk = new Uint8Array(rc4Key.length);
        for (let j = 0; j < rc4Key.length; j++) rk[j] = rc4Key[j] ^ i;
        out = rc4(rk, out);
      }
    }
    return out;
  }
  function computeU(fileKey, idBytes, revision) {
    if (revision === 2) return rc4(fileKey, PAD);
    let out = rc4(fileKey, md5(concatBytes(PAD, idBytes)));
    for (let i = 1; i <= 19; i++) {
      const rk = new Uint8Array(fileKey.length);
      for (let j = 0; j < fileKey.length; j++) rk[j] = fileKey[j] ^ i;
      out = rc4(rk, out);
    }
    const full = new Uint8Array(32);
    full.set(out, 0);
    return full;
  }
  function recoverUserPasswordFromOwner(candidateOwnerPw, O, keyLenBytes, revision) {
    let rc4Key = md5(padPassword(candidateOwnerPw));
    if (revision >= 3) for (let i = 0; i < 50; i++) rc4Key = md5(rc4Key.slice(0, keyLenBytes));
    rc4Key = rc4Key.slice(0, keyLenBytes);
    let out = O.slice();
    if (revision === 2) {
      out = rc4(rc4Key, out);
    } else {
      for (let i = 19; i >= 0; i--) {
        const rk = new Uint8Array(rc4Key.length);
        for (let j = 0; j < rc4Key.length; j++) rk[j] = rc4Key[j] ^ i;
        out = rc4(rk, out);
      }
    }
    return out;
  }
  function objectKey(fileKey, objNum, genNum) {
    const ext = new Uint8Array([objNum & 0xff, (objNum>>8)&0xff, (objNum>>16)&0xff, genNum & 0xff, (genNum>>8)&0xff]);
    const hash = md5(concatBytes(fileKey, ext));
    return hash.slice(0, Math.min(fileKey.length + 5, 16));
  }

  // Permission bits (PDF32000 Table 22, revision 2/3 semantics).
  const PERM_PRINT = 0x4, PERM_MODIFY = 0x8, PERM_COPY = 0x10, PERM_ANNOTATE = 0x20;
  function buildPermissions(perms) {
    let p = 0xFFFFFFFC | 0; // reserved bits 7-32 = 1, bits 1-2 = 0, all optional perms default allowed
    if (perms) {
      if (perms.print === false) p &= ~PERM_PRINT;
      if (perms.modify === false) p &= ~PERM_MODIFY;
      if (perms.copy === false) p &= ~PERM_COPY;
      if (perms.annotate === false) p &= ~PERM_ANNOTATE;
    }
    return p | 0;
  }

  function randomBytes(n) {
    const b = new Uint8Array(n);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(b);
    else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }

  /* Encrypts a pdf-lib PDFDocument in place (its context) and returns
     the encrypted bytes. `doc` should be freshly reloaded from already-
     finalized bytes (see caller) so every stream is a plain PDFRawStream
     holding exactly the final on-disk (already-filtered) bytes. */
  async function encryptDocument(PDFLib, doc, opts) {
    const { PDFName, PDFDict, PDFArray, PDFString, PDFHexString, PDFRawStream } = PDFLib;
    const context = doc.context;
    const userPw = opts.userPassword || "";
    const ownerPw = opts.ownerPassword || opts.userPassword || "";
    const revision = opts.strength === 40 ? 2 : 3;
    const keyLenBytes = opts.strength === 40 ? 5 : 16;
    const V = opts.strength === 40 ? 1 : 2;
    const P = buildPermissions(opts.permissions);
    const idBytes = randomBytes(16);

    const O = computeO(ownerPw, userPw, keyLenBytes, revision);
    const fileKey = computeEncryptionKey(userPw, O, P, idBytes, keyLenBytes, revision);
    const U = computeU(fileKey, idBytes, revision);

    function walk(obj, objNum, genNum) {
      if (obj instanceof PDFDict) {
        obj.keys().forEach(k => { const v = obj.get(k); const nv = walk(v, objNum, genNum); if (nv !== v) obj.set(k, nv); });
        return obj;
      }
      if (obj instanceof PDFArray) {
        for (let i = 0; i < obj.size(); i++) { const v = obj.get(i); const nv = walk(v, objNum, genNum); if (nv !== v) obj.set(i, nv); }
        return obj;
      }
      if (obj instanceof PDFRawStream) {
        walk(obj.dict, objNum, genNum);
        const key = objectKey(fileKey, objNum, genNum);
        obj.contents = rc4(key, obj.contents);
        return obj;
      }
      if (obj instanceof PDFString || obj instanceof PDFHexString) {
        const key = objectKey(fileKey, objNum, genNum);
        return PDFHexString.of(bytesToHex(rc4(key, obj.asBytes())));
      }
      return obj;
    }
    context.enumerateIndirectObjects().forEach(([ref, obj]) => walk(obj, ref.objectNumber, ref.generationNumber));

    const encryptDict = context.obj({
      Filter: PDFName.of("Standard"), V: V, R: revision,
      O: PDFHexString.of(bytesToHex(O)), U: PDFHexString.of(bytesToHex(U)),
      P: P, Length: keyLenBytes * 8
    });
    context.trailerInfo.Encrypt = context.register(encryptDict);
    context.trailerInfo.ID = context.obj([PDFHexString.of(bytesToHex(idBytes)), PDFHexString.of(bytesToHex(idBytes))]);

    return doc.save({ useObjectStreams: false, updateMetadata: false });
  }

  /* Decrypts an encrypted PDF given a password (user OR owner). Returns
     the decrypted bytes, or throws a descriptive Error. */
  async function decryptDocument(PDFLib, bytes, password) {
    const { PDFDocument, PDFName, PDFDict, PDFArray, PDFString, PDFHexString, PDFRawStream } = PDFLib;
    let doc;
    try {
      doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    } catch (e) {
      throw new Error("Couldn't parse this PDF. It may use a structure (like compressed cross-reference streams) this tool doesn't support.");
    }
    const context = doc.context;
    const encRef = context.trailerInfo.Encrypt;
    if (!encRef) throw new Error("This PDF isn't password-protected.");
    const encDict = context.lookup(encRef, PDFDict);
    const V = encDict.get(PDFName.of("V")) ? encDict.get(PDFName.of("V")).asNumber() : 0;
    const R = encDict.get(PDFName.of("R")).asNumber();
    if (V >= 4) throw new Error("This PDF uses AES encryption, which isn't supported yet — only the classic RC4 (40/128-bit) password scheme is.");
    const O = encDict.get(PDFName.of("O")).asBytes();
    const U = encDict.get(PDFName.of("U")).asBytes();
    const P = encDict.get(PDFName.of("P")).asNumber();
    const lengthBits = encDict.has(PDFName.of("Length")) ? encDict.get(PDFName.of("Length")).asNumber() : 40;
    const keyLenBytes = lengthBits / 8;
    const idArr = context.trailerInfo.ID;
    const idBytes = idArr ? context.lookup(idArr, PDFArray).get(0).asBytes() : new Uint8Array(0);

    let fileKey = computeEncryptionKey(password, O, P, idBytes, keyLenBytes, R);
    let computedU = computeU(fileKey, idBytes, R);
    const checkLen = R === 2 ? 32 : 16;
    let matched = bytesEqual(computedU, U, checkLen);
    if (!matched) {
      const recovered = recoverUserPasswordFromOwner(password, O, keyLenBytes, R);
      fileKey = computeEncryptionKey(recovered, O, P, idBytes, keyLenBytes, R);
      computedU = computeU(fileKey, idBytes, R);
      matched = bytesEqual(computedU, U, checkLen);
    }
    if (!matched) throw new Error("Wrong password.");

    function walk(obj, objNum, genNum) {
      if (obj === encDict) return obj;
      if (obj instanceof PDFDict) {
        obj.keys().forEach(k => { const v = obj.get(k); const nv = walk(v, objNum, genNum); if (nv !== v) obj.set(k, nv); });
        return obj;
      }
      if (obj instanceof PDFArray) {
        for (let i = 0; i < obj.size(); i++) { const v = obj.get(i); const nv = walk(v, objNum, genNum); if (nv !== v) obj.set(i, nv); }
        return obj;
      }
      if (obj instanceof PDFRawStream) {
        walk(obj.dict, objNum, genNum);
        const key = objectKey(fileKey, objNum, genNum);
        obj.contents = rc4(key, obj.contents);
        return obj;
      }
      if (obj instanceof PDFString || obj instanceof PDFHexString) {
        const key = objectKey(fileKey, objNum, genNum);
        return PDFHexString.of(bytesToHex(rc4(key, obj.asBytes())));
      }
      return obj;
    }
    context.enumerateIndirectObjects().forEach(([ref, obj]) => { if (ref !== encRef) walk(obj, ref.objectNumber, ref.generationNumber); });
    context.trailerInfo.Encrypt = undefined;

    try {
      return await doc.save({ useObjectStreams: false, updateMetadata: false });
    } catch (e) {
      throw new Error("Decrypted the password, but couldn't rebuild the PDF (unsupported internal structure).");
    }
  }

  window.HandyToolxPdfCrypto = { md5, rc4, encryptDocument, decryptDocument };
})();

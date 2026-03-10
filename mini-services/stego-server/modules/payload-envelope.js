const MAGIC = Buffer.from('STG2');

function readU8(buffer, offset) {
  if (offset >= buffer.length) throw new Error('Invalid envelope (truncated)');
  return buffer.readUInt8(offset);
}

function readSlice(buffer, offset, length) {
  const end = offset + length;
  if (end > buffer.length) throw new Error('Invalid envelope (truncated)');
  return buffer.subarray(offset, end);
}

/**
 * Pack AES-only encrypted payload into a compact binary envelope.
 * Layout:
 *  - 4B  MAGIC "STG2"
 *  - 1B  aesAlgLen
 *  - NB  aesAlg (utf8)
 *  - 1B  aesSaltLen + aesSalt
 *  - 1B  aesIVLen   + aesIV
 *  - 1B  aesTagLen  + aesTag
 *  - 4B  encryptedLen (uint32 BE)
 *  - NB  encryptedData
 */
export function packEncryptedEnvelopeV1({ encryptedData, aesSalt, aesIV, aesTag, aesAlg }) {
  const algBuf = Buffer.from(aesAlg || '', 'utf8');
  if (algBuf.length === 0 || algBuf.length > 255) throw new Error('Invalid AES algorithm in envelope');

  const encBuf = Buffer.isBuffer(encryptedData) ? encryptedData : Buffer.from(encryptedData || '');
  const saltBuf = Buffer.isBuffer(aesSalt) ? aesSalt : Buffer.from(aesSalt || '');
  const ivBuf = Buffer.isBuffer(aesIV) ? aesIV : Buffer.from(aesIV || '');
  const tagBuf = Buffer.isBuffer(aesTag) ? aesTag : Buffer.from(aesTag || '');

  for (const [label, buf] of [
    ['aesSalt', saltBuf],
    ['aesIV', ivBuf],
    ['aesTag', tagBuf]
  ]) {
    if (buf.length === 0 || buf.length > 255) throw new Error(`Invalid ${label} length in envelope`);
  }
  if (encBuf.length > 0xffffffff) throw new Error('Encrypted payload too large');

  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(encBuf.length, 0);

  return Buffer.concat([
    MAGIC,
    Buffer.from([algBuf.length]),
    algBuf,
    Buffer.from([saltBuf.length]),
    saltBuf,
    Buffer.from([ivBuf.length]),
    ivBuf,
    Buffer.from([tagBuf.length]),
    tagBuf,
    lenBuf,
    encBuf
  ]);
}

export function unpackEncryptedEnvelopeV1(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Invalid envelope');
  if (buffer.length < 4 + 1 + 1 + 1 + 1 + 4) throw new Error('Invalid envelope (too small)');
  if (!buffer.subarray(0, 4).equals(MAGIC)) throw new Error('Invalid envelope magic');

  let offset = 4;

  const algLen = readU8(buffer, offset);
  offset += 1;
  const alg = readSlice(buffer, offset, algLen).toString('utf8');
  offset += algLen;

  const saltLen = readU8(buffer, offset);
  offset += 1;
  const aesSalt = readSlice(buffer, offset, saltLen);
  offset += saltLen;

  const ivLen = readU8(buffer, offset);
  offset += 1;
  const aesIV = readSlice(buffer, offset, ivLen);
  offset += ivLen;

  const tagLen = readU8(buffer, offset);
  offset += 1;
  const aesTag = readSlice(buffer, offset, tagLen);
  offset += tagLen;

  if (offset + 4 > buffer.length) throw new Error('Invalid envelope (truncated length)');
  const encryptedLen = buffer.readUInt32BE(offset);
  offset += 4;

  const encryptedData = readSlice(buffer, offset, encryptedLen);
  offset += encryptedLen;

  if (offset !== buffer.length) throw new Error('Invalid envelope (trailing data)');

  return { encryptedData, aesSalt, aesIV, aesTag, aesAlg: alg };
}


// Encryption Module - AES-256-GCM (single-layer)
import crypto from 'crypto';

const AES_ALGORITHM = 'aes-256-gcm';
const AES_KEY_LENGTH = 32; // 256-bit key
const AES_IV_LENGTH = 12;  // 96-bit nonce (recommended for GCM)
const AES_TAG_LENGTH = 16; // 128-bit auth tag

export function generateSalt() {
  return crypto.randomBytes(16);
}

export function generateIV() {
  return crypto.randomBytes(AES_IV_LENGTH);
}

export function deriveAESKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, AES_KEY_LENGTH, 'sha256');
}

function encryptAESGCM(plaintextBuffer, key, iv) {
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== AES_TAG_LENGTH) {
    throw new Error('Unexpected AES-GCM tag length');
  }
  return { ciphertext, tag };
}

function decryptAESGCM(ciphertextBuffer, key, iv, tag) {
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertextBuffer), decipher.final()]);
}

/**
 * AES-256-GCM encryption (binary).
 * Returns raw buffers to minimize embedded size.
 */
export function encryptWithPasswordBytes(message, password) {
  const plaintextBuffer = Buffer.isBuffer(message) ? message : Buffer.from(String(message ?? ''), 'utf8');
  const aesSalt = generateSalt();
  const aesIV = generateIV();
  const aesKey = deriveAESKey(password, aesSalt);
  const { ciphertext, tag } = encryptAESGCM(plaintextBuffer, aesKey, aesIV);

  return {
    encryptedData: ciphertext,
    aesSalt,
    aesIV,
    aesTag: tag,
    aesAlg: AES_ALGORITHM
  };
}

/**
 * AES-256-GCM decryption (binary).
 * Accepts raw buffers for salt/IV/tag/ciphertext and returns UTF-8 plaintext.
 */
export function decryptWithPasswordBytes(encryptedData, password, aesSalt, aesIV, aesTag) {
  const ciphertextBuffer = Buffer.isBuffer(encryptedData)
    ? encryptedData
    : Buffer.from(String(encryptedData ?? ''), 'base64');

  const saltBuffer = Buffer.isBuffer(aesSalt) ? aesSalt : Buffer.from(aesSalt, 'base64');
  const ivBuffer = Buffer.isBuffer(aesIV) ? aesIV : Buffer.from(aesIV, 'base64');
  const tagBuffer = Buffer.isBuffer(aesTag) ? aesTag : Buffer.from(aesTag, 'base64');

  const key = deriveAESKey(password, saltBuffer);
  const plaintextBytes = decryptAESGCM(ciphertextBuffer, key, ivBuffer, tagBuffer);
  return plaintextBytes.toString('utf8');
}


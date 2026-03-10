// Steganography Module - LSB (Least Significant Bit) Technique
import sharp from 'sharp';

const HEADER_DELIMITER = '|||';
const MAX_HEADER_SIZE = 1000;
const LENGTH_HEADER_BYTES = 4;
const LENGTH_HEADER_BITS = LENGTH_HEADER_BYTES * 8;

export function stringToBinary(str) {
  if (!str) return '';
  return str
    .split('')
    .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
}

export function binaryToString(binary) {
  if (!binary) return '';
  const bytes = binary.match(/.{1,8}/g) || [];
  return bytes
    .map(byte => String.fromCharCode(parseInt(byte, 2)))
    .join('');
}

export async function encodeMessage(imagePath, data, outputPath) {
  try {
    if (!imagePath || !data || !outputPath) {
      throw new Error('Invalid parameters');
    }

    const header = `${data.length}${HEADER_DELIMITER}`;
    const headerBinary = stringToBinary(header);
    const dataBinary = stringToBinary(data);
    const totalBinary = headerBinary + dataBinary;

    const result = await sharp(imagePath)
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!result || !result.info || !result.data) {
      throw new Error('Failed to read image');
    }

    const { data: pixels, info } = result;
    const width = info?.width || 0;
    const height = info?.height || 0;
    const channels = info?.channels || 3;
    const totalPixels = width * height * channels;

    if (totalBinary.length > totalPixels) {
      throw new Error(`Message too large`);
    }

    for (let i = 0; i < totalBinary.length; i++) {
      const bit = parseInt(totalBinary[i]);
      pixels[i] = (pixels[i] & 0xFE) | bit;
    }

    await sharp(pixels, {
      raw: { width, height, channels }
    })
      .png()
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    throw new Error(`Encoding failed: ${error.message}`);
  }
}

function getMaxPayloadBytes(totalBits) {
  const usableBits = totalBits - LENGTH_HEADER_BITS;
  if (usableBits <= 0) return 0;
  return Math.floor(usableBits / 8);
}

export async function encodeBytes(imagePath, payloadBuffer, outputPath) {
  try {
    if (!imagePath || !payloadBuffer || !outputPath) throw new Error('Invalid parameters');
    const payload = Buffer.isBuffer(payloadBuffer) ? payloadBuffer : Buffer.from(payloadBuffer);
    if (payload.length > 0xffffffff) throw new Error('Payload too large');

    const result = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
    if (!result || !result.info || !result.data) throw new Error('Failed to read image');

    const { data: pixels, info } = result;
    const width = info?.width || 0;
    const height = info?.height || 0;
    const channels = info?.channels || 3;
    const totalBits = width * height * channels;

    const maxPayloadBytes = getMaxPayloadBytes(totalBits);
    if (payload.length > maxPayloadBytes) {
      throw new Error(`Payload too large`);
    }

    const lenBuf = Buffer.alloc(LENGTH_HEADER_BYTES);
    lenBuf.writeUInt32BE(payload.length, 0);
    const combined = Buffer.concat([lenBuf, payload]);

    const totalBitsToWrite = combined.length * 8;
    for (let bitIndex = 0; bitIndex < totalBitsToWrite; bitIndex++) {
      const byteIndex = bitIndex >> 3;
      const bitOffset = 7 - (bitIndex & 7);
      const bit = (combined[byteIndex] >> bitOffset) & 1;
      pixels[bitIndex] = (pixels[bitIndex] & 0xfe) | bit;
    }

    await sharp(pixels, { raw: { width, height, channels } }).png().toFile(outputPath);
    return outputPath;
  } catch (error) {
    throw new Error(`Encoding failed: ${error.message}`);
  }
}

export async function decodeBytes(imagePath) {
  try {
    if (!imagePath) throw new Error('Invalid image path');

    const result = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
    if (!result || !result.info || !result.data) throw new Error('Failed to read image');

    const { data: pixels, info } = result;
    const width = info?.width || 0;
    const height = info?.height || 0;
    const channels = info?.channels || 3;
    const totalBits = width * height * channels;

    const maxPayloadBytes = getMaxPayloadBytes(totalBits);
    if (maxPayloadBytes <= 0) throw new Error('No hidden payload found');

    // Read payload length (uint32 BE) from first 32 bits.
    let length = 0;
    for (let i = 0; i < LENGTH_HEADER_BITS; i++) {
      length = (length << 1) | (pixels[i] & 1);
    }

    if (length <= 0 || length > maxPayloadBytes) {
      throw new Error('Invalid payload length');
    }

    const out = Buffer.allocUnsafe(length);
    let bitBase = LENGTH_HEADER_BITS;
    for (let byteIndex = 0; byteIndex < length; byteIndex++) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) {
        value = (value << 1) | (pixels[bitBase + (byteIndex * 8) + bit] & 1);
      }
      out[byteIndex] = value;
    }

    return out;
  } catch (error) {
    throw new Error(`Decoding failed: ${error.message}`);
  }
}

export async function decodeMessage(imagePath) {
  try {
    if (!imagePath) {
      throw new Error('Invalid image path');
    }

    const result = await sharp(imagePath)
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!result || !result.data) {
      throw new Error('Failed to read image');
    }

    const { data: pixels } = result;

    const extractedBits = [];
    for (let i = 0; i < pixels.length; i++) {
      extractedBits.push((pixels[i] & 1).toString());
    }

    let binaryData = extractedBits.join('');
    const delimiterBinary = stringToBinary(HEADER_DELIMITER);
    const headerEndIndex = binaryData.indexOf(delimiterBinary);

    if (headerEndIndex === -1) {
      throw new Error('No hidden message found');
    }

    const headerBinary = binaryData.substring(0, headerEndIndex);
    const messageLength = parseInt(binaryToString(headerBinary), 10);

    if (isNaN(messageLength) || messageLength <= 0) {
      throw new Error('Invalid message length');
    }

    const messageStartIndex = headerEndIndex + delimiterBinary.length;
    const messageEndIndex = messageStartIndex + (messageLength * 8);

    if (messageEndIndex > binaryData.length) {
      throw new Error('Message corrupted');
    }

    const messageBinary = binaryData.substring(messageStartIndex, messageEndIndex);
    const message = binaryToString(messageBinary);

    return message;
  } catch (error) {
    throw new Error(`Decoding failed: ${error.message}`);
  }
}

export async function calculateCapacity(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    if (!metadata) return 0;

    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const channels = metadata.channels || 3;

    const totalPixels = width * height * channels;
    const availableBits = totalPixels - LENGTH_HEADER_BITS;
    return Math.max(0, Math.floor(availableBits / 8));
  } catch (error) {
    return 0;
  }
}

export async function isSupportedImage(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    if (!metadata || !metadata.format) return false;
    // Sharp supports: jpeg, png, webp, tiff, gif, avif, heif, etc.
    // We accept all formats that Sharp can read
    const supportedFormats = ['jpeg', 'png', 'webp', 'tiff', 'bmp', 'gif', 'avif', 'heif', 'heic'];
    return supportedFormats.includes(metadata.format);
  } catch {
    return false;
  }
}

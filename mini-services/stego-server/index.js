import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { deflateSync, inflateSync } from 'zlib';

import { encryptWithPasswordBytes, decryptWithPasswordBytes } from './modules/encryption.js';
import { encodeBytes as encodeImageBytes, decodeBytes as decodeImageBytes, isSupportedImage, calculateCapacity } from './modules/steganography.js';
import { encodeAudioBytes, decodeAudioBytes, calculateAudioCapacity } from './modules/audio-steganography.js';
import { encodeVideoBytes, decodeVideoBytes, calculateVideoCapacity } from './modules/video-steganography.js';
import { packEncryptedEnvelopeV1, unpackEncryptedEnvelopeV1 } from './modules/payload-envelope.js';
import { initDb, logOperation, getDbStatus } from './modules/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3030;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

await initDb();

const uploadDir = join(__dirname, 'uploads');
const tempDir = join(__dirname, 'temp');
function ensureDir(dirPath) {
  try {
    mkdirSync(dirPath, { recursive: true });
  } catch (e) {
    if (!existsSync(dirPath)) throw e;
  }
}
ensureDir(uploadDir);
ensureDir(tempDir);

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return String(bytes);
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  const shown = u === 0 ? `${Math.round(v)}` : v.toFixed(v >= 10 ? 1 : 2);
  return `${shown} ${units[u]}`;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket?.remoteAddress || null;
}

function getUserAgent(req) {
  return req.headers['user-agent'] || null;
}

/**
 * Convert audio file to WAV format (PCM 16-bit, 44.1kHz, stereo)
 * This is required for LSB steganography
 */
async function convertAudioToWav(inputPath, outputPath) {
  try {
    console.log(`[Audio Conversion] Converting ${inputPath} to WAV...`);
    const cmd = `ffmpeg -i "${inputPath}" -acodec pcm_s16le -ar 44100 -ac 2 "${outputPath}" -y 2>&1`;
    execSync(cmd, { stdio: 'ignore' });
    
    if (!existsSync(outputPath)) {
      throw new Error('WAV conversion failed - output file not created');
    }
    
    console.log(`[Audio Conversion] Successfully converted to WAV`);
    return outputPath;
  } catch (error) {
    console.error('[Audio Conversion] Error:', error.message);
    throw new Error(`Audio conversion failed: ${error.message}`);
  }
}

/**
 * Check if audio file is already in WAV format
 */
function isWavFile(mimetype, filename) {
  return mimetype === 'audio/wav' || 
         mimetype === 'audio/x-wav' || 
         mimetype === 'audio/wave' ||
         filename.toLowerCase().endsWith('.wav');
}

// Accept ALL image, audio, and video files - NO size limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Allow large base64 "message" payloads when hiding files
    fieldSize: 1024 * 1024 * 200 // 200 MB
  },
  fileFilter: (req, file, cb) => {
    // Accept ALL image types
    if (file.mimetype.startsWith('image/')) {
      console.log(`[Upload] Accepting image: ${file.mimetype}, filename: ${file.originalname}`);
      cb(null, true);
      return;
    }
    
    // Accept ALL audio types (MP3, WAV, AAC, M4A, OGG, FLAC, etc.)
    if (file.mimetype.startsWith('audio/')) {
      console.log(`[Upload] Accepting audio: ${file.mimetype}, filename: ${file.originalname}`);
      cb(null, true);
      return;
    }
    
    // Accept ALL video types (MP4, AVI, MOV, MKV, WebM, etc.)
    if (file.mimetype.startsWith('video/')) {
      console.log(`[Upload] Accepting video: ${file.mimetype}, filename: ${file.originalname}`);
      cb(null, true);
      return;
    }
    
    // Check by extension if mimetype is generic or unknown
    const ext = file.originalname.toLowerCase().split('.').pop();
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif', 'svg', 'ico', 'avif', 'heic', 'heif', 'psd', 'raw', 'cr2', 'nef'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'aiff', 'aif', 'aifc', 'au', 'ra', 'wv'];
    const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv', 'flv', 'm4v', '3gp', 'ts', 'mts', 'm2ts', 'asf', 'rm', 'rmvb', 'vob', 'ogv'];
    
    if (imageExts.includes(ext)) {
      console.log(`[Upload] Accepting image by extension: .${ext}`);
      cb(null, true);
      return;
    }
    
    if (audioExts.includes(ext)) {
      console.log(`[Upload] Accepting audio by extension: .${ext}`);
      cb(null, true);
      return;
    }
    
    if (videoExts.includes(ext)) {
      console.log(`[Upload] Accepting video by extension: .${ext}`);
      cb(null, true);
      return;
    }
    
    console.log(`[Upload] Rejecting file: ${file.mimetype}, extension: .${ext}`);
    cb(new Error(`Unsupported file type: ${file.mimetype}. Please upload an image, audio, or video file.`));
  }
});

// Get file type from mimetype or extension
function getFileType(mimetype, filename) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  
  // Check by extension
  const ext = filename.toLowerCase().split('.').pop();
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif', 'svg', 'ico', 'avif', 'heic', 'heif', 'psd', 'raw', 'cr2', 'nef'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'aiff', 'aif', 'aifc', 'au', 'ra', 'wv'];
  const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv', 'flv', 'm4v', '3gp', 'ts', 'mts', 'm2ts', 'asf', 'rm', 'rmvb', 'vob', 'ogv'];
  
  if (imageExts.includes(ext)) return 'image';
  if (audioExts.includes(ext)) return 'audio';
  if (videoExts.includes(ext)) return 'video';
  
  return 'unknown';
}

// Get output file extension based on file type (lossless for reliable decoding)
function getOutputExtension(fileType) {
  const extensions = {
    image: '.png',
    audio: '.wav',
    video: '.mkv'  // Lossless container for video steganography
  };
  return extensions[fileType] || '.bin';
}

// Get content type based on file type
function getContentType(fileType) {
  const types = {
    image: 'image/png',
    audio: 'audio/wav',
    video: 'video/x-matroska'  // MKV MIME type
  };
  return types[fileType] || 'application/octet-stream';
}

// Get original file extension from filename
function getFileExtension(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  return ext ? `.${ext}` : '';
}

// Compress payload to improve capacity (transparent, backward compatible)
function compressPayload(message) {
  const raw = Buffer.from(message, 'utf8');
  try {
    const compressed = deflateSync(raw);
    const compressedB64 = compressed.toString('base64');
    if (compressedB64.length + 6 < message.length) {
      return `ZLIB::${compressedB64}`;
    }
  } catch (e) {}
  return message;
}

function decompressPayload(payload) {
  if (payload.startsWith('ZLIB::')) {
    const b64 = payload.slice(6);
    const buffer = Buffer.from(b64, 'base64');
    return inflateSync(buffer).toString('utf8');
  }
  if (payload.startsWith('RAW::')) {
    return payload.slice(5);
  }
  return payload;
}

app.post('/api/encode', upload.single('file'), async (req, res) => {
  const timestamp = Date.now();
  let inputPath, outputPath, finalOutputPath, fileType, convertedPath = null;
  let resultPath = null;
  let capacity = null;
  let payloadBytes = null;
  let actualCarrierType = null;
  let inputBytes = null;
  const requestMeta = { clientIp: getClientIp(req), userAgent: getUserAgent(req) };

  try {
    const { message, password, carrierType } = req.body;
    const file = req.file;
    inputBytes = file?.buffer?.length ?? null;

    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    if (!message || !message.trim()) return res.status(400).json({ success: false, error: 'No message' });
    if (!password || !password.trim()) return res.status(400).json({ success: false, error: 'No password' });

    fileType = getFileType(file.mimetype, file.originalname);
    console.log(`[Encode] File type: ${fileType}, mimetype: ${file.mimetype}, filename: ${file.originalname}`);

    // Get original file extension (input only)
    const originalExtension = getFileExtension(file.originalname);
    const processingExtension = getOutputExtension(fileType);

    // Input path (with original extension)
    inputPath = join(uploadDir, `input_${timestamp}${originalExtension}`);

    // Output path (lossless stego output)
    outputPath = join(uploadDir, `stego_temp_${timestamp}${processingExtension}`);

    // Final output path (lossless format)
    finalOutputPath = join(uploadDir, `stego_${timestamp}${processingExtension}`);

    // The uploads folder might be deleted between restarts; ensure it exists before writing.
    ensureDir(uploadDir);
    writeFileSync(inputPath, file.buffer);

    // Add carrier type to message for validation during decoding
    // Format: CARRIER::image::actual_message
    const allowedCarrierTypes = new Set(['image', 'audio', 'video']);
    const normalizedCarrierType = allowedCarrierTypes.has(carrierType) ? carrierType : null;
    actualCarrierType = normalizedCarrierType || fileType;
    const messageWithCarrier = `CARRIER::${actualCarrierType}::${message}`;
    const payload = compressPayload(messageWithCarrier);

    // For audio: convert to WAV for processing, but will convert back later
    if (fileType === 'audio' && !isWavFile(file.mimetype, file.originalname)) {
      console.log(`[Encode] Audio file is not WAV, converting to WAV for processing...`);
      convertedPath = join(tempDir, `converted_${timestamp}.wav`);
      await convertAudioToWav(inputPath, convertedPath);

      // Replace inputPath with converted WAV for processing
      inputPath = convertedPath;
    }

    // Validate and calculate capacity based on file type
    capacity = 0;
    if (fileType === 'image') {
      if (!await isSupportedImage(inputPath)) {
        throw new Error('Invalid image file');
      }
      capacity = await calculateCapacity(inputPath);
    } else if (fileType === 'audio') {
      capacity = await calculateAudioCapacity(inputPath);
    } else if (fileType === 'video') {
      capacity = await calculateVideoCapacity(inputPath);
    } else {
      throw new Error('Unsupported file type');
    }

    console.log(`[Encode] File capacity: ${capacity} bytes`);

    if (capacity <= 0) {
      throw new Error(`${fileType.charAt(0).toUpperCase() + fileType.slice(1)} file is too small or has an invalid format. Please use a larger ${fileType} file.`);
    }

    // Encrypt + pack into compact binary envelope to avoid base64 expansion
    const encrypted = encryptWithPasswordBytes(payload, password);
    const envelope = packEncryptedEnvelopeV1(encrypted);
    payloadBytes = envelope.length;

    console.log(`[Encode] Data to embed size: ${envelope.length} bytes (${formatBytes(envelope.length)})`);
    if (envelope.length > capacity) {
      throw new Error(
        `Message too large (need ${formatBytes(envelope.length)}, max ${formatBytes(capacity)} for ${fileType}). ` +
        `Use a larger carrier or smaller secret.`
      );
    }

    // Encode based on file type
    if (fileType === 'image') {
      await encodeImageBytes(inputPath, envelope, finalOutputPath);
      resultPath = finalOutputPath;
    } else if (fileType === 'audio') {
      // Encode to WAV first
      await encodeAudioBytes(inputPath, envelope, finalOutputPath);
      resultPath = finalOutputPath;
    } else if (fileType === 'video') {
      // For video, we need to modify the video-steganography to output the same format
      await encodeVideoBytes(inputPath, envelope, finalOutputPath);
      resultPath = finalOutputPath;
    }

    if (!resultPath || !existsSync(resultPath)) {
      throw new Error('Failed to create stego output file');
    }

    // Read the final output file
    const stegoBuffer = readFileSync(resultPath);

    // Use lossless output MIME type
    const outputMimeType = getContentType(fileType);

    // Cleanup
    const cleanupPaths = [inputPath, outputPath, finalOutputPath, convertedPath];
    cleanupPaths.forEach((p) => {
      if (p && existsSync(p)) {
        try {
          unlinkSync(p);
        } catch (e) {}
      }
    });

    // Send response
    res.setHeader('Content-Type', outputMimeType);
    res.setHeader('Content-Disposition', `attachment; filename="stego_${timestamp}${processingExtension}"`);
    res.send(stegoBuffer);

    void logOperation({
      operation: 'encode',
      fileType: fileType || 'unknown',
      carrierType: actualCarrierType,
      inputBytes,
      payloadBytes,
      capacityBytes: capacity,
      status: 'success',
      errorMessage: null,
      ...requestMeta
    });

    console.log(`[Encode] Successfully encoded ${fileType} file to ${processingExtension}`);

  } catch (error) {
    console.error('[Encode] Error:', error);
    try {
      if (inputPath && existsSync(inputPath)) unlinkSync(inputPath);
      if (outputPath && existsSync(outputPath)) unlinkSync(outputPath);
      if (finalOutputPath && existsSync(finalOutputPath)) unlinkSync(finalOutputPath);
      if (convertedPath && existsSync(convertedPath)) unlinkSync(convertedPath);
    } catch (e) {}
    void logOperation({
      operation: 'encode',
      fileType: fileType || 'unknown',
      carrierType: actualCarrierType,
      inputBytes,
      payloadBytes,
      capacityBytes: capacity,
      status: 'error',
      errorMessage: error.message || 'Encoding failed',
      ...requestMeta
    });
    res.status(500).json({ success: false, error: error.message || 'Encoding failed' });
  }
});

app.post('/api/decode', upload.single('file'), async (req, res) => {
  const timestamp = Date.now();
  let inputPath, fileType, convertedPath = null;
  let payloadBytes = null;
  let inputBytes = null;
  const requestMeta = { clientIp: getClientIp(req), userAgent: getUserAgent(req) };

  try {
    const { password } = req.body;
    const file = req.file;
    inputBytes = file?.buffer?.length ?? null;

    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    if (!password || !password.trim()) return res.status(400).json({ success: false, error: 'No password' });

    fileType = getFileType(file.mimetype, file.originalname);
    console.log(`[Decode] File type: ${fileType}, mimetype: ${file.mimetype}, filename: ${file.originalname}`);

    const extension = getOutputExtension(fileType);
    inputPath = join(uploadDir, `decode_${timestamp}${extension}`);

    ensureDir(uploadDir);
    writeFileSync(inputPath, file.buffer);

    // For audio, convert to WAV if not already WAV
    if (fileType === 'audio' && !isWavFile(file.mimetype, file.originalname)) {
      console.log('[Decode] Audio file is not WAV, converting...');
      convertedPath = join(tempDir, `converted_decode_${timestamp}.wav`);
      await convertAudioToWav(inputPath, convertedPath);

      unlinkSync(inputPath);
      inputPath = convertedPath;
    }

    if (fileType !== 'image' && fileType !== 'audio' && fileType !== 'video') throw new Error('Unsupported file type');

    let envelopeBytes;
    try {
      if (fileType === 'image') {
        if (!await isSupportedImage(inputPath)) throw new Error('Invalid image file');
        envelopeBytes = await decodeImageBytes(inputPath);
      } else if (fileType === 'audio') {
        envelopeBytes = await decodeAudioBytes(inputPath);
      } else {
        envelopeBytes = await decodeVideoBytes(inputPath);
      }
    } catch (e) {
      throw new Error('No AES-256-GCM stego payload found (legacy formats are not supported). Re-encode with the updated server.');
    }

    payloadBytes = envelopeBytes?.length ?? null;
    let envelope;
    try {
      envelope = unpackEncryptedEnvelopeV1(envelopeBytes);
    } catch (e) {
      throw new Error('No AES-256-GCM stego payload found (legacy formats are not supported). Re-encode with the updated server.');
    }

    const { encryptedData, aesSalt, aesIV, aesTag } = envelope;
    const decryptedMessage = decryptWithPasswordBytes(encryptedData, password, aesSalt, aesIV, aesTag);
    const decompressedMessage = decompressPayload(decryptedMessage);

    // Validate carrier type
    let actualMessage = decompressedMessage;
    const carrierPrefix = 'CARRIER::';
    if (decompressedMessage.startsWith(carrierPrefix)) {
      const rest = decompressedMessage.slice(carrierPrefix.length);
      const sepIndex = rest.indexOf('::');
      if (sepIndex !== -1) {
        const expectedCarrierType = rest.slice(0, sepIndex);
        actualMessage = rest.slice(sepIndex + 2);

        if (expectedCarrierType && expectedCarrierType !== fileType) {
          throw new Error(
            `Invalid file type for decoding. This stego file was created using a ${expectedCarrierType} carrier. ` +
            `Please upload the correct file type (${expectedCarrierType}) for decoding.`
          );
        }

        console.log(`[Decode] Carrier type validated: ${fileType}`);
      }
    }

    // Cleanup
    unlinkSync(inputPath);
    if (convertedPath && existsSync(convertedPath)) unlinkSync(convertedPath);

    console.log(`[Decode] Successfully decoded ${fileType} file`);
    res.json({ success: true, message: actualMessage, fileType });

    void logOperation({
      operation: 'decode',
      fileType: fileType || 'unknown',
      carrierType: null,
      inputBytes,
      payloadBytes,
      capacityBytes: null,
      status: 'success',
      errorMessage: null,
      ...requestMeta
    });
  } catch (error) {
    console.error('[Decode] Error:', error);
    try {
      if (inputPath && existsSync(inputPath)) unlinkSync(inputPath);
      if (convertedPath && existsSync(convertedPath)) unlinkSync(convertedPath);
    } catch (e) {}
    void logOperation({
      operation: 'decode',
      fileType: fileType || 'unknown',
      carrierType: null,
      inputBytes,
      payloadBytes,
      capacityBytes: null,
      status: 'error',
      errorMessage: error.message || 'Decoding failed',
      ...requestMeta
    });
    res.status(500).json({ success: false, error: error.message || 'Decoding failed' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Secure Multimedia Steganography System running',
    db: getDbStatus(),
    supportedFormats: {
      images: ['ALL image formats supported - JPG, PNG, WebP, BMP, GIF, TIFF, SVG, AVIF, HEIC, PSD, RAW, etc.'],
      audio: ['ALL audio formats supported - MP3, WAV, AAC, M4A, OGG, FLAC, WMA, OPUS, AIFF, etc. (auto-converted to WAV)'],
      video: ['ALL video formats supported - MP4, AVI, MOV, MKV, WebM, WMV, FLV, M4V, 3GP, TS, etc.'],
      note: 'Large uploads supported (limits depend on server memory). Hidden payload size is limited by carrier capacity.'
    }
  });
});

// Multer / upload error handler
app.use((err, req, res, next) => {
  if (!err) return next();
  if (res.headersSent) return next(err);

  const isLimitError = typeof err.code === 'string' && err.code.startsWith('LIMIT_');
  const status = isLimitError ? 413 : 500;
  const message = isLimitError
    ? `Upload failed: ${err.message}`
    : (err.message || 'Server error');

  res.status(status).json({ success: false, error: message });
});

app.listen(PORT, () => {
  console.log(`🔒 Secure Multimedia Steganography Server running on port ${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📸 Images: ALL formats | 🎵 Audio: ALL formats (auto-convert to WAV) | 🎬 Video: ALL formats`);
  console.log(`📏 Hidden payload size: LIMITED by carrier capacity`);
});

// Video Steganography Module - LSB on video frames
import sharp from 'sharp';
import { execSync } from 'child_process';
import { unlinkSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HEADER_DELIMITER = '|||';
const MAX_HEADER_SIZE = 2000;
const FRAME_SKIP = 1; // Process EVERY frame (no skipping) for better robustness against compression
const LENGTH_HEADER_BYTES = 4;
const LENGTH_HEADER_BITS = LENGTH_HEADER_BYTES * 8;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * String to binary conversion
 */
function stringToBinary(str) {
  if (!str) return '';
  return str
    .split('')
    .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
}

/**
 * Binary to string conversion
 */
function binaryToString(binary) {
  if (!binary) return '';
  const bytes = binary.match(/.{1,8}/g) || [];
  return bytes
    .map(byte => String.fromCharCode(parseInt(byte, 2)))
    .join('');
}

/**
 * Extract frames from video using ffmpeg
 * @param {string} inputPath - Path to input video
 * @param {string} outputDir - Directory to save frames
 * @param {boolean} extractAllFrames - If true, extract all frames (for decoding)
 */
async function extractFrames(inputPath, outputDir, extractAllFrames = false) {
  try {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Clear any existing frames
    const existingFrames = readdirSync(outputDir).filter(f => f.endsWith('.png'));
    existingFrames.forEach(f => unlinkSync(join(outputDir, f)));

    // Extract frames with ffmpeg - use frame-based extraction to handle short videos
    console.log(`[Video Extract] Extracting frames from: ${inputPath}`);
    
    // First, get the video duration to decide extraction strategy
    const durationCmd = `ffprobe -v error -show_entries format=duration -of csv=s=x:p=0 "${inputPath}" 2>&1`;
    let duration = 0;
    try {
      duration = parseFloat(execSync(durationCmd, { encoding: 'utf-8' }).trim()) || 0;
      console.log(`[Video Extract] Video duration: ${duration}s`);
    } catch (e) {}
    
    let cmd;
    if (extractAllFrames) {
      // For decoding: Extract ALL frames to ensure we get the hidden data
      console.log(`[Video Extract] Decoding mode - extracting ALL frames`);
      cmd = `ffmpeg -i "${inputPath}" -vsync vfr "${join(outputDir, 'frame_%06d.png')}" -y 2>&1`;
    } else if (duration < 1) {
      // For very short videos during encoding, extract a fixed number of frames
      console.log(`[Video Extract] Short video detected, extracting first 10 frames`);
      cmd = `ffmpeg -i "${inputPath}" -vf "select=gt(n\\,0)" -vsync vfr -frames:v 10 "${join(outputDir, 'frame_%06d.png')}" -y 2>&1`;
    } else {
      // For normal videos during encoding, extract at 1 fps
      cmd = `ffmpeg -i "${inputPath}" -vf "fps=1" "${join(outputDir, 'frame_%06d.png')}" -y 2>&1`;
    }
    
    try {
      execSync(cmd, { stdio: 'ignore' });
    } catch (e) {
      console.error('[Video Extract] FFmpeg failed:', e.message);
      // Try alternative method: extract single frame
      try {
        console.log(`[Video Extract] Trying alternative extraction method...`);
        const altCmd = `ffmpeg -i "${inputPath}" -vframes 1 "${join(outputDir, 'frame_000001.png')}" -y 2>&1`;
        execSync(altCmd, { stdio: 'ignore' });
        console.log(`[Video Extract] Alternative method succeeded`);
      } catch (e2) {
        console.error('[Video Extract] Alternative method also failed:', e2.message);
        throw new Error('Frame extraction failed. The video file may be corrupted, too short, or in an unsupported format.');
      }
    }

    // Get list of extracted frames
    const frames = readdirSync(outputDir)
      .filter(f => f.endsWith('.png'))
      .sort();

    if (frames.length === 0) {
      throw new Error('No frames extracted - video may be corrupted, too short, or in an unsupported format. Try using a longer video (10+ seconds) in MP4 format.');
    }

    console.log(`[Video Extract] Successfully extracted ${frames.length} frames`);
    return frames;
  } catch (error) {
    console.error('Frame extraction error:', error.message);
    throw new Error(`Frame extraction failed: ${error.message}`);
  }
}

/**
 * Rebuild video from frames using ffmpeg with FIXED FPS for consistency
 */
async function rebuildVideo(framesDir, originalVideo, outputPath) {
  try {
    // Count frames in the frames directory
    const frames = readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
    const frameCount = frames.length;
    console.log(`[Video Rebuild] Frame count: ${frameCount}`);

    if (frameCount === 0) {
      throw new Error('No frames to rebuild video');
    }

    // Get the first frame to determine dimensions
    const firstFramePath = join(framesDir, frames[0]);
    const firstFrameMeta = await sharp(firstFramePath).metadata();
    const width = firstFrameMeta.width || 1920;
    const height = firstFrameMeta.height || 1080;

    console.log(`[Video Rebuild] Dimensions: ${width}x${height}`);

    // Try to get original video's frame rate
    let originalFPS = 30; // Default to 30 fps
    try {
      const fpsCmd = `ffprobe -v error -select_streams v -of default=noprint_wrappers=1:nokey=1 -show_entries stream=r_frame_rate "${originalVideo}" 2>&1`;
      const fpsOutput = execSync(fpsCmd, { encoding: 'utf-8' }).trim();
      if (fpsOutput.includes('/')) {
        const [num, den] = fpsOutput.split('/').map(Number);
        originalFPS = den > 0 ? num / den : 30;
      } else {
        originalFPS = parseFloat(fpsOutput) || 30;
      }
      console.log(`[Video Rebuild] Original FPS: ${originalFPS}`);
    } catch (e) {
      console.log(`[Video Rebuild] Could not detect FPS, using default: ${originalFPS}`);
    }

    // CRITICAL: Rebuild at 1 fps to EXACTLY match the encoding extraction rate
    // Encoding extracts at 1 fps, so decoding must also extract at 1 fps
    // If we use different fps, the output video duration will be wrong
    const outputFPS = 1;

    console.log(`[Video Rebuild] Frame count: ${frameCount}, Output FPS: ${outputFPS} (MUST match encoding rate)`);

    // Use lossless FFV1 in MKV to preserve exact pixel values for LSB decoding
    const cmd = `ffmpeg -framerate ${outputFPS} -i "${join(framesDir, 'frame_%06d.png')}" -c:v ffv1 -level 3 -g 1 -pix_fmt rgb24 -y "${outputPath}" 2>&1`;
    
    console.log(`[Video Rebuild] Running ffmpeg...`);
    execSync(cmd, { stdio: 'ignore' });

    // Verify the output file was created
    if (!existsSync(outputPath)) {
      throw new Error('Output video file was not created');
    }

    // Verify the output file is valid
    const verifyCmd = `ffprobe -v error -show_entries format=duration -of csv=s=x:p=0 "${outputPath}" 2>&1`;
    try {
      const duration = parseFloat(execSync(verifyCmd, { encoding: 'utf-8' }).trim());
      console.log(`[Video Rebuild] Output video duration: ${duration}s`);
      if (duration <= 0.01) {
        console.warn(`[Video Rebuild] Warning: Output video is very short (${duration}s)`);
      }
    } catch (e) {
      console.warn(`[Video Rebuild] Could not verify duration: ${e.message}`);
    }

    return outputPath;
  } catch (error) {
    console.error('Video rebuild error:', error.message);
    throw new Error(`Video rebuild failed: ${error.message}`);
  }
}

/**
 * Calculate video capacity (in characters)
 */
export async function calculateVideoCapacity(inputPath) {
  const tempDir = join(__dirname, '../temp_video_capacity');

  try {
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    // Get duration from video
    const durationCmd = `ffprobe -v error -show_entries format=duration -of csv=s=x:p=0 "${inputPath}" 2>&1`;
    const duration = parseFloat(execSync(durationCmd, { encoding: 'utf-8' }).trim()) || 0;

    if (duration <= 0) return 0;

    // Extract first frame to get resolution
    const cmd = `ffmpeg -i "${inputPath}" -vframes 1 "${join(tempDir, 'temp_frame.png')}" -y 2>&1`;
    try {
      execSync(cmd, { stdio: 'ignore' });
    } catch (e) {}

    const firstFrame = join(tempDir, 'temp_frame.png');
    if (!existsSync(firstFrame)) {
      return 0;
    }

    const metadata = await sharp(firstFrame).metadata();
    const width = metadata?.width || 0;
    const height = metadata?.height || 0;
    const channels = metadata?.channels || 3;

    console.log(`[Video Capacity] Resolution: ${width}x${height}, Channels: ${channels}`);

    // Estimate total frames (1 frame per second = our extraction rate)
    const totalFrames = Math.max(1, Math.floor(duration)); // At least 1 frame
    const effectiveFrames = Math.max(1, Math.floor(totalFrames / FRAME_SKIP)); // At least 1 frame

    const pixelsPerFrame = width * height * channels;
    const totalPixels = pixelsPerFrame * effectiveFrames;
    const availableBits = Math.max(0, totalPixels - LENGTH_HEADER_BITS); // Ensure not negative
    const capacity = Math.floor(availableBits / 8);
    
    console.log(`[Video Capacity] Duration: ${duration}s, Total frames: ${totalFrames}, Effective frames: ${effectiveFrames}`);
    console.log(`[Video Capacity] Pixels per frame: ${pixelsPerFrame}, Total pixels: ${totalPixels}, Available bits: ${availableBits}`);
    console.log(`[Video Capacity] Calculated capacity: ${capacity} bytes`);

    // Cleanup
    try {
      unlinkSync(firstFrame);
    } catch (e) {}

    return Math.max(0, capacity);
  } catch (error) {
    console.error('Video capacity calculation error:', error);
    return 0;
  }
}

export async function encodeVideoBytes(inputPath, payloadBuffer, outputPath) {
  const tempDir = join(__dirname, '../temp_video_encode');

  try {
    if (!inputPath || !payloadBuffer || !outputPath) throw new Error('Invalid parameters');
    const payload = Buffer.isBuffer(payloadBuffer) ? payloadBuffer : Buffer.from(payloadBuffer);
    if (payload.length > 0xffffffff) throw new Error('Payload too large');

    console.log('[Video Encode Bytes] Starting encode process...');
    const frames = await extractFrames(inputPath, tempDir);
    if (frames.length === 0) throw new Error('No frames extracted from video');

    const lenBuf = Buffer.alloc(LENGTH_HEADER_BYTES);
    lenBuf.writeUInt32BE(payload.length, 0);
    const combined = Buffer.concat([lenBuf, payload]);
    const totalBitsToWrite = combined.length * 8;

    let bitIndex = 0;
    for (let i = 0; i < frames.length && bitIndex < totalBitsToWrite; i += FRAME_SKIP) {
      const framePath = join(tempDir, frames[i]);
      try {
        const result = await sharp(framePath).raw().toBuffer({ resolveWithObject: true });
        if (!result || !result.data || !result.info) continue;

        const { data: pixels, info } = result;
        const { width, height, channels } = info;

        for (let j = 0; j < pixels.length && bitIndex < totalBitsToWrite; j++) {
          const byteIndex = bitIndex >> 3;
          const bitOffset = 7 - (bitIndex & 7);
          const bit = (combined[byteIndex] >> bitOffset) & 1;
          pixels[j] = (pixels[j] & 0xfe) | bit;
          bitIndex++;
        }

        await sharp(pixels, { raw: { width, height, channels } }).png().toFile(framePath);
      } catch (e) {
        console.error(`[Video Encode Bytes] Error processing frame ${frames[i]}:`, e?.message || e);
      }
    }

    if (bitIndex < totalBitsToWrite) {
      throw new Error('Payload too large');
    }

    await rebuildVideo(tempDir, inputPath, outputPath);

    frames.forEach((f) => {
      try {
        unlinkSync(join(tempDir, f));
      } catch (e) {}
    });

    return outputPath;
  } catch (error) {
    throw new Error(`Video encoding failed: ${error.message}`);
  }
}

export async function decodeVideoBytes(inputPath) {
  const tempDir = join(__dirname, '../temp_video_decode');

  try {
    if (!inputPath) throw new Error('Invalid video path');

    console.log('[Video Decode Bytes] Starting decode process...');
    const frames = await extractFrames(inputPath, tempDir, true);
    if (frames.length === 0) throw new Error('No frames extracted from video');

    let length = 0;
    let bitsRead = 0;
    let bitsPerFrame = null;

    // First pass: read the 32-bit payload length.
    outerHeader:
    for (let i = 0; i < frames.length; i++) {
      const framePath = join(tempDir, frames[i]);
      try {
        const result = await sharp(framePath).raw().toBuffer({ resolveWithObject: true });
        if (!result || !result.data) continue;
        const { data: pixels } = result;
        if (bitsPerFrame === null) bitsPerFrame = pixels.length;

        for (let j = 0; j < pixels.length && bitsRead < LENGTH_HEADER_BITS; j++) {
          length = (length << 1) | (pixels[j] & 1);
          bitsRead++;
        }
        if (bitsRead >= LENGTH_HEADER_BITS) break outerHeader;
      } catch (e) {
        console.error(`[Video Decode Bytes] Error processing frame ${frames[i]}:`, e?.message || e);
      }
    }

    if (bitsRead < LENGTH_HEADER_BITS || bitsPerFrame === null) {
      throw new Error('No hidden payload found');
    }

    const totalBitsCapacity = bitsPerFrame * frames.length;
    const usableBits = totalBitsCapacity - LENGTH_HEADER_BITS;
    const maxPayloadBytes = usableBits <= 0 ? 0 : Math.floor(usableBits / 8);

    if (length <= 0 || length > maxPayloadBytes) throw new Error('Invalid payload length');

    const out = Buffer.allocUnsafe(length);

    // Second pass: continue reading bits and fill payload bytes.
    let byteIndex = 0;
    let current = 0;
    let bitInByte = 0;
    let globalBitIndex = 0;

    outerPayload:
    for (let i = 0; i < frames.length; i++) {
      const framePath = join(tempDir, frames[i]);
      try {
        const result = await sharp(framePath).raw().toBuffer({ resolveWithObject: true });
        if (!result || !result.data) continue;
        const { data: pixels } = result;

        for (let j = 0; j < pixels.length; j++) {
          // Skip the length header bits.
          if (globalBitIndex < LENGTH_HEADER_BITS) {
            globalBitIndex++;
            continue;
          }

          current = (current << 1) | (pixels[j] & 1);
          bitInByte++;
          globalBitIndex++;

          if (bitInByte === 8) {
            out[byteIndex] = current;
            byteIndex++;
            if (byteIndex >= length) break outerPayload;
            current = 0;
            bitInByte = 0;
          }
        }
      } catch (e) {
        console.error(`[Video Decode Bytes] Error processing frame ${frames[i]}:`, e?.message || e);
      }
    }

    frames.forEach((f) => {
      try {
        unlinkSync(join(tempDir, f));
      } catch (e) {}
    });

    if (byteIndex !== length) {
      throw new Error('Hidden payload incomplete');
    }

    return out;
  } catch (error) {
    throw new Error(`Video decoding failed: ${error.message}`);
  }
}

/**
 * Check if file is a supported video format
 * Now supports ALL video formats (MP4, AVI, MOV, MKV, WebM, etc.)
 */
export function isSupportedVideo(mimetype) {
  // Accept all video types - ffmpeg will handle format conversion
  return mimetype.startsWith('video/');
}

/**
 * Encode message into video frames using LSB
 */
export async function encodeVideoMessage(inputPath, data, outputPath) {
  const tempDir = join(__dirname, '../temp_video_encode');

  try {
    if (!inputPath || !data || !outputPath) {
      throw new Error('Invalid parameters');
    }

    console.log(`[Video Encode] Starting encode process...`);

    // Extract frames
    const frames = await extractFrames(inputPath, tempDir);

    if (frames.length === 0) {
      throw new Error('No frames extracted from video');
    }

    console.log(`[Video Encode] Extracted ${frames.length} frames`);

    // Prepare data to embed
    const headerText = `${data.length}${HEADER_DELIMITER}`;
    const headerBinary = stringToBinary(headerText);
    const dataBinary = stringToBinary(data);
    const totalBinary = headerBinary + dataBinary;
    let binaryIndex = 0;

    // Encode data into selected frames
    for (let i = 0; i < frames.length && binaryIndex < totalBinary.length; i += FRAME_SKIP) {
      const framePath = join(tempDir, frames[i]);
      
      try {
        const result = await sharp(framePath)
          .raw()
          .toBuffer({ resolveWithObject: true });

        if (!result || !result.data) continue;

        const { data: pixels, info } = result;
        const { width, height, channels } = info;

        // Encode bits into this frame
        for (let j = 0; j < pixels.length && binaryIndex < totalBinary.length; j++) {
          const bit = parseInt(totalBinary[binaryIndex]);
          pixels[j] = (pixels[j] & 0xFE) | bit;
          binaryIndex++;
        }

        // Save modified frame
        await sharp(pixels, {
          raw: { width, height, channels }
        })
          .png()
          .toFile(framePath);
      } catch (e) {
        console.error(`Error processing frame ${frames[i]}:`, e);
      }
    }

    if (binaryIndex < totalBinary.length) {
      throw new Error(`Message too large for video (embedded ${binaryIndex}/${totalBinary.length} bits)`);
    }

    console.log(`[Video Encode] Embedded ${totalBinary.length} bits into video`);

    // Rebuild video with modified frames
    await rebuildVideo(tempDir, inputPath, outputPath);

    // Cleanup temp frames
    frames.forEach(f => {
      try {
        unlinkSync(join(tempDir, f));
      } catch (e) {}
    });

    console.log(`[Video Encode] Successfully encoded video to ${outputPath}`);

    return outputPath;
  } catch (error) {
    throw new Error(`Video encoding failed: ${error.message}`);
  }
}

/**
 * Decode message from video frames
 */
export async function decodeVideoMessage(inputPath) {
  const tempDir = join(__dirname, '../temp_video_decode');

  try {
    if (!inputPath) {
      throw new Error('Invalid video path');
    }

    console.log(`[Video Decode] Starting decode process...`);

    // Extract ALL frames for decoding to ensure we find the hidden data
    // This is more robust against frame rate differences and compression artifacts
    const frames = await extractFrames(inputPath, tempDir, true);

    if (frames.length === 0) {
      throw new Error('No frames extracted from video - the stego video may be corrupted');
    }

    console.log(`[Video Decode] Extracted ${frames.length} frames`);

    // Extract LSB bits from frames to find the hidden data
    const extractedBits = [];
    let headerEndIndex = -1;
    let requiredTotalBits = null;
    let messageLength = null;
    let headerError = null;
    const delimiterBinary = stringToBinary(HEADER_DELIMITER);

    // Process frames sequentially until we have the full message
    outer:
    for (let i = 0; i < frames.length; i++) {
      const framePath = join(tempDir, frames[i]);
      
      try {
        const result = await sharp(framePath)
          .raw()
          .toBuffer({ resolveWithObject: true });

        if (!result || !result.data) continue;

        const { data: pixels } = result;

        for (let j = 0; j < pixels.length; j++) {
          extractedBits.push((pixels[j] & 1).toString());
          
          // Check if we have the delimiter
          if (headerEndIndex === -1 && extractedBits.length >= delimiterBinary.length) {
            const recentBits = extractedBits.slice(-delimiterBinary.length).join('');
            if (recentBits === delimiterBinary) {
              headerEndIndex = extractedBits.length - delimiterBinary.length;
              console.log(`[Video Decode] Found delimiter at bit ${headerEndIndex}`);

              const headerBinary = extractedBits.slice(0, headerEndIndex).join('');
              messageLength = parseInt(binaryToString(headerBinary), 10);
              console.log(`[Video Decode] Message length from header: ${messageLength}`);

              if (isNaN(messageLength) || messageLength <= 0) {
                headerError = new Error('Invalid message length');
                break outer;
              }

              const maxBits = frames.length * pixels.length;
              requiredTotalBits = headerEndIndex + delimiterBinary.length + (messageLength * 8);

              if (requiredTotalBits > maxBits) {
                headerError = new Error('Invalid message length (exceeds video capacity)');
                break outer;
              }
            }
          }

          if (requiredTotalBits !== null && extractedBits.length >= requiredTotalBits) {
            break outer;
          }
        }
      } catch (e) {
        console.error(`Error processing frame ${frames[i]}:`, e);
      }
    }

    if (headerError) {
      // Cleanup
      frames.forEach(f => {
        try {
          unlinkSync(join(tempDir, f));
        } catch (e) {}
      });
      throw headerError;
    }

    if (headerEndIndex === -1) {
      // Cleanup
      frames.forEach(f => {
        try {
          unlinkSync(join(tempDir, f));
        } catch (e) {}
      });
      throw new Error('No hidden message found in video - delimiter not found');
    }

    if (requiredTotalBits === null || messageLength === null) {
      frames.forEach(f => {
        try {
          unlinkSync(join(tempDir, f));
        } catch (e) {}
      });
      throw new Error('Unable to read message header');
    }

    // Extract message
    const messageStartIndex = headerEndIndex + delimiterBinary.length;
    const messageEndIndex = messageStartIndex + (messageLength * 8);

    if (messageEndIndex > extractedBits.length) {
      // Cleanup
      frames.forEach(f => {
        try {
          unlinkSync(join(tempDir, f));
        } catch (e) {}
      });
      throw new Error(`Video message incomplete (need ${messageEndIndex} bits, have ${extractedBits.length})`);
    }

    const messageBinary = extractedBits.slice(messageStartIndex, messageEndIndex).join('');
    const message = binaryToString(messageBinary);

    console.log(`[Video Decode] Successfully extracted message (${message.length} chars)`);

    // Cleanup temp frames
    frames.forEach(f => {
      try {
        unlinkSync(join(tempDir, f));
      } catch (e) {}
    });

    return message;
  } catch (error) {
    throw new Error(`Video decoding failed: ${error.message}`);
  }
}

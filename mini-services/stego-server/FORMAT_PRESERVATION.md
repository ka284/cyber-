# Lossless Output Behavior - Summary

This project **always outputs lossless formats** to preserve the hidden LSB data reliably.

## ✅ Current Behavior

### Output Formats
- **Images** → PNG (lossless)
- **Audio** → WAV (PCM, lossless)
- **Video** → MKV (FFV1, lossless)

### Examples
- MP4 input → **MKV output**
- MP3 input → **WAV output**
- JPG input → **PNG output**

This is intentional. Lossy formats (MP4/MP3/JPG) will destroy LSB data during re-encoding.

---

## 🔧 Why Lossless Output Is Required

LSB steganography stores data in the least significant bits.  
Any lossy compression will alter those bits and corrupt the hidden data.

Lossless containers/codecs (PNG/WAV/MKV-FFV1) keep the embedded bits intact.

---

## 🔄 Encoding Flow (Actual)

### Video Example (MP4 → MKV)
```
1. User uploads: video.mp4
2. Frames are extracted and modified
3. Video is rebuilt as MKV (FFV1 lossless)
4. User downloads: stego_video.mkv
```

### Audio Example (MP3 → WAV)
```
1. User uploads: music.mp3
2. Converted to WAV for processing
3. Hidden data is embedded
4. User downloads: stego_audio.wav
```

### Image Example (JPG → PNG)
```
1. User uploads: photo.jpg
2. Converted internally to PNG
3. Hidden data is embedded
4. User downloads: stego_image.png
```

---

## ✅ Carrier Type Validation (Still Enforced)

If you encode using a video carrier, you must decode with a video stego file  
(same category: image/audio/video), not a different type.

---

## 📝 Notes

If you want original-format output (e.g., MP4 → MP4), the code must **re-encode**
back into a lossy format, which will make decoding unreliable. That’s why the
current implementation prioritizes **data integrity over format preservation**.

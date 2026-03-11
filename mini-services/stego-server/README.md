# Secure Multimedia Steganography System

Hide **text messages or ANY file** (images, PDFs, documents, audio, video, etc.) inside images, audio, or video using AES-256-GCM encryption and LSB steganography.

---

## 🚀 Quick Start

### 1. Navigate to stego-server
```bash
cd mini-services/stego-server
```

### 2. Install dependencies
```bash
bun install
```

### 3. Start the server
```bash
# Dev (hot reload)
bun run dev
# OR
node index.js
```

### 4. Open in browser
```
http://localhost:3030/
```

---

## 🗄️ MySQL Setup (Required for Operation Logs)

The server writes encode/decode metadata to MySQL (no secrets or passwords are stored).

### .env File (Recommended)
Create `mini-services/stego-server/.env` using the template below.

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=stego
PORT=3030
```

### Environment Variables
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=stego
```

### Notes
- The server will **auto-create** the database and `stego_operations` table if your MySQL user has permission.
- If your user cannot create databases, create it manually:
```
CREATE DATABASE stego;
```

---

## ✨ Features

### ✅ Multiple Carrier Types
- **Images**: ALL formats (JPEG, PNG, WebP, BMP, GIF, TIFF, AVIF, etc.)
- **Audio**: ALL formats (MP3, WAV, AAC, M4A, OGG, FLAC, etc.)
- **Video**: ALL formats (MP4, AVI, MOV, MKV, WebM, WMV, etc.)

### ✅ Lossless Output (Reliable Decoding)
- **Image output**: PNG (lossless)
- **Audio output**: WAV (lossless PCM)
- **Video output**: MKV (lossless FFV1)
- Lossless output is required so LSB data survives encoding/decoding

### ✅ Hide Any Data Type
- **Text Messages**: Secret words, passwords, notes
- **Files**: Images, PDFs, documents, audio, video, archives, etc.

### ✅ Security
- **Encryption**: AES-256-GCM
- **Password protection**: Required for both encoding and decoding
- **Carrier type validation**: Must use same file type for encoding/decoding

### ✅ No File Size Limits
- Within your instance's capacity
- Larger carriers = more hidden data capacity

---

## 🎯 How to Use

### Hiding a Text Message:
1. Go to **Encode** page
2. Upload carrier file (image/audio/video)
3. Select **"📝 Text Message"**
4. Enter your secret message
5. Enter password
6. Click **"Encode & Encrypt"**
7. Download stego file

### Hiding a File:
1. Go to **Encode** page
2. Upload carrier file (image/audio/video)
3. Select **"📁 File (Image, PDF, Doc, etc.)"**
4. Upload the file you want to hide
5. Enter password
6. Click **"Encode & Encrypt"**
7. Download stego file

### Extracting Data:
1. Go to **Decode** page
2. Upload stego file (MUST be same type as carrier used for encoding)
3. Enter password
4. Click **"Decode & Decrypt"**
5. See your message or download the hidden file

---

## ⚠️ Important: Carrier Type Validation

**You MUST use the same file type for encoding and decoding!**

### Examples (Lossless output):
- ✅ Encode MP4 → Download MKV → Decode MKV
- ✅ Encode AVI → Download MKV → Decode MKV
- ✅ Encode MP3 → Download WAV → Decode WAV
- ✅ Encode WAV → Download WAV → Decode WAV
- ✅ Encode PNG → Download PNG → Decode PNG
- ❌ Encode MP4 → Decode MP4 ❌ **(Lossy, will fail)**
- ❌ Encode MP3 → Decode MP3 ❌ **(Lossy, will fail)**

**Important Note:**
- When you upload video, the output will be **MKV (lossless)**
- When you upload audio, the output will be **WAV (lossless)**
- When you upload images, the output will be **PNG (lossless)**

**Error message if wrong type:**
> "Invalid file type for decoding. This stego file was created using a video carrier. Please upload the correct file type (video) for decoding."

---

## 🔧 Troubleshooting

### Issue: "Invalid file type for decoding"
**Cause**: You're using a different file type than what was used for encoding.
**Fix**: Upload the same file type (image/audio/video) that was used during encoding.

### Issue: "Message too large"
**Cause**: Secret data exceeds carrier file capacity.
**Fix**: Use a larger carrier file or smaller secret. (The server auto-compresses when it helps, but limits still apply.)

### Issue: "Network error"
**Cause**: Server not running or wrong port.
**Fix**: Make sure server is running on port 3030.

### Issue: "No valid hidden message found"
**Cause**: Wrong password, wrong file, or corrupted file.
**Fix**: Use the same password and correct stego file.

---

## 📊 File Structure

```
stego-server/
├── package.json          # Dependencies
├── index.js              # Express server
├── Dockerfile            # Docker configuration
├── build.sh              # Build script for Node.js deployment
├── .gitignore            # Git exclusions
├── .dockerignore         # Docker exclusions
├── modules/
│   ├── encryption.js     # AES-256-GCM encryption
│   ├── steganography.js  # Image steganography
│   ├── audio-steganography.js  # Audio steganography
│   └── video-steganography.js  # Video steganography
└── public/
    ├── index.html        # Main UI
    ├── styles.css        # Styles
    ├── app.js            # Frontend logic
    └── logo.svg          # Logo
```

---

## 🚀 Deploy to Render

### Option 1: Docker (Recommended)
- Environment: **Docker**
- Build Command: *(leave empty)*
- Start Command: *(leave empty)*

### Option 2: Node.js
- Environment: **Node**
- Build Command: `bash build.sh && npm install`
- Start Command: `node index.js`

---

## 🎯 Testing

Start with:
1. Small carrier file (under 1MB)
2. Short message or small file (under 100KB)
3. Simple password (test with "test123")

If basic test works, try larger files!

---

## 📝 Capacity Guidelines

| Carrier Type | Approx. Capacity |
|--------------|------------------|
| Image (1920x1080, RGB) | ~1.5 MB |
| Audio (1 min, 44.1kHz, stereo) | ~5 MB |
| Video (1 min, 1080p, 1 fps) | ~2 MB |

---

## 🔍 Debug Mode

Open browser console (F12) to see:
- API requests
- Error messages
- Upload progress

---

## Need Help?

Check:
1. ✅ Server is running on port 3030
2. ✅ Using same file type for encode/decode
3. ✅ Using same password for encode/decode
4. ✅ Browser console for errors
5. ✅ Server terminal for errors

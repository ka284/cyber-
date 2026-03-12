// Secure Multimedia Steganography System

// Detect if running locally
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '';
const isStegoServer = window.location.port === '3030' || window.location.hostname.includes('192.168');

// Set API URL
let API_BASE = '/api';
if (isLocalhost && !isStegoServer) {
  API_BASE = 'http://localhost:3030/api';
}

// DOM elements
const navBtns = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('.theme-icon');

// File type configurations
const fileTypes = {
  image: {
    icon: '📷',
    label: 'Image',
    extension: '.png',
    contentType: 'image/png'
  },
  audio: {
    icon: '🎵',
    label: 'Audio',
    extension: '.wav',
    contentType: 'audio/wav'
  },
  video: {
    icon: '🎬',
    label: 'Video',
    extension: '.mkv',
    contentType: 'video/x-matroska'
  }
};

// Detect file type from File object
function getFileType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  const ext = (file.name || '').toLowerCase().split('.').pop();
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif', 'svg', 'ico', 'avif', 'heic', 'heif', 'psd', 'raw', 'cr2', 'nef'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'aiff', 'aif', 'aifc', 'au', 'ra', 'wv'];
  const videoExts = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv', 'flv', 'm4v', '3gp', 'ts', 'mts', 'm2ts', 'asf', 'rm', 'rmvb', 'vob', 'ogv'];
  if (imageExts.includes(ext)) return 'image';
  if (audioExts.includes(ext)) return 'audio';
  if (videoExts.includes(ext)) return 'video';
  return 'unknown';
}

// Theme functions
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'bright';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'bright';
  const newTheme = currentTheme === 'dark' ? 'bright' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

// Page navigation
function showPage(pageName) {
  pages.forEach(page => {
    page.style.display = page.id === `${pageName}-page` ? 'block' : 'none';
  });
  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageName);
  });
}

// Password toggle
function togglePassword(targetId) {
  const input = document.getElementById(targetId);
  const btn = document.querySelector(`[data-target="${targetId}"]`);
  if (input && btn) {
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁️' : '🔒';
  }
}

// File upload preview
function setupFileUpload(isEncode) {
  const prefix = isEncode ? 'encode' : 'decode';
  const container = document.getElementById(`${prefix}FileUpload`);
  const placeholder = document.getElementById(`${prefix}UploadPlaceholder`);
  const previewContainer = document.getElementById(`${prefix}PreviewContainer`);
  const input = document.getElementById(`${prefix}File`);

  if (!container || !input) return;

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      // Hide all previews first
      ['Image', 'Audio', 'Video'].forEach(mediaType => {
        const preview = document.getElementById(`${prefix}${mediaType}Preview`);
        if (preview) {
          preview.style.display = 'none';
          preview.src = '';
        }
      });

      // Detect file type and show appropriate preview
      const fileType = getFileType(file);
      let previewElement;

      if (fileType === 'image') {
        previewElement = document.getElementById(`${prefix}ImagePreview`);
        previewElement.src = event.target.result;
      } else if (fileType === 'audio') {
        previewElement = document.getElementById(`${prefix}AudioPreview`);
        previewElement.src = event.target.result;
      } else if (fileType === 'video') {
        previewElement = document.getElementById(`${prefix}VideoPreview`);
        previewElement.src = event.target.result;
      }

      if (previewElement) {
        previewElement.style.display = 'block';
        previewContainer.style.display = 'block';
        placeholder.style.display = 'none';
      }
    };

    reader.readAsDataURL(file);
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    container.classList.add('dragover');
  });

  container.addEventListener('dragleave', () => {
    container.classList.remove('dragover');
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    container.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

// Setup secret file upload (for hiding files inside media)
function setupSecretFileUpload() {
  const container = document.getElementById('secretFileUpload');
  const placeholder = document.getElementById('secretUploadPlaceholder');
  const previewContainer = document.getElementById('secretFilePreviewContainer');
  const input = document.getElementById('secretFile');

  if (!container || !input) return;

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show file info
    document.getElementById('secretFileName').textContent = `File: ${file.name}`;
    document.getElementById('secretFileSize').textContent = `Size: ${formatFileSize(file.size)}`;

    previewContainer.style.display = 'block';
    placeholder.style.display = 'none';
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    container.classList.add('dragover');
  });

  container.addEventListener('dragleave', () => {
    container.classList.remove('dragover');
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    container.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

// Setup data type selector
function setupDataTypeSelector() {
  const radioButtons = document.querySelectorAll('input[name="dataType"]');
  const textGroup = document.getElementById('textMessageGroup');
  const fileGroup = document.getElementById('secretFileGroup');
  const messageInput = document.getElementById('encodeMessage');
  const secretFileInput = document.getElementById('secretFile');

  radioButtons.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'text') {
        textGroup.style.display = 'block';
        fileGroup.style.display = 'none';
        messageInput.required = true;
        secretFileInput.required = false;
      } else {
        textGroup.style.display = 'none';
        fileGroup.style.display = 'block';
        messageInput.required = false;
        secretFileInput.required = true;
      }
    });
  });
}

// Show result message
function showResult(id, success, message) {
  const card = document.getElementById(id);
  const icon = card.querySelector('.result-icon');
  const msg = card.querySelector('.result-message');
  
  card.className = 'result-card ' + (success ? 'success' : 'error');
  icon.textContent = success ? '✅' : '❌';
  msg.textContent = message;
  card.style.display = 'block';
}

function resetMediaUpload(prefix) {
  const input = document.getElementById(`${prefix}File`);
  const previewContainer = document.getElementById(`${prefix}PreviewContainer`);
  const placeholder = document.getElementById(`${prefix}UploadPlaceholder`);

  if (input) input.value = '';
  if (previewContainer) previewContainer.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';

  ['Image', 'Audio', 'Video'].forEach(mediaType => {
    const preview = document.getElementById(`${prefix}${mediaType}Preview`);
    if (preview) {
      if (typeof preview.pause === 'function') preview.pause();
      preview.src = '';
      if (typeof preview.load === 'function') preview.load();
      preview.style.display = 'none';
    }
  });
}

function resetStegoPreview() {
  const stegoResult = document.getElementById('stegoResult');
  if (stegoResult) stegoResult.style.display = 'none';

  ['stegoImage', 'stegoAudio', 'stegoVideo'].forEach(id => {
    const preview = document.getElementById(id);
    if (preview) {
      if (typeof preview.pause === 'function') preview.pause();
      preview.src = '';
      if (typeof preview.load === 'function') preview.load();
      preview.style.display = 'none';
    }
  });
}

function resetEncodeFormFields() {
  const messageInput = document.getElementById('encodeMessage');
  const passwordInput = document.getElementById('encodePassword');
  const secretFileInput = document.getElementById('secretFile');
  const encodeResult = document.getElementById('encodeResult');
  const secretPreview = document.getElementById('secretFilePreviewContainer');
  const secretPlaceholder = document.getElementById('secretUploadPlaceholder');
  const textGroup = document.getElementById('textMessageGroup');
  const fileGroup = document.getElementById('secretFileGroup');

  if (messageInput) messageInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (secretFileInput) secretFileInput.value = '';
  if (encodeResult) encodeResult.style.display = 'none';
  if (secretPreview) secretPreview.style.display = 'none';
  if (secretPlaceholder) secretPlaceholder.style.display = 'block';
  const secretName = document.getElementById('secretFileName');
  const secretSize = document.getElementById('secretFileSize');
  if (secretName) secretName.textContent = '';
  if (secretSize) secretSize.textContent = '';

  // Reset data type selection to text
  const textRadio = document.querySelector('input[name="dataType"][value="text"]');
  if (textRadio) textRadio.checked = true;
  if (textGroup) textGroup.style.display = 'block';
  if (fileGroup) fileGroup.style.display = 'none';
  if (messageInput) messageInput.required = true;
  if (secretFileInput) secretFileInput.required = false;
}

function resetDecodeFormFields() {
  const passwordInput = document.getElementById('decodePassword');
  const decodeResult = document.getElementById('decodeResult');
  const decodedMessageCard = document.getElementById('decodedMessageCard');
  const decodedMessage = document.getElementById('decodedMessage');
  const decodedFileContainer = document.getElementById('decodedFileContainer');
  const decodedFileInfo = document.getElementById('decodedFileInfo');

  if (passwordInput) passwordInput.value = '';
  if (decodeResult) decodeResult.style.display = 'none';
  if (decodedMessageCard) decodedMessageCard.style.display = 'none';
  if (decodedMessage) decodedMessage.textContent = '';
  if (decodedFileContainer) decodedFileContainer.style.display = 'none';
  if (decodedFileInfo) decodedFileInfo.textContent = '';
}

// Encode function
async function encode(e) {
  e.preventDefault();

  const btn = document.getElementById('encodeBtn');
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');

  hideResult('encodeResult');
  document.getElementById('stegoResult').style.display = 'none';
  resetMediaUpload('decode');
  resetDecodeFormFields();

  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';

  try {
    // Get the selected data type
    const dataType = document.querySelector('input[name="dataType"]:checked').value;
    let messageToSend = '';

    // Prepare the data to send
    if (dataType === 'file') {
      const secretFile = document.getElementById('secretFile').files[0];
      if (!secretFile) {
        showResult('encodeResult', false, 'Please select a file to hide.');
        return;
      }

      // Convert file to base64 with metadata
      const base64Data = await fileToBase64(secretFile);
      // Format: FILE::filename::mimetype::base64data
      messageToSend = `FILE::${secretFile.name}::${secretFile.type}::${base64Data}`;
    } else {
      // Plain text message
      messageToSend = document.getElementById('encodeMessage').value;
    }

    // Get carrier file type
    const carrierFile = document.getElementById('encodeFile').files[0];
    const carrierFileType = getFileType(carrierFile);

    // Create FormData
    const formData = new FormData();
    const password = document.getElementById('encodePassword').value;

    formData.append('file', carrierFile);
    formData.append('message', messageToSend);
    formData.append('password', password);
    if (carrierFileType !== 'unknown') {
      formData.append('carrierType', carrierFileType); // Add carrier type for validation
    }

    let url = `${API_BASE}/encode`;
    if (!isLocalhost && !isStegoServer) url += '?XTransformPort=3030';

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Get file type from the uploaded file
      const fileInput = document.getElementById('encodeFile');
      const uploadedFile = fileInput.files[0];
      const fileType = getFileType(uploadedFile);
      const config = fileTypes[fileType] || fileTypes.image;

      // Use lossless output extension for download
      const outputExtension = config.extension;

      // Hide all stego previews
      ['stegoImage', 'stegoAudio', 'stegoVideo'].forEach(id => {
        document.getElementById(id).style.display = 'none';
      });

      // Show appropriate preview
      let previewElement;
      if (fileType === 'image') {
        previewElement = document.getElementById('stegoImage');
        previewElement.src = blobUrl;
      } else if (fileType === 'audio') {
        previewElement = document.getElementById('stegoAudio');
        previewElement.src = blobUrl;
      } else if (fileType === 'video') {
        previewElement = document.getElementById('stegoVideo');
        previewElement.src = blobUrl;
      }

      if (previewElement) {
        previewElement.style.display = 'block';
      }

      // Update title and description
      const dataTypeText = dataType === 'file' ? 'file' : 'message';
      document.getElementById('stegoTitle').textContent = `Stego ${config.label} Ready`;
      document.getElementById('stegoDescription').textContent =
        `Your ${dataTypeText} has been encrypted and hidden in this ${config.label.toLowerCase()} (${outputExtension.substring(1).toUpperCase()}) using AES-256-GCM encryption and LSB steganography. This lossless format ensures reliable decoding.`;

      document.getElementById('stegoResult').style.display = 'block';

      document.getElementById('downloadStego').onclick = () => {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `stego_${Date.now()}${outputExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      showResult('encodeResult', true, `${dataTypeText.charAt(0).toUpperCase() + dataTypeText.slice(1)} encoded successfully!`);
    } else {
      const error = await response.json();
      showResult('encodeResult', false, error.error || 'Encoding failed');
    }
  } catch (error) {
    console.error(error);
    showResult('encodeResult', false, 'Network error. Please try again.');
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
  }
}

// Decode function
async function decode(e) {
  e.preventDefault();

  const btn = document.getElementById('decodeBtn');
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');

  hideResult('decodeResult');
  document.getElementById('decodedMessageCard').style.display = 'none';

  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';

  try {
    let url = `${API_BASE}/decode`;
    if (!isLocalhost && !isStegoServer) url += '?XTransformPort=3030';

    const response = await fetch(url, {
      method: 'POST',
      body: new FormData(e.target)
    });

    const data = await response.json();

    if (data.success) {
      const decodedData = data.message;

      // Check if the decoded data is a file
      if (decodedData.startsWith('FILE::')) {
        // Parse file data: FILE::filename::mimetype::base64data
        const parts = decodedData.split('::');
        if (parts.length >= 4) {
          const filename = parts[1];
          const mimetype = parts[2];
          const base64Data = parts[3];

          // Show file download
          document.getElementById('decodedMessage').style.display = 'none';
          document.getElementById('decodedFileContainer').style.display = 'block';
          document.getElementById('decodedFileInfo').textContent =
            `Hidden file found: ${filename} (${formatFileSize(Math.round(base64Data.length * 0.75))})`;

          // Setup download button
          const downloadBtn = document.getElementById('downloadDecodedFile');
          downloadBtn.onclick = () => {
            // Convert base64 back to blob
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimetype });
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          };
        }
      } else {
        // Plain text message
        document.getElementById('decodedMessage').textContent = decodedData;
        document.getElementById('decodedMessage').style.display = 'block';
        document.getElementById('decodedFileContainer').style.display = 'none';
      }

      document.getElementById('decodedMessageCard').style.display = 'block';
      showResult('decodeResult', true, 'Data decoded successfully!');

      // Clear encode carrier preview so a new file can be added after decode.
      resetMediaUpload('encode');
      resetStegoPreview();
      resetEncodeFormFields();
    } else {
      showResult('decodeResult', false, data.error || 'Decoding failed');
    }
  } catch (error) {
    console.error(error);
    showResult('decodeResult', false, 'Network error. Please try again.');
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
  }
}

function hideResult(id) {
  document.getElementById(id).style.display = 'none';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  themeToggle.addEventListener('click', toggleTheme);

  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => showPage(e.target.dataset.page));
  });

  document.querySelectorAll('.hero-buttons .btn').forEach(btn => {
    btn.addEventListener('click', (e) => showPage(e.target.dataset.page));
  });

  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => togglePassword(btn.dataset.target));
  });

  setupFileUpload(true);  // encode
  setupFileUpload(false); // decode
  setupSecretFileUpload();  // secret file upload
  setupDataTypeSelector();  // data type selector

  document.getElementById('encodeForm').addEventListener('submit', encode);
  document.getElementById('decodeForm').addEventListener('submit', decode);
});

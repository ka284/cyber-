#!/bin/bash

# Build script for Render deployment
# This script installs FFmpeg before running npm install

echo "Installing FFmpeg..."
apt-get update && apt-get install -y ffmpeg

echo "Installing Node dependencies..."
npm install

echo "Build complete!"

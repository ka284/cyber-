# Use Node.js 18 as base image
FROM node:18-slim

# Install FFmpeg for video/audio processing
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads temp temp_video_encode temp_video_decode temp_video_capacity

# Expose the port
EXPOSE 3030

# Start the application
CMD ["node", "index.js"]

# Use Node.js as the base image
FROM node:20-slim

# Install system dependencies for youtube-dl and ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./

# Skip youtube-dl binary download during npm install
ENV YOUTUBE_DL_SKIP_DOWNLOAD=true

RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Expose the port Hugging Face expects
EXPOSE 7860

ENV PORT=7860

# Start the application
CMD ["npm", "start"]

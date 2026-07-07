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
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application (Vite + esbuild)
RUN npm run build

# Expose the port Hugging Face expects (7860)
EXPOSE 7860

# Set environment variable for port
ENV PORT=7860

# Start the application
CMD ["npm", "start"]

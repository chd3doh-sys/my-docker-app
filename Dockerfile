# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application source code
COPY . .

# Create upload directory
RUN mkdir -p "uploaded files"

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]

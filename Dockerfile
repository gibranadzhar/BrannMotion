# Use the official Node.js light alpine image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files first for caching layers
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the rest of the application files
COPY server.js ./
COPY public/ ./public/

# Expose the application port
EXPOSE 5000

# Start the application
CMD [ "npm", "start" ]

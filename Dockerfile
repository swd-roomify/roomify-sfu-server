FROM node:18-bullseye
RUN apt-get update && apt-get install -y python3 python3-pip build-essential

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .


# Expose the port the app runs on
EXPOSE 8082

# Command to start the application
CMD ["npm", "start"]
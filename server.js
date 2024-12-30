const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors'); // Import CORS middleware
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'], // Specify allowed HTTP methods
    allowedHeaders: ['Content-Type'], // Specify allowed headers
  },
});

app.use(cors());

const PORT = 8082;
let rooms = {};
let workers = [];
let nextWorkerIdx = 0;

// Create mediasoup workers
const createWorkers = async () => {
  const numWorkers = 1; // Adjust as needed
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker();
    workers.push(worker);
  }
};

const getNextWorker = () => {
  const worker = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return worker;
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('createRoom', async (username, callback) => {
    const roomId = Math.random().toString(36).substr(2, 9); // Generate a room ID
    const worker = getNextWorker();
    const router = await worker.createRouter({
      mediaCodecs: [
        { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
        { kind: 'video', mimeType: 'video/H264', clockRate: 90000, parameters: { 'packetization-mode': 1 } },
      ],
    });

    rooms[roomId] = { router, users: [{ socketId: socket.id, username }] };
    socket.join(roomId);
    callback({ roomId, rtpCapabilities: router.rtpCapabilities });
  });

  socket.on('joinRoom', (roomId, username, callback) => {
    const room = rooms[roomId];
    if (!room) {
      callback({ error: 'Room not found' });
      return;
    }
    room.users.push({ socketId: socket.id, username });
    socket.join(roomId);
    callback({ rtpCapabilities: room.router.rtpCapabilities });
  });

  socket.on('getRouterRtpCapabilities', (roomId, callback) => {
    const room = rooms[roomId];
    if (room) {
      callback(room.router.rtpCapabilities);
    } else {
      callback({ error: 'Room not found' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      rooms[roomId].users = rooms[roomId].users.filter((user) => user.socketId !== socket.id);
      if (rooms[roomId].users.length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

// Start the server
server.listen(PORT, async () => {
  await createWorkers();
  console.log(`Server running on port ${PORT}`);
});
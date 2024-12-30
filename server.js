const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  },
});

app.use(cors());

const PORT = 8082;
const numWorkers = 10;
let rooms = {};
let workers = [];
let nextWorkerIdx = 0;

const createWorkers = async () => {
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker();
    workers.push(worker);
  }
};

// Round robin strategy to select worker
const getNextWorker = () => {
  const worker = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return worker;
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('createRoom', async (username, callback) => {
    const roomId = Math.random().toString(36).substring(2, 9);
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

server.listen(PORT, async () => {
  await createWorkers();
  console.log(`Server running on port ${PORT}`);
});
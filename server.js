const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mediasoup = require("mediasoup");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let worker, router, transports = [];

async function createWorker() {
  worker = await mediasoup.createWorker();
  worker.on("died", () => {
    console.error("Mediasoup worker died");
    process.exit(1);
  });

  router = await worker.createRouter({
    mediaCodecs: [
      { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
      { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
      { kind: "video", mimeType: "video/H264", clockRate: 90000, parameters: { "packetization-mode": 1 } },
    ],
  });

  console.log("Worker and Router initialized");
}
const consumers = [];
const producers = [];

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Gửi RTP Capabilities tới client
  socket.on("getRouterRtpCapabilities", (data, callback) => {
    callback(router.rtpCapabilities);
  });

  // Tạo WebRTC Transport
  socket.on("createWebRtcTransport", async (_, callback) => {
    try {
      const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: "127.0.0.1", announcedIp: null }], // Cập nhật IP công khai nếu cần
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      transports.push(transport);

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (error) {
      console.error("Error creating WebRtcTransport:", error);
      callback({ error: error.message });
    }
  });

  // Kết nối WebRTC Transport
  socket.on("connectWebRtcTransport", async ({ transportId, dtlsParameters }, callback) => {
    const transport = transports.find((t) => t.id === transportId);

    if (!transport) {
      return callback({ error: "Transport not found" });
    }

    try {
      await transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (error) {
      console.error("Error connecting transport:", error);
      callback({ error: error.message });
    }
  });

  // Tạo Producer cho stream
  socket.on("produce", async ({ transportId, kind, rtpParameters }, callback) => {
    const transport = transports.find((t) => t.id === transportId);

    if (!transport) {
      return callback({ error: "Transport not found" });
    }

    try {
      const producer = await transport.produce({ kind, rtpParameters });
      callback({ id: producer.id });
    } catch (error) {
      console.error("Error creating producer:", error);
      callback({ error: error.message });
    }
  });
});

createWorker().then(() => {
  server.listen(2999, () => {
    console.log("Server is running on http://localhost:2999");
  });
});

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { createWorker } = require("mediasoup");
const ProducerTransport = require("./component/producer-transport");
const { payload, verifyPayload } = require("./component/utils");

const routerRtpCapabilities = "router-rtp-capabilities";
const serverLog = "server-log";
const connection = "connection";
const err = "error";

// producer
const createProducerTransport = "create-producer-transport";
const producerTransportCreated = "producer-transport-created";
const closeProducerTransport = "close-producer-transport";
const producerId = "producer-id";

// consumer
const consume = "consume";
const subscribed = "subscribed";
const subTransportCreated = "sub-transport-created";
const createConsumerTransport = "create-consumer-transport";
const connectConsumerTransport = "connect-consumer-transport";

// transport
const transportConnect = "transport-connect";
const transportProduce = "transport-produce";


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let mediasoupRouter;

const producerTransports = [];
const consumerTransports = new Map();

const mediaCodecs = [
    {
        kind       : "video",
        mimeType   : "video/H264",
        clockRate  : 90000,
        parameters : {
            "packetization-mode"      : 1,
            "profile-level-id"        : "42e01f",
            "level-asymmetry-allowed" : 1
        }
    },
    {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2, // 1 for mono and 2 for stereo better use 2 here for better audio quality, 
                        // but in case of low bandwidth use 1
    },
  ];

const webRtcConfig = {
    listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: '192.168.100.207',
        },
      ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
}

const startMediasoup = async () => {
  const worker = await createWorker();
  mediasoupRouter = await worker.createRouter({ mediaCodecs });
  console.log("Mediasoup worker created and router initialized.");
};

io.on(connection, (socket) => {
    console.log("New client connected:", socket.id);

    const send = async (type, data) => {
        socket.emit(type, data ? await payload(data) : undefined);
    }

    if (mediasoupRouter) {
        send(routerRtpCapabilities, mediasoupRouter.rtpCapabilities);
    }

    socket.onAny(async (event, data) => {
        if (!await verifyPayload(data)) {
            send(err, payload("Invalid payload"));
            return;
        }

        const payload = JSON.parse(data);

        switch (event) {
            case createProducerTransport:
                await handleCreateProducerTransport(payload);
                break;
            case closeProducerTransport:
                await handleCloseProducerTransport(payload);
                break;
            case createConsumerTransport:
                await handleCreateConsumerTransport();
                break;
            case transportConnect:
                await handleTransportConnect(payload);
                break;
            case transportProduce:
                await handleTransportProduce(payload);
                break;
            case connectConsumerTransport:
                await handleConnectConsumerTransport(payload);
                break;
            case consume:
                await handleConsume(payload);
                break;    
            default:
                console.warn(errorMessage.unknowServerMessage + event);
                break;
        }
    });


    const addProducer = (userId, producerId, producerTransport) => {
        const pt = new ProducerTransport(userId, producerId, producerTransport);
        producerTransports.push(pt);
    }

    const removeByUserId = (userId) => {
        const index = producerTransports.findIndex(producerTransport => producerTransport.userId === userId);
        if (index !== -1) {
            return producerTransports.splice(index, 1)[0];
        }
        return null;
    }

    const findProducerTransportByUserId = (userId) => {
        return producerTransports.find((transport) => transport.userId === userId);
    };
    
    const findProducerTransportByProducerId = (producerId) => {
        return producerTransports.find((transport) => transport.producerId === producerId);
    };
    
    const handleCreateProducerTransport = async (payload) => {
        try {
            const userId = payload[0];

            // producer transport here can be used to send both video and audio or even screen sharing to the server
            const producerTransport = await mediasoupRouter.createWebRtcTransport(webRtcConfig);
    
            addProducer(userId, null, producerTransport);
    
            const message = {
                id: producerTransport.id,
                iceParameters: producerTransport.iceParameters,
                iceCandidates: producerTransport.iceCandidates,
                dtlsParameters: producerTransport.dtlsParameters,
            };

            send(producerTransportCreated, message);
        } catch (error) {
            console.error("Error creating producer transport:", error);
            send(err, "Failed to create producer transport");
        }
    }
    
    const handleCloseProducerTransport = async (payload) => {
        try {
            const userId = payload[0];
            const producerTransport = findProducerTransportByUserId(userId);

            console.log("Closing producer transport for user:", userId);
    
            if (producerTransport) {
                console.log("Producer transport closed for user:", userId);
                socket.broadcast.emit(closeProducerTransport, { userId });
                removeByUserId(userId);
                producerTransport.producerTransport.close();
            }
        } catch (error) {
            console.error("Error closing producer transport:", error);
            send(err, { message: "Failed to close producer transport" });
        }
    }
    
    const handleCreateConsumerTransport = async () => {
        try {
            const consumerTransport = await mediasoupRouter.createWebRtcTransport(webRtcConfig);
    
            consumerTransports.set(socket.id, consumerTransport);
    
            send(subTransportCreated, [{
                id: consumerTransport.id,
                iceParameters: consumerTransport.iceParameters,
                iceCandidates: consumerTransport.iceCandidates,
                dtlsParameters: consumerTransport.dtlsParameters,
            }]);
        } catch (error) {
            console.error("Error creating consumer transport:", error);
            send(err, { message: "Failed to create consumer transport" });
        }
    }
    
    const handleTransportConnect = async (payload) => {
        try {
            const [{ userId, dtlsParameters }] = payload;
    
            const producerTransport = findProducerTransportByUserId(userId);
    
            if (!producerTransport) {
                throw new Error(`Producer transport not found with id: ${userId}`);
            }
    
            await producerTransport.producerTransport.connect({ dtlsParameters });
        } catch (error) {
            console.error("Error connecting producer transport:", error);
            send(err, { message: error.message });
        }
    }
    
    const handleTransportProduce = async (payload) => {
        try {
            const [{ userId, kind, rtpParameters }] = payload;
    
            const producerTransport = findProducerTransportByUserId(userId);
            if (!producerTransport) {
                throw new Error(`Producer transport not found with id: ${userId}`);
            }
            
            const serverProducerTransport = await producerTransport.producerTransport.produce({ kind, rtpParameters });
            if (producerTransport.producerId == null) {
                console.log(serverProducerTransport.kind);
                producerTransport.producerId = serverProducerTransport.id;
            } else {
                console.log(serverProducerTransport.kind);
                addProducer(producerTransport.userId, serverProducerTransport.id, producerTransport.producerTransport);
            }

            send(producerId, { 
                producerId: serverProducerTransport.id,
                kind: kind
            });
            
            console.log("New server producer transport", serverProducerTransport.id);
        } catch (error) {
            console.error("Error in transport-produce:", error);
            send(err, { message: error.message });
        }
    }
    
    const handleConnectConsumerTransport = async (payload) => {
        try {
            const [{ dtlsParameters }] = payload;
    
            const transport = consumerTransports.get(socket.id);
            if (!transport) {
                throw new Error(`Consumer transport not found for socket: ${socket.id}`);
            }
    
            await transport.connect({ dtlsParameters });
            console.log("Consumer transport connected:", transport.id);
        } catch (error) {
            console.error("Error connecting consumer transport:", error);
            send(err, { message: error.message });
        }
    }
    
    const handleConsume = async (payload) => {
        try {
            const [{ rtpCapabilities }] = payload;
    
            const transport = consumerTransports.get(socket.id);
            if (!transport) {
                throw new Error(`Consumer transport not found for socket: ${socket.id}`);
            }
    
            const consumersList = [];
            for (const producerTransport of producerTransports) {
                const producerId = producerTransport.producerId;
                try {
                    mediasoupRouter.canConsume({ producerId, rtpCapabilities })
                } catch (error) {
                    console.log(`Cannot consume producer ${producerId}, error: ${error}`);
                    continue;
                }
                
                const consumer = await transport.consume({
                    producerId,
                    rtpCapabilities,
                    paused: false,
                });

                consumersList.push({
                    id: consumer.id,
                    producerId,
                    kind: consumer.kind,
                    rtpParameters: consumer.rtpParameters,
                    type: consumer.type,
                    producerPaused: consumer.producerPaused,
                });
            }
            
            send(subscribed, consumersList);
        } catch (error) {
            console.error("Error in consume:", error);
            send(err, { message: error.message });
        }
    }
});


app.use(cors());
server.listen(3000, () => {
  console.log("Server is running on port 3000");
  startMediasoup();
});
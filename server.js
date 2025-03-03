const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { createWorker } = require("mediasoup");
const ProducerTransport = require("./component/producer-transport");
const ConsumerTransport = require("./component/consumer-transport");
const { payload, verifyPayload } = require("./component/utils");


// server message
const routerRtpCapabilities = "router-rtp-capabilities";
const serverLog = "server-log";
const connection = "connection";

// producer
const createProducerTransport = "create-producer-transport";
const producerTransportCreated = "producer-transport-created";
const closeProducerTransport = "close-producer-transport";
const producerId = "producer-id";
const otherUsersDisconnect = "other-users-disconnect";

// consumer
const consume = "consume";
const subscribed = "subscribed";
const subTransportCreated = "sub-transport-created";
const createConsumerTransport = "create-consumer-transport";
const connectConsumerTransport = "connect-consumer-transport";

// transport
const transportConnect = "transport-connect";
const transportProduce = "transport-produce";

// functional
const disconnect = "user_disconnect";

// error message
const err = "error";


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
const consumerTransports = [];

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
          announcedIp: process.env.SFU_SERVER_URL || '192.168.102.85',
        },
      ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
}

const startMediasoup = async () => {
  const worker = await createWorker();
  mediasoupRouter = await worker.createRouter({ mediaCodecs });
  console.log("Mediasoup worker created and router initialized and running in IP " + webRtcConfig.listenIps[0].announcedIp);
};

io.on(connection, (socket) => {
    console.log("New client connected with socket id:", socket.id);
    console.log("Total connected clients:", io.engine.clientsCount);

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
                await handleCreateConsumerTransport(payload);
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
            case disconnect:
                await handleDisconnect(payload);
                break;
            default:
                console.warn(errorMessage.unknowServerMessage + event);
                break;
        }
    });
    

    const addConsumer = (userId, socketId, consumerTransport) => {
        const ct = new ConsumerTransport(userId, socketId, consumerTransport);
        consumerTransports.push(ct);
    };

    const addProducer = (userId, streamId, videoProducerId, audioProducerId, producerTransport) => {
        const pt = new ProducerTransport(userId, streamId, videoProducerId, audioProducerId, producerTransport);
        producerTransports.push(pt);
    };

    const findConsumerTransportBySocketId = (socketId) => {
        return consumerTransports.find((transport) => transport.socketId === socketId);
    };

    const removeTransportByUserId = (array, userId) => {
        const index = array.findIndex(transport => transport.userId === userId);
        if (index !== -1) {
            return array.splice(index, 1)[0];
        }
        return null;
    };
    
    const removeProducerTransportByUserId = (userId) => {
        return removeTransportByUserId(producerTransports, userId);
    };
    
    const removeConsumerTransportByUserId = (userId) => {
        return removeTransportByUserId(consumerTransports, userId);
    };
    

    const findProducerTransportByUserId = (userId) => {
        return producerTransports.find((transport) => transport.userId === userId);
    };
    
    const findProducerTransportByStreamId = (streamId) => {
        return producerTransports.find((transport) => transport.streamId === streamId);
    };
    
    const handleCreateProducerTransport = async (payload) => {
        try {
            const { userId, streamId } = payload[0];

            // producer transport here can be used to send both video and audio or even screen sharing to the server
            const producerTransport = await mediasoupRouter.createWebRtcTransport(webRtcConfig);
    
            addProducer(userId, streamId, null, null, producerTransport);
            console.log("Add new producer transport with userId", userId);
    
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
                handleProducerTransportDisconnect(userId);
            }
        } catch (error) {
            console.error("Error closing producer transport:", error);
            send(err, { message: "Failed to close producer transport" });
        }
    }
    
    const handleCreateConsumerTransport = async (payload) => {
        const [{ userId, newPlayers, removedPlayers }] = payload;

        if (newPlayers.length === 0) {
            console.log("No players to consume");
        } else if (newPlayers.length > 0) {
            try {
                const consumerTransport = await mediasoupRouter.createWebRtcTransport(webRtcConfig);
        
                addConsumer(userId, socket.id, consumerTransport);
        
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

        if (removedPlayers.length > 0) {
            for (const player of removedPlayers) {
                await handleConsumerTransportDisconnect(player.user_id);
            }
        }
    }
    
    const handleTransportConnect = async (payload) => {
        try {
            const [{ streamId, dtlsParameters }] = payload;
    
            const producerTransport = findProducerTransportByStreamId(streamId);
    
            if (!producerTransport) {
                throw new Error(`Producer transport not found with stream id: ${streamId}`);
            }
    
            await producerTransport.producerTransport.connect({ dtlsParameters });
        } catch (error) {
            console.error("Error connecting producer transport:", error);
            send(err, { message: error.message });
        }
    }
    
    const handleTransportProduce = async (payload) => {
        try {
            const [{ streamId, kind, rtpParameters }] = payload;
    
            const producerTransport = findProducerTransportByStreamId(streamId);
            if (!producerTransport) {
                throw new Error(`Producer transport not found with id: ${streamId}`);
            }
            
            const serverProducerTransport = await producerTransport.producerTransport.produce({ kind, rtpParameters });
            

            // We will need 2 producers, 1 for video and 1 for audio
            if (kind === "video") {
                producerTransport.videoProducerId = serverProducerTransport.id;
            } else if (kind === "audio") {
                producerTransport.audioProducerId = serverProducerTransport.id;
            }

            send(producerId, { 
                producerId: serverProducerTransport.id,
                kind: kind
            });
        } catch (error) {
            console.error("Error in transport-produce:", error);
            send(err, { message: error.message });
        }
    }

    const handleConnectConsumerTransport = async (payload) => {
        try {
            const [{ dtlsParameters }] = payload;
    
            const ConsumerTransport = findConsumerTransportBySocketId(socket.id);
            if (!ConsumerTransport) {
                throw new Error(`Consumer transport not found for socket: ${socket.id}`);
            }
    
            await ConsumerTransport.consumerTransport.connect({ dtlsParameters });
        } catch (error) {
            console.error("Error connecting consumer transport:", error);
            send(err, { message: error.message });
        }
    }
    
    // Create list consume for all producer
    // TO DO create a list consumer for some specific producers
    const handleConsume = async (payload) => {
        try {
            const [{ rtpCapabilities, nearbyPlayers }] = payload;
    
            const ConsumerTransport = findConsumerTransportBySocketId(socket.id);
            const transport = ConsumerTransport.consumerTransport;
            if (!transport) {
                throw new Error(`Consumer transport not found for socket: ${socket.id}`);
            }
    
            const consumersList = [];
            for (const player of nearbyPlayers) {
                try {
                    const userId = player.user_id;
                    const ProducerTransport = findProducerTransportByUserId(userId);

                    const videoProducerId = ProducerTransport.videoProducerId;
                    const audioProducerId = ProducerTransport.audioProducerId;

                    mediasoupRouter.canConsume({ videoProducerId, rtpCapabilities });
                    mediasoupRouter.canConsume({ audioProducerId, rtpCapabilities });

                    const videoConsumer = await transport.consume({
                        producerId: videoProducerId,
                        rtpCapabilities,
                        paused: false,
                    });

                    const audioConsumer = await transport.consume({
                        producerId: audioProducerId,
                        rtpCapabilities,
                        paused: false,
                    });
    
                    consumersList.push({
                        userId: userId,
                        id: videoConsumer.id,
                        producerId: videoProducerId,
                        kind: videoConsumer.kind,
                        rtpParameters: videoConsumer.rtpParameters,
                        type: videoConsumer.type,
                        producerPaused: videoConsumer.producerPaused,
                    });

                    consumersList.push({
                        userId: userId,
                        id: audioConsumer.id,
                        producerId: audioProducerId,
                        kind: audioConsumer.kind,
                        rtpParameters: audioConsumer.rtpParameters,
                        type: audioConsumer.type,
                        producerPaused: audioConsumer.producerPaused,
                    });
                } catch (error) {
                    console.log(`Cannot consume producer ${producerId}, error: ${error}`);
                    continue;
                }
            }
            
            send(subscribed, consumersList);
        } catch (error) {
            console.error("Error in consume:", error);
            send(err, { message: error.message });
        }
    }

    const handleProducerTransportDisconnect = (userId) => {
        const ProducerTransport = removeProducerTransportByUserId(userId);
        if (ProducerTransport) {
            ProducerTransport.producerTransport.close();
            const stillExists = producerTransports.some(
                (transport) => transport.userId === userId
            );
            if (stillExists) {
                console.error(`Failed to remove producer transport for user: ${userId}`);
            } else {
                console.log(`Producer transport successfully removed for user: ${userId}`);
            }
        } else {
            console.warn(`No producer transport found for user: ${userId}`);
        }
    };
    
    const handleConsumerTransportDisconnect = async (userId) => {
        const ConsumerTransport = removeConsumerTransportByUserId(userId);
        if (ConsumerTransport) {
            ConsumerTransport.consumerTransport.close();
            const stillExists = consumerTransports.some(
                (transport) => transport.userId === userId
            );
            if (stillExists) {
                console.error(`Failed to remove consumer transport for user: ${userId}`);
            } else {
                console.log(`Consumer transport successfully removed for user: ${userId}`);
            }
        } else {
            console.warn(`No consumer transport found for user: ${userId}`);
        }

        await send(otherUsersDisconnect, { userId });
    };
    
    const handleDisconnect = async (payload) => {
        const [{ userId }] = payload;
    
        handleProducerTransportDisconnect(userId);
        handleConsumerTransportDisconnect(userId);
    
        console.log("User disconnected:", userId);
    };
});


app.use(cors());
server.listen(8082, () => {
  console.log("Server is running on port 8082");
  startMediasoup();
});
const Events = require("../config/socketEvents");
const { send } = require("../util/utils");
const { createConsumer, removeConsumerByUserId, findConsumerBySocketId} = require("../services/ConsumerTransportService");
const { findProducerByUserId } = require("../services/ProducerTransportService");
const mediasoupRouter = require("../services/MediaSoupService");

async function create(socket, payload) {
    try {
        const { userId, newPlayers, removedPlayers } = payload[0];

        if (newPlayers.length > 0) {
            const transport = await createConsumer(userId, socket.id);
            await send(socket, Events.CONSUMER.SUBSCRIBED, {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            });
        }

        for (const player of removedPlayers) {
            removeConsumerByUserId(player.user_id);
        }
    } catch (error) {
        console.error("Error creating consumer transport:", error);
        await send(socket, Events.ERROR, "Failed to create consumer transport");
    }
}

async function connect(socket, payload) {
    try {
        const { dtlsParameters } = payload[0];
        const transport = findConsumerBySocketId(socket.id);
        if (!transport) console.error(`Consumer transport not found for socket: ${socket.id}`);

        await transport.consumerTransport.connect({ dtlsParameters });
    } catch (error) {
        console.error("Error connecting consumer transport:", error);
        await send(socket, Events.ERROR, error.message);
    }
}

async function consume(socket, payload) {
    try {
        const [{ rtpCapabilities, nearbyPlayers }] = payload;

        const ConsumerTransport = findConsumerBySocketId(socket.id);
        const transport = ConsumerTransport.consumerTransport;
        if (!transport) {
            console.error(`Consumer transport not found for socket: ${socket.id}`);
        }

        const consumersList = [];
        for (const player of nearbyPlayers) {
            try {
                const userId = player.user_id;
                const ProducerTransport = findProducerByUserId(userId);

                const videoProducerId = ProducerTransport.videoProducerId;
                const audioProducerId = ProducerTransport.audioProducerId;

                mediasoupRouter.getRouter().canConsume({
                    producerId: videoProducerId,
                    rtpCapabilities: rtpCapabilities });
                mediasoupRouter.getRouter().canConsume({
                    producerId: audioProducerId,
                    rtpCapabilities: rtpCapabilities });

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
                console.log(`Cannot consume producer for user ${player.user_id}, error: ${error}`);
            }
        }

        await send(socket, Events.CONSUMER.SUBSCRIBED, consumersList);
    } catch (error) {
        console.error("Error in consume:", error);
        await send(socket, Events.ERROR, { message: error.message });
    }
}

module.exports = { create, connect, consume };

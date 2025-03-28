const handleConsume = async (payload) => {
    try {
        const [{ rtpCapabilities, nearbyPlayers }] = payload;

        const ConsumerTransport = findConsumerTransportBySocketId(socket.id);
        if (!ConsumerTransport) {
            console.error(`Consumer transport not found for socket: ${socket.id}`);
            return send(err, { message: `No consumer transport found for user: ${socket.id}` });
        }

        const transport = ConsumerTransport.consumerTransport;
        const consumersList = [];
        for (const player of nearbyPlayers) {
            try {
                const userId = player.user_id;
                const ProducerTransport = findProducerTransportByUserId(userId);

                if (!ProducerTransport) {
                    console.error(`Producer transport not found for user: ${userId}`);
                    continue;
                }

                const videoProducerId = ProducerTransport.videoProducerId;
                const audioProducerId = ProducerTransport.audioProducerId;

                if (!videoProducerId) {
                    console.error(`Video producer ID not found for user: ${userId}`);
                    continue;
                }

                if (!audioProducerId) {
                    console.error(`Audio producer ID not found for user: ${userId}`);
                    continue;
                }

                if (!mediasoupRouter.canConsume({ producerId: videoProducerId, rtpCapabilities })) {
                    console.error(`Cannot consume video producer for user: ${userId}`);
                    continue;
                }

                if (!mediasoupRouter.canConsume({ producerId: audioProducerId, rtpCapabilities })) {
                    console.error(`Cannot consume audio producer for user: ${userId}`);
                    continue;
                }

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
                console.error(`Cannot consume producer for user: ${player.user_id}, error: ${error}`);
                continue;
            }
        }

        send(subscribed, consumersList);
    } catch (error) {
        console.error("Error in consume:", error);
        send(err, { message: error.message });
    }
};

// ...existing code...

const handleCreateConsumerTransport = async (payload) => {
    const [{ userId, newPlayers }] = payload;

    if (newPlayers.length > 0) {
        try {
            const consumerTransport = await mediasoupRouter.createWebRtcTransport(webRtcConfig);

            if (!consumerTransport) {
                console.error("Failed to create consumer transport");
                return;
            }

            addConsumer(userId, socket.id, consumerTransport);
        } catch (error) {
            console.error("Error creating consumer transport:", error);
        }
    }
};

const handleCreateProducerTransport = async (payload) => {
    try {
        const { userId, streamId } = payload[0];

        const producerTransport = await mediasoupRouter.createWebRtcTransport(webRtcConfig);

        if (!producerTransport) {
            console.error("Failed to create producer transport");
            return;
        }

        addProducer(userId, streamId, null, null, producerTransport);
    } catch (error) {
        console.error("Error creating producer transport:", error);
    }
};

// ...existing code...

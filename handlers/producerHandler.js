const { createProducer, removeProducerByUserId } = require("../services/ProducerTransportService");
const Events = require("../config/socketEvents");
const { send } = require("../util/utils");

async function create(socket, payload) {
    try {
        const { userId, streamId } = payload[0];
        const transport = await createProducer(userId, streamId);

        await send(socket, Events.PRODUCER.CREATED, {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        });
    } catch (error) {
        console.error("Error creating producer transport:", error);
        await send(socket, Events.ERROR, "Failed to create producer transport");
    }
}

async function close(socket, payload) {
    try {
        const userId = payload[0];
        removeProducerByUserId(userId);
        socket.broadcast.emit(Events.PRODUCER.CLOSE, { userId });
        console.log("Closed producer transport for user:", userId);
    } catch (error) {
        console.error("Error closing producer transport:", error);
        await send(socket, Events.ERROR, "Failed to close producer transport");
    }
}

module.exports = { create, close };

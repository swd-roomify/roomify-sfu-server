const ProducerTransportService = require("../services/ProducerTransportService");
const Events = require("../config/socketEvents");
const { findProducerByStreamId } = require("../services/ProducerTransportService");
const { send } = require("../util/utils");

async function connect(socket, payload) {
    try {
        const { streamId, dtlsParameters } = payload[0];
        const transport = ProducerTransportService.findProducerByStreamId(streamId);
        if (!transport) console.error(`Producer transport not found for streamId: ${streamId}`);

        await transport.producerTransport.connect({ dtlsParameters });
    } catch (error) {
        console.error("Error connecting producer transport:", error);
        await send(socket, Events.ERROR, error.message);
    }
}

async function produce(socket, payload) {
    try {
        const { streamId, kind, rtpParameters } = payload[0];
        const transport = findProducerByStreamId(streamId);
        if (!transport) console.error(`Producer transport not found for streamId: ${streamId}`);

        const producer = await transport.producerTransport.produce({ kind, rtpParameters });

        if (kind === "video") {
            transport.videoProducerId = producer.id;
        } else if (kind === "audio") {
            transport.audioProducerId = producer.id;
        }

        await send(socket, Events.PRODUCER.ID, {producerId: producer.id, kind});
    } catch (error) {
        console.error("Error producing transport:", error);
        await send(socket, Events.ERROR, error.message);
    }
}

module.exports = { connect, produce };

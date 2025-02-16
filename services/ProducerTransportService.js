const { webRtcConfig } = require("../config/mediasoupConfig");
const ProducerTransport = require("../models/ProducerTransport");
const mediasoupRouter = require("../services/MediaSoupService");

let producerTransports = [];

const createProducer = async (router, userId, streamId) => {
    const transport = await mediasoupRouter.getRouter().createWebRtcTransport(webRtcConfig);
    producerTransports.push(new ProducerTransport(userId, streamId, null, null, transport));
    return transport;
};

const removeProducerByUserId = (userId) => {
    const index = producerTransports.findIndex(transport => transport.userId === userId);
    if (index !== -1) {
        return producerTransports.splice(index, 1)[0];
    }
    return null;
};

const findProducerByUserId = (userId) => {
    return producerTransports.find((transport) => transport.userId === userId);
};

const findProducerByStreamId = (streamId) => {
    return producerTransports.find((transport) => transport.streamId === streamId);
};

const disconnectProducer = async (userId) => {
    const pt = removeProducerByUserId(userId);
    if (pt) {
        pt.producerTransport.close();
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

module.exports = {
    createProducer,
    removeProducerByUserId,
    findProducerByUserId,
    findProducerByStreamId,
    disconnectProducer,
};

const { webRtcConfig } = require("../config/mediasoupConfig");
const { send } = require("../util/utils");
const ConsumerTransport = require("../models/ConsumerTransport");
const Events = require("../config/socketEvents");
const mediasoupRouter = require("../services/MediaSoupService");

let consumerTransports = [];

const createConsumer = async (router, userId, socketId) => {
    const transport = await mediasoupRouter.getRouter().createWebRtcTransport(webRtcConfig);
    consumerTransports.push(new ConsumerTransport(userId, socketId));
    return transport;
};

const removeConsumerByUserId = (userId) => {
    const index = consumerTransports.findIndex(transport => transport.userId === userId);
    if (index !== -1) {
        return consumerTransports.splice(index, 1)[0];
    }
    return null;
};

const findConsumerBySocketId = (socketId) => {
    return consumerTransports.find((t) => t.socketId === socketId);
};

const disconnectConsumer = async (userId) => {
    const ConsumerTransport = removeConsumerByUserId(userId);
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

    await send(Events.FUNCTIONAL.OTHER_USERS_DISCONNECT, { userId });
};

module.exports = {
    createConsumer,
    removeConsumerByUserId,
    findConsumerBySocketId,
    disconnectConsumer,
};
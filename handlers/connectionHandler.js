const ProducerHandler = require("./producerHandler");
const ConsumerHandler = require("./consumerHandler");
const TransportHandler = require("./transportHandler");
const { disconnectProducer } = require("../services/ProducerTransportService");
const { disconnectConsumer } = require("../services/ConsumerTransportService");
const Events = require("../config/socketEvents");
const { verifyPayload, send } = require("../util/utils");

async function onAnyEvent(socket, event, data) {
    if (!await verifyPayload(data)) {
        await send(Events.ERROR, "Invalid payload");
        return;
    }

    const payload = JSON.parse(data);

    switch (event) {
        case Events.PRODUCER.CREATE:
            await ProducerHandler.create(socket, payload);
            break;
        case Events.PRODUCER.CLOSE:
            await ProducerHandler.close(socket, payload);
            break;
        case Events.CONSUMER.CREATE_TRANSPORT:
            await ConsumerHandler.create(socket, payload);
            break;
        case Events.TRANSPORT.CONNECT:
            await TransportHandler.connect(socket, payload);
            break;
        case Events.TRANSPORT.PRODUCE:
            await TransportHandler.produce(socket, payload);
            break;
        case Events.CONSUMER.CONNECT_TRANSPORT:
            await ConsumerHandler.connect(socket, payload);
            break;
        case Events.CONSUMER.CONSUME:
            await ConsumerHandler.consume(socket, payload);
            break;
        case Events.FUNCTIONAL.DISCONNECT:
            await handleDisconnect(payload);
            break;
        default:
            console.warn(`Unknown event: ${event}`);
            break;
    }

    async function handleDisconnect(payload) {
        const [{ userId }] = payload;
        await disconnectProducer(userId);
        await disconnectConsumer(userId);
        console.log("User disconnected:", userId);
    }
}

module.exports = { onAnyEvent };
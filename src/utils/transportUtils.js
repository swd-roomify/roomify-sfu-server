// ...existing code...

const findConsumerTransportBySocketId = (socketId) => {
    const transport = consumerTransports.find((transport) => transport.socketId === socketId);
    if (!transport) {
        console.error(`Consumer transport not found for socketId: ${socketId}`);
    }
    return transport;
};

const findProducerTransportByUserId = (userId) => {
    const transport = producerTransports.find((transport) => transport.userId === userId);
    if (!transport) {
        console.error(`Producer transport not found for userId: ${userId}`);
    }
    return transport;
};

const removeTransportByUserId = (array, userId) => {
    const index = array.findIndex(transport => transport.userId === userId);
    if (index !== -1) {
        const removed = array.splice(index, 1)[0];
        console.log(`Transport removed for userId: ${userId}`);
        return removed;
    }
    console.warn(`No transport found to remove for userId: ${userId}`);
    return null;
};

// ...existing code...

const payload = async (...args) => {
    try {
        return JSON.stringify(args);
    } catch (error) {
        console.error('Error converting payload to JSON:', error);
        return JSON.stringify({ error: 'Failed to convert payload' });
    }
};

const verifyPayload = async (payload) => {
    try {
        JSON.parse(payload);
        return true;
    } catch (error) {
        console.error('Error parsing payload:', error);
        return false;
    }
};

const send = async (socket, type, data) => {
    socket.emit(type, data ? await payload(data) : undefined);
};

module.exports = { payload, verifyPayload, send };
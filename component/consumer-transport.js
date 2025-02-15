class ConsumerTransport {
    constructor(userId, socketId, consumerTransport) {
        this._userId = userId;
        this._socketId = socketId;
        this._consumerTransport = consumerTransport;
    }

    get userId() {
        return this._userId;
    }

    set userId(value) {
        this._userId = value;
    }

    get socketId() {
        return this._socketId;
    }

    set socketId(value) {
        this._socketId = value;
    }

    get consumerTransport() {
        return this._consumerTransport;
    }

    set consumerTransport(value) {
        this._consumerTransport = value;
    }
}

module.exports = ConsumerTransport;
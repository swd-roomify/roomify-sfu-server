class ProducerTransport {
    constructor(userId, producerId, producerTransport) {
        this._userId = userId;
        this._producerId = producerId;
        this._producerTransport = producerTransport;
    }

    get userId() {
        return this._userId;
    }

    set userId(value) {
        this._userId = value;
    }

    get producerId() {
        return this._producerId;
    }

    set producerId(value) {
        this._producerId = value;
    }

    get producerTransport() {
        return this._producerTransport;
    }

    set producerTransport(value) {
        this._producerTransport = value;
    }
}

module.exports = ProducerTransport;

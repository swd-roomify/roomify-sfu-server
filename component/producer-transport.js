class ProducerTransport {
    constructor(userId, streamId, videoProducerId, audioProducerId, producerTransport) {
        this._userId = userId;
        this._streamId = streamId;
        this._videoProducerId = videoProducerId;
        this._audioProducerId = audioProducerId;
        this._producerTransport = producerTransport;
    }

    get userId() {
        return this._userId;
    }

    set userId(value) {
        this._userId = value;
    }

    get streamId() {
        return this._streamId;
    }

    set streamId(value) {
        this._streamId = value;
    }

    get videoProducerId() {
        return this._videoProducerId;
    }

    set videoProducerId(value) {
        this._videoProducerId = value;
    }

    get audioProducerId() {
        return this._audioProducerId;
    }

    set audioProducerId(value) {
        this._audioProducerId = value;
    }

    get producerTransport() {
        return this._producerTransport;
    }

    set producerTransport(value) {
        this._producerTransport = value;
    }

    close() {
        if (this._producerTransport) {
            this._producerTransport.close();
            console.log(`Producer transport closed for user: ${this._userId}`);
        } else {
            console.warn(`No producer transport to close for user: ${this._userId}`);
        }
    }
}

module.exports = ProducerTransport;

const { createWorker } = require("mediasoup");
const { mediaCodecs } = require("../config/mediasoupConfig");

const mediaSoupService = {
    worker: null,
    router: null,

    async start() {
        if (!this.worker) {
            this.worker = await createWorker();
            this.router = await this.worker.createRouter({ mediaCodecs });
            console.log("MediaSoup worker and router initialized");
        }
    },

    getRouter() {
        if (!this.router) {
            throw new Error("MediaSoup router is not initialized. Call `MediaSoupService.start()` first.");
        }
        return this.router;
    }
};

module.exports = mediaSoupService;
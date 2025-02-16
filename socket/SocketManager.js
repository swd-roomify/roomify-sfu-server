const { Server } = require("socket.io");
const MediaSoupService = require("../services/MediaSoupService");
const Events = require("../config/socketEvents");
const { send} = require("../util/utils");
const { onAnyEvent } = require("../handlers/connectionHandler");

class SocketManager {
    constructor(server) {
        this.io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
        this.setupSocketListeners();
    }

    setupSocketListeners() {
        this.io.on(Events.CONNECTION, (socket) => {
            console.log(`Client connected: ${socket.id}`);
            console.log("Total connected clients:", this.io.engine.clientsCount);

            if (MediaSoupService) {
                send(socket, Events.ROUTER_RTP_CAPABILITIES, MediaSoupService.router.rtpCapabilities).then(() => {});
            }

            socket.onAny((event, data) => onAnyEvent(socket, event, data));
        });
    }
}

module.exports = SocketManager;
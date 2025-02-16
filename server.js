const express = require("express");
const http = require("http");
const cors = require("cors");
const MediaSoupService = require("./services/MediaSoupService");
const SocketManager = require("./socket/SocketManager");

const app = express();
const server = http.createServer(app);

app.use(cors());

server.listen(3000, async () => {
    console.log("Server running on port 3000");
    await MediaSoupService.start();
    try {
        new SocketManager(server);
    } catch (error) {
        console.error(error);
    }
});
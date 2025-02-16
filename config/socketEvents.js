class SocketEvents {
    static ROUTER_RTP_CAPABILITIES = "router-rtp-capabilities";
    static CONNECTION = "connection";

    static PRODUCER = {
        CREATE: "create-producer-transport",
        CREATED: "producer-transport-created",
        CLOSE: "close-producer-transport",
        ID: "producer-id",
    };

    static CONSUMER = {
        CONSUME: "consume",
        SUBSCRIBED: "subscribed",
        SUB_TRANSPORT_CREATED: "sub-transport-created",
        CREATE_TRANSPORT: "create-consumer-transport",
        CONNECT_TRANSPORT: "connect-consumer-transport",
    };

    static TRANSPORT = {
        CONNECT: "transport-connect",
        PRODUCE: "transport-produce",
    };

    static FUNCTIONAL = {
        DISCONNECT: "user_disconnect",
        OTHER_USERS_DISCONNECT: "other-users-disconnect",
    };

    // Error Events
    static ERROR = "error";
}

module.exports = SocketEvents;
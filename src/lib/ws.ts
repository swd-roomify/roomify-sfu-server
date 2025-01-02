import WebSocket from 'ws';
import { Consumer, Producer, Router, RtpCapabilities, Transport } from 'mediasoup/node/lib/types';

import { send, createWebRtcTransport, broadcast } from './utils/wsUtils';
import { createWorker } from './worker';
import { IsJsonString } from './utils/validateUtils';

let mediasoupRouter: Router;
let producerTransport: Transport;
let consumerTransport: Transport;
let producer: Producer;
let consumer: Consumer;

const WebSocketConnection = async (websocket: WebSocket.Server) => {
    try {
        mediasoupRouter = await createWorker();
    } catch (error) {
        throw error;
    }

    websocket.on('connection', (ws: WebSocket) => {
        ws.on('message', (message: string) => {
            const jsonValidation = IsJsonString(message);
            if (!jsonValidation) {
                console.log('Invalid JSON');
                return;
            }

            const event = JSON.parse(message);

            switch (event.type) {
                case "getRouterRtpCapabilities":
                    handleGetRouterRtpCapabilities(event, ws);
                    break;
                case "createProducerTransport":
                    handleCreateProducerTransport(event, ws);
                    break;
                case "connectProducerTransport":
                    handleConnectProducerTransport(event, ws);
                    break;
                case "produce":
                    onProduce(event, ws, websocket);
                    break;
                case "createConsumerTransport":
                    onCreateConsumerTransport(event, ws);
                    break;
                case "connectConsumerTransport":
                    onConnectConsumerTransport(event, ws);
                    break;
                case "resume":
                    onResume(ws);
                    break;
                case 'consume':
                    onConsume(event, ws);
                    break;    
                default:
                    break;
            }
        });
    });

    const handleGetRouterRtpCapabilities = async (event: string, ws: WebSocket) => {
        send(ws, 'routerRtpCapabilities', mediasoupRouter.rtpCapabilities);
    }

    const handleCreateProducerTransport = async (event: any, ws: WebSocket) => {
        try {
            const {transport, params} = await createWebRtcTransport(mediasoupRouter);
            producerTransport = transport;
            send(ws, 'producerTransportCreated', params);
        } catch (error) {
            console.error('[SERVER]: ',error);
            send(ws, 'error', error);
        }
    }

    const handleConnectProducerTransport = async (event: any, ws: WebSocket) => {
        await producerTransport.connect({ dtlsParameters: event.dtlsParameters });
        send(ws, 'producerConnected', 'producer connected');
    }

    const onProduce = async (event: any, ws: WebSocket, websocket: WebSocket.Server) => {
        const {kind, rtpParameters} = event;
        producer = await producerTransport.produce({ kind, rtpParameters });
        const resp = {
            id: producer.id
        }

        send(ws, 'produced', resp);
        broadcast(websocket, 'newProducer', "new user");
    }

    const onCreateConsumerTransport = async (event: any, ws: WebSocket) => {
        try {
            const {transport, params} = await createWebRtcTransport(mediasoupRouter);
            consumerTransport = transport;
            send(ws, 'subTransportCreated', params);
        } catch (error) {
            console.error('[SERVER]: ',error);
            send(ws, 'error', error);
        }
    }

    const onConnectConsumerTransport = async (event: any, ws: WebSocket) => {
        await consumerTransport.connect({ dtlsParameters: event.dtlsParameters });
        send(ws, 'subConnected', 'consumer connected');
    }

    const onResume = async(ws: WebSocket) => {
        await consumer.resume();
        send(ws, 'resumed', 'resumed');
    }

    const onConsume = async (event: any, ws: WebSocket) => {
        const res = await createConsumer(producer, event.rtpCapabilities);
        send(ws, "subscribed", res);
    }

    const createConsumer = async (producer: Producer, rtpCapabilities: RtpCapabilities) => {
        if (!mediasoupRouter.canConsume(
            {
                producerId: producer.id,
                rtpCapabilities,
            }
        )) {
            console.error('Can not consume');
            return;
        }

        try {
            consumer = await consumerTransport.consume({
                producerId: producer.id,
                rtpCapabilities,
                paused: producer.kind === 'video',
            });
        } catch (error) {
            console.error('[SERVER]: ',error);
            return;
        }

        return {
            producerId: producer.id,
            id: consumer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
            producerPaused: consumer.producerPaused
        }
    }
}

export { WebSocketConnection };
import WebSocket from 'ws';
import { Router } from 'mediasoup/node/lib/types';
import { config } from '../../config';

const send = (ws: WebSocket, type: string, msg: any) => {
    const message = {
        type,
        data: msg
    }

    ws.send(JSON.stringify(message));
}

const createWebRtcTransport = async (mediasoupRouter: Router) => {
    const {
        maxIncomeBitrate,
        initialAvailableOutgoingBitrate,
    } = config.mediasoup.webRtcTransport;

    const transport = await mediasoupRouter.createWebRtcTransport({
        listenIps: config.mediasoup.webRtcTransport.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate,
    });

    if (maxIncomeBitrate) {
        try {
            await transport.setMaxIncomingBitrate(maxIncomeBitrate);
        } catch (error) {
            console.error(error);
        }
    }

    return {
        transport,
        params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
        },
    }
}

const broadcast = (ws: WebSocket.Server, type: string, msg: any) => {
    const message = {
        type,
        data: msg
    }

    const resp = JSON.stringify(message);
    ws.clients.forEach(client => { 
        client.send(resp) 
    });

}

export { send, createWebRtcTransport, broadcast };
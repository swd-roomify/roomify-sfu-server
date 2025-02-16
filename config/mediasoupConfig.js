module.exports = {
    mediaCodecs: [
        {
            kind: "video",
            mimeType: "video/H264",
            clockRate: 90000,
            parameters: {
                "packetization-mode": 1,
                "profile-level-id": "42e01f",
                "level-asymmetry-allowed": 1
            }
        },
        {
            kind: "audio",
            mimeType: "audio/opus",
            clockRate: 48000,
            channels: 2, // 1 for mono and 2 for stereo better use 2 here for better audio quality,
            // but in case of low bandwidth use 1
        },
    ],
    webRtcConfig: {
        listenIps: [
            {
                ip: '0.0.0.0',
                announcedIp: process.env.SFU_SERVER_URL || '192.168.102.85',
            },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
    },
}
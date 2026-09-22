import { LocalVideoTrack, LocalAudioTrack } from 'livekit-client';

export class TeacherVideoPublisher {
    constructor(room) {
        this.room = room;
        this.publishedTracks = [];
    }

    async publishVideo(videoRefsMap = {}) {
        for (const [lang, videoRef] of Object.entries(videoRefsMap)) {
            const videoElement = videoRef?.current;
            if (!videoElement || !videoElement.captureStream) {
                continue;
            }

            // ⭐ VERY IMPORTANT — ensure video is actually playing
            if (videoElement.readyState < 2) {
                await new Promise(resolve => {
                    videoElement.onloadeddata = resolve;
                });
            }

            // play FIRST (critical)
            await videoElement.play().catch(e => console.error(`Failed to play ${lang} video`, e));

            // small delay so frames exist
            await new Promise(r => setTimeout(r, 200));

            // Capture stream with explicit 30 FPS target
            const mediaStream = typeof videoElement.captureStream === 'function'
                ? videoElement.captureStream(30)
                : (typeof videoElement.mozCaptureStream === 'function' ? videoElement.mozCaptureStream(30) : null);

            if (!mediaStream) continue;

            const videoMediaTrack = mediaStream.getVideoTracks()[0];
            const audioMediaTrack = mediaStream.getAudioTracks()[0];

            if (videoMediaTrack) {
                const width = videoElement.videoWidth || 1920;
                const height = videoElement.videoHeight || 1080;
                const maxBitrate = width >= 1920 ? 4_500_000 : (width >= 1280 ? 3_000_000 : 1_500_000);

                const trackSettings = videoMediaTrack.getSettings ? videoMediaTrack.getSettings() : {};
                console.log(`🎥 [Publisher Diagnostics] Source Video: ${width}x${height} | Capture Track: ${trackSettings.width || width}x${trackSettings.height || height} @ ${trackSettings.frameRate || 30}fps`);
                console.log(`🎥 [Publisher Diagnostics] Publishing track (${lang}): maxBitrate=${maxBitrate}bps, codec=vp8, degradationPreference=maintain-resolution`);

                if ('contentHint' in videoMediaTrack) {
                    videoMediaTrack.contentHint = 'text';
                }

                const pub = await this.room.localParticipant.publishTrack(videoMediaTrack, {
                    name: `class-video-${lang}`,
                    source: 'screen_share',
                    simulcast: false,
                    videoCodec: 'vp8',
                    screenShareEncoding: {
                        maxBitrate: 8_000_000,
                        maxFramerate: 30,
                    },
                    degradationPreference: 'maintain-resolution',
                });
                this.publishedTracks.push(pub.track);
            }

            if (audioMediaTrack) {
                const pub = await this.room.localParticipant.publishTrack(audioMediaTrack, { name: `class-audio-${lang}` });
                this.publishedTracks.push(pub.track);
            }
        }

        console.log('✅ Teacher multilingual video & audio tracks published');
    }

    async stopPublishing() {
        for (const track of this.publishedTracks) {
            await this.room.localParticipant.unpublishTrack(track);
            track.stop();
        }
        this.publishedTracks = [];
    }
}

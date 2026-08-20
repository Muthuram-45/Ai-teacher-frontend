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

            const mediaStream = videoElement.captureStream();

            const videoMediaTrack = mediaStream.getVideoTracks()[0];
            const audioMediaTrack = mediaStream.getAudioTracks()[0];

            if (videoMediaTrack) {
                const pub = await this.room.localParticipant.publishTrack(videoMediaTrack, { name: `class-video-${lang}` });
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

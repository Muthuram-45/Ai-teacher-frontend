import { LocalVideoTrack, LocalAudioTrack } from 'livekit-client';

export class TeacherVideoPublisher {
    constructor(room) {
        this.room = room;
        this.videoTrack = null;
        this.audioTrack = null;
    }

    async publishVideo(videoElement) {
        if (!videoElement.captureStream) {
            throw new Error('captureStream() not supported');
        }

        // ⭐ VERY IMPORTANT — ensure video is actually playing
        if (videoElement.readyState < 2) {
            await new Promise(resolve => {
                videoElement.onloadeddata = resolve;
            });
        }

        // play FIRST (critical)
        await videoElement.play();

        // small delay so frames exist
        await new Promise(r => setTimeout(r, 200));

        const mediaStream = videoElement.captureStream();

        const videoMediaTrack = mediaStream.getVideoTracks()[0];
        const audioMediaTrack = mediaStream.getAudioTracks()[0];

        if (!videoMediaTrack) {
            throw new Error('No video track found');
        }

        this.videoTrack = new LocalVideoTrack(videoMediaTrack, { name: 'teacher-video' });
        await this.room.localParticipant.publishTrack(this.videoTrack);

        if (audioMediaTrack) {
            this.audioTrack = new LocalAudioTrack(audioMediaTrack);
            await this.room.localParticipant.publishTrack(this.audioTrack);
        }

        console.log('✅ Teacher video published with frames');
    }

    async stopPublishing() {
        if (this.videoTrack) {
            await this.room.localParticipant.unpublishTrack(this.videoTrack);
            this.videoTrack.stop();
            this.videoTrack = null;
        }

        if (this.audioTrack) {
            await this.room.localParticipant.unpublishTrack(this.audioTrack);
            this.audioTrack.stop();
            this.audioTrack = null;
        }
    }
}

import { LocalVideoTrack, LocalAudioTrack } from 'livekit-client';

export class TeacherVideoPublisher {
    constructor(room) {
        this.room = room;
        this.videoTrack = null;
        this.audioTrack = null;
        this.auxAudioTracks = {}; // Store auxiliary language tracks
    }

    async publishVideo(videoElement, audioElementsMap = {}) {
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

        // Publish the main (default) audio track as English
        if (audioMediaTrack) {
            this.audioTrack = new LocalAudioTrack(audioMediaTrack, { name: 'audio_en' });
            await this.room.localParticipant.publishTrack(this.audioTrack);
        }

        // Publish auxiliary audio tracks
        for (const [lang, audioRef] of Object.entries(audioElementsMap)) {
            const audioEl = audioRef?.current;
            if (audioEl && audioEl.captureStream) {
                // Ensure audio element is playing so we can capture the stream
                try {
                    await audioEl.play();
                } catch (e) {
                    console.error(`Failed to play ${lang} audio`, e);
                }
                const auxStream = audioEl.captureStream();
                const auxAudioTrack = auxStream.getAudioTracks()[0];
                if (auxAudioTrack) {
                    const localAuxTrack = new LocalAudioTrack(auxAudioTrack, { name: `audio_${lang}` });
                    await this.room.localParticipant.publishTrack(localAuxTrack);
                    this.auxAudioTracks[lang] = localAuxTrack;
                }
            }
        }

        console.log('✅ Teacher video & audio tracks published');
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

        // Cleanup auxiliary tracks
        for (const lang in this.auxAudioTracks) {
            const track = this.auxAudioTracks[lang];
            await this.room.localParticipant.unpublishTrack(track);
            track.stop();
        }
        this.auxAudioTracks = {};
    }
}

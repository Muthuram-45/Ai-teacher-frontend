import { videoCodecs } from 'livekit-client';
import { VideoConferenceClientImpl } from './VideoConferenceClientImpl';
import { isVideoCodec } from '@/lib/types';

export default async function CustomRoomConnection(props) {
    const resolvedSearchParams = await props.searchParams;
    const liveKitUrl = resolvedSearchParams.liveKitUrl || 'wss://meet-vrmadeb4.livekit.cloud';
    const token = resolvedSearchParams.token;
    const codec = resolvedSearchParams.codec;
    const singlePC = resolvedSearchParams.singlePC;
    if (typeof liveKitUrl !== 'string') {
        return <h2>Missing LiveKit URL</h2>;
    }
    if (typeof token !== 'string') {
        return <h2>Missing LiveKit token</h2>;
    }
    if (codec !== undefined && !isVideoCodec(codec)) {
        return <h2>Invalid codec, if defined it has to be [{videoCodecs.join(', ')}].</h2>;
    }

    return (
        <main data-lk-theme="default" style={{ height: '100%' }}>
            <VideoConferenceClientImpl
                liveKitUrl={liveKitUrl}
                token={token}
                codec={codec}
                singlePeerConnection={singlePC === 'true'}
            />
        </main>
    );
}

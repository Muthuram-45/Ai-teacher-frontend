import * as React from 'react';
import { PageClientImpl } from './PageClientImpl';

export default async function Page({
    params,
    searchParams,
}) {
    // ✅ MUST await params
    const resolvedParams = await params;

    // ✅ MUST await searchParams
    const resolvedSearchParams = await searchParams;

    const roomName = resolvedParams.roomName;
    const token = resolvedSearchParams.token;
    const url = resolvedSearchParams.url || 'wss://meet-vrmadeb4.livekit.cloud';

    // ✅ Safety check (very important)
    if (!token) {
        return (
            <div style={{ padding: 40, color: 'red' }}>
                ❌ Missing token
            </div>
        );
    }

    return (
        <PageClientImpl
            roomName={roomName}
            token={token}
            url={url}
        />
    );
}

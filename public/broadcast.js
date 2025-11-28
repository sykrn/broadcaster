const socket = io();

const startButton = document.getElementById('startBroadcast');
const stopButton = document.getElementById('stopBroadcast');
const statusText = document.getElementById('statusText');
const statusDot = document.querySelector('.status-dot');
const viewerCountDiv = document.getElementById('viewerCount');
const viewerCountNumber = document.getElementById('viewerCountNumber');

let localStream = null;
let peerConnections = new Map(); // viewerId -> RTCPeerConnection
let viewerCount = 0;

// Get network URL for sharing
async function getNetworkUrl() {
    try {
        const response = await fetch('/api/server-ip');
        const data = await response.json();
        return `http://${data.ip}:${data.port}/viewer.html`;
    } catch (err) {
        console.error('Error fetching server IP:', err);
        // Fallback to current location
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port;
        const portStr = port ? `:${port}` : '';
        return `${protocol}//${hostname}${portStr}/viewer.html`;
    }
}

// Copy viewer URL to clipboard
function copyViewerUrl(event) {
    const url = document.getElementById('viewerUrl').textContent;
    navigator.clipboard.writeText(url).then(() => {
        const btn = event.target.closest('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>✅ Copied!</span>';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    });
}

// WebRTC configuration
// Empty iceServers array allows fully local network operation without internet
// Devices on the same network can connect directly without STUN/TURN servers
const configuration = {
    iceServers: []
};

// Start broadcasting
startButton.addEventListener('click', async () => {
    try {
        console.log('Requesting screen capture...');

        // Request screen capture
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'always',
                displaySurface: 'monitor'
            },
            audio: false
        });

        console.log('✅ Screen capture started');
        console.log('Tracks:', localStream.getTracks());
        localStream.getTracks().forEach(track => {
            console.log(`Track: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
        });

        // Handle stream ended (user stops sharing)
        localStream.getVideoTracks()[0].onended = () => {
            console.log('Screen sharing ended by user');
            stopBroadcast();
        };

        // Update UI
        startButton.style.display = 'none';
        stopButton.style.display = 'inline-block';
        statusText.textContent = 'Broadcasting...';
        statusDot.classList.add('broadcasting');
        viewerCountDiv.style.display = 'inline-block';

        // Show network info
        const networkInfo = document.getElementById('networkInfo');
        const viewerUrl = document.getElementById('viewerUrl');
        const url = await getNetworkUrl();
        viewerUrl.textContent = url;
        networkInfo.style.display = 'block';

        // Join as broadcaster
        console.log('Emitting join-broadcast');
        socket.emit('join-broadcast');

        console.log('Broadcasting started successfully');
    } catch (err) {
        console.error('Error starting broadcast:', err);
        alert('Failed to start broadcast. Please make sure you granted screen sharing permission.');
    }
});

// Stop broadcasting
stopButton.addEventListener('click', () => {
    stopBroadcast();
});

function stopBroadcast() {
    // Close all peer connections
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();

    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // Update UI
    startButton.style.display = 'inline-block';
    stopButton.style.display = 'none';
    statusText.textContent = 'Ready to broadcast';
    statusDot.classList.remove('broadcasting');
    viewerCountDiv.style.display = 'none';
    document.getElementById('networkInfo').style.display = 'none';
    viewerCount = 0;
    viewerCountNumber.textContent = '0';

    console.log('Broadcasting stopped');
}

// Handle new viewer
socket.on('viewer-joined', async (viewerId) => {
    console.log('🎬 New viewer joined:', viewerId);

    if (!localStream) {
        console.error('❌ No local stream available!');
        return;
    }

    try {
        // Create peer connection for this viewer
        console.log('Creating peer connection for viewer:', viewerId);
        const peerConnection = new RTCPeerConnection(configuration);
        peerConnections.set(viewerId, peerConnection);

        // Add local stream tracks to peer connection
        console.log('Adding tracks to peer connection...');
        localStream.getTracks().forEach(track => {
            console.log(`Adding track: ${track.kind}, enabled: ${track.enabled}`);
            const sender = peerConnection.addTrack(track, localStream);
            console.log('Track added, sender:', sender);
        });

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate to viewer:', viewerId);
                socket.emit('ice-candidate', {
                    to: viewerId,
                    candidate: event.candidate
                });
            }
        };

        // Log connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`Peer connection state with ${viewerId}:`, peerConnection.connectionState);
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log(`ICE connection state with ${viewerId}:`, peerConnection.iceConnectionState);
        };

        // Create and send offer
        console.log('Creating offer for viewer:', viewerId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        console.log('Sending offer to viewer:', viewerId);
        socket.emit('offer', {
            to: viewerId,
            offer: offer
        });

        // Update viewer count
        viewerCount++;
        viewerCountNumber.textContent = viewerCount;
        viewerCountDiv.classList.add('active');

        console.log('✅ Offer sent to viewer:', viewerId, 'Total viewers:', viewerCount);
    } catch (err) {
        console.error('❌ Error creating offer:', err);
    }
});

// Handle answer from viewer
socket.on('answer', async (data) => {
    console.log('Received answer from:', data.from);

    const peerConnection = peerConnections.get(data.from);
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
});

// Handle ICE candidate from viewer
socket.on('ice-candidate', async (data) => {
    console.log('Received ICE candidate from:', data.from);

    const peerConnection = peerConnections.get(data.from);
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

// Handle viewer disconnection
socket.on('viewer-disconnected', (viewerId) => {
    console.log('Viewer disconnected:', viewerId);

    // Remove peer connection
    const peerConnection = peerConnections.get(viewerId);
    if (peerConnection) {
        peerConnection.close();
        peerConnections.delete(viewerId);
    }

    // Update viewer count
    if (viewerCount > 0) {
        viewerCount--;
        viewerCountNumber.textContent = viewerCount;
        if (viewerCount === 0) {
            viewerCountDiv.classList.remove('active');
        }
    }
});

// Handle socket disconnection
socket.on('disconnect', () => {
    console.log('Disconnected from server');
    stopBroadcast();
});

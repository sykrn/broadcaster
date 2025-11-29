const socket = io();

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusText = document.getElementById('statusText');
const statusDot = document.querySelector('.status-dot');
const viewerCountDiv = document.getElementById('viewerCount');
const viewerCountNumber = document.getElementById('viewerCountNumber');

let localStream = null;
let peerConnections = new Map(); // viewerId -> RTCPeerConnection
let viewerCount = 0;
let currentSessionId = null;

// Validate session name
function validateSessionName(name) {
    const pattern = /^[a-zA-Z0-9-_]+$/;
    if (!name || name.length === 0) {
        return { valid: false, error: 'Session name is required' };
    }
    if (!pattern.test(name)) {
        return { valid: false, error: 'Session name can only contain letters, numbers, hyphens, and underscores' };
    }
    if (name.length < 3) {
        return { valid: false, error: 'Session name must be at least 3 characters' };
    }
    if (name.length > 50) {
        return { valid: false, error: 'Session name must be less than 50 characters' };
    }
    return { valid: true };
}

// Get network URL for sharing
async function getNetworkUrl() {
    try {
        const response = await fetch('/api/server-ip');
        const data = await response.json();
        return `http://${data.ip}:${data.port}/viewer.html?id=${currentSessionId}`;
    } catch (err) {
        console.error('Error fetching server IP:', err);
        // Fallback to current location
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port;
        const portStr = port ? `:${port}` : '';
        return `${protocol}//${hostname}${portStr}/viewer.html?id=${currentSessionId}`;
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
        // Get and validate session name
        const sessionName = document.getElementById('sessionName').value.trim();
        const validation = validateSessionName(sessionName);

        const sessionError = document.getElementById('sessionError');
        if (!validation.valid) {
            sessionError.textContent = validation.error;
            sessionError.style.display = 'block';
            return;
        }

        sessionError.style.display = 'none';
        currentSessionId = sessionName;

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
        document.getElementById('sessionSetup').style.display = 'none';
        startButton.style.display = 'none';
        stopButton.style.display = 'inline-block';
        statusText.textContent = `Broadcasting session: ${currentSessionId}`;
        statusDot.classList.add('broadcasting');
        viewerCountDiv.style.display = 'inline-block';

        // Show network info
        const networkInfo = document.getElementById('networkInfo');
        const viewerUrl = document.getElementById('viewerUrl');
        const url = await getNetworkUrl();
        viewerUrl.textContent = url;
        networkInfo.style.display = 'block';

        // Join as broadcaster with session ID
        console.log('Emitting join-broadcast with session:', currentSessionId);
        socket.emit('join-broadcast', currentSessionId);

        console.log('Broadcasting started successfully');
    } catch (err) {
        console.error('Error starting broadcast:', err);
        alert('Failed to start broadcast. Please make sure you granted screen sharing permission.');
        currentSessionId = null;
    }
});

// Stop broadcasting
stopButton.addEventListener('click', stopBroadcast);

function stopBroadcast() {
    // Stop all tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // Close all peer connections
    peerConnections.forEach((pc, viewerId) => {
        pc.close();
    });
    peerConnections.clear();

    // Update UI
    document.getElementById('sessionSetup').style.display = 'block';
    startButton.style.display = 'inline-block';
    stopButton.style.display = 'none';
    statusText.textContent = 'Ready to broadcast';
    statusDot.classList.remove('broadcasting');
    viewerCountDiv.style.display = 'none';
    document.getElementById('networkInfo').style.display = 'none';
    viewerCount = 0;
    viewerCountNumber.textContent = '0';

    // Notify server if we had a session
    if (currentSessionId) {
        console.log('Stopping broadcast for session:', currentSessionId);
        currentSessionId = null;
    }
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

// Handle force stop from server (e.g., when another client stops the session)
socket.on('force-stop-broadcast', () => {
    console.log('Forced to stop broadcast by server');
    stopBroadcast();
});

// Handle socket disconnection
socket.on('disconnect', () => {
    console.log('Disconnected from server');
    stopBroadcast();
});

// Handle sessions list updates
socket.on('sessions-update', (sessionsList) => {
    console.log('Received sessions update:', sessionsList);
    updateSessionsTable(sessionsList);
});

// Update sessions table
async function updateSessionsTable(sessionsList) {
    const tbody = document.getElementById('sessionsTableBody');

    if (!sessionsList || sessionsList.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td colspan="4" style="padding: 2rem; text-align: center; color: var(--text-secondary);">
          No active sessions. Start broadcasting to see your session here.
        </td>
      </tr>
    `;
        return;
    }

    // Get network base URL
    let baseUrl;
    try {
        const response = await fetch('/api/server-ip');
        const data = await response.json();
        baseUrl = `http://${data.ip}:${data.port}/viewer.html?id=`;
    } catch (err) {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port;
        const portStr = port ? `:${port}` : '';
        baseUrl = `${protocol}//${hostname}${portStr}/viewer.html?id=`;
    }

    tbody.innerHTML = sessionsList.map(session => `
    <tr>
      <td style="padding: 1rem; border-bottom: 1px solid var(--border-glass); color: var(--text-primary);">
        ${escapeHtml(session.sessionId)}
        ${session.sessionId === currentSessionId ? '<span style="color: var(--accent-primary); font-size: 0.8rem;"> (You)</span>' : ''}
      </td>
      <td style="padding: 1rem; border-bottom: 1px solid var(--border-glass); text-align: center; color: var(--text-primary);">
        👥 ${session.viewerCount}
      </td>
      <td style="padding: 1rem; border-bottom: 1px solid var(--border-glass);">
        <code style="font-size: 0.85rem; color: var(--accent-primary);">${baseUrl}${escapeHtml(session.sessionId)}</code>
      </td>
      <td style="padding: 1rem; border-bottom: 1px solid var(--border-glass); text-align: center;">
        ${session.hasBroadcaster ?
            `<button onclick="stopSession('${escapeHtml(session.sessionId)}')" style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
            ⏹️ Stop
          </button>` :
            '<span style="color: var(--text-secondary);">⚪ Inactive</span>'}
      </td>
    </tr>
  `).join('');
}

// Stop a specific session
function stopSession(sessionId) {
    if (confirm(`Stop session "${sessionId}"?`)) {
        console.log('Stopping session:', sessionId);
        socket.emit('stop-session', sessionId);

        // If it's our session, also stop local broadcast
        if (sessionId === currentSessionId) {
            stopBroadcast();
        }
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Request sessions list on load
socket.emit('request-sessions');

const socket = io();

const remoteVideo = document.getElementById('remoteVideo');
const statusText = document.getElementById('statusText');
const statusDot = document.querySelector('.status-dot');
const placeholder = document.getElementById('placeholder');

let peerConnection = null;
let broadcasterId = null;

// WebRTC configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Connect to server as viewer
socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('join-viewer');
    statusText.textContent = 'Waiting for broadcast...';
});

// Handle broadcaster available notification
socket.on('broadcaster-available', (id) => {
    console.log('Broadcaster is available:', id);
    broadcasterId = id;
    statusText.textContent = 'Connecting to broadcaster...';
});

// Handle waiting for broadcaster
socket.on('waiting-for-broadcaster', () => {
    console.log('No broadcaster available yet');
    statusText.textContent = 'Waiting for broadcaster to start...';
});

// Handle offer from broadcaster
socket.on('offer', async (data) => {
    console.log('Received offer from broadcaster:', data.from);
    broadcasterId = data.from;

    try {
        // Create peer connection
        peerConnection = new RTCPeerConnection(configuration);
        console.log('Created peer connection');

        // Handle incoming tracks
        peerConnection.ontrack = (event) => {
            console.log('🎥 Received remote track!', event);
            console.log('Track kind:', event.track.kind);
            console.log('Track enabled:', event.track.enabled);
            console.log('Track readyState:', event.track.readyState);
            console.log('Streams:', event.streams);

            if (event.streams && event.streams[0]) {
                console.log('Setting video srcObject');
                remoteVideo.srcObject = event.streams[0];

                // Log when video metadata is loaded
                remoteVideo.onloadedmetadata = () => {
                    console.log('Video metadata loaded');
                    console.log('Video dimensions:', remoteVideo.videoWidth, 'x', remoteVideo.videoHeight);

                    // Explicitly play the video (browsers often block autoplay)
                    console.log('Attempting to play video...');
                    remoteVideo.play()
                        .then(() => {
                            console.log('✅ Video playing successfully!');
                        })
                        .catch(err => {
                            console.error('❌ Error playing video:', err);
                        });
                };

                // Log when video starts playing
                remoteVideo.onplay = () => {
                    console.log('Video started playing');
                };

                remoteVideo.classList.add('active');
                placeholder.style.display = 'none';
                statusText.textContent = 'Connected - Watching broadcast';
                statusDot.classList.add('connected');
            } else {
                console.warn('No streams in track event');
            }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                socket.emit('ice-candidate', {
                    to: broadcasterId,
                    candidate: event.candidate
                });
            } else {
                console.log('All ICE candidates sent');
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);

            if (peerConnection.connectionState === 'connected') {
                console.log('✅ Peer connection established');
                statusText.textContent = 'Peer connected, streaming video...';
            } else if (peerConnection.connectionState === 'disconnected' ||
                peerConnection.connectionState === 'failed' ||
                peerConnection.connectionState === 'closed') {
                handleDisconnection();
            }
        };

        // Handle ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', peerConnection.iceConnectionState);
        };

        // Set remote description and create answer
        console.log('Setting remote description');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

        console.log('Creating answer');
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Send answer to broadcaster
        console.log('Sending answer to broadcaster');
        socket.emit('answer', {
            to: broadcasterId,
            answer: answer
        });

        console.log('Answer sent, waiting for connection...');
        statusText.textContent = 'Negotiating connection...';
    } catch (err) {
        console.error('Error handling offer:', err);
        statusText.textContent = 'Connection error';
    }
});

// Handle ICE candidate from broadcaster
socket.on('ice-candidate', async (data) => {
    console.log('Received ICE candidate from broadcaster');

    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
            console.error('Error adding ICE candidate:', err);
        }
    }
});

// Handle broadcaster disconnection
socket.on('broadcaster-disconnected', () => {
    console.log('Broadcaster disconnected');
    handleDisconnection();
    statusText.textContent = 'Broadcast ended';
});

// Handle disconnection
function handleDisconnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    remoteVideo.srcObject = null;
    remoteVideo.classList.remove('active');
    placeholder.style.display = 'block';
    statusDot.classList.remove('connected');

    // Update placeholder
    const placeholderIcon = placeholder.querySelector('.placeholder-icon');
    const placeholderTitle = placeholder.querySelector('h2');
    const placeholderText = placeholder.querySelector('p');

    placeholderIcon.textContent = '📡';
    placeholderTitle.textContent = 'Broadcast Ended';
    placeholderText.textContent = 'The broadcaster has stopped sharing their screen';
}

// Handle socket disconnection
socket.on('disconnect', () => {
    console.log('Disconnected from server');
    statusText.textContent = 'Disconnected from server';
    handleDisconnection();
});

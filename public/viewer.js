const socket = io();

const remoteVideo = document.getElementById('remoteVideo');
const statusText = document.getElementById('statusText');
const statusDot = document.querySelector('.status-dot');
const placeholder = document.getElementById('placeholder');

let peerConnection = null;
let broadcasterId = null;
let isPlaying = true;
const FRAME_STEP = 1 / 30; // ~30fps, step by one frame

// Get session ID from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('id');

// Validate session ID
if (!sessionId) {
    statusText.textContent = 'Error: No session ID provided';
    statusDot.style.display = 'none';
    const placeholderIcon = placeholder.querySelector('.placeholder-icon');
    const placeholderTitle = placeholder.querySelector('h2');
    const placeholderText = placeholder.querySelector('p');
    placeholderIcon.textContent = '⚠️';
    placeholderTitle.textContent = 'Invalid URL';
    placeholderText.innerHTML = 'No session ID found in URL.<br>Expected format: viewer.html?id=session-name';
    console.error('No session ID in URL');
} else {
    console.log('Joining session:', sessionId);
    // Update header with session name
    document.querySelector('header h1').textContent = `🖥️ Viewer - ${sessionId}`;
}

// Playback control functions
function togglePlayPause() {
    const video = remoteVideo;
    const icon = document.getElementById('playPauseIcon');

    if (isPlaying) {
        video.pause();
        icon.textContent = '▶️ Play';
        isPlaying = false;
        console.log('Video paused');
    } else {
        video.play();
        icon.textContent = '⏸️ Pause';
        isPlaying = true;
        console.log('Video playing');
    }
}

function previousFrame() {
    const video = remoteVideo;
    if (!video.paused) {
        video.pause();
        document.getElementById('playPauseIcon').textContent = '▶️ Play';
        isPlaying = false;
    }
    video.currentTime = Math.max(0, video.currentTime - FRAME_STEP);
    console.log('Previous frame, time:', video.currentTime);
}

function nextFrame() {
    const video = remoteVideo;
    if (!video.paused) {
        video.pause();
        document.getElementById('playPauseIcon').textContent = '▶️ Play';
        isPlaying = false;
    }
    video.currentTime = Math.min(video.duration || video.currentTime + FRAME_STEP, video.currentTime + FRAME_STEP);
    console.log('Next frame, time:', video.currentTime);
}

// Picture-in-Picture function
async function togglePictureInPicture() {
    const video = remoteVideo;

    try {
        if (document.pictureInPictureElement) {
            // Exit PiP
            await document.exitPictureInPicture();
            console.log('Exited Picture-in-Picture mode');
        } else {
            // Enter PiP
            await video.requestPictureInPicture();
            console.log('Entered Picture-in-Picture mode');
        }
    } catch (err) {
        console.error('Picture-in-Picture error:', err);
        alert('Picture-in-Picture is not supported or allowed in this browser.');
    }
}

// Fullscreen function
async function toggleFullscreen() {
    const container = document.getElementById('videoContainer');
    const icon = document.getElementById('fullscreenIcon');

    try {
        if (document.fullscreenElement) {
            // Exit fullscreen
            await document.exitFullscreen();
            icon.textContent = '⛶ Fullscreen';

            // Unlock orientation
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
                console.log('Orientation unlocked');
            }

            console.log('Exited fullscreen mode');
        } else {
            // Enter fullscreen
            await container.requestFullscreen();
            icon.textContent = '⛶ Exit Fullscreen';

            // Lock to landscape orientation on mobile devices
            if (screen.orientation && screen.orientation.lock) {
                try {
                    await screen.orientation.lock('landscape');
                    console.log('Orientation locked to landscape');
                } catch (err) {
                    console.log('Orientation lock not supported or failed:', err.message);
                }
            }

            console.log('Entered fullscreen mode');
        }
    } catch (err) {
        console.error('Fullscreen error:', err);
        alert('Fullscreen is not supported or allowed in this browser.');
    }
}

// WebRTC configuration
// Empty iceServers array allows fully local network operation without internet
// Devices on the same network can connect directly without STUN/TURN servers
const configuration = {
    iceServers: []
};

// Connect to server as viewer
socket.on('connect', () => {
    console.log('Connected to server');
    if (sessionId) {
        socket.emit('join-viewer', sessionId);
        statusText.textContent = 'Waiting for broadcast...';
    }
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

                // Show playback controls
                document.getElementById('playbackControls').style.display = 'block';
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

    // Hide playback controls
    document.getElementById('playbackControls').style.display = 'none';
    isPlaying = true;
    document.getElementById('playPauseIcon').textContent = '⏸️ Pause';

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

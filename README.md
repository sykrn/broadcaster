# Screen Broadcaster 📡

A clean and simple web-based screen sharing application built with WebRTC technology. Share your screen with multiple viewers in real-time with low latency and efficient bandwidth usage.

## Features

- **Real-time Screen Sharing**: WebRTC-based peer-to-peer streaming
- **Low Latency**: Uses UDP (via WebRTC's SRTP) for smooth, efficient streaming
- **Multiple Viewers**: Support for multiple simultaneous viewers
- **Secure**: End-to-end encrypted via DTLS-SRTP
- **Browser-Based**: No plugins required, works in modern browsers
- **Modern UI**: Clean glassmorphic design with smooth animations

## Technology Stack

- **Backend**: Node.js + Express
- **Real-time Communication**: Socket.IO for signaling
- **Streaming**: WebRTC (uses UDP internally via SRTP)
- **Frontend**: Vanilla HTML/CSS/JavaScript

## How It Works

1. **Broadcaster** starts screen sharing using the browser's Screen Capture API
2. **WebRTC** establishes peer-to-peer connections with viewers
3. **Socket.IO** handles the signaling (offer/answer/ICE candidates)
4. **Media streams** flow directly between broadcaster and viewers via WebRTC (UDP-based)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### As a Broadcaster

1. Go to the home page and click "Start Broadcasting"
2. Click the "🎥 Start Broadcasting" button
3. Select the screen/window you want to share
4. Share the viewer URL with your audience
5. See the viewer count in real-time
6. Click "Stop Broadcasting" when done

### As a Viewer

1. Go to the home page and click "Watch Broadcast"
2. Wait for the broadcaster to start sharing
3. The screen will appear automatically when broadcast begins

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ Broadcaster │◄───────►│    Server    │◄───────►│   Viewer 1  │
│  (Browser)  │  Socket │ (Socket.IO)  │  Socket │  (Browser)  │
└─────────────┘   .IO   └──────────────┘   .IO   └─────────────┘
      │                                                   ▲
      │              WebRTC P2P Connection                │
      └───────────────────────────────────────────────────┘
                    (Direct Media Stream)
```

### Why WebRTC?

WebRTC was chosen for this application because:

1. **UDP-based**: Uses UDP for media transmission (via SRTP), providing lower latency than TCP
2. **Peer-to-Peer**: Direct connections reduce server load
3. **Built-in**: Native browser support, no plugins needed
4. **Secure**: Encrypted by default (DTLS-SRTP)
5. **Efficient**: Adaptive bitrate and congestion control

## Browser Support

- Chrome/Chromium 74+
- Firefox 66+
- Safari 12.1+
- Edge 79+

## Configuration

The application uses public STUN servers by default. For production use, consider:

- Adding TURN servers for better connectivity
- Implementing authentication
- Adding room-based broadcasting
- Bandwidth monitoring and quality controls

## License

MIT

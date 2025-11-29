# Screen Broadcaster 📡

A clean and modern web-based screen sharing application built with WebRTC technology. Share your screen with multiple viewers in real-time with low latency and efficient bandwidth usage.

## Screenshots

### Home Page
![Home Page](screenshots/home.png)

### Broadcaster Interface
![Broadcaster Interface](screenshots/broadcaster.png)

### Viewer Interface with Playback Controls
![Viewer Interface](screenshots/viewer.png)

## Features

### Core Functionality
- 🔒 **Fully Offline** - Works entirely on local network, no internet required
- 🔐 **HTTPS Support** - Self-signed certificates for secure context over network
- 🎥 **Real-time Screen Broadcasting** - Share your screen with multiple viewers simultaneously
- 🌐 **Network Access** - Access from any device on the same Wi-Fi/LAN
- 📱 **Mobile Responsive** - Optimized viewing experience on phones and tablets
- 🖥️ **Multi-Session Support** - Multiple users can broadcast different sessions simultaneously
- ⚡ **WebRTC Direct Connection** - Low latency peer-to-peer streaming
- 🎮 **Advanced Viewer Controls:**
  - ⏯️ Play/Pause with frame-by-frame navigation
  - 🖼️ Picture-in-Picture mode
  - ⛶ Fullscreen with auto-rotate on mobile
- 📊 **Session Management** - View all active sessions with live viewer counts
- 🔄 **Re-broadcast** - Quickly rejoin inactive sessions with waiting viewers

### Viewer Controls
- **⏮️ / ⏭️ Frame Stepping**: Navigate frame-by-frame when paused
- **⏸️ Play/Pause**: Control video playback
- **🖼️ Picture-in-Picture**: Pop video into floating window
- **⛶ Fullscreen**: Full screen mode with auto-rotation on mobile
- **Responsive Layout**: Optimized for mobile and desktop

### User Experience
- **Modern Glassmorphic UI**: Sleek design with smooth animations
- **Auto IP Detection**: Server automatically finds your local network IP
- **One-Click Copy**: Easy sharing with copy-to-clipboard button
- **Mobile Optimized**: Controls adapt to screen size, auto-rotate to landscape

## Technology Stack

- **Backend**: Node.js + Express
- **Real-time Communication**: Socket.IO for signaling
- **Streaming**: WebRTC (uses UDP internally via SRTP)
- **Frontend**: Vanilla HTML/CSS/JavaScript

## Installation

1. Install dependencies:
```bash
npm install
```

### HTTPS Setup (Required for Network Screen Sharing)

Screen sharing requires a **secure context (HTTPS)** when accessed over network. The server automatically uses HTTPS if it finds SSL certificates.

**Generate SSL certificate (one-time setup):**

```bash
npm run generate-cert
```

This creates `server.key` and `server.cert` files that enable HTTPS.

2. Start the server:
```bash
npm start
```

The server will automatically:
- Use **HTTPS** if certificates exist → `https://localhost:3000`
- Fall back to **HTTP** if no certificates → `http://localhost:3000`

> **Note:** First-time users must accept the self-signed certificate warning in their browser:
> 1. Click "Advanced" or "Show Details"
> 2. Click "Proceed to [IP address] (unsafe)" or "Accept the Risk"
> 3. This only needs to be done once per browser

Or for development with auto-reload:
```bash
npm run dev
```

3. Server will start and display:
```
Server running on:
  Local:   http://localhost:3000
  Network: http://192.168.100.102:3000

Share this URL for viewers on your network:
  http://192.168.100.102:3000/viewer.html
```

## Usage

### As a Broadcaster

1. Open `https://localhost:3000/broadcast.html` in your browser
2. **Enter a session name** (e.g., "meeting-room-1", "presentation-hall-a")
   - Use alphanumeric characters, hyphens, and underscores
   - 3-50 characters long
3. Click **"🎥 Start Broadcasting"** button
4. Select the screen/window you want to share in the browser dialog
5. Click **"Share"** or **"Allow"** to grant permission
6. A **shareable viewer URL** will appear with your session ID
7. Share this URL with your audience
8. Monitor the **viewer count** in real-time
9. Click **"⏹️ Stop Broadcasting"** when done

### Multi-Session Broadcasting

**Multiple users can broadcast simultaneously with different session names!**

#### How It Works

- Each broadcaster creates a unique session with a custom name
- Viewers join specific sessions using the session ID in the URL
- All sessions are independent - no interference between them
- Sessions table shows all active broadcasts on the network

#### Example Scenario

**Meeting Room A:**
- Broadcaster enters session name: `meeting-room-a`
- Shares URL: `https://192.168.1.100:3000/viewer.html?id=meeting-room-a`

**Conference Hall:**
- Another broadcaster enters: `conference-hall`
- Shares URL: `https://192.168.1.100:3000/viewer.html?id=conference-hall`

**Training Room:**
- Third broadcaster enters: `training-101`
- Shares URL: `https://192.168.1.100:3000/viewer.html?id=training-101`

All three broadcasts run simultaneously on the same server!

#### Session Management Table

The broadcaster page shows an **Active Broadcast Sessions** table with:

| Column | Description |
|--------|-------------|
| **Session Name** | The session identifier (shows "(You)" for your session) |
| **Viewers** | Number of people watching this session |
| **Viewer URL** | Shareable link with session ID |
| **Actions** | Control buttons for each session |

**Action Buttons:**
- **⏹️ Stop** (Active sessions): Stop the broadcast
- **📡 Broadcast** (Inactive with viewers): Re-join session if you refreshed
- **⚪ Inactive** (No broadcaster, no viewers): Session is empty

#### Re-broadcasting

If you refresh the browser while broadcasting:
1. Your session becomes **inactive** but stays in the table
2. Viewers remain connected and waiting
3. Click the **📡 Broadcast** button to rejoin
4. Your screen sharing resumes for waiting viewers

This is useful if you need to restart your browser or switch tabs!

### As a Viewer

1. **Get the viewer URL** from the broadcaster (includes session ID)
   - Format: `https://[SERVER-IP]:3000/viewer.html?id=session-name`
2. Open the URL in your browser
3. **Accept certificate warning** (first time only on HTTPS)
4. Video will appear automatically once broadcast begins
5. Use playback controls to interact with the stream

**Important:** The URL must include the `?id=session-name` parameter to connect to the correct session!

### Viewer Controls

**Playback Controls (First Row):**
- **⏮️** Previous Frame - Step backward one frame (when paused)
- **⏸️ Pause / ▶️ Play** - Pause or resume the stream
- **⏭️** Next Frame - Step forward one frame (when paused)

**View Mode Controls (Second Row):**
- **🖼️ PiP** - Enter Picture-in-Picture mode (floating window)
- **⛶ Fullscreen** - Enter fullscreen mode
  - **Mobile**: Automatically rotates to landscape orientation

**Tips:**
- Pause the video to use frame-by-frame navigation
- PiP mode keeps video on top while you work in other apps
- Fullscreen provides immersive viewing, especially on mobile

### Network Access

To broadcast from one device and view from another on the same network:

1. **Start the server** - The console will display both HTTP and HTTPS URLs
2. **On broadcaster device** - Open the broadcast page:
   - HTTPS: `https://[SERVER-IP]:3000/broadcast.html` (recommended)
   - HTTP: `http://[SERVER-IP]:3000/broadcast.html` (localhost only)
3. **On viewer devices** - Use the shareable URL with session ID:
   - Format: `https://[SERVER-IP]:3000/viewer.html?id=session-name`
   - You can copy this URL from the broadcaster interface

> ⚠️ **Important:** Screen sharing over network requires **HTTPS**. Make sure you:
> 1. Generated SSL certificates with `npm run generate-cert`
> 2. Accepted the certificate warning on each device

**Example:**
```
Server IP: 192.168.1.100
Broadcaster: https://192.168.1.100:3000/broadcast.html
Viewer: https://192.168.1.100:3000/viewer.html?id=meeting-room-1
```
### Troubleshooting

### Screen Sharing Not Working Over Network

**Symptom:** Error when clicking "Start Broadcasting" from a network device

**Solution:** Screen sharing requires HTTPS over network. Follow these steps:

1. **Generate SSL certificate:**
   ```bash
   npm run generate-cert
   ```

2. **Restart the server** - It will now use HTTPS

3. **Accept the certificate warning** on each device:
   - Navigate to `https://[IP]:3000`
   - Click "Advanced" → "Proceed to [IP] (unsafe)"
   - This is safe - it's your own local certificate

4. **Use HTTPS URLs** for broadcasting:
   - ✅ `https://192.168.1.100:3000/broadcast.html`
   - ❌ `http://192.168.1.100:3000/broadcast.html`

### Connection Issues

**Can't connect from another device?**

1. **Check firewall**: Ensure your Mac allows incoming connections on port 3000
   - Go to: System Settings → Network → Firewall
   - Allow Node.js or the broadcaster app

2. **Verify network**: Both devices must be on the **same Wi-Fi network**
   - Don't use VPN on either device

3. **Test connection**: From another device, try pinging the server:
   ```bash
   ping 192.168.100.102
   ```

## Offline Operation

This broadcaster is designed to work **completely offline** on a local network:

- ✅ No internet connection required
- ✅ No external STUN/TURN servers
- ✅ No external dependencies after installation
- ✅ Self-signed HTTPS certificate (no CA needed)
- ✅ Direct peer-to-peer WebRTC connections on LAN

Perfect for:
- Corporate presentations in conference rooms
- Classroom broadcasting
- Events with unreliable internet
- Privacy-sensitive environments (no data leaves your network)
- Remote locations with local Wi-Fi only

**How it works:**
- Devices on the same network can communicate directly via local IP addresses
- HTTPS is used for secure context (browser requirement), not for encryption over internet
- No data is sent outside your local networkine

1. **Server runs locally** on your computer (localhost:3000)
2. **WebRTC uses local IPs** - Devices discover each other via local network
3. **Direct connections** - Video streams flow peer-to-peer on your LAN
4. **No internet needed** - As long as devices are on the same Wi-Fi/LAN

### Use Cases

- **Corporate presentations** - Share in conference rooms without internet
- **Schools/Education** - Classroom broadcasting on local network
- **Events** - Display screens at venues with unreliable internet
- **Privacy** - Keep all data on local network, nothing goes to cloud
- **Remote locations** - Works anywhere with just local Wi-Fi

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

WebRTC was chosen because it's the **optimal solution** for real-time browser-based streaming:

1. **UDP-based Media Transport** - Uses UDP internally for minimal latency
2. **Peer-to-Peer Architecture** - Direct streams reduce server load
3. **Security Built-in** - Mandatory encryption (DTLS-SRTP)
4. **Browser Native** - Works in all modern browsers without plugins

## Browser Support

- Chrome/Chromium 74+
- Firefox 66+
- Safari 12.1+
- Edge 79+

**Mobile Browsers:**
- Chrome Mobile (Android)
- Safari (iOS)
- Firefox Mobile

## Configuration

### Current Setup (Offline Local Network)

The application is configured for **local network operation without internet**:
- No STUN/TURN servers required
- Direct peer-to-peer connections on LAN
- Works completely offline

### Optional: Adding STUN/TURN for Internet Use

If you need to broadcast **over the internet** (not just local network), you can add STUN/TURN servers:

```javascript
// In broadcast.js and viewer.js
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // For production, add TURN servers for better connectivity
  ]
};
```

### Production Enhancements

For production deployment, consider:
- **TURN servers**: Better connectivity through restrictive firewalls (for internet use)
- **Authentication**: Implement user authentication for broadcasters
- **Room system**: Multiple independent broadcast rooms
- **Recording**: Save broadcasts server-side
- **Chat**: Real-time viewer chat functionality
- **Quality controls**: Bandwidth and resolution settings

## Features Comparison

| Feature | Description | Status |
|---------|-------------|--------|
| Screen Sharing | Share your screen in real-time | ✅ |
| Multiple Viewers | Unlimited simultaneous viewers | ✅ |
| Network Access | Share across local network | ✅ |
| Playback Controls | Pause, play, frame stepping | ✅ |
| Picture-in-Picture | Floating window mode | ✅ |
| Fullscreen | Full screen with auto-rotate | ✅ |
| Mobile Optimized | Responsive controls | ✅ |
| Viewer Count | Real-time viewer tracking | ✅ |
| Auto IP Detection | Automatic network URL | ✅ |
| Copy to Clipboard | Easy URL sharing | ✅ |

## License

MIT

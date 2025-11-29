const express = require('express');
const https = require('https');
const http = require('http');
const socketIo = require('socket.io');
const os = require('os');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Serve static files
app.use(express.static('public'));

// Try to create HTTPS server, fallback to HTTP if no certificates
let server;
let protocol = 'http';

try {
  const keyPath = path.join(__dirname, 'server.key');
  const certPath = path.join(__dirname, 'server.cert');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    server = https.createServer(options, app);
    protocol = 'https';
    console.log('✅ HTTPS enabled with self-signed certificate');
  } else {
    server = http.createServer(app);
    console.log('⚠️  Running on HTTP (certificates not found). Screen sharing may not work over network.');
    console.log('   To enable HTTPS, run: npm run generate-cert');
  }
} catch (err) {
  console.log('⚠️  Failed to load certificates, using HTTP:', err.message);
  server = http.createServer(app);
}

const io = socketIo(server);

// API endpoint to return server network IP
app.get('/api/server-ip', (req, res) => {
  res.json({ ip: getLocalIP(), port: PORT });
});

// Store active broadcast sessions
// sessions = Map { 'session-name' => { broadcaster: socketId, viewers: Set([id1, id2]), createdAt: timestamp } }
const sessions = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle broadcaster creating/joining a session
  socket.on('join-broadcast', (sessionId) => {
    console.log('Broadcaster joined session:', sessionId, 'Socket:', socket.id);

    // Create session if it doesn't exist
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        broadcaster: socket.id,
        viewers: new Set(),
        createdAt: Date.now()
      });
      console.log('Created new session:', sessionId);
    } else {
      // Update broadcaster for existing session
      const session = sessions.get(sessionId);
      session.broadcaster = socket.id;
      console.log('Updated broadcaster for session:', sessionId);
    }

    // Join the session room
    socket.join(sessionId);

    // Store session ID on socket for cleanup
    socket.sessionId = sessionId;
    socket.isBroadcaster = true;

    // Notify all existing viewers in this session
    const session = sessions.get(sessionId);
    session.viewers.forEach(viewerId => {
      console.log('Notifying existing viewer:', viewerId, 'in session:', sessionId);
      io.to(viewerId).emit('broadcaster-available', socket.id);
    });

    // Broadcast updated session list
    broadcastSessionsList();
  });

  // Handle viewer joining a session
  socket.on('join-viewer', (sessionId) => {
    console.log('Viewer joined session:', sessionId, 'Socket:', socket.id);

    // Create session if it doesn't exist (viewer joined before broadcaster)
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        broadcaster: null,
        viewers: new Set(),
        createdAt: Date.now()
      });
      console.log('Created session for viewer:', sessionId);
    }

    const session = sessions.get(sessionId);

    // Add viewer to session
    session.viewers.add(socket.id);

    // Join the session room
    socket.join(sessionId);

    // Store session ID on socket for cleanup
    socket.sessionId = sessionId;
    socket.isBroadcaster = false;

    if (session.broadcaster) {
      // Notify broadcaster about new viewer
      console.log('Notifying broadcaster about new viewer:', socket.id, 'in session:', sessionId);
      io.to(session.broadcaster).emit('viewer-joined', socket.id);

      // Notify viewer that broadcaster is available
      socket.emit('broadcaster-available', session.broadcaster);
    } else {
      console.log('No broadcaster available for session:', sessionId);
      socket.emit('waiting-for-broadcaster');
    }

    // Broadcast updated session list
    broadcastSessionsList();
  });

  // Handle session stop request
  socket.on('stop-session', (sessionId) => {
    console.log('Stop session requested:', sessionId, 'by:', socket.id);

    const session = sessions.get(sessionId);
    if (session) {
      // Notify broadcaster to stop
      if (session.broadcaster) {
        io.to(session.broadcaster).emit('force-stop-broadcast');
      }

      // Notify all viewers
      session.viewers.forEach(viewerId => {
        io.to(viewerId).emit('broadcaster-disconnected');
      });

      // Remove session
      sessions.delete(sessionId);
      console.log('Session stopped and removed:', sessionId);

      // Broadcast updated session list
      broadcastSessionsList();
    }
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    console.log('Offer from', socket.id, 'to', data.to);
    io.to(data.to).emit('offer', {
      from: socket.id,
      offer: data.offer
    });
  });

  socket.on('answer', (data) => {
    console.log('Answer from', socket.id, 'to', data.to);
    io.to(data.to).emit('answer', {
      from: socket.id,
      answer: data.answer
    });
  });

  socket.on('ice-candidate', (data) => {
    console.log('ICE candidate from', socket.id, 'to', data.to);
    io.to(data.to).emit('ice-candidate', {
      from: socket.id,
      candidate: data.candidate
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    const sessionId = socket.sessionId;
    if (!sessionId || !sessions.has(sessionId)) return;

    const session = sessions.get(sessionId);

    if (socket.isBroadcaster && session.broadcaster === socket.id) {
      console.log('Broadcaster disconnected from session:', sessionId);
      // Notify all viewers in this session
      session.viewers.forEach(viewerId => {
        io.to(viewerId).emit('broadcaster-disconnected');
      });
      // Remove session or reset broadcaster
      session.broadcaster = null;

      // Clean up empty sessions
      if (session.viewers.size === 0) {
        sessions.delete(sessionId);
        console.log('Deleted empty session:', sessionId);
      }
    } else if (session.viewers.has(socket.id)) {
      // Viewer disconnected
      console.log('Viewer disconnected from session:', sessionId, 'Socket:', socket.id);
      session.viewers.delete(socket.id);

      // Notify broadcaster about viewer disconnection
      if (session.broadcaster) {
        io.to(session.broadcaster).emit('viewer-disconnected', socket.id);
      }

      // Clean up empty sessions
      if (!session.broadcaster && session.viewers.size === 0) {
        sessions.delete(sessionId);
        console.log('Deleted empty session:', sessionId);
      }
    }

    // Broadcast updated session list
    broadcastSessionsList();
  });
});

// Broadcast updated session list to all clients
function broadcastSessionsList() {
  const sessionsList = Array.from(sessions.entries()).map(([sessionId, data]) => ({
    sessionId,
    viewerCount: data.viewers.size,
    hasBroadcaster: !!data.broadcaster
  }));

  io.emit('sessions-update', sessionsList);
  console.log('Broadcasting sessions list:', sessionsList);
}

// Send session list when client connects
io.on('connection', (socket) => {
  socket.on('request-sessions', () => {
    broadcastSessionsList();
  });
});

// Call broadcastSessionsList when sessions change
// We'll call it after session creation, viewer join/leave, broadcaster join/disconnect

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`Server running on:`);
  console.log(`  Local:   ${protocol}://localhost:${PORT}`);
  console.log(`  Network: ${protocol}://${localIP}:${PORT}`);
  console.log('');
  console.log(`Share this URL for viewers on your network:`);
  console.log(`  ${protocol}://${localIP}:${PORT}/viewer.html`);

  if (protocol === 'https') {
    console.log('');
    console.log('⚠️  Note: First-time users must accept the self-signed certificate warning in their browser');
  }
});

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;
const os = require('os');

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

// API endpoint to get server IP
app.get('/api/server-ip', (req, res) => {
  res.json({ ip: getLocalIP(), port: PORT });
});

// Store active broadcasters and viewers
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle broadcaster joining
  socket.on('join-broadcast', () => {
    console.log('Broadcaster joined:', socket.id);

    // Store this as a broadcaster
    if (!rooms.has('main')) {
      rooms.set('main', { broadcaster: null, viewers: new Set() });
    }
    const room = rooms.get('main');
    room.broadcaster = socket.id;

    // Notify all existing viewers that broadcaster is now available
    room.viewers.forEach(viewerId => {
      console.log('Notifying existing viewer:', viewerId);
      io.to(viewerId).emit('broadcaster-available', socket.id);
    });

    // Notify all viewers (including new ones) that broadcaster connected
    socket.broadcast.emit('broadcaster-connected', socket.id);
  });

  // Handle viewer joining
  socket.on('join-viewer', () => {
    console.log('Viewer joined:', socket.id);
    const room = rooms.get('main');

    if (!room) {
      rooms.set('main', { broadcaster: null, viewers: new Set() });
    }

    const currentRoom = rooms.get('main');

    // Add viewer to room
    currentRoom.viewers.add(socket.id);

    if (currentRoom.broadcaster) {
      // Notify broadcaster about new viewer
      console.log('Notifying broadcaster about new viewer:', socket.id);
      io.to(currentRoom.broadcaster).emit('viewer-joined', socket.id);

      // Notify viewer that broadcaster is available
      socket.emit('broadcaster-available', currentRoom.broadcaster);
    } else {
      console.log('No broadcaster available for viewer:', socket.id);
      socket.emit('waiting-for-broadcaster');
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

    const room = rooms.get('main');
    if (room) {
      // If broadcaster disconnects
      if (room.broadcaster === socket.id) {
        console.log('Broadcaster disconnected');
        // Notify all viewers
        room.viewers.forEach(viewerId => {
          io.to(viewerId).emit('broadcaster-disconnected');
        });
        // Reset room but keep viewers
        room.broadcaster = null;
      } else if (room.viewers.has(socket.id)) {
        // If viewer disconnects
        console.log('Viewer disconnected:', socket.id);
        room.viewers.delete(socket.id);

        // Notify broadcaster about viewer disconnection
        if (room.broadcaster) {
          io.to(room.broadcaster).emit('viewer-disconnected', socket.id);
        }
      }
    }
  });
});

http.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`Server running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIP}:${PORT}`);
  console.log(`\nShare this URL for viewers on your network:`);
  console.log(`  http://${localIP}:${PORT}/viewer.html`);
});

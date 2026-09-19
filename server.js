const path = require('path');
const os = require('os');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const store = require('./store');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

/* Deteksi alamat IP di jaringan WiFi lokal. Kalau server punya beberapa
   kartu jaringan dan salah deteksi, set manual lewat variabel lingkungan
   LAN_IP, misalnya: LAN_IP=192.168.1.20 node server.js */
function getLanIp() {
  if (process.env.LAN_IP) return process.env.LAN_IP;
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

function getAmbilUrl() {
  return `http://${getLanIp()}:${PORT}/ambil`;
}

/* ---------- Rute halaman (URL bersih tanpa .html) ---------- */
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/kiosk', (req, res) => res.sendFile(path.join(__dirname, 'public', 'kiosk.html')));
app.get('/ambil', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ambil.html')));
app.get('/loket', (req, res) => res.sendFile(path.join(__dirname, 'public', 'loket.html')));
app.get('/display', (req, res) => res.sendFile(path.join(__dirname, 'public', 'display.html')));

app.use(express.static(path.join(__dirname, 'public')));

/* ---------- API kecil untuk kode QR ---------- */
app.get('/api/ambil-url', (req, res) => {
  res.json({ url: getAmbilUrl() });
});

app.get('/api/qr.png', async (req, res) => {
  try {
    const buffer = await QRCode.toBuffer(getAmbilUrl(), {
      width: 380, margin: 1,
      color: { dark: '#0b1c33', light: '#ffffff' }
    });
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (e) {
    res.status(500).send('Gagal membuat kode QR');
  }
});

/* ---------- Realtime lewat Socket.io ---------- */
function broadcastState() {
  io.emit('state', store.getState());
}

io.on('connection', (socket) => {
  // Kirim state terkini begitu ada perangkat baru terhubung
  socket.emit('state', store.getState());

  socket.on('ticket:add', (category, cb) => {
    try {
      const ticket = store.addTicket(category);
      broadcastState();
      if (typeof cb === 'function') cb({ ok: true, ticket });
    } catch (e) {
      if (typeof cb === 'function') cb({ ok: false, error: e.message });
    }
  });

  socket.on('loket:next', (loketNum, cb) => {
    const ticket = store.callNext(loketNum);
    broadcastState();
    if (typeof cb === 'function') cb(ticket ? { ok: true, ticket } : { ok: false });
  });

  socket.on('loket:recall', (loketNum, cb) => {
    const ticket = store.recallCurrent(loketNum);
    broadcastState();
    if (typeof cb === 'function') cb(ticket ? { ok: true, ticket } : { ok: false });
  });

  socket.on('loket:finish', (loketNum, cb) => {
    store.finishCurrent(loketNum);
    broadcastState();
    if (typeof cb === 'function') cb({ ok: true });
  });

  socket.on('admin:reset', (cb) => {
    store.resetAll();
    broadcastState();
    if (typeof cb === 'function') cb({ ok: true });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('== QMS Kantor Imigrasi berjalan ==');
  console.log(`  Di komputer ini : http://localhost:${PORT}`);
  console.log(`  Di jaringan WiFi: http://${getLanIp()}:${PORT}`);
  console.log(`  Link ambil nomor: ${getAmbilUrl()}`);
  console.log('  (Pastikan semua perangkat terhubung ke WiFi yang sama)');
});

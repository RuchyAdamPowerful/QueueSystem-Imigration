const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

/* Semua perangkat (Kiosk, Ambil-Nomor di HP, Loket, Display) membaca &
   mengubah state yang sama ini lewat Socket.io — bukan localStorage lagi,
   karena sekarang perangkatnya berbeda-beda, bukan sekadar tab berbeda. */

const CATEGORIES = {
  A: { code: 'A', name: 'Permohonan Paspor Baru' },
  B: { code: 'B', name: 'Penggantian Paspor' },
  C: { code: 'C', name: 'Pengambilan Paspor' }
};
const LOKET_COUNT = 2;

function createInitialState() {
  const loketStatus = {};
  for (let i = 1; i <= LOKET_COUNT; i++) loketStatus[i] = { status: 'idle', currentTicketId: null };
  return {
    tickets: [],
    counters: { A: 0, B: 0, C: 0 },
    loketStatus,
    currentCall: null,
    recentCalls: []
  };
}

let db;
let state = createInitialState();
let deviceTickets = new Map();
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'queue.sqlite');
fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });

function queryRows(sql, values = []) {
  const statement = db.prepare(sql);
  try {
    statement.bind(values);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    return rows;
  } finally {
    statement.free();
  }
}

function saveDatabase() {
  const temporaryPath = `${databasePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, Buffer.from(db.export()));
    fs.renameSync(temporaryPath, databasePath);
  } catch (error) {
    try { fs.unlinkSync(temporaryPath); } catch {}
    throw error;
  }
}

function saveState() {
  db.run(`
    INSERT INTO app_state (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `, ['runtime', JSON.stringify({
    counters: state.counters,
    loketStatus: state.loketStatus,
    currentCall: state.currentCall,
    recentCalls: state.recentCalls
  })]);
}

async function initialize() {
  const SQL = await initSqlJs();
  const savedDatabase = fs.existsSync(databasePath) ? fs.readFileSync(databasePath) : undefined;
  db = savedDatabase ? new SQL.Database(savedDatabase) : new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      number TEXT NOT NULL,
      status TEXT NOT NULL,
      loket INTEGER,
      created_at INTEGER NOT NULL,
      called_at INTEGER,
      done_at INTEGER,
      device_id TEXT UNIQUE
    );
    CREATE INDEX IF NOT EXISTS tickets_status_created ON tickets(status, created_at);
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const metadata = queryRows('SELECT value FROM app_state WHERE key = ?', ['runtime']);
  const ticketRows = queryRows('SELECT * FROM tickets ORDER BY created_at, rowid');
  if (metadata.length) state = { ...createInitialState(), ...JSON.parse(metadata[0].value) };
  state.tickets = ticketRows.map(row => ({
    id: row.id,
    category: row.category,
    number: row.number,
    status: row.status,
    loket: row.loket,
    createdAt: row.created_at,
    calledAt: row.called_at,
    doneAt: row.done_at
  }));
  deviceTickets = new Map(ticketRows.filter(row => row.device_id).map(row => [row.device_id, row.id]));

  if (!metadata.length) {
    saveState();
    saveDatabase();
  }
}

const ready = initialize();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getWaitingTickets() {
  return state.tickets.filter(t => t.status === 'waiting').sort((a, b) => a.createdAt - b.createdAt);
}

function addTicket(category, deviceId) {
  if (!CATEGORIES[category]) throw new Error('Kategori tidak dikenal');
  if (!deviceId || typeof deviceId !== 'string') throw new Error('Identitas perangkat tidak valid');
  const existingTicketId = deviceTickets.get(deviceId);
  if (existingTicketId) {
    const existingTicket = state.tickets.find(ticket => ticket.id === existingTicketId);
    if (existingTicket) return existingTicket;
  }
  state.counters[category] = (state.counters[category] || 0) + 1;
  const number = `${category}-${String(state.counters[category]).padStart(2, '0')}`;
  const ticket = {
    id: uid(), category, number, status: 'waiting',
    loket: null, createdAt: Date.now(), calledAt: null, doneAt: null
  };
  db.run(`
    INSERT INTO tickets (id, category, number, status, loket, created_at, called_at, done_at, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [ticket.id, ticket.category, ticket.number, ticket.status, ticket.loket, ticket.createdAt, ticket.calledAt, ticket.doneAt, deviceId]);
  state.tickets.push(ticket);
  deviceTickets.set(deviceId, ticket.id);
  saveState();
  saveDatabase();
  return ticket;
}

function getDeviceTicket(deviceId) {
  const ticketId = deviceTickets.get(deviceId);
  return state.tickets.find(ticket => ticket.id === ticketId) || null;
}

function callNext(loketNum) {
  const waiting = getWaitingTickets();
  if (waiting.length === 0) return null;
  const target = waiting[0];
  target.status = 'called';
  target.loket = loketNum;
  target.calledAt = Date.now();
  state.loketStatus[loketNum] = { status: 'serving', currentTicketId: target.id };
  state.currentCall = { ticketId: target.id, number: target.number, category: target.category, loket: loketNum, ts: Date.now(), callCount: 1 };
  state.recentCalls.unshift({ number: target.number, loket: loketNum, ts: Date.now() });
  state.recentCalls = state.recentCalls.slice(0, 8);
  db.run('UPDATE tickets SET status = ?, loket = ?, called_at = ?, done_at = ? WHERE id = ?',
    [target.status, target.loket, target.calledAt, target.doneAt, target.id]);
  saveState();
  saveDatabase();
  return target;
}

function recallCurrent(loketNum) {
  const st = state.loketStatus[loketNum];
  if (!st || !st.currentTicketId) return null;
  const ticket = state.tickets.find(t => t.id === st.currentTicketId);
  if (!ticket) return null;
  const prev = state.currentCall;
  state.currentCall = {
    ticketId: ticket.id, number: ticket.number, category: ticket.category, loket: loketNum,
    ts: Date.now(), callCount: (prev && prev.ticketId === ticket.id) ? prev.callCount + 1 : 1
  };
  saveState();
  saveDatabase();
  return ticket;
}

function finishCurrent(loketNum) {
  const st = state.loketStatus[loketNum];
  if (!st || !st.currentTicketId) return;
  const ticket = state.tickets.find(t => t.id === st.currentTicketId);
  if (ticket) { ticket.status = 'done'; ticket.doneAt = Date.now(); }
  state.loketStatus[loketNum] = { status: 'idle', currentTicketId: null };
  if (ticket) {
    db.run('UPDATE tickets SET status = ?, loket = ?, called_at = ?, done_at = ? WHERE id = ?',
      [ticket.status, ticket.loket, ticket.calledAt, ticket.doneAt, ticket.id]);
  }
  saveState();
  saveDatabase();
}

function resetAll() {
  db.run('BEGIN TRANSACTION');
  try {
    db.run('DELETE FROM tickets');
    db.run('DELETE FROM app_state');
    state = createInitialState();
    deviceTickets = new Map();
    saveState();
    db.run('COMMIT');
    saveDatabase();
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

function getState() {
  return state;
}

module.exports = {
  CATEGORIES, LOKET_COUNT,
  addTicket, getDeviceTicket, callNext, recallCurrent, finishCurrent, resetAll,
  getState, getWaitingTickets, ready
};

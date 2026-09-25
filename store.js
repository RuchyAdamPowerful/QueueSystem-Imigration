/* Sumber kebenaran tunggal untuk seluruh antrean, disimpan di memori server.
   Semua perangkat (Kiosk, Ambil-Nomor di HP, Loket, Display) membaca &
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

let state = createInitialState();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getWaitingTickets() {
  return state.tickets.filter(t => t.status === 'waiting').sort((a, b) => a.createdAt - b.createdAt);
}

function addTicket(category) {
  if (!CATEGORIES[category]) throw new Error('Kategori tidak dikenal');
  state.counters[category] = (state.counters[category] || 0) + 1;
  const number = `${category}-${String(state.counters[category]).padStart(2, '0')}`;
  const ticket = {
    id: uid(), category, number, status: 'waiting',
    loket: null, createdAt: Date.now(), calledAt: null, doneAt: null
  };
  state.tickets.push(ticket);
  return ticket;
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
  return ticket;
}

function finishCurrent(loketNum) {
  const st = state.loketStatus[loketNum];
  if (!st || !st.currentTicketId) return;
  const ticket = state.tickets.find(t => t.id === st.currentTicketId);
  if (ticket) { ticket.status = 'done'; ticket.doneAt = Date.now(); }
  state.loketStatus[loketNum] = { status: 'idle', currentTicketId: null };
}

function resetAll() {
  state = createInitialState();
}

function getState() {
  return state;
}

module.exports = {
  CATEGORIES, LOKET_COUNT,
  addTicket, callNext, recallCurrent, finishCurrent, resetAll,
  getState, getWaitingTickets
};

// BUNKER free WebSocket room relay / authoritative host relay.
// MIT licensed dependency: ws. The host runs the game simulation; clients send actions to host.
const WebSocket = require('ws');
const crypto = require('crypto');
const PORT = Number(process.env.PORT || process.env.SERVER_PORT || process.env.SERVER_PORT_1 || 9080);
const MAX_ROOM_PLAYERS = 12;
const wss = new WebSocket.Server({ port: PORT, maxPayload: 128 * 1024 });
const rooms = new Map();
function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function getRoom(ws) { return ws.room ? rooms.get(ws.room) : null; }
function publicRoomList() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (!room.players.size || now - room.createdAt > 6 * 60 * 60 * 1000) rooms.delete(code);
  }
  return [...rooms.entries()]
    .filter(([, room]) => !room.started && room.players.size < MAX_ROOM_PLAYERS)
    .map(([code, room]) => ({
      room: code,
      count: room.players.size,
      max_players: MAX_ROOM_PLAYERS,
      host_name: [...room.players.values()].find(p => p.host)?.name || 'Хост',
      created_at: room.createdAt
    }))
    .sort((a, b) => a.created_at - b.created_at);
}
function roomState(code) {
  const room = rooms.get(code);
  if (!room) return;
  const players = [...room.players.values()].map(p => ({ id: p.id, name: p.name, host: p.host, ready: p.ready }));
  for (const p of room.players.values()) {
    send(p.ws, { type: 'lobby_state', room: code, count: players.length, players, started: room.started });
  }
}
function leaveRoom(ws) {
  const code = ws.room;
  if (!code || !rooms.has(code)) return;
  const room = rooms.get(code);
  room.players.delete(ws.id);
  ws.room = null;
  if (room.hostId === ws.id) {
    for (const p of room.players.values()) send(p.ws, { type: 'room_closed', message: 'Хост отключился; создайте новую комнату.' });
    for (const p of room.players.values()) p.ws.room = null;
    rooms.delete(code);
    return;
  }
  if (!room.players.size) rooms.delete(code);
  else roomState(code);
}
wss.on('connection', ws => {
  ws.id = crypto.randomUUID();
  ws.room = null;
  ws.name = 'Выживший';
  ws.host = false;
  ws.ready = false;
  send(ws, { type: 'hello', protocol: 'bunker-game-v2', maxPlayers: MAX_ROOM_PLAYERS });
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { type: 'error', message: 'Некорректный JSON' }); }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
    if (msg.type === 'list_rooms') {
      send(ws, { type: 'room_list', rooms: publicRoomList() });
      return;
    }
    if (msg.type === 'join') {
      const code = String(msg.room || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
      const name = String(msg.name || 'Выживший').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24) || 'Выживший';
      if (!code) return send(ws, { type: 'error', message: 'Нужен код комнаты' });
      if (ws.room) leaveRoom(ws);
      let room = rooms.get(code);
      const requestedHost = Boolean(msg.host);
      if (!room && !requestedHost) return send(ws, { type: 'error', message: 'Комната не найдена. Сначала хост должен создать её.' });
      if (!room) {
        room = { players: new Map(), hostId: null, started: false, createdAt: Date.now(), settings: {} };
        rooms.set(code, room);
      }
      if (room.started) return send(ws, { type: 'error', message: 'Партия уже началась; позднее подключение отключено.' });
      if (room.players.size >= MAX_ROOM_PLAYERS) return send(ws, { type: 'error', message: 'Комната заполнена.' });
      if ([...room.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase()))
        return send(ws, { type: 'error', message: 'В комнате уже есть игрок с таким именем.' });
      ws.room = code;
      ws.name = name;
      ws.host = !room.hostId;
      if (ws.host) room.hostId = ws.id;
      room.players.set(ws.id, { id: ws.id, ws, name, host: ws.host, ready: false });
      send(ws, { type: 'joined', id: ws.id, room: code, host: ws.host, name, protocol: 'bunker-game-v2' });
      roomState(code);
      return;
    }
    const room = getRoom(ws);
    if (!room) return send(ws, { type: 'error', message: 'Сначала подключись к комнате.' });
    if (msg.type === 'chat') {
      const text = String(msg.text || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 300);
      if (!text.trim()) return;
      for (const p of room.players.values()) send(p.ws, { type: 'chat', name: ws.name, text });
      return;
    }
    if (msg.type === 'ready') {
      ws.ready = Boolean(msg.ready);
      const player = room.players.get(ws.id);
      if (player) player.ready = ws.ready;
      roomState(ws.room);
      return;
    }
    if (msg.type === 'start_game') {
      if (room.hostId !== ws.id) return send(ws, { type: 'error', message: 'Только хост может начать партию.' });
      if (room.started) return send(ws, { type: 'error', message: 'Партия уже запущена.' });
      room.started = true;
      const players = [...room.players.values()].map(p => ({ id: p.id, name: p.name, host: p.host }));
      for (const p of room.players.values()) {
        if (p.id !== ws.id) send(p.ws, { type: 'game_started', room: ws.room, hostName: ws.name, players, settings: {
          player_count: Number(msg.player_count || players.length), style: String(msg.style || 'Обычный'), survivors: Number(msg.survivors || 4)
        }});
      }
      roomState(ws.room);
      return;
    }
    if (msg.type === 'game_state') {
      if (room.hostId !== ws.id) return send(ws, { type: 'error', message: 'Состояние игры может отправлять только хост.' });
      const state = msg.state;
      if (!state || typeof state !== 'object') return;
      const categoryFields = [
        ['Профессия', 'profession'], ['Биология', 'biology'], ['Здоровье', 'health'],
        ['Хобби', 'hobby'], ['Багаж', 'baggage'], ['Факт', 'facts'], ['Факты', 'facts'],
        ['Характер', 'trait'], ['Секрет', 'secret'], ['Скрытый предмет', 'secret_item'],
        ['Тайная цель', 'secret_goal'], ['Скрытая проблема', 'secret_problem'],
        ['Особое условие', 'special_condition']
      ];
      for (const recipient of room.players.values()) {
        if (recipient.id === ws.id) continue;
        const recipientState = JSON.parse(JSON.stringify(state));
        if (recipientState.game_phase === 'vote' && !recipientState.game_finished) {
          recipientState.vote_choices = {};
        }
        for (const person of (recipientState.game_players || [])) {
          if (String(person.name || '') === recipient.name) continue;
          const revealed = Array.isArray(person.revealed) ? person.revealed : [];
          for (const [category, field] of categoryFields) {
            if (!revealed.includes(category)) person[field] = 'ЗАКРЫТО';
          }
          // Private progression and ability details are never sent for other players.
          person.special_abilities = [];
          person.special_used = [];
          delete person.trust;
          delete person.suspicion;
        }
        send(recipient.ws, { type: 'game_state', state: recipientState });
      }
      return;
    }
    if (msg.type === 'timer_sync') {
      if (room.hostId !== ws.id) return;
      for (const p of room.players.values()) if (p.id !== ws.id) send(p.ws, { type: 'timer_sync', seconds: Number(msg.seconds || 0), paused: Boolean(msg.paused) });
      return;
    }
    if (msg.type === 'action') {
      if (room.hostId === ws.id) return send(ws, { type: 'error', message: 'Хост применяет свои действия локально.' });
      const host = room.players.get(room.hostId);
      if (!host) return send(ws, { type: 'error', message: 'Хост отключился.' });
      const action = msg.action;
      if (!action || typeof action !== 'object') return;
      // Only allow the explicitly supported gameplay action types.
      if (!['reveal', 'vote', 'intro_skip', 'skip_turn', 'ability_open', 'ability_cancel', 'ability'].includes(String(action.action)))
        return send(ws, { type: 'error', message: 'Неизвестное действие.' });
      send(host.ws, { type: 'game_action', sender: ws.name, action });
      return;
    }
  });
  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});
console.log(`BUNKER game relay listening on :${PORT} (protocol bunker-game-v2)`);

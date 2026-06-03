const SocketClient = {
  socket: null,
  listeners: {},

  connect() {
    this.socket = io({ transports: ['websocket', 'polling'] });
    this.socket.on('connect', () => console.log('Socket connected'));
    this.socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
    this.socket.on('connect_error', (err) => console.log('Socket connect error:', err.message));
    this.socket.on('reconnect', (attempt) => console.log('Socket reconnected, attempt:', attempt));

    // 绑定所有事件
    const events = [
      'room:created', 'room:joined', 'room:updated',
      'game:started', 'game:state', 'game:played',
      'game:options', 'game:claimed', 'game:drawn',
      'game:ended', 'history:data', 'error'
    ];
    events.forEach(evt => {
      this.socket.on(evt, (data) => this.emit(evt, data));
    });
  },

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },

  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  },

  createRoom(playerName) {
    this.socket.emit('room:create', { playerName });
  },

  joinRoom(code, playerName) {
    this.socket.emit('room:join', { code, playerName });
  },

  startGame(code) {
    this.socket.emit('room:start', { code });
  },

  playTile(code, tileIndex) {
    this.socket.emit('game:play', { code, tileIndex });
  },

  chi(code, optionIndex) {
    this.socket.emit('game:chi', { code, optionIndex });
  },

  peng(code) {
    this.socket.emit('game:peng', { code });
  },

  gang(code, type) {
    this.socket.emit('game:gang', { code, type });
  },

  hu(code) {
    this.socket.emit('game:hu', { code });
  },

  skip(code) {
    this.socket.emit('game:skip', { code });
  },

  getHistory(playerId) {
    this.socket.emit('history:get', { playerId });
  }
};

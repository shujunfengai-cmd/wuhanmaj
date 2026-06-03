const RoomUI = {
  currentRoom: null,
  myPlayerId: null,

  init() {
    document.getElementById('btn-create-room').addEventListener('click', () => {
      const name = document.getElementById('player-name').value.trim();
      if (!name) { this.showError('请输入昵称'); return; }
      SocketClient.createRoom(name);
    });
    document.getElementById('btn-join-room').addEventListener('click', () => {
      const name = document.getElementById('player-name').value.trim();
      const code = document.getElementById('room-code').value.trim();
      if (!name) { this.showError('请输入昵称'); return; }
      if (!code || code.length !== 4) { this.showError('请输入4位口令'); return; }
      SocketClient.joinRoom(code, name);
    });
    document.getElementById('btn-start-game').addEventListener('click', () => {
      console.log('Start game clicked, currentRoom:', this.currentRoom);
      if (this.currentRoom) {
        SocketClient.startGame(this.currentRoom);
      } else {
        alert('房间信息丢失，请重新进入');
      }
    });
    document.getElementById('btn-leave-room').addEventListener('click', () => {
      this.goHome();
    });
    SocketClient.on('room:created', (data) => {
      this.myPlayerId = data.playerId;
      this.currentRoom = data.code;
      this.showRoom(data.code, data.players, true);
    });
    SocketClient.on('room:joined', (data) => {
      this.myPlayerId = data.playerId;
      this.currentRoom = data.code;
      this.showRoom(data.code, data.players, false);
    });
    SocketClient.on('room:updated', (data) => {
      this.updatePlayers(data.players);
    });
    SocketClient.on('error', (data) => {
      this.showError(data.message);
    });
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    if (roomCode) {
      document.getElementById('room-code').value = roomCode;
    }
  },
  showRoom(code, players, isHost) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('room-screen').classList.add('active');
    document.getElementById('room-code-display').textContent = code;
    const link = `${window.location.origin}?room=${code}`;
    document.getElementById('share-link').textContent = `分享链接: ${link}`;
    this.updatePlayers(players);
    const startBtn = document.getElementById('btn-start-game');
    const waitMsg = document.getElementById('waiting-msg');
    if (isHost) {
      startBtn.classList.remove('hidden');
      waitMsg.classList.add('hidden');
    } else {
      startBtn.classList.add('hidden');
      waitMsg.classList.remove('hidden');
    }
  },
  updatePlayers(players) {
    const container = document.getElementById('players-list');
    container.innerHTML = '';
    const seats = ['东', '南', '西', '北'];
    for (let i = 0; i < 4; i++) {
      const p = players[i];
      const card = document.createElement('div');
      card.className = 'player-card' + (p && p.id === this.myPlayerId ? ' host' : '');
      if (p) {
        card.innerHTML = `<div class="seat">${seats[i]}</div><div class="name">${p.name}</div>`;
      } else {
        card.innerHTML = `<div class="seat">${seats[i]}</div><div class="name" style="color:rgba(255,255,255,0.4)">等待中...</div>`;
      }
      container.appendChild(card);
    }
  },
  showError(msg) {
    console.error('Error:', msg);
    const homeErr = document.getElementById('home-error');
    if (homeErr) homeErr.textContent = msg;
    const roomScreen = document.getElementById('room-screen');
    if (roomScreen && roomScreen.classList.contains('active')) {
      alert('错误: ' + msg);
    }
  },
  goHome() {
    this.currentRoom = null;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('home-screen').classList.add('active');
  }
};

const GameUI = {
  gameState: null,
  myPlayerId: null,
  roomCode: null,
  selectedTileIndex: null,
  laizi: null,
  piZi: [],

  init() {
    document.getElementById('my-hand').addEventListener('click', (e) => {
      const tile = e.target.closest('.tile');
      if (!tile) return;
      const idx = parseInt(tile.dataset.index);
      if (isNaN(idx)) return;
      this.selectTile(idx);
    });
    document.getElementById('btn-chi').addEventListener('click', () => {
      SocketClient.chi(this.roomCode, 0);
      this.hideActions();
    });
    document.getElementById('btn-peng').addEventListener('click', () => {
      SocketClient.peng(this.roomCode);
      this.hideActions();
    });
    document.getElementById('btn-gang').addEventListener('click', () => {
      SocketClient.gang(this.roomCode, 'ming');
      this.hideActions();
    });
    document.getElementById('btn-pizi-gang').addEventListener('click', () => {
      const idx = this.gameState?.myPiZiIndices?.[0];
      if (idx !== undefined) SocketClient.gang(this.roomCode, 'pizi');
      this.hideActions();
    });
    document.getElementById('btn-hu').addEventListener('click', () => {
      SocketClient.hu(this.roomCode);
      this.hideActions();
    });
    document.getElementById('btn-skip').addEventListener('click', () => {
      SocketClient.skip(this.roomCode);
      this.hideActions();
    });
    SocketClient.on('game:started', (data) => {
      this.laizi = data.laizi;
      this.piZi = data.piZi || [];
      this.showGameScreen(data);
    });
    SocketClient.on('game:state', (data) => {
      this.gameState = data;
      this.updateDisplay();
    });
    SocketClient.on('game:played', (data) => {
      this.updateLastPlayed(data.tile);
    });
    SocketClient.on('game:options', (data) => {
      this.showActions(data);
    });
    SocketClient.on('game:claimed', (data) => {
      // 刷新状态
    });
    SocketClient.on('game:drawn', (data) => {
      // 自己摸牌了
    });
    SocketClient.on('game:ended', (data) => {
      this.showResult(data);
    });
  },
  showGameScreen(data) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('laizi-display').textContent = `赖子: ${this.tileName(data.laizi)}`;
    document.getElementById('pizi-display').textContent = `皮子: ${(data.piZi || []).map(t => this.tileName(t)).join(' ')}`;
  },
  updateDisplay() {
    if (!this.gameState) return;
    const state = this.gameState;
    document.getElementById('remaining-display').textContent = `剩余: ${state.remaining}`;
    const current = state.players.find(p => p.id === state.currentPlayer);
    document.getElementById('turn-indicator').textContent = current ? `轮到: ${current.name}` : '-';
    // 渲染其他玩家
    const opArea = document.getElementById('opponents-area');
    opArea.innerHTML = '';
    for (const p of state.players) {
      if (p.id === this.myPlayerId) continue;
      const div = document.createElement('div');
      div.className = 'opponent';
      const meldsHtml = (p.melds || []).map(m => `<div class="meld-group">${m.tiles.map(t => `<div class="tile ${t.suit}">${this.tileName(t)}</div>`).join('')}</div>`).join('');
      div.innerHTML = `<div class="op-name">${p.name} ${p.seat}</div><div class="op-count">${p.handCount}张</div><div class="op-melds">${meldsHtml}</div>`;
      opArea.appendChild(div);
    }
    // 渲染我的手牌
    const handArea = document.getElementById('my-hand');
    handArea.innerHTML = '';
    state.myHand.forEach((tile, i) => {
      const div = document.createElement('div');
      div.className = 'tile ' + tile.suit;
      if (this.isLaizi(tile)) div.classList.add('laizi');
      if (this.isPiZi(tile)) div.classList.add('pizi');
      if (i === this.selectedTileIndex) div.classList.add('selected');
      div.dataset.index = i;
      div.textContent = this.tileName(tile);
      handArea.appendChild(div);
    });
    // 渲染副露
    const meldsArea = document.getElementById('my-melds');
    meldsArea.innerHTML = '';
    for (const m of state.myMelds) {
      const g = document.createElement('div');
      g.className = 'meld-group';
      g.innerHTML = m.tiles.map(t => `<div class="tile ${t.suit}">${this.tileName(t)}</div>`).join('');
      meldsArea.appendChild(g);
    }
    // 如果是我的回合且没选牌，提示
    if (state.currentPlayer === this.myPlayerId) {
      // 检查是否能胡（自摸）
      // 由服务器发送 game:options 处理
    }
  },
  selectTile(index) {
    if (this.selectedTileIndex === index) {
      // 再次点击同一张 = 出牌
      SocketClient.playTile(this.roomCode, index);
      this.selectedTileIndex = null;
    } else {
      this.selectedTileIndex = index;
      this.updateDisplay();
    }
  },
  updateLastPlayed(tile) {
    document.getElementById('last-played').textContent = tile ? this.tileName(tile) : '-';
  },
  showActions(data) {
    const btns = document.getElementById('action-buttons');
    btns.classList.remove('hidden');
    document.getElementById('btn-chi').classList.toggle('hidden', data.type !== 'chi');
    document.getElementById('btn-peng').classList.toggle('hidden', data.type !== 'peng');
    document.getElementById('btn-gang').classList.toggle('hidden', data.type !== 'gang');
    document.getElementById('btn-hu').classList.toggle('hidden', data.type !== 'hu');
    document.getElementById('btn-skip').classList.remove('hidden');
    // 皮子杠按钮由 game state 控制
  },
  hideActions() {
    document.getElementById('action-buttons').classList.add('hidden');
    document.getElementById('btn-chi').classList.add('hidden');
    document.getElementById('btn-peng').classList.add('hidden');
    document.getElementById('btn-gang').classList.add('hidden');
    document.getElementById('btn-pizi-gang').classList.add('hidden');
    document.getElementById('btn-hu').classList.add('hidden');
    document.getElementById('btn-skip').classList.add('hidden');
  },
  showResult(data) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('result-screen').classList.add('active');
    const content = document.getElementById('result-content');
    if (data.liuJu) {
      content.innerHTML = '<p>流局</p>';
      return;
    }
    let html = `<p>赢家: ${data.winner}</p>`;
    html += `<p>胡牌类型: ${data.winType}</p>`;
    html += `<p>番数: ${data.fan}番</p>`;
    html += '<div style="margin-top:16px;">';
    for (const r of data.results || []) {
      html += `<div class="result-row"><span>${r.playerId}</span><span>${r.change > 0 ? '+' : ''}${r.change}</span></div>`;
    }
    html += '</div>';
    content.innerHTML = html;
  },
  tileName(tile) {
    if (!tile) return '?';
    const vn = { dong: '东', nan: '南', xi: '西', bei: '北', zhong: '中', fa: '发', bai: '白' };
    if (tile.suit === 'feng' || tile.suit === 'jian') return vn[tile.value] || tile.value;
    return tile.value + (tile.suit === 'wan' ? '万' : tile.suit === 'tong' ? '筒' : '条');
  },
  isLaizi(tile) {
    return this.laizi && tile.suit === this.laizi.suit && tile.value === this.laizi.value;
  },
  isPiZi(tile) {
    return this.piZi.some(pz => pz.suit === tile.suit && pz.value === tile.value);
  }
};

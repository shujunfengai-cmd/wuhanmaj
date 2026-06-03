const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.RENDER ? '/tmp' : path.join(__dirname, '..');
const DB_FILE = path.join(DATA_DIR, 'mahjong-data.json');

function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) { console.error('DB load error:', e.message); }
  return { players: [], rooms: [], games: [], scores: [], playerStats: {} };
}

function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { console.error('DB save error:', e.message); }
}

class Database {
  constructor() {
    this.data = loadData();
  }

  _save() { saveData(this.data); }

  savePlayer(name) {
    const existing = this.data.players.find(p => p.name === name);
    if (existing) return Promise.resolve(existing);
    const player = { id: this.data.players.length + 1, name, created_at: new Date().toISOString() };
    this.data.players.push(player);
    this._save();
    return Promise.resolve(player);
  }

  saveRoom(code, hostId) {
    const room = { id: this.data.rooms.length + 1, code, host_id: hostId, status: 'waiting', created_at: new Date().toISOString() };
    this.data.rooms.push(room);
    this._save();
    return Promise.resolve(room);
  }

  saveGame(roomCode, players, laizi, piZi) {
    const [e, s, w, n] = players;
    const game = {
      id: this.data.games.length + 1,
      room_id: roomCode,
      status: 'playing',
      started_at: new Date().toISOString(),
      east_id: e?.id, south_id: s?.id, west_id: w?.id, north_id: n?.id,
      laizi_tile: laizi, pi_zi_tiles: piZi,
      winner_id: null, win_type: null, total_fan: null
    };
    this.data.games.push(game);
    this._save();
    return Promise.resolve({ id: game.id });
  }

  endGame(gameId, winnerId, winType, totalFan) {
    const game = this.data.games.find(g => g.id === gameId);
    if (game) {
      game.status = 'ended';
      game.ended_at = new Date().toISOString();
      game.winner_id = winnerId;
      game.win_type = winType;
      game.total_fan = totalFan;
      this._save();
    }
    return Promise.resolve();
  }

  saveScore(gameId, playerId, change, isWinner, mingGang, anGang, piZiGang) {
    const score = { game_id: gameId, player_id: playerId, score_change: change, is_winner: isWinner, ming_gang_count: mingGang || 0, an_gang_count: anGang || 0, pi_zi_gang_count: piZiGang || 0 };
    this.data.scores.push(score);
    this._save();
    return Promise.resolve();
  }

  updatePlayerStats(playerId, isWinner, scoreChange, fan) {
    const stats = this.data.playerStats[playerId] || { total_games: 0, total_wins: 0, total_score: 0, highest_fan: 0 };
    stats.total_games++;
    if (isWinner) stats.total_wins++;
    stats.total_score += scoreChange;
    if (fan > stats.highest_fan) stats.highest_fan = fan;
    stats.updated_at = new Date().toISOString();
    this.data.playerStats[playerId] = stats;
    this._save();
    return Promise.resolve();
  }

  getPlayerHistory(playerId, limit = 10) {
    const history = [];
    for (const g of this.data.games.slice().reverse()) {
      const s = this.data.scores.find(x => x.game_id === g.id && x.player_id === playerId);
      if (s) {
        history.push({ ...g, score_change: s.score_change, is_winner: s.is_winner });
        if (history.length >= limit) break;
      }
    }
    return Promise.resolve(history);
  }

  getPlayerStats(playerId) {
    return Promise.resolve(this.data.playerStats[playerId] || { total_games: 0, total_wins: 0, total_score: 0, highest_fan: 0 });
  }

  getRoomHistory(roomId) {
    const games = this.data.games.filter(g => g.room_id === roomId && g.status === 'ended').reverse();
    return Promise.resolve(games);
  }
}

module.exports = Database;

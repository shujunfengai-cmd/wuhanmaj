const { GameEngine } = require('./engine');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> room
  }

  createRoom(hostPlayer) {
    const code = this.generateCode();
    const room = {
      code,
      hostId: hostPlayer.id,
      status: 'waiting',
      players: [hostPlayer],
      game: null,
      createdAt: Date.now()
    };
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code, player) {
    const room = this.rooms.get(code);
    if (!room) return { success: false, error: 'roomNotFound' };
    if (room.status !== 'waiting') return { success: false, error: 'gameStarted' };
    if (room.players.length >= 4) return { success: false, error: 'roomFull' };
    if (room.players.some(p => p.id === player.id)) return { success: false, error: 'alreadyJoined' };

    room.players.push(player);
    return { success: true, room };
  }

  leaveRoom(code, playerId) {
    const room = this.rooms.get(code);
    if (!room) return { success: false };
    room.players = room.players.filter(p => p.id !== playerId);
    if (room.players.length === 0) {
      this.rooms.delete(code);
      return { success: true, deleted: true };
    }
    // 如果房主离开，转让房主
    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
    }
    return { success: true, room };
  }

  startGame(code) {
    const room = this.rooms.get(code);
    if (!room) return { success: false, error: 'roomNotFound' };
    if (room.players.length !== 4) return { success: false, error: 'notEnoughPlayers' };
    if (room.status !== 'waiting') return { success: false, error: 'alreadyStarted' };

    room.status = 'playing';
    room.game = new GameEngine(code, room.players);
    const startResult = room.game.start();
    return { success: true, startResult };
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  generateCode() {
    // 4位数字口令
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
}

module.exports = RoomManager;

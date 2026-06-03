const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Database = require('./db/database');
const RoomManager = require('./game/room-manager');
const { v4: uuidv4 } = require('uuid');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling']
});

const db = new Database();
const roomManager = new RoomManager();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io 事件处理
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 创建房间
  socket.on('room:create', async ({ playerName }) => {
    try {
      const player = { id: uuidv4(), name: playerName, socketId: socket.id };
      const room = roomManager.createRoom(player);
      await db.saveRoom(room.code, player.id);
      await db.savePlayer(player.name);
      socket.join(room.code);
      socket.emit('room:created', {
        code: room.code,
        playerId: player.id,
        players: room.players.map(p => ({ id: p.id, name: p.name, seat: p.seat || null }))
      });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // 加入房间
  socket.on('room:join', async ({ code, playerName }) => {
    try {
      const player = { id: uuidv4(), name: playerName, socketId: socket.id };
      const result = roomManager.joinRoom(code, player);
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }
      await db.savePlayer(player.name);
      socket.join(code);
      socket.emit('room:joined', {
        code,
        playerId: player.id,
        players: result.room.players.map(p => ({ id: p.id, name: p.name }))
      });
      socket.to(code).emit('room:updated', {
        players: result.room.players.map(p => ({ id: p.id, name: p.name }))
      });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // 开始游戏
  socket.on('room:start', ({ code }) => {
    try {
      console.log('room:start received', code, 'from', socket.id);
      const room = roomManager.getRoom(code);
      if (!room) {
        socket.emit('error', { message: 'roomNotFound' });
        return;
      }
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.id !== room.hostId) {
        socket.emit('error', { message: 'notHost' });
        return;
      }
      const result = roomManager.startGame(code);
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      const seats = ['east', 'south', 'west', 'north'];
      room.players.forEach((p, i) => { p.seat = seats[i]; });

      db.saveGame(room.code, room.players, result.startResult.laizi, result.startResult.piZi)
        .then(game => { room.gameId = game.id; })
        .catch(err => console.error('saveGame error:', err));

      io.to(code).emit('game:started', {
        dice: result.startResult.dice,
        laizi: result.startResult.laizi,
        piZi: result.startResult.piZi,
        players: room.players.map(p => ({
          id: p.id,
          name: p.name,
          seat: p.seat,
          handCount: p.hand.tiles.length
        }))
      });

      for (const p of room.players) {
        try {
          const state = room.game.getGameState(p.id);
          const targetSocket = io.sockets.sockets.get(p.socketId);
          if (targetSocket) {
            targetSocket.emit('game:state', state);
          } else {
            console.warn('Socket not found for player', p.id, p.socketId);
          }
        } catch (e) {
          console.error('Send state error:', e);
        }
      }
      console.log('room:start completed');
    } catch (err) {
      console.error('room:start error:', err);
      socket.emit('error', { message: 'startFailed: ' + err.message });
    }
  });
  // 出牌
  socket.on('game:play', ({ code, tileIndex }) => {
    const room = roomManager.getRoom(code);
    if (!room || !room.game) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const result = room.game.playTile(player.id, tileIndex);
    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }

    io.to(code).emit('game:played', { playerId: player.id, tile: result.tile });

    if (result.claims && result.claims.length > 0) {
      // 有玩家可以操作
      for (const claim of result.claims) {
        const target = room.players.find(p => p.id === claim.playerId);
        if (target) {
          io.sockets.sockets.get(target.socketId)?.emit('game:options', {
            type: claim.type,
            options: claim.options || null,
            tile: result.tile
          });
        }
      }
    } else if (result.liuJu) {
      io.to(code).emit('game:ended', { liuJu: true });
      endGameToDb(room, null, 'liuJu', 0);
    } else {
      // 下家摸牌
      const nextP = room.players.find(p => p.id === result.nextPlayer);
      if (nextP) {
        io.to(nextP.socketId).emit('game:drawn', { tile: result.drawn, canHu: result.canHu });
      }
      broadcastState(room);
    }
  });

  // 吃
  socket.on('game:chi', ({ code, optionIndex }) => {
    handleClaim(code, socket, (game, player) => game.doChi(player.id, optionIndex || 0), 'chi');
  });

  // 碰
  socket.on('game:peng', ({ code }) => {
    handleClaim(code, socket, (game, player) => game.doPeng(player.id), 'peng');
  });

  // 杠
  socket.on('game:gang', ({ code, type }) => {
    const room = roomManager.getRoom(code);
    if (!room || !room.game) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    let result;
    if (type === 'ming') {
      result = room.game.doMingGang(player.id);
    } else if (type === 'an') {
      // 暗杠需要指定牌
    const tileForAnGang = player.hand.tiles.find(t => {
      const gangs = player.hand.canAnGang();
      return gangs.some(g => require('./game/tile').tileEquals(g, t));
    });
    if (tileForAnGang) result = room.game.doAnGang(player.id, require('./game/tile').tileKey(tileForAnGang));
    } else if (type === 'pizi') {
      // 皮子杠
      const idx = player.hand.findPiZiIndices(room.game.piZi)[0];
      if (idx !== undefined) result = room.game.doPiZiGang(player.id, idx);
    }

    if (result && result.success) {
      io.to(code).emit('game:claimed', { playerId: player.id, type: result.type, tile: result.tile });
      if (result.drawn) {
        io.to(player.socketId).emit('game:drawn', { tile: result.drawn });
      }
      broadcastState(room);
    } else {
      socket.emit('error', { message: result?.error || 'gangFailed' });
    }
  });

  // 胡
  socket.on('game:hu', ({ code }) => {
    const room = roomManager.getRoom(code);
    if (!room || !room.game) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const isZimo = room.game.getCurrentPlayer().id === player.id;
    const result = room.game.doHu(player.id, isZimo);

    if (result.success) {
      room.lastGameResult = result;
      io.to(code).emit('game:ended', {
        winner: result.winner,
        winType: result.winType,
        fan: result.fan,
        score: result.score,
        results: result.results
      });
      endGameToDb(room, result.winner, result.winType, result.fan);
    } else {
      socket.emit('error', { message: result.error || 'cannotHu' });
    }
  });

  // 跳过
  socket.on('game:skip', ({ code }) => {
    const room = roomManager.getRoom(code);
    if (!room || !room.game) return;
    // 清除当前玩家的claim选项
    room.game.pendingClaims = room.game.pendingClaims.filter(c => c.playerId !== playerIdFromSocket(room, socket));
    if (room.game.pendingClaims.length === 0) {
      room.game.phase = 'playing';
      room.game.nextTurn();
      const nextP = room.game.getCurrentPlayer();
      const drawn = room.game.deck.draw();
      if (drawn) {
        nextP.hand.add(drawn);
        const huCheck = room.game.checkSelfHu(nextP);
        io.to(nextP.socketId).emit('game:drawn', { tile: drawn, canHu: huCheck.canHu });
      }
      broadcastState(room);
    }
  });

  // 获取历史
  socket.on('history:get', async ({ playerId }) => {
    try {
      const history = await db.getPlayerHistory(playerId);
      const stats = await db.getPlayerStats(playerId);
      socket.emit('history:data', { history, stats });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// 辅助函数
function handleClaim(code, socket, action, typeName) {
  const room = roomManager.getRoom(code);
  if (!room || !room.game) return;
  const player = room.players.find(p => p.socketId === socket.id);
  if (!player) return;

  const result = action(room.game, player);
  if (result.success) {
    io.to(code).emit('game:claimed', { playerId: player.id, type: typeName });
    broadcastState(room);
  } else {
    socket.emit('error', { message: result.error || `${typeName}Failed` });
  }
}

function broadcastState(room) {
  for (const p of room.players) {
    const state = room.game.getGameState(p.id);
    io.sockets.sockets.get(p.socketId)?.emit('game:state', state);
  }
}

function playerIdFromSocket(room, socket) {
  const p = room.players.find(p => p.socketId === socket.id);
  return p ? p.id : null;
}

async function endGameToDb(room, winnerId, winType, fan) {
  if (!room.gameId) return;
  try {
    await db.endGame(room.gameId, winnerId, winType, fan);
    for (const p of room.players) {
      const r = room.lastGameResult?.results?.find(x => x.playerId === p.id);
      const change = r ? r.change : 0;
      await db.saveScore(room.gameId, p.id, change, p.id === winnerId, p.mingGangCount, p.anGangCount, p.piZiGangCount);
      await db.updatePlayerStats(p.id, p.id === winnerId, change, fan);
    }
  } catch (err) {
    console.error('DB save error:', err);
  }
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Wuhan Mahjong server running on port ${PORT}`);
});

const Deck = require('./deck');
const Hand = require('./hand');
const WinChecker = require('./win-checker');
const FanCalculator = require('./fan-calculator');
const Rules = require('./rules');
const Tile = require('./tile');

const PHASES = {
  WAITING: 'waiting',
  DEALING: 'dealing',
  PLAYING: 'playing',
  CLAIMING: 'claiming',
  ENDED: 'ended'
};

const SEATS = ['east', 'south', 'west', 'north'];

class GameEngine {
  constructor(roomId, players) {
    this.roomId = roomId;
    this.players = players.map((p, i) => ({
      ...p,
      seat: SEATS[i],
      seatIndex: i,
      hand: new Hand(),
      hasOpened: false,
      mingGangCount: 0,
      anGangCount: 0,
      piZiGangCount: 0,
      score: 0,
      isZhuang: i === 0
    }));
    this.phase = PHASES.WAITING;
    this.deck = null;
    this.currentPlayerIndex = 0;
    this.lastPlayedTile = null;
    this.laizi = null;
    this.piZi = [];
    this.winner = null;
    this.winType = null;
    this.history = [];
    this.pendingClaims = []; // 待处理的操作请求
    this.turnCount = 0;
  }

  start() {
    this.deck = new Deck();
    const dice = this.deck.rollDice();
    // 发牌
    const hands = this.deck.deal(4);
    for (let i = 0; i < 4; i++) {
      this.players[i].hand = new Hand(hands[i]);
    }
    // 翻赖子/皮子
    const lr = this.deck.revealLaizi();
    this.laizi = lr.laizi;
    this.piZi = lr.piZi;
    this.phase = PHASES.PLAYING;
    this.currentPlayerIndex = 0; // 庄家先出
    this.turnCount = 0;
    return {
      dice,
      laizi: this.laizi,
      piZi: this.piZi,
      hands: this.players.map(p => p.hand.tiles.length)
    };
  }

  // 获取当前玩家
  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  // 出牌
  playTile(playerId, tileIndex) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.players[this.currentPlayerIndex].id !== playerId) {
      return { success: false, error: 'notYourTurn' };
    }
    const tile = player.hand.remove(tileIndex);
    if (!tile) return { success: false, error: 'invalidTile' };

    this.lastPlayedTile = tile;
    this.history.push({ type: 'play', playerId, tile });

    // 检查其他玩家是否有操作
    const claims = this.checkClaims(tile, player.seatIndex);
    if (claims.length > 0) {
      this.phase = PHASES.CLAIMING;
      this.pendingClaims = claims;
      return { success: true, tile, claims, nextPhase: 'claiming' };
    }

    // 无人操作，下家摸牌
    this.nextTurn();
    const nextPlayer = this.getCurrentPlayer();
    const drawn = this.deck.draw();
    if (drawn) {
      nextPlayer.hand.add(drawn);
      // 检查自摸
      const huCheck = this.checkSelfHu(nextPlayer);
      return { success: true, tile, nextPlayer: nextPlayer.id, drawn, canHu: huCheck.canHu };
    } else {
      // 流局
      this.phase = PHASES.ENDED;
      return { success: true, tile, liuJu: true };
    }
  }

  // 检查其他玩家对打出牌的操作权
  checkClaims(tile, fromSeatIndex) {
    const claims = [];
    for (let i = 1; i <= 3; i++) {
      const targetIdx = (fromSeatIndex + i) % 4;
      const player = this.players[targetIdx];
      const hand = player.hand;

      // 胡（任何人可胡）
      const checker = new WinChecker(this.laizi, this.piZi);
      const huTest = [...hand.tiles, tile];
      if (checker.canHu(huTest, hand.melds, player.hasOpened).canHu) {
        claims.push({ playerId: player.id, type: 'hu', priority: 1 });
      }

      // 杠
      if (hand.canMingGang(tile)) {
        claims.push({ playerId: player.id, type: 'gang', priority: 2 });
      }

      // 碰（非下家也可碰）
      if (hand.canPeng(tile)) {
        claims.push({ playerId: player.id, type: 'peng', priority: 3 });
      }

      // 吃（仅下家可吃）
      if (i === 1) {
        const chiOptions = hand.findChiOptions(tile);
        if (chiOptions.length > 0) {
          claims.push({ playerId: player.id, type: 'chi', options: chiOptions, priority: 4 });
        }
      }
    }
    // 按优先级排序（胡>杠>碰>吃）
    claims.sort((a, b) => a.priority - b.priority);
    return claims;
  }

  // 检查自摸
  checkSelfHu(player) {
    const checker = new WinChecker(this.laizi, this.piZi);
    return checker.canHu(player.hand.tiles, player.hand.melds, player.hasOpened);
  }

  // 执行吃
  doChi(playerId, optionIndex) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false };
    const claims = this.pendingClaims.filter(c => c.playerId === playerId && c.type === 'chi');
    if (claims.length === 0) return { success: false, error: 'noChiClaim' };
    const options = claims[0].options;
    if (optionIndex < 0 || optionIndex >= options.length) return { success: false, error: 'invalidOption' };

    player.hand.doChi(this.lastPlayedTile, options[optionIndex]);
    player.hasOpened = true;
    this.pendingClaims = [];
    this.currentPlayerIndex = player.seatIndex;
    this.phase = PHASES.PLAYING;
    return { success: true, playerId, type: 'chi' };
  }

  // 执行碰
  doPeng(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false };
    const hasClaim = this.pendingClaims.some(c => c.playerId === playerId && c.type === 'peng');
    if (!hasClaim) return { success: false, error: 'noPengClaim' };

    player.hand.doPeng(this.lastPlayedTile);
    player.hasOpened = true;
    this.pendingClaims = [];
    this.currentPlayerIndex = player.seatIndex;
    this.phase = PHASES.PLAYING;
    return { success: true, playerId, type: 'peng' };
  }

  // 执行明杠
  doMingGang(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false };
    const hasClaim = this.pendingClaims.some(c => c.playerId === playerId && c.type === 'gang');
    if (!hasClaim) return { success: false, error: 'noGangClaim' };

    player.hand.doMingGang(this.lastPlayedTile);
    player.hasOpened = true;
    player.mingGangCount++;
    this.pendingClaims = [];
    this.currentPlayerIndex = player.seatIndex;
    this.phase = PHASES.PLAYING;
    // 杠后摸牌
    const drawn = this.deck.draw();
    if (drawn) player.hand.add(drawn);
    return { success: true, playerId, type: 'mingGang', drawn };
  }

  // 执行暗杠
  doAnGang(playerId, tileKey) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.getCurrentPlayer().id !== playerId) return { success: false };
    const tile = player.hand.tiles.find(t => Tile.tileKey(t) === tileKey);
    if (!tile || !player.hand.canAnGang().some(t => Tile.tileEquals(t, tile))) {
      return { success: false, error: 'cannotAnGang' };
    }
    player.hand.doAnGang(tile);
    player.anGangCount++;
    const drawn = this.deck.draw();
    if (drawn) player.hand.add(drawn);
    return { success: true, playerId, type: 'anGang', drawn };
  }

  // 执行加杠
  doJiaGang(playerId, tileKey) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.getCurrentPlayer().id !== playerId) return { success: false };
    const tile = player.hand.tiles.find(t => Tile.tileKey(t) === tileKey);
    if (!tile) return { success: false, error: 'noTile' };
    if (!player.hand.canJiaGang().some(t => Tile.tileEquals(t, tile))) {
      return { success: false, error: 'cannotJiaGang' };
    }
    player.hand.doJiaGang(tile);
    player.mingGangCount++;
    // TODO: 检查抢杠胡
    const drawn = this.deck.draw();
    if (drawn) player.hand.add(drawn);
    return { success: true, playerId, type: 'jiaGang', drawn };
  }

  // 执行皮子杠
  doPiZiGang(playerId, tileIndex) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.getCurrentPlayer().id !== playerId) return { success: false };
    const tile = player.hand.tiles[tileIndex];
    if (!tile || !this.piZi.some(pz => Tile.tileEquals(tile, pz))) {
      return { success: false, error: 'notPiZi' };
    }
    player.hand.doPiZiGang(tile);
    player.piZiGangCount++;
    player.score += 1; // 即时+1分
    return { success: true, playerId, type: 'piZiGang', tile };
  }

  // 执行胡（点炮或自摸）
  doHu(playerId, isZimo = false) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { success: false };

    const checker = new WinChecker(this.laizi, this.piZi);
    let huResult;
    if (isZimo) {
      huResult = checker.canHu(player.hand.tiles, player.hand.melds, player.hasOpened);
    } else {
      const testTiles = [...player.hand.tiles, this.lastPlayedTile];
      huResult = checker.canHu(testTiles, player.hand.melds, player.hasOpened);
    }
    if (!huResult.canHu) {
      return { success: false, error: huResult.reason };
    }

    this.winner = player;
    this.winType = isZimo ? 'zimo' : 'dianPao';
    this.phase = PHASES.ENDED;
    this.pendingClaims = [];

    // 计算番数
    const calc = new FanCalculator(this.laizi);
    const finalFan = calc.calculate(
      player.hand.tiles,
      player.hand.melds,
      this.winType,
      player.mingGangCount,
      player.anGangCount
    );

    // 结算积分
    const score = Rules.calculateScore(finalFan);
    const results = this.settleScore(player, score, isZimo);

    return {
      success: true,
      winner: playerId,
      winType: this.winType,
      fan: finalFan,
      score,
      results
    };
  }

  // 积分结算
  settleScore(winner, score, isZimo) {
    const results = [];
    if (isZimo) {
      // 自摸：其余三家各付
      for (const p of this.players) {
        if (p.id === winner.id) {
          p.score += score * 3;
          results.push({ playerId: p.id, change: score * 3 });
        } else {
          p.score -= score;
          results.push({ playerId: p.id, change: -score });
        }
      }
    } else {
      // 点炮：点炮者单独付
      const dianPaoPlayer = this.players[this.currentPlayerIndex];
      for (const p of this.players) {
        if (p.id === winner.id) {
          p.score += score;
          results.push({ playerId: p.id, change: score });
        } else if (dianPaoPlayer && p.id === dianPaoPlayer.id) {
          p.score -= score;
          results.push({ playerId: p.id, change: -score });
        } else {
          results.push({ playerId: p.id, change: 0 });
        }
      }
    }
    // 加上皮子杠的即时分
    for (const p of this.players) {
      const piZiScore = p.piZiGangCount * 1;
      if (piZiScore > 0) {
        const r = results.find(x => x.playerId === p.id);
        if (r) r.change += piZiScore;
      }
    }
    return results;
  }

  getLastPlayerIndex() {
    // 上一出牌的人
    return (this.currentPlayerIndex - 1 + 4) % 4;
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 4;
    this.turnCount++;
  }

  // 获取游戏状态（发送给客户端）
  getGameState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return {
      phase: this.phase,
      currentPlayer: this.players[this.currentPlayerIndex]?.id,
      laizi: this.laizi,
      piZi: this.piZi,
      myHand: player ? player.hand.tiles : [],
      myMelds: player ? player.hand.melds : [],
      myPiZiIndices: player ? player.hand.findPiZiIndices(this.piZi) : [],
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        handCount: p.hand.tiles.length,
        melds: p.hand.melds,
        hasOpened: p.hasOpened,
        score: p.score
      })),
      lastPlayed: this.lastPlayedTile,
      remaining: this.deck ? this.deck.remaining() : 0
    };
  }

  // 获取公开状态（旁观或结算）
  getPublicState() {
    return {
      phase: this.phase,
      currentPlayer: this.players[this.currentPlayerIndex]?.id,
      laizi: this.laizi,
      piZi: this.piZi,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        handCount: p.hand.tiles.length,
        melds: p.hand.melds,
        hasOpened: p.hasOpened,
        score: p.score
      })),
      lastPlayed: this.lastPlayedTile,
      remaining: this.deck ? this.deck.remaining() : 0
    };
  }
}

module.exports = { GameEngine, PHASES, SEATS };

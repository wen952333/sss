
type PagesFunction<Env = any> = (context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
  waitUntil: (promise: Promise<any>) => void;
  next: () => Promise<Response>;
  data: Record<string, unknown>;
}) => Promise<Response>;

type D1Database = {
  prepare: (query: string) => { 
    bind: (...args: any[]) => any; 
    run: () => Promise<any>; 
    first: <T = any>(col?: string) => Promise<T | null>;
  };
};

interface Env {
  DB: D1Database;
}

// 统一处理所有游戏同步请求
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.DB;

  try {
    const body: any = await request.json();
    const { action, roomId, userId, username, payload } = body;
    const now = Date.now();

    // --- 1. 创建房间 (Create) ---
    if (action === 'create') {
      const initialPlayers = [
        { id: 0, uid: userId, name: username, isHuman: true, isReady: true, hand: [], role: null, passes: 0 }, // 房主永远是 ID 0
        { id: 1, uid: null, name: "等待加入...", isHuman: true, isReady: false, hand: [], role: null, passes: 0 },
        { id: 2, uid: null, name: "等待加入...", isHuman: true, isReady: false, hand: [], role: null, passes: 0 }
      ];
      
      // 初始游戏状态
      const initialState = {
         players: initialPlayers,
         phase: 'ROOM_LOBBY',
         currentTurnIndex: 0,
         multiplier: 1,
         baseScore: 100,
         landlordCards: [],
         lastMove: null
      };

      await db.prepare(`
        INSERT INTO rooms (room_id, host_id, players_json, game_state_json, status, updated_at)
        VALUES (?, ?, ?, ?, 'waiting', ?)
        ON CONFLICT(room_id) DO UPDATE SET 
          host_id=excluded.host_id, 
          players_json=excluded.players_json, 
          game_state_json=excluded.game_state_json,
          status='waiting',
          updated_at=excluded.updated_at
      `).bind(roomId, userId, JSON.stringify(initialPlayers), JSON.stringify(initialState), now).run();

      return new Response(JSON.stringify({ success: true, state: initialState }));
    }

    // --- 2. 加入房间 (Join) ---
    if (action === 'join') {
      const room: any = await db.prepare("SELECT players_json, status FROM rooms WHERE room_id = ?").bind(roomId).first();
      
      if (!room) return new Response(JSON.stringify({ error: "房间不存在" }), { status: 404 });
      // if (room.status !== 'waiting') return new Response(JSON.stringify({ error: "游戏已开始" }), { status: 403 });

      let players = JSON.parse(room.players_json);
      
      // 检查是否已经在房间里
      const existingIdx = players.findIndex((p: any) => p.uid === userId);
      if (existingIdx !== -1) {
         // 已在房间，返回成功即可
         return new Response(JSON.stringify({ success: true, playerId: existingIdx }));
      }

      // 寻找空位 (ID 1 或 2)
      const emptyIdx = players.findIndex((p: any) => p.uid === null);
      if (emptyIdx === -1) {
        return new Response(JSON.stringify({ error: "房间已满" }), { status: 403 });
      }

      // 占位
      players[emptyIdx] = { 
        ...players[emptyIdx], 
        uid: userId, 
        name: username, 
        isReady: true 
      };

      await db.prepare("UPDATE rooms SET players_json = ?, updated_at = ? WHERE room_id = ?")
        .bind(JSON.stringify(players), now, roomId).run();

      return new Response(JSON.stringify({ success: true, playerId: emptyIdx }));
    }

    // --- 3. 轮询状态 (Poll) ---
    if (action === 'poll') {
      const room: any = await db.prepare("SELECT game_state_json, players_json, updated_at FROM rooms WHERE room_id = ?").bind(roomId).first();
      if (!room) return new Response(JSON.stringify({ error: "Room not found" }), { status: 404 });

      // 合并最新的玩家列表到游戏状态中 (因为 Lobby 阶段主要更新 players_json)
      let gameState = JSON.parse(room.game_state_json);
      const players = JSON.parse(room.players_json);
      
      // 只有在 Lobby 阶段，我们才强制用 room.players_json 覆盖 gameState.players
      // 开始游戏后，gameState.players 包含手牌信息，不能被简单的 players_json 覆盖
      if (gameState.phase === 'ROOM_LOBBY') {
          gameState.players = players;
      } else {
          // 游戏进行中，只同步在线状态或名字，不要覆盖手牌数据
          // 这里简单起见，假设游戏开始后完全信任 game_state_json
      }

      return new Response(JSON.stringify({ success: true, state: gameState, timestamp: room.updated_at }));
    }

    // --- 4. 上传状态 (Update State) ---
    // 客户端计算完出牌结果后，将整个 newState 传给服务器保存
    // 这是一种“信任客户端”的模式，简化了后端逻辑
    if (action === 'update') {
      const { newState } = payload;
      
      // 如果是发牌阶段，需要更新 players_json 里的状态以保持一致性 (可选)
      
      await db.prepare("UPDATE rooms SET game_state_json = ?, updated_at = ? WHERE room_id = ?")
        .bind(JSON.stringify(newState), now, roomId).run();
        
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

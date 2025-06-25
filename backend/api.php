<?php
// 处理CORS预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header("Access-Control-Allow-Origin: https://ss.wenge.ip-ddns.com");
  header("Access-Control-Allow-Credentials: true");
  header("Access-Control-Allow-Headers: Content-Type");
  header("Access-Control-Allow-Methods: POST, OPTIONS");
  http_response_code(204);
  exit;
}

header("Access-Control-Allow-Origin: https://ss.wenge.ip-ddns.com");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

// 支持跨域 session cookie，必须在 session_start() 前设置
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '', // 不要写主机名
    'secure' => true, // 你的API是https才用true
    'httponly' => true,
    'samesite' => 'None'
]);
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header("Allow: POST");
  http_response_code(405);
  echo json_encode(['success'=>false, 'message'=>'Method Not Allowed']);
  exit;
}

require_once 'db.php';
require_once 'game.php';

// 简易token机制（生产建议JWT或session）
function get_user() {
  if (isset($_SESSION['uid'])) {
    $uid = $_SESSION['uid'];
    return query("SELECT * FROM user WHERE id=?", [$uid]);
  }
  return null;
}
function auth() {
  $u = get_user();
  if (!$u) die(json_encode(['success'=>false, 'message'=>'未登录']));
  return $u;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

// 注册
if ($action === 'register') {
  $phone = $input['phone'] ?? '';
  $nickname = $input['nickname'] ?? '';
  $password = $input['password'] ?? '';
  if (!preg_match('/^\d{11}$/', $phone) || !$nickname || !$password)
    die(json_encode(['success'=>false, 'message'=>'参数错误']));
  if (query("SELECT id FROM user WHERE phone=?", [$phone]))
    die(json_encode(['success'=>false, 'message'=>'手机号已注册']));
  $hash = password_hash($password, PASSWORD_BCRYPT);
  execute("INSERT INTO user (phone, nickname, password) VALUES (?, ?, ?)", [$phone, $nickname, $hash]);
  $user = query("SELECT * FROM user WHERE phone=?", [$phone]);
  $_SESSION['uid'] = $user['id'];
  die(json_encode(['success'=>true, 'user'=>['phone'=>$user['phone'], 'nickname'=>$user['nickname'], 'score'=>$user['score']]]));
}

// 登录
if ($action === 'login') {
  $phone = $input['phone'] ?? '';
  $password = $input['password'] ?? '';
  $user = query("SELECT * FROM user WHERE phone=?", [$phone]);
  if (!$user || !password_verify($password, $user['password']))
    die(json_encode(['success'=>false, 'message'=>'手机号或密码错误']));
  $_SESSION['uid'] = $user['id'];
  die(json_encode(['success'=>true, 'user'=>['phone'=>$user['phone'], 'nickname'=>$user['nickname'], 'score'=>$user['score']]]));
}

// 房间列表
if ($action === 'list_rooms') {
  $rooms = query("SELECT * FROM room ORDER BY id DESC", [], true);
  foreach ($rooms as &$room) {
    $players = query("SELECT u.phone, u.nickname, u.score FROM room_player p JOIN user u ON u.id=p.user_id WHERE p.room_id=?", [$room['id']], true);
    $room['players'] = $players;
  }
  die(json_encode(['success'=>true, 'rooms'=>$rooms]));
}

// 创建房间
if ($action === 'create_room') {
  $user = auth();
  $name = $input['name'] ?? '';
  execute("INSERT INTO room (name) VALUES (?)", [$name]);
  $room_id = db()->insert_id;
  execute("INSERT INTO room_player (room_id, user_id, seat) VALUES (?, ?, ?)", [$room_id, $user['id'], 1]);
  $room = query("SELECT * FROM room WHERE id=?", [$room_id]);
  die(json_encode(['success'=>true, 'room'=>$room]));
}

// 加入房间
if ($action === 'join_room') {
  $user = auth();
  $room_id = $input['room_id'] ?? 0;
  $exists = query("SELECT * FROM room WHERE id=?", [$room_id]);
  if (!$exists) die(json_encode(['success'=>false, 'message'=>'房间不存在']));
  // 已满4人
  $cnt = query("SELECT COUNT(*) c FROM room_player WHERE room_id=?", [$room_id])['c'];
  if ($cnt >= 4) die(json_encode(['success'=>false, 'message'=>'房间已满']));
  // 已经在房间
  if (query("SELECT * FROM room_player WHERE room_id=? AND user_id=?", [$room_id, $user['id']]))
    die(json_encode(['success'=>true, 'room'=>$exists]));
  execute("INSERT INTO room_player (room_id, user_id, seat) VALUES (?, ?, ?)", [$room_id, $user['id'], $cnt+1]);
  die(json_encode(['success'=>true, 'room'=>$exists]));
}

// 获取房间及游戏状态
if ($action === 'get_room') {
  $user = auth();
  $room_id = $input['room_id'] ?? 0;
  $room = query("SELECT * FROM room WHERE id=?", [$room_id]);
  if (!$room) die(json_encode(['success'=>false, 'message'=>'房间不存在']));
  $players = query("SELECT u.phone, u.nickname, u.score, p.seat, p.cards, p.score as round_score
                    FROM room_player p JOIN user u ON u.id=p.user_id WHERE p.room_id=? ORDER BY p.seat", [$room_id], true);
  $me = query("SELECT * FROM room_player WHERE room_id=? AND user_id=?", [$room_id, $user['id']]);
  $mycards = $me && $me['cards'] ? explode(',', $me['cards']) : [];
  die(json_encode(['success'=>true, 'game'=>[
      'status'=>intval($room['status']), // 0等待 1进行中 2已结束
      'players'=>$players,
      'cards'=>$mycards
  ]]));
}

// 发牌开始游戏（仅房主可操作）
if ($action === 'start_game') {
  $user = auth();
  $room_id = $input['room_id'] ?? 0;
  $room = query("SELECT * FROM room WHERE id=?", [$room_id]);
  if (!$room) die(json_encode(['success'=>false, 'message'=>'房间不存在']));
  // 仅房主可发牌
  $players = query("SELECT * FROM room_player WHERE room_id=? ORDER BY seat", [$room_id], true);
  if (!$players || $players[0]['user_id'] != $user['id']) die(json_encode(['success'=>false, 'message'=>'只有房主可操作']));
  // 已发过牌则不能再发
  foreach ($players as $p) if ($p['cards']) die(json_encode(['success'=>false, 'message'=>'已发牌']));
  // 发牌
  $deals = deal_cards(count($players));
  foreach ($players as $i => $p) {
    $cards = implode(',', $deals[$i]);
    execute("UPDATE room_player SET cards=? WHERE id=?", [$cards, $p['id']]);
  }
  execute("UPDATE room SET status=1 WHERE id=?", [$room_id]);
  die(json_encode(['success'=>true]));
}

// 玩家提交手牌
if ($action === 'submit_hand') {
  $user = auth();
  $room_id = $input['room_id'] ?? 0;
  $cards = $input['cards'] ?? [];
  if (count($cards) != 13) die(json_encode(['success'=>false, 'message'=>'必须13张牌']));
  // 校验是否本房间玩家
  $player = query("SELECT * FROM room_player WHERE room_id=? AND user_id=?", [$room_id, $user['id']]);
  if (!$player) die(json_encode(['success'=>false, 'message'=>'未在房间']));
  // 存储玩家牌序
  execute("UPDATE room_player SET cards=? WHERE id=?", [implode(',', $cards), $player['id']]);
  die(json_encode(['success'=>true]));
}

// 结算比分（仅房主可操作）
if ($action === 'settle_game') {
  $user = auth();
  $room_id = $input['room_id'] ?? 0;
  $room = query("SELECT * FROM room WHERE id=?", [$room_id]);
  if (!$room) die(json_encode(['success'=>false, 'message'=>'房间不存在']));
  // 仅房主可结算
  $players = query("SELECT * FROM room_player WHERE room_id=? ORDER BY seat", [$room_id], true);
  if (!$players || $players[0]['user_id'] != $user['id']) die(json_encode(['success'=>false, 'message'=>'只有房主可操作']));
  // 所有玩家必须都已出牌
  foreach ($players as $p) if (!$p['cards']) die(json_encode(['success'=>false, 'message'=>'等待所有玩家出牌']));
  // 比牌
  $hands = [];
  foreach ($players as $p) $hands[] = explode(',', $p['cards']);
  $winners = compare_hands($hands);
  foreach ($players as $i => $p) {
    $score = in_array($i, $winners) ? 10 : -5;
    execute("UPDATE user SET score=score+? WHERE id=?", [$score, $p['user_id']]);
    execute("UPDATE room_player SET score=? WHERE id=?", [$score, $p['id']]);
  }
  execute("UPDATE room SET status=2 WHERE id=?", [$room_id]);
  die(json_encode(['success'=>true, 'winners'=>$winners]));
}

// 积分赠送
if ($action === 'gift_points') {
  $user = auth();
  $to_phone = $input['to_phone'] ?? '';
  $amount = intval($input['amount'] ?? 0);
  if ($user['phone'] === $to_phone) die(json_encode(['success'=>false, 'message'=>'不能赠送给自己']));
  $to = query("SELECT * FROM user WHERE phone=?", [$to_phone]);
  if (!$to) die(json_encode(['success'=>false, 'message'=>'对方不存在']));
  if ($amount < 1 || $user['score'] < $amount) die(json_encode(['success'=>false, 'message'=>'积分不足']));
  execute("UPDATE user SET score=score-? WHERE id=?", [$amount, $user['id']]);
  execute("UPDATE user SET score=score+? WHERE id=?", [$amount, $to['id']]);
  execute("INSERT INTO gift_log (from_id, to_id, amount) VALUES (?, ?, ?)", [$user['id'], $to['id'], $amount]);
  die(json_encode(['success'=>true]));
}

die(json_encode(['success'=>false, 'message'=>'未知操作']));

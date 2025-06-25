<?php
require_once 'db.php';
session_start();
header("Content-Type: application/json");

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

if ($action === 'login') {
  $phone = $input['phone'] ?? '';
  $password = $input['password'] ?? '';
  $user = query("SELECT * FROM user WHERE phone=?", [$phone]);
  if (!$user || !password_verify($password, $user['password']))
    die(json_encode(['success'=>false, 'message'=>'手机号或密码错误']));
  $_SESSION['uid'] = $user['id'];
  die(json_encode(['success'=>true, 'user'=>['phone'=>$user['phone'], 'nickname'=>$user['nickname'], 'score'=>$user['score']]]));
}

if ($action === 'list_rooms') {
  $rooms = query("SELECT * FROM room ORDER BY id DESC", [], true);
  foreach ($rooms as &$room) {
    $players = query("SELECT u.phone, u.nickname, u.score FROM room_player p JOIN user u ON u.id=p.user_id WHERE p.room_id=?", [$room['id']], true);
    $room['players'] = $players;
  }
  die(json_encode(['success'=>true, 'rooms'=>$rooms]));
}

if ($action === 'create_room') {
  $user = auth();
  $name = $input['name'] ?? '';
  execute("INSERT INTO room (name) VALUES (?)", [$name]);
  $room_id = db()->insert_id;
  execute("INSERT INTO room_player (room_id, user_id, seat) VALUES (?, ?, ?)", [$room_id, $user['id'], 1]);
  $room = query("SELECT * FROM room WHERE id=?", [$room_id]);
  die(json_encode(['success'=>true, 'room'=>$room]));
}

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

if ($action === 'get_room') {
  $user = auth();
  $room_id = $input['room_id'] ?? 0;
  $room = query("SELECT * FROM room WHERE id=?", [$room_id]);
  if (!$room) die(json_encode(['success'=>false, 'message'=>'房间不存在']));
  $players = query("SELECT u.phone, u.nickname, u.score FROM room_player p JOIN user u ON u.id=p.user_id WHERE p.room_id=?", [$room_id], true);
  // 伪代码: 返回本玩家手牌等信息
  $me = query("SELECT * FROM room_player WHERE room_id=? AND user_id=?", [$room_id, $user['id']]);
  $cards = $me ? explode(',', $me['cards']) : [];
  die(json_encode(['success'=>true, 'game'=>['players'=>$players, 'cards'=>$cards]]));
}

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

// TODO: 游戏发牌、比牌逻辑（可参考 game.php 拆分实现）

die(json_encode(['success'=>false, 'message'=>'未知操作']));

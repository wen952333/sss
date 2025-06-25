<?php
header('Content-Type: application/json');
session_start();

$db = new PDO('sqlite:db.sqlite');

// 初始化表
$db->exec("CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE,
  nickname TEXT,
  password TEXT,
  points INTEGER DEFAULT 100
)");
$db->exec("CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  owner INTEGER,
  players TEXT, -- json array of user ids
  state TEXT,   -- json game state
  status TEXT   -- waiting|playing|ended
)");
$db->exec("CREATE TABLE IF NOT EXISTS points_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_uid INTEGER,
  to_uid INTEGER,
  amount INTEGER,
  time DATETIME DEFAULT CURRENT_TIMESTAMP
)");

function json($arr) { echo json_encode($arr); exit; }

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

switch ($action) {
  case 'register':
    $stmt = $db->prepare("INSERT INTO users (phone, nickname, password) VALUES (?, ?, ?)");
    try {
      $stmt->execute([$input['phone'], $input['nickname'], password_hash($input['password'], PASSWORD_DEFAULT)]);
      $_SESSION['uid'] = $db->lastInsertId();
      json(['success'=>true, 'user'=>['phone'=>$input['phone'], 'nickname'=>$input['nickname']]]);
    } catch (Exception $e) {
      json(['success'=>false, 'message'=>'已注册或参数错误']);
    }
    break;
  case 'login':
    $stmt = $db->prepare("SELECT id,phone,nickname,password,points FROM users WHERE phone=?");
    $stmt->execute([$input['phone']]);
    $u = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($u && password_verify($input['password'], $u['password'])) {
      $_SESSION['uid'] = $u['id'];
      json(['success'=>true, 'user'=>['phone'=>$u['phone'], 'nickname'=>$u['nickname'], 'points'=>$u['points']]]);
    }
    json(['success'=>false, 'message'=>'账号或密码错误']);
    break;
  case 'room_list':
    $rooms = $db->query("SELECT id,name,players,status FROM rooms")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rooms as &$r) {
      $r['players'] = json_decode($r['players'] ?? '[]', true);
    }
    json(['success'=>true, 'rooms'=>$rooms]);
    break;
  case 'create_room':
    $name = $input['name'] ?: ('房间'.rand(1000,9999));
    $owner = $_SESSION['uid'] ?? 0;
    $players = json_encode([$owner]);
    $stmt = $db->prepare("INSERT INTO rooms (name, owner, players, status) VALUES (?, ?, ?, 'waiting')");
    $stmt->execute([$name, $owner, $players]);
    json(['success'=>true, 'room_id'=>$db->lastInsertId()]);
    break;
  case 'join_room':
    $room_id = intval($input['room_id']);
    $uid = $_SESSION['uid'] ?? 0;
    $room = $db->query("SELECT players FROM rooms WHERE id=$room_id")->fetch(PDO::FETCH_ASSOC);
    $players = json_decode($room['players'] ?? '[]', true);
    if (!in_array($uid, $players)) $players[] = $uid;
    $stmt = $db->prepare("UPDATE rooms SET players=? WHERE id=?");
    $stmt->execute([json_encode($players), $room_id]);
    json(['success'=>true]);
    break;
  case 'room_state':
    $room_id = intval($input['room_id']);
    $room = $db->query("SELECT * FROM rooms WHERE id=$room_id")->fetch(PDO::FETCH_ASSOC);
    if ($room) {
      $room['players'] = json_decode($room['players'] ?? '[]', true);
      $room['state'] = json_decode($room['state'] ?? '{}', true);
      json(['success'=>true, 'room'=>$room]);
    }
    json(['success'=>false]);
    break;
  case 'start_game':
    // 省略发牌与状态初始化（可自行扩展）
    json(['success'=>true]);
    break;
  case 'gift_points':
    $from_uid = $_SESSION['uid'] ?? 0;
    $to_phone = $input['to_phone'];
    $amount = intval($input['amount']);
    $to_user = $db->query("SELECT id FROM users WHERE phone='$to_phone'")->fetch(PDO::FETCH_ASSOC);
    if (!$to_user) json(['success'=>false, 'message'=>'未找到用户']);
    $db->exec("UPDATE users SET points=points-$amount WHERE id=$from_uid AND points>=$amount");
    $db->exec("UPDATE users SET points=points+$amount WHERE id={$to_user['id']}");
    $db->exec("INSERT INTO points_log (from_uid, to_uid, amount) VALUES ($from_uid, {$to_user['id']}, $amount)");
    json(['success'=>true, 'message'=>'赠送成功']);
    break;
  case 'my_points':
    $uid = $_SESSION['uid'] ?? 0;
    $u = $db->query("SELECT points FROM users WHERE id=$uid")->fetch(PDO::FETCH_ASSOC);
    json(['success'=>true, 'points'=>$u['points']]);
    break;
  default:
    json(['success'=>false, 'message'=>'未知操作']);
}

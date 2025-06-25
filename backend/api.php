<?php
// 允许跨域请求（只允许你的前端域名）
header("Access-Control-Allow-Origin: https://ss.wenge.ip-ddns.com");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
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
function get_uid() { return $_SESSION['uid'] ?? 0; }
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

switch ($action) {
  case 'register':
    $stmt = $db->prepare("INSERT INTO users (phone, nickname, password) VALUES (?, ?, ?)");
    try {
      $stmt->execute([
        $input['phone'],
        $input['nickname'],
        password_hash($input['password'], PASSWORD_DEFAULT)
      ]);
      $_SESSION['uid'] = $db->lastInsertId();
      json(['success'=>true, 'user'=>['phone'=>$input['phone'], 'nickname'=>$input['nickname']]]);
    } catch (Exception $e) {
      json(['success'=>false, 'message'=>'手机号已注册或参数错误']);
    }
    break;
  case 'login':
    $stmt = $db->prepare("SELECT * FROM users WHERE phone=?");
    $stmt->execute([$input['phone']]);
    $u = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($u && password_verify($input['password'], $u['password'])) {
      $_SESSION['uid'] = $u['id'];
      json(['success'=>true, 'user'=>['id'=>$u['id'],'phone'=>$u['phone'], 'nickname'=>$u['nickname'], 'points'=>$u['points']]]);
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
    $owner = get_uid();
    $players = json_encode([$owner]);
    $stmt = $db->prepare("INSERT INTO rooms (name, owner, players, status) VALUES (?, ?, ?, 'waiting')");
    $stmt->execute([$name, $owner, $players]);
    json(['success'=>true, 'room_id'=>$db->lastInsertId()]);
    break;
  case 'join_room':
    $room_id = intval($input['room_id']);
    $uid = get_uid();
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
    // 简单洗牌和分牌（未实现十三水所有规则，仅为示例）
    $room_id = intval($input['room_id']);
    $room = $db->query("SELECT players FROM rooms WHERE id=$room_id")->fetch(PDO::FETCH_ASSOC);
    $players = json_decode($room['players'] ?? '[]', true);
    $cards = [];
    foreach (['spades','hearts','diamonds','clubs'] as $suit) {
      foreach (['ace','2','3','4','5','6','7','8','9','10','jack','queen','king'] as $value) {
        $cards[] = ['suit'=>$suit, 'value'=>$value];
      }
    }
    shuffle($cards);
    $cardsByUser = [];
    foreach ($players as $i=>$pid) {
      $cardsByUser[$pid] = array_splice($cards,0,13);
    }
    $state = ['cards'=>$cardsByUser];
    $stmt = $db->prepare("UPDATE rooms SET state=?, status='playing' WHERE id=?");
    $stmt->execute([json_encode($state), $room_id]);
    json(['success'=>true, 'message'=>'已发牌']);
    break;
  case 'gift_points':
    $from_uid = get_uid();
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
    $uid = get_uid();
    $u = $db->query("SELECT points FROM users WHERE id=$uid")->fetch(PDO::FETCH_ASSOC);
    json(['success'=>true, 'points'=>$u['points']]);
    break;
  case 'whoami':
    $uid = get_uid();
    if (!$uid) json(['success'=>false, 'message'=>'未登录']);
    $u = $db->query("SELECT id,phone,nickname,points FROM users WHERE id=$uid")->fetch(PDO::FETCH_ASSOC);
    if ($u) {
      json(['success'=>true, 'user'=>$u]);
    } else {
      json(['success'=>false, 'message'=>'未登录']);
    }
    break;
  default:
    json(['success'=>false, 'message'=>'未知操作']);
}

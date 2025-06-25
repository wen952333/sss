<?php
require_once("../db.php");
require_once("../utils.php");

$input = json_decode(file_get_contents("php://input"), true);
$action = $_GET['action'] ?? $input['action'] ?? '';
$token = $_GET['token'] ?? $input['token'] ?? '';
$user = getUserByToken($token);
if (!$user && $action != 'list') die(json_encode(['ok'=>false, 'error'=>'请登录']));

switch ($action) {
  case 'list':
    $rooms = $db->query("SELECT * FROM rooms")->fetchAll();
    foreach ($rooms as &$r) {
      $r['players'] = $db->query("SELECT u.id, u.nickname, rp.ready FROM room_players rp JOIN users u ON rp.user_id=u.id WHERE rp.room_id=?", [$r['id']])->fetchAll();
    }
    echo json_encode(['ok'=>true, 'rooms'=>$rooms]);
    break;
  case 'create':
    $name = $input['name'] ?? '';
    if (!$name) die(json_encode(['ok'=>false, 'error'=>'房间名不能为空']));
    $db->query("INSERT INTO rooms(name, owner_id, started) VALUES (?, ?, 0)", [$name, $user['id']]);
    $rid = $db->lastInsertId();
    $db->query("INSERT INTO room_players(room_id, user_id, ready) VALUES (?, ?, 0)", [$rid, $user['id']]);
    echo json_encode(['ok'=>true, 'room'=>['id'=>$rid, 'name'=>$name]]);
    break;
  case 'join':
    $id = $input['id'] ?? 0;
    $room = $db->query("SELECT * FROM rooms WHERE id=?", [$id])->fetch();
    if (!$room) die(json_encode(['ok'=>false, 'error'=>'房间不存在']));
    $count = $db->query("SELECT COUNT(*) c FROM room_players WHERE room_id=?", [$id])->fetch()['c'];
    if ($count >= 4) die(json_encode(['ok'=>false, 'error'=>'房间已满']));
    $db->query("INSERT IGNORE INTO room_players(room_id, user_id, ready) VALUES (?, ?, 0)", [$id, $user['id']]);
    echo json_encode(['ok'=>true]);
    break;
  case 'get':
    $id = $_GET['id'] ?? $input['id'] ?? 0;
    $room = $db->query("SELECT * FROM rooms WHERE id=?", [$id])->fetch();
    if (!$room) die(json_encode(['ok'=>false, 'error'=>'房间不存在']));
    $players = $db->query("SELECT u.id, u.nickname, rp.ready FROM room_players rp JOIN users u ON rp.user_id=u.id WHERE rp.room_id=?", [$id])->fetchAll();
    $myCards = [];
    if ($room['started']) {
      // 这里读取玩家手牌等，略
    }
    echo json_encode(['ok'=>true, 'room'=>['id'=>$room['id'], 'name'=>$room['name'], 'players'=>$players, 'started'=>$room['started'], 'myCards'=>$myCards]]);
    break;
  case 'ready':
    $id = $input['id'] ?? 0;
    $db->query("UPDATE room_players SET ready=1 WHERE room_id=? AND user_id=?", [$id, $user['id']]);
    // 检查所有人都ready则发牌并开始游戏，略
    echo json_encode(['ok'=>true]);
    break;
  // 其他游戏流程实现略
  default:
    echo json_encode(['ok'=>false, 'error'=>'未知操作']);
}

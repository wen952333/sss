<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';
ini_set('display_errors', 0);
error_reporting(0);
header('Content-Type: application/json');

$roomId = $_GET['roomId'];
$token = $_GET['token'];
if (!$roomId || !$token) die(json_encode(['success'=>false, 'code'=>401]));

$user = verifyToken($token);
if (!$user || $user['roomId'] !== $roomId) die(json_encode(['success'=>false, 'code'=>401]));

$pdo = getDb();
$room = $pdo->query("SELECT * FROM rooms WHERE room_id='$roomId'")->fetch();
if (!$room) {
  echo json_encode(['success'=>false, 'message'=>'房间不存在']);
  exit();
}
$rows = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll();
$players = [];
$allReady = true;
foreach ($rows as $row) {
  $players[] = [
    'name' => $row['name'],
    'isOwner' => $row['is_owner'] ? true : false,
    'submitted' => isset($row['submitted']) ? (bool)$row['submitted'] : false
  ];
  if (!$row['submitted']) $allReady = false;
}

// ======= 自动发牌逻辑：4人都准备且房间未开始，自动发牌 =======
if ($room['status'] === 'waiting' && count($rows) === 4 && $allReady) {
  // 更新房间状态
  $pdo->prepare("UPDATE rooms SET status='started' WHERE room_id=?")->execute([$roomId]);
  // 生成并洗牌
  $cards = [];
  $suits = ['clubs', 'spades', 'diamonds', 'hearts'];
  $ranks = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
  foreach ($suits as $suit) foreach ($ranks as $rank) $cards[] = "{$rank}_of_{$suit}";
  shuffle($cards);
  // 分配手牌
  foreach ($rows as $p) {
    $hand = array_splice($cards, 0, 13);
    $pdo->prepare("UPDATE players SET cards=? WHERE id=?")->execute([json_encode($hand), $p['id']]);
  }
  $room['status'] = 'started'; // 立即反映到响应
}

echo json_encode([
  'success' => true,
  'players' => $players,
  'status' => $room['status'],
  'me' => $user['name'],
  'type' => $room['type'],
  'score' => intval($room['score'])
]);
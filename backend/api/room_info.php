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

// ==== 新增：自动清理10分钟未满4人房间玩家 ====
if ($room['status'] === 'waiting' && !empty($room['ready_reset_time'])) {
    $passed = time() - strtotime($room['ready_reset_time']);
    if ($passed >= 600) { // 10分钟
        $cnt = $pdo->query("SELECT COUNT(*) as cnt FROM players WHERE room_id='$roomId'")->fetch()['cnt'];
        if ($cnt < 4 && $cnt > 0) {
            $pdo->prepare("DELETE FROM players WHERE room_id=?")->execute([$roomId]);
            $pdo->prepare("UPDATE rooms SET ready_reset_time=NULL WHERE room_id=?")->execute([$roomId]);
        }
    }
}

$rows = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll();
$players = [];
$allReady = true;
foreach ($rows as $row) {
  $playerObj = [
    'name' => $row['name'],
    'isOwner' => $row['is_owner'] ? true : false,
    'submitted' => isset($row['submitted']) ? (bool)$row['submitted'] : false
  ];
  // 返回三道和分数
  if ($row['cards']) {
    $c = json_decode($row['cards'], true);
    if (is_array($c) && count($c) == 13) {
      $playerObj['head'] = array_slice($c,0,3);
      $playerObj['middle'] = array_slice($c,3,8);
      $playerObj['tail'] = array_slice($c,8,13);
    }
  }
  if ($row['result']) {
    $res = json_decode($row['result'], true);
    if (is_array($res) && isset($res[0])) {
      $playerObj['score'] = $res[0]['score'] ?? 0;
      $playerObj['isFoul'] = $res[0]['isFoul'] ?? false;
    }
  }
  $players[] = $playerObj;
  if (!$row['submitted']) $allReady = false;
}

echo json_encode([
  'success' => true,
  'players' => $players,
  'status' => $room['status'],
  'me' => $user['name'],
  'type' => $room['type'],
  'score' => intval($room['score']),
  'ready_reset_time' => $room['ready_reset_time'] ?? null // 关键：新增这一行
]);

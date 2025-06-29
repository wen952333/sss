<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';
require_once '_timeout_helper.php';
header('Content-Type: application/json');

$roomId = $_GET['roomId'];
$token = $_GET['token'];
$user = verifyToken($token);
if (!$user || $user['roomId'] !== $roomId) die(json_encode(['success'=>false, 'code'=>401]));

$pdo = getDb();
handleTimeoutsAndAutoPlay($roomId, $pdo);

$row = $pdo->query("SELECT * FROM players WHERE room_id='$roomId' AND name='{$user['name']}'")->fetch();
$cards = json_decode($row['cards'], true);

echo json_encode([
  'success'=>true,
  'cards'=>$cards ?: [],
  'submitted'=>$row['submitted'] ? true : false,
  'result'=>json_decode($row['result'], true),
  'allPlayed'=>allPlayersSubmitted($roomId, $pdo)
]);

function allPlayersSubmitted($roomId, $pdo) {
  $rows = $pdo->query("SELECT submitted FROM players WHERE room_id='$roomId'")->fetchAll();
  if (count($rows) < 4) return false; // 必须4人
  foreach ($rows as $r) if (!$r['submitted']) return false;
  return true;
}

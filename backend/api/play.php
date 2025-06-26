<?php
require_once '../db/db.php';
require_once '../utils/auth.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$roomId = $data['roomId'];
$token = $data['token'];
$cards = $data['cards'];

$user = verifyToken($token);
if (!$user || $user['roomId'] !== $roomId) die(json_encode(['success'=>false, 'code'=>401]));

$pdo = getDb();
$pdo->prepare("UPDATE players SET cards=?, submitted=1 WHERE room_id=? AND name=?")
    ->execute([json_encode($cards), $roomId, $user['name']]);

// 检查是否全部玩家都提交，则结算
$all = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll();
$allSubmitted = true;
foreach ($all as $p) if (!$p['submitted']) $allSubmitted = false;

if ($allSubmitted) {
  // 简化判分逻辑，每人得1分，实际应实现十三水详细比牌
  foreach ($all as $player) {
    $pdo->prepare("UPDATE players SET result=? WHERE id=?")
        ->execute([json_encode([['name'=>$player['name'],'score'=>1]]), $player['id']]);
  }
}
echo json_encode(['success'=>true]);

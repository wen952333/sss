<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$roomId = $data['roomId'];
$token = $data['token'];

$user = verifyToken($token);
if (!$user || $user['roomId'] !== $roomId) die(json_encode(['success'=>false, 'code'=>401]));

$pdo = getDb();
$player = $pdo->query("SELECT * FROM players WHERE room_id='$roomId' AND name='{$user['name']}'")->fetch();
if (!$player['is_owner']) die(json_encode(['success'=>false, 'message'=>'非房主不可操作']));

$pdo->exec("UPDATE rooms SET status='started' WHERE room_id='$roomId'");

// 发牌
$cards = [];
$suits = ['clubs', 'spades', 'diamonds', 'hearts'];
$ranks = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
foreach ($suits as $suit) foreach ($ranks as $rank) $cards[] = "{$rank}_of_{$suit}";
shuffle($cards);

$players = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll();
foreach ($players as $player) {
  $hand = array_splice($cards, 0, 13);
  $pdo->prepare("UPDATE players SET cards=? WHERE id=?")->execute([json_encode($hand), $player['id']]);
}
echo json_encode(['success'=>true]);

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

// 任何玩家都可以触发发牌（移除房主限制）
// 检查玩家数量和是否全部准备
$players = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll();
if (count($players) !== 4) {
    echo json_encode(['success'=>false, 'message'=>'必须4人才能开始游戏']);
    exit();
}
foreach ($players as $p) {
    if (!$p['submitted']) {
        echo json_encode(['success'=>false, 'message'=>'请等待所有玩家准备']);
        exit();
    }
}

// 检查房间状态
$room = $pdo->query("SELECT status FROM rooms WHERE room_id='$roomId'")->fetch();
if ($room['status'] !== 'waiting') {
    echo json_encode(['success'=>false, 'message'=>'房间已开始']);
    exit();
}

// 发牌并设置房间状态
$pdo->prepare("UPDATE rooms SET status='started' WHERE room_id=?")->execute([$roomId]);

// 洗牌、发牌
$cards = [];
$suits = ['clubs', 'spades', 'diamonds', 'hearts'];
$ranks = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
foreach ($suits as $suit) foreach ($ranks as $rank) $cards[] = "{$rank}_of_{$suit}";
shuffle($cards);

foreach ($players as $p) {
    $hand = array_splice($cards, 0, 13);
    $pdo->prepare("UPDATE players SET cards=? WHERE id=?")->execute([json_encode($hand), $p['id']]);
}

echo json_encode(['success'=>true]);
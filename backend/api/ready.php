<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';
require_once '_timeout_helper.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$roomId = $data['roomId'] ?? '';
$token = $data['token'] ?? '';

$user = verifyToken($token);
if (!$user || $user['roomId'] !== $roomId) {
    echo json_encode(['success'=>false, 'message'=>'未授权']);
    exit();
}

$pdo = getDb();
handleTimeoutsAndAutoPlay($roomId, $pdo);

// 设置当前玩家为已准备
$stmt = $pdo->prepare("UPDATE players SET submitted=1 WHERE room_id=? AND name=?");
$stmt->execute([$roomId, $user['name']]);

// 检查所有玩家是否都已准备
$players = $pdo->prepare("SELECT id, name, submitted FROM players WHERE room_id=?");
$players->execute([$roomId]);
$allPlayers = $players->fetchAll();
$allReady = true;
foreach ($allPlayers as $p) {
    if (!$p['submitted']) {
        $allReady = false;
        break;
    }
}

// 如果全部都准备好，且人数为4，自动发牌
if ($allReady && count($allPlayers) === 4) {
    // 更新房间状态
    $pdo->prepare("UPDATE rooms SET status='started' WHERE room_id=?")->execute([$roomId]);

    // 生成一副牌并洗牌
    $cards = [];
    $suits = ['clubs', 'spades', 'diamonds', 'hearts'];
    $ranks = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
    foreach ($suits as $suit) {
        foreach ($ranks as $rank) {
            $cards[] = "{$rank}_of_{$suit}";
        }
    }
    shuffle($cards);

    // 给每位玩家发13张牌
    foreach ($allPlayers as $player) {
        $hand = array_splice($cards, 0, 13);
        $pdo->prepare("UPDATE players SET cards=? WHERE id=?")->execute([json_encode($hand), $player['id']]);
    }
    echo json_encode(['success'=>true, 'autoDealt'=>true]);
    exit();
}

echo json_encode(['success'=>true, 'autoDealt'=>false]);
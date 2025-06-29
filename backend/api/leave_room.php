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

// 查找该玩家
$stmt = $pdo->prepare("SELECT * FROM players WHERE room_id=? AND name=?");
$stmt->execute([$roomId, $user['name']]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if ($row) {
    // 已发牌但未理牌，自动理牌
    if (!empty($row['cards']) && intval($row['submitted']) === 0) {
        $cards = json_decode($row['cards'], true);
        if (is_array($cards) && count($cards) === 13) {
            $head = array_slice($cards, 0, 3);
            $middle = array_slice($cards, 3, 8);
            $tail = array_slice($cards, 8, 13);
            $autoCards = array_merge($head, $middle, $tail);
            $pdo->prepare("UPDATE players SET cards=?, submitted=1 WHERE id=?")
                ->execute([json_encode($autoCards), $row['id']]);
        }
    }
    // 删除玩家
    $stmt = $pdo->prepare("DELETE FROM players WHERE room_id=? AND name=?");
    $stmt->execute([$roomId, $user['name']]);
}

echo json_encode(['success'=>true]);
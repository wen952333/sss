<?php
require_once '../utils/cors.php';
require_once '../db/db.php';

header('Content-Type: application/json');

// 查询所有房间（只要没被物理删除都查出，返回status，前端可区分显示）
$pdo = getDb();
$rooms = $pdo->query("SELECT room_id, type, score, status FROM rooms ORDER BY room_id DESC")->fetchAll(PDO::FETCH_ASSOC);

$result = [];
foreach ($rooms as $room) {
    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM players WHERE room_id = ?");
    $stmt->execute([$room['room_id']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $result[] = [
        'room_id' => $room['room_id'],
        'type' => $room['type'],
        'score' => intval($room['score']),
        'status' => $room['status'],
        'player_count' => intval($row['cnt']),
    ];
}

echo json_encode([
    'success' => true,
    'rooms' => $result,
]);
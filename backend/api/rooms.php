<?php
require_once '../utils/cors.php';
require_once '../db/db.php';

header('Content-Type: application/json');

// 查询所有等待中的房间及人数
$pdo = getDb();
$rooms = $pdo->query("SELECT room_id FROM rooms WHERE status='waiting' ORDER BY room_id DESC")->fetchAll(PDO::FETCH_ASSOC);

$result = [];
foreach ($rooms as $room) {
    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM players WHERE room_id = ?");
    $stmt->execute([$room['room_id']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $result[] = [
        'room_id' => $room['room_id'],
        'player_count' => intval($row['cnt']),
    ];
}

echo json_encode([
    'success' => true,
    'rooms' => $result,
]);

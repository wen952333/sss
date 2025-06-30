<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';

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

// 查找该玩家
$stmt = $pdo->prepare("SELECT * FROM players WHERE room_id=? AND name=?");
$stmt->execute([$roomId, $user['name']]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if ($row) {
    // 直接删除玩家，不再理牌
    $stmt = $pdo->prepare("DELETE FROM players WHERE room_id=? AND name=?");
    $stmt->execute([$roomId, $user['name']]);
}

echo json_encode(['success'=>true]);

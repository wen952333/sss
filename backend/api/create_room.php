<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
if (!$data['name']) {
    echo json_encode(['success' => false, 'message' => '缺少昵称']);
    exit();
}

// 生成唯一房间ID
$roomId = substr(md5(uniqid('', true)), 0, 6);

// 连接数据库
$pdo = getDb();
try {
    $stmt1 = $pdo->prepare("INSERT INTO rooms (room_id, status) VALUES (?, ?)");
    $stmt1->execute([$roomId, 'waiting']);

    $stmt2 = $pdo->prepare("INSERT INTO players (room_id, name, is_owner) VALUES (?, ?, 1)");
    $stmt2->execute([$roomId, $data['name']]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => '数据库写入失败: ' . $e->getMessage()]);
    exit();
}

// 生成token
$token = createToken(['roomId' => $roomId, 'name' => $data['name']]);

echo json_encode([
    'success' => true,
    'roomId' => $roomId,
    'token' => $token
]);

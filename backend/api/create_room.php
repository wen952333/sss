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
$pdo->exec("INSERT INTO rooms (room_id, status) VALUES ('$roomId', 'waiting')");
$pdo->exec("INSERT INTO players (room_id, name, is_owner) VALUES ('$roomId', '{$data['name']}', 1)");

// 生成token
$token = createToken(['roomId' => $roomId, 'name' => $data['name']]);

echo json_encode([
    'success' => true,
    'roomId' => $roomId,
    'token' => $token
]);

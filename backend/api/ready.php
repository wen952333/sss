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
$stmt = $pdo->prepare("UPDATE players SET submitted=1 WHERE room_id=? AND name=?");
$stmt->execute([$roomId, $user['name']]);

echo json_encode(['success'=>true]);

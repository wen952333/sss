<?php
require_once '../utils/cors.php';
require_once '../db/db.php';

header('Content-Type: application/json');
define('BOT_SECRET', 'P1yqxnHxJfoTvlyp'); // 必须和bot.php一致

$data = json_decode(file_get_contents('php://input'), true);

if (($data['bot_secret'] ?? '') !== BOT_SECRET) {
    echo json_encode(['success' => false, 'message' => '无权操作']);
    exit();
}
$roomId = trim($data['room_id'] ?? '');
if (!$roomId) {
    echo json_encode(['success' => false, 'message' => '缺少房间号']);
    exit();
}

$pdo = getDb();
try {
    $pdo->beginTransaction();
    $pdo->prepare("DELETE FROM players WHERE room_id=?")->execute([$roomId]);
    $pdo->prepare("DELETE FROM rooms WHERE room_id=?")->execute([$roomId]);
    $pdo->commit();
    echo json_encode(['success' => true, 'message' => '房间已删除']);
} catch (Exception $e) {
    $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => '删除失败：'.$e->getMessage()]);
}

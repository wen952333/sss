<?php
require_once '../utils/cors.php';
require_once '../db/db.php';

header('Content-Type: application/json');
define('BOT_SECRET', 'P1yqxnHxJfoTvlyp');

$data = json_decode(file_get_contents('php://input'), true);

if (($data['bot_secret'] ?? '') !== BOT_SECRET) {
    echo json_encode(['success'=>false, 'message'=>'无权操作']);
    exit();
}

$phone = trim($data['phone'] ?? '');
if (!$phone) {
    echo json_encode(['success'=>false, 'message'=>'缺少手机号']);
    exit();
}

$pdo = getDb();
$stmt = $pdo->prepare("DELETE FROM users WHERE phone=?");
$stmt->execute([$phone]);
echo json_encode(['success'=>true, 'message'=>'已删除']);
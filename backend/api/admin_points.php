<?php
require_once '../utils/cors.php';
require_once '../db/db.php';

header('Content-Type: application/json');

define('BOT_SECRET', '你的_bot_secret'); // 与bot.php一致

$data = json_decode(file_get_contents('php://input'), true);

if (($data['bot_secret'] ?? '') !== BOT_SECRET) {
    echo json_encode(['success'=>false, 'message'=>'无权操作']);
    exit();
}

$phone = trim($data['phone'] ?? '');
$amount = intval($data['amount'] ?? 0);

if (!$phone || $amount === 0) {
    echo json_encode(['success'=>false, 'message'=>'参数错误']);
    exit();
}

$pdo = getDb();
$stmt = $pdo->prepare("SELECT id, points FROM users WHERE phone=?");
$stmt->execute([$phone]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo json_encode(['success'=>false, 'message'=>'用户不存在']);
    exit();
}

try {
    $pdo->prepare("UPDATE users SET points=points+? WHERE id=?")->execute([$amount, $user['id']]);
    echo json_encode(['success'=>true, 'message'=>'操作成功', 'new_points'=>$user['points']+$amount]);
} catch (Exception $e) {
    echo json_encode(['success'=>false, 'message'=>'操作失败']);
}

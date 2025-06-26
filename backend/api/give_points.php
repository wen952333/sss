<?php
require_once '../utils/cors.php';
require_once '../db/db.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$from_phone = trim($data['from_phone'] ?? '');
$to_phone = trim($data['to_phone'] ?? '');
$amount = intval($data['amount'] ?? 0);

if (!$from_phone || !$to_phone || $amount <= 0) {
    echo json_encode(['success'=>false, 'message'=>'参数错误']);
    exit();
}

$pdo = getDb();

// 检查赠送方
$stmt = $pdo->prepare("SELECT id, points FROM users WHERE phone=?");
$stmt->execute([$from_phone]);
$from = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$from) {
    echo json_encode(['success'=>false, 'message'=>'赠送方不存在']);
    exit();
}
if ($from['points'] < $amount) {
    echo json_encode(['success'=>false, 'message'=>'积分不足']);
    exit();
}

// 检查接收方
$stmt = $pdo->prepare("SELECT id, points FROM users WHERE phone=?");
$stmt->execute([$to_phone]);
$to = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$to) {
    echo json_encode(['success'=>false, 'message'=>'接收方不存在']);
    exit();
}

// 执行转账（建议用事务）
try {
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE users SET points=points-? WHERE id=?")->execute([$amount, $from['id']]);
    $pdo->prepare("UPDATE users SET points=points+? WHERE id=?")->execute([$amount, $to['id']]);
    $pdo->commit();
    echo json_encode(['success'=>true, 'message'=>'赠送成功']);
} catch (Exception $e) {
    $pdo->rollBack();
    echo json_encode(['success'=>false, 'message'=>'赠送失败']);
}

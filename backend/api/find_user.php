<?php
require_once '../utils/cors.php';
require_once '../db/db.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$phone = trim($data['phone'] ?? '');

if (!$phone) {
    echo json_encode(['success'=>false, 'message'=>'手机号不能为空']);
    exit();
}

$pdo = getDb();
$stmt = $pdo->prepare("SELECT id, phone, nickname, points FROM users WHERE phone=?");
$stmt->execute([$phone]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo json_encode(['success'=>false, 'message'=>'用户不存在']);
    exit();
}

echo json_encode(['success'=>true, 'user'=>$user]);

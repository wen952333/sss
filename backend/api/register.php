<?php
require_once '../utils/cors.php';
require_once '../db/db.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$phone = trim($data['phone'] ?? '');
$nickname = trim($data['nickname'] ?? '');
$password = trim($data['password'] ?? '');

if (!$phone || !$nickname || !$password) {
    echo json_encode(['success'=>false, 'message'=>'手机号、昵称和密码不能为空']);
    exit();
}

$pdo = getDb();
$stmt = $pdo->prepare("SELECT id FROM users WHERE phone=?");
$stmt->execute([$phone]);
if ($stmt->fetch()) {
    echo json_encode(['success'=>false, 'message'=>'手机号已注册']);
    exit();
}

// 密码加密存储
$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $pdo->prepare("INSERT INTO users (phone, nickname, password) VALUES (?, ?, ?)");
$stmt->execute([$phone, $nickname, $hash]);

echo json_encode(['success'=>true, 'message'=>'注册成功，初始积分100']);

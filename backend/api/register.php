<?php
header('Content-Type: application/json');
require_once __DIR__.'/../db.php';

// 获取前端POST的JSON参数
$data = json_decode(file_get_contents('php://input'), true);
$phone = $data['phone'] ?? '';
$password = $data['password'] ?? '';
$nickname = $data['nickname'] ?? '';

if (!$phone || !$password || !$nickname) {
    echo json_encode(['ok' => false, 'error' => '参数不能为空']);
    exit;
}

// 检查手机号是否已注册
$stmt = $db->prepare("SELECT id FROM users WHERE phone = ?");
$stmt->execute([$phone]);
if ($stmt->fetch()) {
    echo json_encode(['ok' => false, 'error' => '手机号已注册']);
    exit;
}

// 插入新用户
$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $db->prepare("INSERT INTO users (phone, password, nickname) VALUES (?, ?, ?)");
if ($stmt->execute([$phone, $hash, $nickname])) {
    $uid = $db->lastInsertId();
    echo json_encode(['ok' => true, 'user' => [
        'id' => $uid,
        'phone' => $phone,
        'nickname' => $nickname
    ]]);
} else {
    echo json_encode(['ok' => false, 'error' => '注册失败，请重试']);
}

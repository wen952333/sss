<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../db.php';

// 获取前端POST的JSON参数
$data = json_decode(file_get_contents('php://input'), true);
$phone = $data['phone'] ?? '';
$password = $data['password'] ?? '';

if (!$phone || !$password) {
    echo json_encode(['ok' => false, 'error' => '手机号和密码不能为空']);
    exit;
}

// 用 prepare + execute 防止SQL注入，不要用 query 传数组参数！
$stmt = $db->prepare("SELECT * FROM users WHERE phone = ?");
$stmt->execute([$phone]);
$user = $stmt->fetch();

if (!$user) {
    echo json_encode(['ok' => false, 'error' => '用户不存在']);
    exit;
}

if (!password_verify($password, $user['password'])) {
    echo json_encode(['ok' => false, 'error' => '密码错误']);
    exit;
}

// 登录成功，返回用户信息（可根据实际需求裁剪字段）
echo json_encode([
    'ok' => true,
    'user' => [
        'id' => $user['id'],
        'phone' => $user['phone'],
        'nickname' => $user['nickname']
    ]
]);

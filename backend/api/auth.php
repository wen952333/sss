<?php
// ===== CORS 跨域设置 =====
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
// ========================

include_once '../includes/db.php';
include_once '../includes/functions.php';

$data = json_decode(file_get_contents('php://input'), true);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($data['action'])) {
        switch ($data['action']) {
            case 'register':
                handleRegister($pdo, $data);
                break;
            case 'login':
                handleLogin($pdo, $data);
                break;
            default:
                echo json_encode(['success' => false, 'message' => '无效操作']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => '缺少操作参数']);
    }
}

function handleRegister($pdo, $data) {
    if (empty($data['mobile']) || empty($data['nickname']) || empty($data['password'])) {
        echo json_encode(['success' => false, 'message' => '请填写完整信息']);
        return;
    }
    
    // 验证手机号格式
    if (!preg_match('/^1[3-9]\d{9}$/', $data['mobile'])) {
        echo json_encode(['success' => false, 'message' => '手机号格式不正确']);
        return;
    }
    
    // 检查手机号是否已存在
    $stmt = $pdo->prepare("SELECT id FROM users WHERE mobile = ?");
    $stmt->execute([$data['mobile']]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => '手机号已注册']);
        return;
    }
    
    // 创建新用户
    $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO users (mobile, nickname, password) VALUES (?, ?, ?)");
    
    if ($stmt->execute([$data['mobile'], $data['nickname'], $hashedPassword])) {
        $userId = $pdo->lastInsertId();
        $user = [
            'id' => $userId,
            'mobile' => $data['mobile'],
            'nickname' => $data['nickname'],
            'points' => 1000
        ];
        echo json_encode(['success' => true, 'user' => $user]);
    } else {
        echo json_encode(['success' => false, 'message' => '注册失败']);
    }
}

function handleLogin($pdo, $data) {
    if (empty($data['mobile']) || empty($data['password'])) {
        echo json_encode(['success' => false, 'message' => '请填写手机号和密码']);
        return;
    }
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE mobile = ?");
    $stmt->execute([$data['mobile']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user && password_verify($data['password'], $user['password'])) {
        unset($user['password']);
        echo json_encode(['success' => true, 'user' => $user]);
    } else {
        echo json_encode(['success' => false, 'message' => '手机号或密码错误']);
    }
}
?>

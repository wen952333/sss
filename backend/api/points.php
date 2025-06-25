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
    $userId = authenticateUser($pdo);
    if (!$userId) {
        echo json_encode(['success' => false, 'message' => '未授权']);
        exit;
    }
    
    if (isset($data['action'])) {
        switch ($data['action']) {
            case 'transfer':
                handleTransferPoints($pdo, $userId, $data);
                break;
            default:
                echo json_encode(['success' => false, 'message' => '无效操作']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => '缺少操作参数']);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = authenticateUser($pdo);
    if (!$userId) {
        echo json_encode(['success' => false, 'message' => '未授权']);
        exit;
    }
    
    if (isset($_GET['action'])) {
        switch ($_GET['action']) {
            case 'search_user':
                handleSearchUser($pdo, $userId, $_GET);
                break;
            default:
                echo json_encode(['success' => false, 'message' => '无效操作']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => '缺少操作参数']);
    }
}

function handleSearchUser($pdo, $userId, $data) {
    if (empty($data['mobile'])) {
        echo json_encode(['success' => false, 'message' => '手机号不能为空']);
        return;
    }
    
    $mobile = $data['mobile'];
    
    // 不能搜索自己
    $stmt = $pdo->prepare("SELECT id, mobile, nickname, points FROM users WHERE mobile = ? AND id != ?");
    $stmt->execute([$mobile, $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user) {
        echo json_encode(['success' => true, 'user' => $user]);
    } else {
        echo json_encode(['success' => false, 'message' => '未找到用户']);
    }
}

function handleTransferPoints($pdo, $fromUserId, $data) {
    if (empty($data['to_user_id']) || empty($data['amount'])) {
        echo json_encode(['success' => false, 'message' => '参数不完整']);
        return;
    }
    
    $toUserId = $data['to_user_id'];
    $amount = (int)$data['amount'];
    
    if ($amount <= 0) {
        echo json_encode(['success' => false, 'message' => '转账金额必须大于0']);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        // 获取转账方积分
        $stmt = $pdo->prepare("SELECT points FROM users WHERE id = ? FOR UPDATE");
        $stmt->execute([$fromUserId]);
        $fromUser = $stmt->fetch();
        
        if (!$fromUser) {
            throw new Exception('用户不存在');
        }
        
        if ($fromUser['points'] < $amount) {
            throw new Exception('积分不足');
        }
        
        // 获取接收方信息
        $stmt = $pdo->prepare("SELECT points FROM users WHERE id = ? FOR UPDATE");
        $stmt->execute([$toUserId]);
        $toUser = $stmt->fetch();
        
        if (!$toUser) {
            throw new Exception('接收方不存在');
        }
        
        // 更新转账方积分
        $newFromPoints = $fromUser['points'] - $amount;
        $stmt = $pdo->prepare("UPDATE users SET points = ? WHERE id = ?");
        $stmt->execute([$newFromPoints, $fromUserId]);
        
        // 更新接收方积分
        $newToPoints = $toUser['points'] + $amount;
        $stmt = $pdo->prepare("UPDATE users SET points = ? WHERE id = ?");
        $stmt->execute([$newToPoints, $toUserId]);
        
        // 记录转账记录
        $stmt = $pdo->prepare("INSERT INTO transfers (from_user_id, to_user_id, amount) VALUES (?, ?, ?)");
        $stmt->execute([$fromUserId, $toUserId, $amount]);
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => '转账成功',
            'new_balance' => $newFromPoints
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
?>

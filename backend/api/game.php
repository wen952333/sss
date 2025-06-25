<?php
include_once '../includes/db.php';
include_once '../includes/functions.php';

$data = json_decode(file_get_contents('php://input'), true);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($data['action'])) {
        $userId = authenticateUser($pdo);
        if (!$userId) {
            echo json_encode(['success' => false, 'message' => '未授权']);
            exit;
        }
        
        switch ($data['action']) {
            case 'create_room':
                handleCreateRoom($pdo, $userId, $data);
                break;
            case 'join_room':
                handleJoinRoom($pdo, $userId, $data);
                break;
            case 'leave_room':
                handleLeaveRoom($pdo, $userId, $data);
                break;
            case 'start_game':
                handleStartGame($pdo, $userId, $data);
                break;
            case 'play_cards':
                handlePlayCards($pdo, $userId, $data);
                break;
            case 'get_rooms':
                handleGetRooms($pdo);
                break;
            case 'get_room':
                handleGetRoom($pdo, $data);
                break;
            default:
                echo json_encode(['success' => false, 'message' => '无效操作']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => '缺少操作参数']);
    }
}

function handleCreateRoom($pdo, $userId, $data) {
    if (empty($data['name'])) {
        echo json_encode(['success' => false, 'message' => '房间名不能为空']);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        // 创建房间
        $stmt = $pdo->prepare("INSERT INTO rooms (name, owner_id) VALUES (?, ?)");
        $stmt->execute([$data['name'], $userId]);
        $roomId = $pdo->lastInsertId();
        
        // 将创建者加入房间
        $stmt = $pdo->prepare("INSERT INTO room_players (room_id, user_id) VALUES (?, ?)");
        $stmt->execute([$roomId, $userId]);
        
        $pdo->commit();
        
        echo json_encode(['success' => true, 'room_id' => $roomId]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => '创建房间失败: ' . $e->getMessage()]);
    }
}

function handleJoinRoom($pdo, $userId, $data) {
    if (empty($data['room_id'])) {
        echo json_encode(['success' => false, 'message' => '房间ID不能为空']);
        return;
    }
    
    $roomId = $data['room_id'];
    
    // 检查房间是否存在
    $stmt = $pdo->prepare("SELECT * FROM rooms WHERE id = ?");
    $stmt->execute([$roomId]);
    $room = $stmt->fetch();
    
    if (!$room) {
        echo json_encode(['success' => false, 'message' => '房间不存在']);
        return;
    }
    
    // 检查用户是否已在房间中
    $stmt = $pdo->prepare("SELECT * FROM room_players WHERE room_id = ? AND user_id = ?");
    $stmt->execute([$roomId, $userId]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => true]);
        return;
    }
    
    // 检查房间人数
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM room_players WHERE room_id = ?");
    $stmt->execute([$roomId]);
    $playerCount = $stmt->fetchColumn();
    
    if ($playerCount >= 4) {
        echo json_encode(['success' => false, 'message' => '房间已满']);
        return;
    }
    
    // 加入房间
    $stmt = $pdo->prepare("INSERT INTO room_players (room_id, user_id) VALUES (?, ?)");
    if ($stmt->execute([$roomId, $userId])) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => '加入房间失败']);
    }
}

// 其他游戏相关函数实现类似...

?>

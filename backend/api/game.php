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
            default:
                echo json_encode(['success' => false, 'message' => '无效操作']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => '缺少操作参数']);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['action'])) {
        switch ($_GET['action']) {
            case 'get_rooms':
                handleGetRooms($pdo);
                break;
            case 'get_room':
                handleGetRoom($pdo, $_GET);
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

        echo json_encode(['success' => true, 'id' => $roomId]);
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

function handleStartGame($pdo, $userId, $data) {
    if (empty($data['room_id'])) {
        echo json_encode(['success' => false, 'message' => '房间ID不能为空']);
        return;
    }

    $roomId = $data['room_id'];

    // 验证用户是房主
    $stmt = $pdo->prepare("SELECT owner_id FROM rooms WHERE id = ?");
    $stmt->execute([$roomId]);
    $room = $stmt->fetch();

    if (!$room || $room['owner_id'] != $userId) {
        echo json_encode(['success' => false, 'message' => '只有房主可以开始游戏']);
        return;
    }

    // 获取房间玩家
    $stmt = $pdo->prepare("SELECT user_id FROM room_players WHERE room_id = ?");
    $stmt->execute([$roomId]);
    $players = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (count($players) < 2) {
        echo json_encode(['success' => false, 'message' => '至少需要2名玩家']);
        return;
    }

    try {
        $pdo->beginTransaction();

        // 生成牌组并洗牌
        $suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        $ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        $deck = [];

        foreach ($suits as $suit) {
            foreach ($ranks as $rank) {
                $deck[] = ['rank' => $rank, 'suit' => $suit];
            }
        }

        shuffle($deck);

        // 发牌 (每人13张)
        $cardsPerPlayer = 13;
        $playerCards = array_fill(0, count($players), []);

        for ($i = 0; $i < $cardsPerPlayer; $i++) {
            foreach ($players as $index => $playerId) {
                if (!empty($deck)) {
                    $playerCards[$index][] = array_shift($deck);
                }
            }
        }

        // 保存玩家手牌
        foreach ($players as $index => $playerId) {
            $cardsJson = json_encode($playerCards[$index]);
            $stmt = $pdo->prepare("UPDATE room_players SET cards = ? WHERE room_id = ? AND user_id = ?");
            $stmt->execute([$cardsJson, $roomId, $playerId]);
        }

        // 更新房间状态
        $stmt = $pdo->prepare("UPDATE rooms SET status = 'playing' WHERE id = ?");
        $stmt->execute([$roomId]);

        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => '开始游戏失败: ' . $e->getMessage()]);
    }
}

// 其余 handleLeaveRoom、handlePlayCards、handleGetRooms、handleGetRoom 可参考已有风格补充...

?>

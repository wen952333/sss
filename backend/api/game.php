// ... 前面代码不变 ...

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

// 其他游戏函数...

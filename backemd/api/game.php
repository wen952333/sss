<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

session_start();

require_once __DIR__ . '/../lib/Game.php';

$action = $_GET['action'] ?? '';

$response = [
    'success' => false,
    'message' => '未知操作'
];

try {
    switch ($action) {
        case 'create':
            $data = json_decode(file_get_contents('php://input'), true);
            $userId = $data['userId'] ?? null;
            
            if (!$userId) {
                throw new Exception('用户ID不能为空');
            }
            
            $game = new Game();
            $gameId = $game->createGame($userId);
            
            $response = [
                'success' => true,
                'gameId' => $gameId,
                'message' => '游戏创建成功'
            ];
            break;
            
        case 'join':
            $gameId = $_GET['gameId'] ?? null;
            $userId = $_GET['userId'] ?? null;
            
            if (!$gameId || !$userId) {
                throw new Exception('参数不完整');
            }
            
            $game = new Game($gameId);
            $game->joinGame($userId);
            
            $response = [
                'success' => true,
                'game' => $game->getState(),
                'players' => $game->getPlayers(),
                'message' => '加入游戏成功'
            ];
            break;
            
        case 'status':
            $gameId = $_GET['gameId'] ?? null;
            
            if (!$gameId) {
                throw new Exception('游戏ID不能为空');
            }
            
            $game = new Game($gameId);
            
            $response = [
                'success' => true,
                'game' => $game->getState(),
                'players' => $game->getPlayers(),
                'message' => '游戏状态获取成功'
            ];
            break;
            
        case 'submit':
            $data = json_decode(file_get_contents('php://input'), true);
            $gameId = $data['gameId'] ?? null;
            $userId = $data['userId'] ?? null;
            $front = $data['front'] ?? [];
            $middle = $data['middle'] ?? [];
            $back = $data['back'] ?? [];
            
            if (!$gameId || !$userId) {
                throw new Exception('参数不完整');
            }
            
            $game = new Game($gameId);
            $game->submitCards($userId, $front, $middle, $back);
            
            $response = [
                'success' => true,
                'message' => '牌型提交成功'
            ];
            break;
            
        case 'list':
            $games = Game::listAvailableGames();
            
            $response = [
                'success' => true,
                'games' => $games,
                'message' => '可用游戏列表'
            ];
            break;
            
        default:
            $response['message'] = '无效的操作';
            break;
    }
} catch (Exception $e) {
    $response['message'] = $e->getMessage();
}

echo json_encode($response);
?>

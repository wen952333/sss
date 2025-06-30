<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$roomId = $data['roomId'] ?? '';
$token = $data['token'] ?? '';
$user = verifyToken($token);
if (!$user || $user['roomId'] !== $roomId) {
    echo json_encode(['success'=>false, 'message'=>'未授权']);
    exit();
}

// 检查房间是否是比牌阶段
$pdo = getDb();
$room = $pdo->query("SELECT * FROM rooms WHERE room_id='$roomId'")->fetch();
if (!$room || $room['status'] !== 'started') {
    echo json_encode(['success'=>false, 'msg'=>'房间状态异常']);
    exit();
}

// 记录当前玩家已关闭比牌弹窗
$stmt = $pdo->prepare("UPDATE players SET result=NULL WHERE room_id=? AND name=?");
$stmt->execute([$roomId, $user['name']]);

// 检查是否所有玩家都已关闭比牌弹窗（result字段都为NULL）
$players = $pdo->prepare("SELECT result FROM players WHERE room_id=?");
$players->execute([$roomId]);
$allClosed = true;
foreach ($players->fetchAll() as $row) {
    if (!is_null($row['result'])) {
        $allClosed = false;
        break;
    }
}

if ($allClosed) {
    // 所有人都关闭弹窗，重置房间
    $pdo->prepare("UPDATE rooms SET status='waiting' WHERE room_id=?")->execute([$roomId]);
    $pdo->prepare("UPDATE players SET submitted=0, cards=NULL WHERE room_id=?")->execute([$roomId]);
    echo json_encode(['success'=>true, 'reset'=>'all']);
} else {
    echo json_encode(['success'=>true, 'reset'=>'wait']);
}

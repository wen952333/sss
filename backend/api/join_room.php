<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
if (!$data['name'] || !$data['roomId']) die(json_encode(['success'=>false,'message'=>'参数缺失']));

$pdo = getDb();
$room = $pdo->query("SELECT * FROM rooms WHERE room_id='{$data['roomId']}'")->fetch();
if (!$room) die(json_encode(['success'=>false,'message'=>'房间不存在']));
if (!in_array($room['status'], ['waiting', 'started'])) die(json_encode(['success'=>false,'message'=>'房间不可加入']));

// 修正：如果房间是waiting且ready_reset_time为空，则初始化为当前时间
if ($room['status'] === 'waiting' && (empty($room['ready_reset_time']) || $room['ready_reset_time'] === '0000-00-00 00:00:00')) {
    $pdo->prepare("UPDATE rooms SET ready_reset_time=? WHERE room_id=?")
        ->execute([date('Y-m-d H:i:s'), $data['roomId']]);
}

try {
    $pdo->beginTransaction();

    // 防止重名或重复加入
    $stmtCheck = $pdo->prepare("SELECT * FROM players WHERE room_id=? AND name=? FOR UPDATE");
    $stmtCheck->execute([$data['roomId'], $data['name']]);
    if ($stmtCheck->fetch()) {
        $pdo->rollBack();
        die(json_encode(['success'=>false,'message'=>'该昵称已在房间中']));
    }

    // 房间人数限制，防并发超员
    $stmtCnt = $pdo->prepare("SELECT COUNT(*) as cnt FROM players WHERE room_id = ? FOR UPDATE");
    $stmtCnt->execute([$data['roomId']]);
    $rowCnt = $stmtCnt->fetch();
    if (intval($rowCnt['cnt']) >= 4) {
        $pdo->rollBack();
        die(json_encode(['success'=>false,'message'=>'房间已满']));
    }

    // 插入玩家，带join_time
    $stmt = $pdo->prepare("INSERT INTO players (room_id, name, is_owner, join_time) VALUES (?, ?, 0, ?)");
    $stmt->execute([$data['roomId'], $data['name'], date('Y-m-d H:i:s')]);
    $pdo->commit();

    $token = createToken(['roomId'=>$data['roomId'], 'name'=>$data['name']]);
    echo json_encode(['success'=>true, 'token'=>$token]);
} catch(Exception $e) {
    $pdo->rollBack();
    echo json_encode(['success'=>false, 'message'=>'加入失败: '.$e->getMessage()]);
}

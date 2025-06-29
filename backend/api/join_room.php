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

// 加锁防并发（MySQL事务+排他锁，防止超员和重名）
try {
    $pdo->beginTransaction();

    // 防止重名或重复加入
    $stmtCheck = $pdo->prepare("SELECT * FROM players WHERE room_id=? AND name=?");
    $stmtCheck->execute([$data['roomId'], $data['name']]);
    if ($stmtCheck->fetch()) {
        $pdo->rollBack();
        die(json_encode(['success'=>false,'message'=>'该昵称已在房间中']));
    }

    $stmtCnt = $pdo->prepare("SELECT COUNT(*) as cnt FROM players WHERE room_id = ? FOR UPDATE");
    $stmtCnt->execute([$data['roomId']]);
    $rowCnt = $stmtCnt->fetch();
    if (intval($rowCnt['cnt']) >= 4) {
        $pdo->rollBack();
        die(json_encode(['success'=>false,'message'=>'房间已满']));
    }

    $stmt = $pdo->prepare("INSERT INTO players (room_id, name, is_owner) VALUES (?, ?, 0)");
    $stmt->execute([$data['roomId'], $data['name']]);
    $pdo->commit();

    $token = createToken(['roomId'=>$data['roomId'], 'name'=>$data['name']]);
    echo json_encode(['success'=>true, 'token'=>$token]);
} catch(Exception $e) {
    $pdo->rollBack();
    echo json_encode(['success'=>false, 'message'=>'加入失败: '.$e->getMessage()]);
}

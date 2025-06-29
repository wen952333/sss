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
// 允许 waiting 和 started 状态都能加入
if (!in_array($room['status'], ['waiting', 'started'])) die(json_encode(['success'=>false,'message'=>'房间不可加入']));

// 新增：防止超员（最多4人）
$stmtCnt = $pdo->prepare("SELECT COUNT(*) as cnt FROM players WHERE room_id = ?");
$stmtCnt->execute([$data['roomId']]);
$rowCnt = $stmtCnt->fetch();
if (intval($rowCnt['cnt']) >= 4) {
    die(json_encode(['success'=>false,'message'=>'房间已满']));
}

$stmt = $pdo->prepare("INSERT INTO players (room_id, name, is_owner) VALUES (?, ?, 0)");
$stmt->execute([$data['roomId'], $data['name']]);

$token = createToken(['roomId'=>$data['roomId'], 'name'=>$data['name']]);
echo json_encode(['success'=>true, 'token'=>$token]);

<?php
require_once '../db/db.php';
require_once '../utils/auth.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
if (!$data['name'] || !$data['roomId']) die(json_encode(['success'=>false,'message'=>'参数缺失']));

$pdo = getDb();
$room = $pdo->query("SELECT * FROM rooms WHERE room_id='{$data['roomId']}'")->fetch();
if (!$room) die(json_encode(['success'=>false,'message'=>'房间不存在']));
if ($room['status'] !== 'waiting') die(json_encode(['success'=>false,'message'=>'房间已开始']));

$stmt = $pdo->prepare("INSERT INTO players (room_id, name, is_owner) VALUES (?, ?, 0)");
$stmt->execute([$data['roomId'], $data['name']]);

$token = createToken(['roomId'=>$data['roomId'], 'name'=>$data['name']]);
echo json_encode(['success'=>true, 'token'=>$token]);

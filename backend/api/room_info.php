<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';
header('Content-Type: application/json');

$roomId = $_GET['roomId'];
$token = $_GET['token'];
if (!$roomId || !$token) die(json_encode(['success'=>false, 'code'=>401]));

$user = verifyToken($token);
if (!$user || $user['roomId'] !== $roomId) die(json_encode(['success'=>false, 'code'=>401]));

$pdo = getDb();
$room = $pdo->query("SELECT * FROM rooms WHERE room_id='$roomId'")->fetch();
$rows = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll();
$players = [];
foreach ($rows as $row) {
  $players[] = [
    'name' => $row['name'],
    'isOwner' => $row['is_owner'] ? true : false,
    'submitted' => isset($row['submitted']) ? (bool)$row['submitted'] : false
  ];
}
echo json_encode([
  'success' => true,
  'players' => $players,
  'status' => $room['status'],
  'me' => $user['name']
]);

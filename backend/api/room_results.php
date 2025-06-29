<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';

header('Content-Type: application/json');

$roomId = $_GET['roomId'] ?? '';
$token = $_GET['token'] ?? '';

$user = verifyToken($token);
if (!$user || $user['roomId'] !== $roomId) {
    echo json_encode(['success'=>false, 'message'=>'未授权']);
    exit();
}

$pdo = getDb();
$rows = $pdo->query("SELECT name, cards, result FROM players WHERE room_id='$roomId'")->fetchAll(PDO::FETCH_ASSOC);
$players = [];
foreach ($rows as $row) {
    $cards = json_decode($row['cards'], true);
    $result = json_decode($row['result'], true);
    $players[] = [
        'name' => $row['name'],
        'cards' => $cards ?: [],
        'head' => is_array($cards) && count($cards) === 13 ? array_slice($cards, 0, 3) : [],
        'middle' => is_array($cards) && count($cards) === 13 ? array_slice($cards, 3, 8) : [],
        'tail' => is_array($cards) && count($cards) === 13 ? array_slice($cards, 8, 13) : [],
        'result' => $result && isset($result[0]) ? $result[0] : null,
    ];
}

echo json_encode(['success'=>true, 'players'=>$players]);
?>

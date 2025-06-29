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

    // 防御：只当cards为长度13且每项为字符串时才处理
    $isValidCards = is_array($cards) && count($cards) === 13 && count(array_filter($cards, 'is_string')) === 13;

    $players[] = [
        'name'   => $row['name'],
        'head'   => $isValidCards ? array_slice($cards, 0, 3) : [],
        'middle' => $isValidCards ? array_slice($cards, 3, 5) : [],
        'tail'   => $isValidCards ? array_slice($cards, 8, 5) : [],
        'result' => is_array($result) && isset($result[0]) ? $result[0] : (object)[],
    ];
}

echo json_encode(['success' => true, 'players' => $players]);

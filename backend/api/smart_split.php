<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';
require_once '_timeout_helper.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$token = $data['token'] ?? '';
$cards = $data['cards'] ?? [];

$user = verifyToken($token);
if (!$user) {
    echo json_encode(['success'=>false, 'message'=>'未授权']);
    exit();
}
if (!is_array($cards) || count($cards) !== 13) {
    echo json_encode(['success'=>false, 'message'=>'牌数不足13张']);
    exit();
}

list($head, $middle, $tail) = smartSplitNoFoul($cards);

echo json_encode([
    'success' => true,
    'split' => [
        'head' => array_values($head),
        'middle' => array_values($middle),
        'tail' => array_values($tail),
    ]
]);

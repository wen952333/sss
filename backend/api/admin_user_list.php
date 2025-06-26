<?php
require_once '../utils/cors.php';
require_once '../db/db.php';

header('Content-Type: application/json');
define('BOT_SECRET', '你的_bot_secret');

$data = json_decode(file_get_contents('php://input'), true);

if (($data['bot_secret'] ?? '') !== BOT_SECRET) {
    echo json_encode(['success'=>false, 'message'=>'无权操作']);
    exit();
}

$pdo = getDb();
$rows = $pdo->query("SELECT phone, nickname, points FROM users ORDER BY points DESC")->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['success'=>true, 'users'=>$rows]);

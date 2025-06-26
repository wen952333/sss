<?php
require_once '../utils/cors.php';

// 你的bot密钥，须与bot.php一致
define('BOT_SECRET', '你的_bot_secret');

header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true);

if (($data['bot_secret'] ?? '') !== BOT_SECRET) {
    echo json_encode(['success'=>false, 'message'=>'权限不足']);
    exit();
}

require_once '../db/db.php';
$pdo = getDb();

try {
    $pdo->exec("TRUNCATE TABLE announcements");
    echo json_encode(['success'=>true, 'message'=>'已全部删除']);
} catch(Exception $e) {
    echo json_encode(['success'=>false, 'message'=>'操作失败: '.$e->getMessage()]);
}

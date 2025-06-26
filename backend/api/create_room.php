<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';

header('Content-Type: application/json');

// ===== bot专用：强制校验bot_secret =====
define('BOT_SECRET', '你的_bot_secret'); // 此处与bot.php一致

$data = json_decode(file_get_contents('php://input'), true);

// 只有通过bot_secret的请求才能创建房间
if (($data['bot_secret'] ?? '') !== BOT_SECRET) {
    echo json_encode(['success' => false, 'message' => '无权创建房间']);
    exit();
}

if (!$data['name']) {
    echo json_encode(['success' => false, 'message' => '缺少昵称']);
    exit();
}
// 房间类型与分数
$type = in_array($data['type'] ?? '', ['normal','double']) ? $data['type'] : 'normal';
$score = intval($data['score'] ?? 1);
if (!in_array($score, [1,2,5,10])) $score = 1;

// 生成唯一房间ID
$roomId = substr(md5(uniqid('', true)), 0, 6);

// 连接数据库
$pdo = getDb();
try {
    $stmt1 = $pdo->prepare("INSERT INTO rooms (room_id, status, type, score) VALUES (?, ?, ?, ?)");
    $stmt1->execute([$roomId, 'waiting', $type, $score]);
    $stmt2 = $pdo->prepare("INSERT INTO players (room_id, name, is_owner) VALUES (?, ?, 1)");
    $stmt2->execute([$roomId, $data['name']]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => '数据库写入失败: ' . $e->getMessage()]);
    exit();
}

// 生成token
$token = createToken(['roomId' => $roomId, 'name' => $data['name']]);

echo json_encode([
    'success' => true,
    'roomId' => $roomId,
    'token' => $token,
    'type' => $type,
    'score' => $score
]);

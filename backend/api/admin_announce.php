<?php
require_once '../utils/cors.php';
require_once '../db/db.php';

header('Content-Type: application/json');
define('BOT_SECRET', 'P1yqxnHxJfoTvlyp');

$data = json_decode(file_get_contents('php://input'), true);

if (($data['bot_secret'] ?? '') !== BOT_SECRET) {
    echo json_encode(['success'=>false, 'message'=>'无权操作']);
    exit();
}
$content = trim($data['content'] ?? '');
if (!$content) {
    echo json_encode(['success'=>false, 'message'=>'公告内容为空']);
    exit();
}
// 建议建表: announcements(id int auto_increment primary key, content text, created_at timestamp default current_timestamp)
$pdo = getDb();
$stmt = $pdo->prepare("INSERT INTO announcements (content) VALUES (?)");
$stmt->execute([$content]);
echo json_encode(['success'=>true, 'message'=>'公告已发布']);
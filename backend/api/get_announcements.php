<?php
require_once '../utils/cors.php';
require_once '../db/db.php';

header('Content-Type: application/json');

$pdo = getDb();
$rows = $pdo->query("SELECT id, content, created_at FROM announcements ORDER BY id DESC LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['success'=>true, 'announcements'=>$rows]);
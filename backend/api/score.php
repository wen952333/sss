<?php
require_once("../db.php");
require_once("../utils.php");

$input = json_decode(file_get_contents("php://input"), true);
$action = $_GET['action'] ?? $input['action'] ?? '';
$token = $_GET['token'] ?? $input['token'] ?? '';
$user = getUserByToken($token);
if (!$user) die(json_encode(['ok'=>false, 'error'=>'请登录']));

switch ($action) {
  case 'send':
    $to = $input['to'] ?? '';
    $amount = intval($input['amount'] ?? 0);
    if ($amount <= 0) die(json_encode(['ok'=>false, 'error'=>'积分数量不合法']));
    $toUser = $db->query("SELECT * FROM users WHERE phone=?", [$to])->fetch();
    if (!$toUser) die(json_encode(['ok'=>false, 'error'=>'对方不存在']));
    if ($user['score'] < $amount) die(json_encode(['ok'=>false, 'error'=>'积分不足']));
    $db->beginTransaction();
    $db->query("UPDATE users SET score=score-? WHERE id=?", [$amount, $user['id']]);
    $db->query("UPDATE users SET score=score+? WHERE id=?", [$amount, $toUser['id']]);
    $db->commit();
    echo json_encode(['ok'=>true]);
    break;
  default:
    echo json_encode(['ok'=>false, 'error'=>'未知操作']);
}

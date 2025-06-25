<?php
require_once("../db.php");
$input = json_decode(file_get_contents("php://input"), true);
$phone = $input['phone'] ?? '';
$nickname = $input['nickname'] ?? '';
$password = $input['password'] ?? '';

if (!preg_match('/^1\d{10}$/', $phone)) die(json_encode(['ok'=>false, 'error'=>'手机号不合法']));
if (!$nickname || !$password) die(json_encode(['ok'=>false, 'error'=>'请填写昵称和密码']));
if (mb_strlen($nickname) > 10) die(json_encode(['ok'=>false, 'error'=>'昵称过长']));
if ($db->query("SELECT id FROM users WHERE phone='$phone'")->fetch()) {
  die(json_encode(['ok'=>false, 'error'=>'手机号已注册']));
}
$pwd = password_hash($password, PASSWORD_DEFAULT);
$db->query("INSERT INTO users(phone, nickname, password, score) VALUES (?, ?, ?, 1000)", [$phone, $nickname, $pwd]);
$user = $db->query("SELECT id, phone, nickname, score FROM users WHERE phone='$phone'")->fetch();
$token = bin2hex(random_bytes(16));
$db->query("UPDATE users SET token=? WHERE id=?", [$token, $user['id']]);
echo json_encode(['ok'=>true, 'user'=>['id'=>$user['id'], 'phone'=>$user['phone'], 'nickname'=>$user['nickname'], 'score'=>1000, 'token'=>$token]]);

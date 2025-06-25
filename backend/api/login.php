<?php
require_once("../db.php");
$input = json_decode(file_get_contents("php://input"), true);
$phone = $input['phone'] ?? '';
$password = $input['password'] ?? '';
$user = $db->query("SELECT * FROM users WHERE phone=?", [$phone])->fetch();
if (!$user || !password_verify($password, $user['password'])) {
  die(json_encode(['ok'=>false, 'error'=>'手机号或密码错误']));
}
$token = bin2hex(random_bytes(16));
$db->query("UPDATE users SET token=? WHERE id=?", [$token, $user['id']]);
echo json_encode(['ok'=>true, 'user'=>['id'=>$user['id'], 'phone'=>$user['phone'], 'nickname'=>$user['nickname'], 'score'=>$user['score'], 'token'=>$token]]);

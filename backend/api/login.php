<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$phone = trim($data['phone'] ?? '');
$password = $data['password'] ?? '';
if (!$phone || !$password) {
    echo json_encode(['success'=>false, 'message'=>'手机号和密码不能为空']);
    exit();
}
$pdo = getDb();
$stmt = $pdo->prepare("SELECT id, nickname, password FROM users WHERE phone=?");
$stmt->execute([$phone]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$user || !password_verify($password, $user['password'])) {
    echo json_encode(['success'=>false, 'message'=>'手机号或密码错误']);
    exit();
}
// 登录成功，生成token
$token = createToken(['userId'=>$user['id'], 'phone'=>$phone, 'nickname'=>$user['nickname']]);
echo json_encode(['success'=>true, 'message'=>'登录成功','token'=>$token,'nickname'=>$user['nickname']]);

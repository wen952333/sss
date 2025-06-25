<?php
require_once "db.php";

// 设置你的Bot的Telegram user id和Bot的TOKEN
define('BOT_ADMIN_ID', '你的Telegram账号数字ID'); // 只允许此id操作
define('BOT_TOKEN', '你的Bot的TOKEN'); // 仅作记录，无实际接口校验功能

header("Content-Type: application/json");

// 校验管理员身份（只允许特定TG账号调用，POST参数必须带admin_id）
$admin_id = $_POST['admin_id'] ?? '';
if ($admin_id !== BOT_ADMIN_ID) {
  die(json_encode(['success'=>false, 'message'=>'No permission']));
}

$action = $_POST['action'] ?? '';

// 通过手机号查找玩家
if ($action === "get_user") {
  $phone = $_POST['phone'] ?? '';
  $user = query("SELECT id, phone, nickname, score FROM user WHERE phone=?", [$phone]);
  die(json_encode(['success'=>!!$user, 'user'=>$user]));
}

// 增减积分
if ($action === "add_points") {
  $phone = $_POST['phone'] ?? '';
  $amount = intval($_POST['amount'] ?? 0);
  $user = query("SELECT id FROM user WHERE phone=?", [$phone]);
  if (!$user) die(json_encode(['success'=>false, 'message'=>'not found']));
  execute("UPDATE user SET score=score+? WHERE id=?", [$amount, $user['id']]);
  die(json_encode(['success'=>true]));
}

// 查询玩家积分列表
if ($action === "list_users") {
  $users = query("SELECT phone, nickname, score FROM user ORDER BY score DESC", [], true);
  die(json_encode(['success'=>true, 'list'=>$users]));
}

// 删除玩家所有数据
if ($action === "delete_user") {
  $phone = $_POST['phone'] ?? '';
  $user = query("SELECT id FROM user WHERE phone=?", [$phone]);
  if (!$user) die(json_encode(['success'=>false, 'message'=>'not found']));
  execute("DELETE FROM room_player WHERE user_id=?", [$user['id']]);
  execute("DELETE FROM gift_log WHERE from_id=? OR to_id=?", [$user['id'], $user['id']]);
  execute("DELETE FROM user WHERE id=?", [$user['id']]);
  die(json_encode(['success'=>true]));
}

// 发公告
if ($action === "broadcast") {
  $msg = trim($_POST['message'] ?? '');
  if (!$msg) die(json_encode(['success'=>false, 'message'=>'empty']));
  execute("INSERT INTO announce (message) VALUES (?)", [$msg]);
  die(json_encode(['success'=>true]));
}

// 获取公告列表（最新10条）
if ($action === "list_announces") {
  $rows = query("SELECT id, message, created_at FROM announce ORDER BY id DESC LIMIT 10", [], true);
  die(json_encode(['success'=>true, 'list'=>$rows]));
}

// 删除公告
if ($action === "delete_announce") {
  $id = intval($_POST['id'] ?? 0);
  if (!$id) die(json_encode(['success'=>false, 'message'=>'参数错误']));
  execute("DELETE FROM announce WHERE id=?", [$id]);
  die(json_encode(['success'=>true]));
}

// 默认
die(json_encode(['success'=>false, 'message'=>'unknown action']));

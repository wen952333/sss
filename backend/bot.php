<?php
// Telegram 管理BOT主文件（Webhook）

define('BOT_TOKEN', '你的BotToken');
define('API', 'https://api.telegram.org/bot' . BOT_TOKEN . '/');
define('BOT_SECRET', 'your_bot_secret'); // 后端校验密钥

define('API_BASE', 'https://你的域名/api/');

// ========== 菜单定义 ==========
$mainMenu = [
    'keyboard' => [
        [['text' => '➕ 增减积分'], ['text' => '👤 查询用户']],
        [['text' => '📝 用户列表'], ['text' => '🏠 房间管理']],
        [['text' => '📢 发公告']],
    ],
    'resize_keyboard' => true
];
$roomMenu = [
    'keyboard' => [
        [['text' => '➕ 创建房间'], ['text' => '❌ 删除房间']],
        [['text' => '🔙 返回主菜单']]
    ],
    'resize_keyboard' => true
];
$typeMenu = [
    'keyboard' => [
        [['text' => '普通场'], ['text' => '翻倍场']],
        [['text' => '🔙 返回房间管理']]
    ],
    'resize_keyboard' => true
];
$scoreMenu = [
    'keyboard' => [
        [['text' => '1分'], ['text' => '2分']],
        [['text' => '5分'], ['text' => '10分']],
        [['text' => '🔙 返回房间管理']]
    ],
    'resize_keyboard' => true
];

// ========== 工具函数 ==========
function sendMessage($chat_id, $text, $reply_markup = null) {
    $data = [
        'chat_id' => $chat_id,
        'text' => $text,
        'parse_mode' => 'HTML'
    ];
    if ($reply_markup) $data['reply_markup'] = json_encode($reply_markup, JSON_UNESCAPED_UNICODE);
    file_get_contents(API . 'sendMessage?' . http_build_query($data));
}

function getUserState($chat_id) {
    $file = __DIR__ . "/session_{$chat_id}.json";
    if (is_file($file)) {
        return json_decode(file_get_contents($file), true) ?: [];
    }
    return [];
}
function setUserState($chat_id, $state) {
    $file = __DIR__ . "/session_{$chat_id}.json";
    file_put_contents($file, json_encode($state));
}
function clearUserState($chat_id) {
    $file = __DIR__ . "/session_{$chat_id}.json";
    @unlink($file);
}

// ========== 处理Webhook ==========
$update = json_decode(file_get_contents('php://input'), true);
$message = $update['message'] ?? [];
$chat_id = $message['chat']['id'] ?? 0;
$text = trim($message['text'] ?? '');

if (!$chat_id) exit();

$user_state = getUserState($chat_id);

// 1. 入口/主菜单
if ($text == '/start' || $text == '🔙 返回主菜单') {
    clearUserState($chat_id);
    sendMessage($chat_id, "欢迎使用管理Bot，请选择操作：", $mainMenu);
    exit();
}

// 房间管理菜单
if ($text == '🏠 房间管理') {
    setUserState($chat_id, ['step' => 'room_menu']);
    sendMessage($chat_id, "房间管理菜单：", $roomMenu);
    exit();
}

// 创建房间流程
if (($user_state['step'] ?? '') == 'room_menu' && $text == '➕ 创建房间') {
    setUserState($chat_id, ['step' => 'create_room_type']);
    sendMessage($chat_id, "请选择房间类型：", $typeMenu);
    exit();
}
if (($user_state['step'] ?? '') == 'create_room_type' && in_array($text, ['普通场', '翻倍场'])) {
    $type = $text == '普通场' ? 'normal' : 'double';
    setUserState($chat_id, ['step' => 'create_room_score', 'type' => $type]);
    sendMessage($chat_id, "请选择底分：", $scoreMenu);
    exit();
}
if (($user_state['step'] ?? '') == 'create_room_score' && preg_match('/^(\d+)分$/', $text, $m)) {
    $score = intval($m[1]);
    $type = $user_state['type'] ?? 'normal';
    $nickname = "TG管理员";
    $post = [
        'name' => $nickname,
        'type' => $type,
        'score' => $score,
        'bot_secret' => BOT_SECRET
    ];
    $context = stream_context_create(['http' =>
        ['method' => 'POST', 'header' => "Content-Type: application/json\r\n",
         'content' => json_encode($post)]
    ]);
    $res = file_get_contents(API_BASE . 'create_room.php', false, $context);
    $data = json_decode($res, true);
    if ($data && $data['success']) {
        sendMessage($chat_id, "✅ 房间创建成功！<b>房间号: {$data['roomId']}\n类型: " . ($type=='double'?'翻倍':'普通') . " 底分: {$score}</b>", $roomMenu);
    } else {
        sendMessage($chat_id, "❌ 创建失败：" . ($data['message'] ?? '未知错误'), $roomMenu);
    }
    setUserState($chat_id, ['step' => 'room_menu']);
    exit();
}
if (in_array($text, ['🔙 返回房间管理']) || (($user_state['step'] ?? '') == 'create_room_type' && $text == '🔙 返回房间管理')) {
    setUserState($chat_id, ['step' => 'room_menu']);
    sendMessage($chat_id, "房间管理菜单：", $roomMenu);
    exit();
}

// 删除房间
if (($user_state['step'] ?? '') == 'room_menu' && $text == '❌ 删除房间') {
    setUserState($chat_id, ['step' => 'delete_room_input']);
    sendMessage($chat_id, "请输入要删除的房间号：", ['keyboard'=>[[['text'=>'🔙 返回房间管理']]],'resize_keyboard'=>true]);
    exit();
}
if (($user_state['step'] ?? '') == 'delete_room_input' && preg_match('/^[a-f0-9]{6}$/i', $text)) {
    $post = ['room_id'=>$text, 'bot_secret'=>BOT_SECRET];
    $context = stream_context_create(['http' =>
        ['method'=>'POST','header'=>"Content-Type: application/json\r\n",
        'content'=>json_encode($post)]
    ]);
    $res = file_get_contents(API_BASE . 'delete_room.php', false, $context);
    $data = json_decode($res, true);
    sendMessage($chat_id,
        $data && $data['success'] ? "已删除房间 {$text}。" : "删除失败：" . ($data['message'] ?? '未知错误'),
        $roomMenu
    );
    setUserState($chat_id, ['step' => 'room_menu']);
    exit();
}
if (($user_state['step'] ?? '') == 'delete_room_input' && $text == '🔙 返回房间管理') {
    setUserState($chat_id, ['step' => 'room_menu']);
    sendMessage($chat_id, "房间管理菜单：", $roomMenu);
    exit();
}

// ================== 其他菜单功能 ==================

// === 积分增减 ===
if ($text == '➕ 增减积分') {
    setUserState($chat_id, ['step' => 'add_points_phone']);
    sendMessage($chat_id, "请输入要操作的用户手机号：", $mainMenu);
    exit();
}
if (($user_state['step'] ?? '') == 'add_points_phone' && preg_match('/^\d{8,}$/', $text)) {
    setUserState($chat_id, ['step' => 'add_points_amount', 'phone' => $text]);
    sendMessage($chat_id, "请输入增减积分数量（正数为加，负数为减）：", $mainMenu);
    exit();
}
if (($user_state['step'] ?? '') == 'add_points_amount' && preg_match('/^-?\d+$/', $text)) {
    $phone = $user_state['phone'];
    $amount = intval($text);
    $post = ['phone'=>$phone, 'amount'=>$amount, 'bot_secret'=>BOT_SECRET];
    $context = stream_context_create(['http'=>[
        'method'=>'POST','header'=>"Content-Type: application/json\r\n",
        'content'=>json_encode($post)
    ]]);
    $res = file_get_contents(API_BASE . 'admin_points.php', false, $context);
    $data = json_decode($res, true);
    sendMessage($chat_id,
        $data && $data['success']
            ? "操作成功，{$phone} 新积分：" . $data['new_points']
            : "操作失败：" . ($data['message'] ?? '未知错误'), $mainMenu
    );
    clearUserState($chat_id);
    exit();
}

// === 查询用户 ===
if ($text == '👤 查询用户') {
    setUserState($chat_id, ['step' => 'query_user_phone']);
    sendMessage($chat_id, "请输入要查询的手机号：", $mainMenu);
    exit();
}
if (($user_state['step'] ?? '') == 'query_user_phone' && preg_match('/^\d{8,}$/', $text)) {
    $post = ['phone'=>$text];
    $context = stream_context_create(['http'=>[
        'method'=>'POST','header'=>"Content-Type: application/json\r\n",
        'content'=>json_encode($post)
    ]]);
    $res = file_get_contents(API_BASE . 'find_user.php', false, $context);
    $data = json_decode($res, true);
    if ($data && $data['success']) {
        $u = $data['user'];
        sendMessage($chat_id, "昵称：{$u['nickname']}\n手机号：{$u['phone']}\n积分：{$u['points']}", $mainMenu);
    } else {
        sendMessage($chat_id, "查找失败：" . ($data['message'] ?? '未知错误'), $mainMenu);
    }
    clearUserState($chat_id);
    exit();
}

// === 用户列表 ===
if ($text == '📝 用户列表') {
    $post = ['bot_secret'=>BOT_SECRET];
    $context = stream_context_create(['http'=>[
        'method'=>'POST','header'=>"Content-Type: application/json\r\n",
        'content'=>json_encode($post)
    ]]);
    $res = file_get_contents(API_BASE . 'admin_user_list.php', false, $context);
    $data = json_decode($res, true);
    if ($data && $data['success']) {
        $msg = "用户列表：\n";
        foreach ($data['users'] as $u) {
            $msg .= "{$u['nickname']}（{$u['phone']}）：{$u['points']}分\n";
        }
        sendMessage($chat_id, $msg, $mainMenu);
    } else {
        sendMessage($chat_id, "获取失败：" . ($data['message'] ?? '未知错误'), $mainMenu);
    }
    clearUserState($chat_id);
    exit();
}

// === 发公告 ===
if ($text == '📢 发公告') {
    setUserState($chat_id, ['step' => 'announce_input']);
    sendMessage($chat_id, "请输入公告内容：", $mainMenu);
    exit();
}
if (($user_state['step'] ?? '') == 'announce_input' && $text) {
    $post = ['bot_secret'=>BOT_SECRET, 'content'=>$text];
    $context = stream_context_create(['http'=>[
        'method'=>'POST','header'=>"Content-Type: application/json\r\n",
        'content'=>json_encode($post)
    ]]);
    $res = file_get_contents(API_BASE . 'admin_announce.php', false, $context);
    $data = json_decode($res, true);
    sendMessage($chat_id,
        $data && $data['success']
            ? "公告发布成功！"
            : "发布失败：" . ($data['message'] ?? '未知错误'),
        $mainMenu
    );
    clearUserState($chat_id);
    exit();
}

// 默认：回主菜单
sendMessage($chat_id, "未识别的操作，已回到主菜单。", $mainMenu);
clearUserState($chat_id);

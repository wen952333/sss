<?php
// ===============================
// Telegram 管理BOT主文件（Webhook）
// 支持：主菜单、房间管理（创建/删除）、类型/分数引导
// 会话状态用文件型session（如需多服务器或高并发建议用redis等）
// ===============================

define('BOT_TOKEN', '你的BotToken');
define('API', 'https://api.telegram.org/bot' . BOT_TOKEN . '/');
define('BACKEND_URL', 'https://你的域名/api/create_room.php'); // 后端创建房间接口
define('BOT_SECRET', 'your_bot_secret'); // 后端校验密钥

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

// ========== 读取和保存用户状态 ==========
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

// 2. 房间管理菜单
if ($text == '🏠 房间管理') {
    setUserState($chat_id, ['step' => 'room_menu']);
    sendMessage($chat_id, "房间管理菜单：", $roomMenu);
    exit();
}

// 3. 创建房间流程
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
    // 调用后端接口创建房间
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
    $res = file_get_contents(BACKEND_URL, false, $context);
    $data = json_decode($res, true);
    if ($data && $data['success']) {
        sendMessage($chat_id, "✅ 房间创建成功！<b>房间号: {$data['roomId']}\n类型: " . ($type=='double'?'翻倍':'普通') . " 底分: {$score}</b>", $roomMenu);
    } else {
        sendMessage($chat_id, "❌ 创建失败：" . ($data['message'] ?? '未知错误'), $roomMenu);
    }
    setUserState($chat_id, ['step' => 'room_menu']);
    exit();
}
if (in_array($text, ['🔙 返回房间管理']) || ($user_state['step'] ?? '') == 'create_room_type' && $text == '🔙 返回房间管理') {
    setUserState($chat_id, ['step' => 'room_menu']);
    sendMessage($chat_id, "房间管理菜单：", $roomMenu);
    exit();
}

// 4. 删除房间流程（仅演示，实际应从后端拉取可删除房间列表，可扩展为 InlineKeyboard 分页选择）
if (($user_state['step'] ?? '') == 'room_menu' && $text == '❌ 删除房间') {
    // 示例：弹出输入房间号
    setUserState($chat_id, ['step' => 'delete_room_input']);
    sendMessage($chat_id, "请输入要删除的房间号：", ['keyboard'=>[[['text'=>'🔙 返回房间管理']]],'resize_keyboard'=>true]);
    exit();
}
if (($user_state['step'] ?? '') == 'delete_room_input' && preg_match('/^[a-f0-9]{6}$/i', $text)) {
    // 实际应调用后端删除房间接口
    // $delete_res = file_get_contents(...);
    // 假设成功
    sendMessage($chat_id, "已请求删除房间 {$text}。", $roomMenu);
    setUserState($chat_id, ['step' => 'room_menu']);
    exit();
}
if (($user_state['step'] ?? '') == 'delete_room_input' && $text == '🔙 返回房间管理') {
    setUserState($chat_id, ['step' => 'room_menu']);
    sendMessage($chat_id, "房间管理菜单：", $roomMenu);
    exit();
}

// =====================
// 其他菜单功能请自行补充：
// ➕ 增减积分、👤 查询用户、📝 用户列表、📢 发公告等，与房间管理流程一致
// =====================

// 默认：回主菜单
sendMessage($chat_id, "未识别的操作，已回到主菜单。", $mainMenu);
clearUserState($chat_id);

<?php
// backend/includes/config.php
define('CARD_RANKS', ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']);
define('CARD_SUITS', ['C', 'D', 'H', 'S']); // Clubs, Diamonds, Hearts, Spades

// 数值映射，用于比较大小
define('RANK_VALUES', [
    '2' => 2, '3' => 3, '4' => 4, '5' => 5, '6' => 6, '7' => 7, '8' => 8, '9' => 9,
    'T' => 10, 'J' => 11, 'Q' => 12, 'K' => 13, 'A' => 14
]);

// 花色映射，用于图片文件名等
define('SUIT_NAMES', [
    'C' => 'clubs',
    'D' => 'diamonds',
    'H' => 'hearts',
    'S' => 'spades'
]);

// 牌型强度 (值越大越强) - 请根据你的十三水规则细化和调整
define('HAND_TYPE_STRENGTH', [
    'HIGH_CARD' => 1,
    'PAIR' => 2,
    'TWO_PAIR' => 3,
    'THREE_OF_A_KIND' => 4,
    'STRAIGHT' => 5,
    'FLUSH' => 6,
    'FULL_HOUSE' => 7,
    'FOUR_OF_A_KIND' => 8,
    'STRAIGHT_FLUSH' => 9,
    // 十三水特殊牌型 (比普通牌型强，但内部也有顺序)
    'THIRTEEN_WATER_SPECIAL_BASE' => 100, // 基础值，用于区分
    'THREE_FLUSHES' => 101, // 示例：三同花
    'THREE_STRAIGHTS' => 102, // 示例：三顺子
    'SIX_PAIRS_PLUS' => 103,  // 六对半
    'DRAGON' => 104,          // 一条龙 (A-K杂顺)
    'ROYAL_DRAGON' => 105,    // 至尊清龙 (A-K同花顺)
    // 根据需要添加更多特殊牌型及其强度值
]);

// 墩的名称
define('HAND_SEGMENTS', ['front', 'middle', 'back']);

// CORS 设置
// 在生产环境中，应该严格限制为你的前端域名
$allowed_origin = "https://ss.wenge.ip-ddns.com"; // 你的前端域名
// 对于开发或测试，有时会用 '*'，但不推荐用于生产
// $allowed_origin = "*"; 

header("Access-Control-Allow-Origin: " . $allowed_origin);
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // 确保 OPTIONS 被允许
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With"); // 允许的请求头
header("Content-Type: application/json; charset=UTF-8"); // 默认响应类型

// 处理 OPTIONS 预检请求
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200); // 必须返回200 OK
    exit();
}
?>

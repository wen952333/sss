<?php
/**
 * 统一自动超时踢人和理牌工具
 * 用法: require_once '_timeout_helper.php'; handleTimeoutsAndAutoPlay($roomId, $pdo);
 * 要求players表有 join_time, deal_time, finish_time 字段，cards字段存13张，submitted字段标记是否已理牌
 */
function handleTimeoutsAndAutoPlay($roomId, $pdo) {
    $now = time();
    $players = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($players as $p) {
        // 1. 未准备超时踢出（入场超45秒、局后未准备超45秒）
        if (!$p['submitted'] && isset($p['join_time']) && strtotime($p['join_time']) + 45 < $now) {
            $pdo->prepare("DELETE FROM players WHERE id=?")->execute([$p['id']]);
            continue;
        }
        if ($p['submitted'] && isset($p['finish_time']) && strtotime($p['finish_time']) + 45 < $now) {
            $pdo->prepare("DELETE FROM players WHERE id=?")->execute([$p['id']]);
            continue;
        }
        // 2. 理牌超时自动提交（发牌后180秒未理牌）
        if (isset($p['deal_time']) && !$p['submitted'] && strtotime($p['deal_time']) + 180 < $now) {
            $cards = json_decode($p['cards'], true);
            if (is_array($cards) && count($cards) === 13) {
                $head = array_slice($cards, 0, 3);
                $middle = array_slice($cards, 3, 8);
                $tail = array_slice($cards, 8, 13);
                $autoCards = array_merge($head, $middle, $tail);
                $pdo->prepare("UPDATE players SET cards=?, submitted=1 WHERE id=?")
                    ->execute([json_encode($autoCards), $p['id']]);
            }
        }
    }
}
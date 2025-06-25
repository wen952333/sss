<?php
// 十三水游戏工具：洗牌、发牌、比牌（极简版），供api.php调用

function make_deck() {
    $suits = ['C', 'D', 'H', 'S']; // 梅花, 方块, 红桃, 黑桃
    $ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    $deck = [];
    foreach ($suits as $suit) {
        foreach ($ranks as $rank) {
            $deck[] = $rank . $suit;
        }
    }
    shuffle($deck);
    return $deck;
}

// 生成每人13张牌，返回二维数组
function deal_cards($player_count) {
    $deck = make_deck();
    $cards = [];
    for ($i = 0; $i < $player_count; $i++) {
        $cards[$i] = array_splice($deck, 0, 13);
    }
    return $cards;
}

// 极简比牌（仅按牌面点数总和判定，实际十三水应分类型比牌，可再完善）
function compare_hands($hands) {
    // hands: [ [牌1,牌2,...], ... ]
    $scores = [];
    foreach ($hands as $i => $hand) {
        $score = 0;
        foreach ($hand as $card) {
            $rank = substr($card, 0, -1);
            if ($rank == 'A') $score += 14;
            elseif ($rank == 'K') $score += 13;
            elseif ($rank == 'Q') $score += 12;
            elseif ($rank == 'J') $score += 11;
            else $score += intval($rank);
        }
        $scores[$i] = $score;
    }
    // 最高分胜，平分无奖励
    $max = max($scores);
    $winners = [];
    foreach ($scores as $i => $s) {
        if ($s == $max) $winners[] = $i;
    }
    return $winners;
}

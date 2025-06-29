<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$roomId = $data['roomId'];
$token = $data['token'];
$cards = $data['cards'];

$user = verifyToken($token);
if (!$user || $user['roomId'] !== $roomId) die(json_encode(['success'=>false, 'code'=>401]));

$pdo = getDb();
$pdo->prepare("UPDATE players SET cards=?, submitted=1 WHERE room_id=? AND name=?")
    ->execute([json_encode($cards), $roomId, $user['name']]);

// 检查是否全部玩家都提交，则结算
$all = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll();
$allSubmitted = true;
foreach ($all as $p) if (!$p['submitted']) $allSubmitted = false;

if ($allSubmitted) {
  // 获取房间类型和底分
  $room = $pdo->query("SELECT * FROM rooms WHERE room_id='$roomId'")->fetch();
  $baseScore = intval($room['score'] ?? 1);
  $multiplier = ($room['type'] ?? 'normal') === 'double' ? 2 : 1;
  $mult = $baseScore * $multiplier;

  // 1. 读取所有玩家三道
  $playerData = [];
  foreach ($all as $p) {
    $c = json_decode($p['cards'], true);
    if (!is_array($c) || count($c) != 13) continue;
    $head = array_slice($c,0,3);
    $middle = array_slice($c,3,5);
    $tail = array_slice($c,8,5);
    $isFoul = isFoul($head, $middle, $tail);
    $special = $isFoul ? null : getSpecialType($head, $middle, $tail, $c);
    $playerData[] = [
      'id' => $p['id'],
      'name' => $p['name'],
      'head' => $head,
      'middle' => $middle,
      'tail' => $tail,
      'isFoul' => $isFoul,
      'special' => $special,
      'score' => 0,
    ];
  }
  $N = count($playerData);

  // 核心极简新规则（完全同步sssScore.js）
  for ($i = 0; $i < $N; ++$i) {
    for ($j = $i + 1; $j < $N; ++$j) {
      $p1 = &$playerData[$i];
      $p2 = &$playerData[$j];
      $pairScore = 0;

      // 1. 倒水判定
      if ($p1['isFoul'] && !$p2['isFoul']) {
        $pairScore = -calculateTotalBaseScore($p2);
      } else if (!$p1['isFoul'] && $p2['isFoul']) {
        $pairScore = calculateTotalBaseScore($p1);
      } else if ($p1['isFoul'] && $p2['isFoul']) {
        $pairScore = 0;
      }
      // 2. 特殊牌型处理
      else if ($p1['special'] && $p2['special']) {
        $pairScore = 0;
      } else if ($p1['special'] && !$p2['special']) {
        $pairScore = specialScore($p1['special']);
      } else if (!$p1['special'] && $p2['special']) {
        $pairScore = -specialScore($p2['special']);
      }
      // 3. 普通三道比牌
      else {
        $areas = ['head','middle','tail'];
        foreach ($areas as $area) {
          $cmp = compareArea($p1[$area], $p2[$area], $area);
          if ($cmp > 0) {
            $pairScore += getAreaScore($p1[$area], $area);
          } else if ($cmp < 0) {
            $pairScore -= getAreaScore($p2[$area], $area);
          }
        }
      }
      $p1['score'] += $pairScore * $mult;
      $p2['score'] -= $pairScore * $mult;
    }
  }

  // 写回每人得分
  foreach ($playerData as $p) {
    $pdo->prepare("UPDATE players SET result=? WHERE id=?")
        ->execute([json_encode([['name'=>$p['name'],'score'=>$p['score'],'isFoul'=>$p['isFoul']]]), $p['id']]);
  }
}
echo json_encode(['success'=>true]);

// ================== 工具函数（完全等价sssScore.js） =====================

// 计算三道基础分
function calculateTotalBaseScore($p) {
  if ($p['special']) return specialScore($p['special']);
  return getAreaScore($p['head'], 'head') + getAreaScore($p['middle'], 'middle') + getAreaScore($p['tail'], 'tail');
}

// 倒水判定
function isFoul($head, $middle, $tail) {
  $headRank = areaTypeRank(getAreaType($head, 'head'), 'head');
  $midRank = areaTypeRank(getAreaType($middle, 'middle'), 'middle');
  $tailRank = areaTypeRank(getAreaType($tail, 'tail'), 'tail');
  if ($headRank > $midRank || $midRank > $tailRank) return true;
  if ($headRank == $midRank && compareArea($head, $middle, 'head') > 0) return true;
  if ($midRank == $tailRank && compareArea($middle, $tail, 'middle') > 0) return true;
  return false;
}

// 特殊牌型判定
function getSpecialType($head, $middle, $tail, $all) {
  $midType = getAreaType($middle, 'middle');
  $tailType = getAreaType($tail, 'tail');
  if (in_array($midType, ['铁支', '同花顺']) || in_array($tailType, ['铁支', '同花顺'])) return null;

  $uniqVals = [];
  foreach ($all as $c) $uniqVals[explode('_', $c)[0]] = 1;
  if (count($uniqVals) === 13) return '一条龙';

  $grouped = getGroupedValues($all);
  if (isset($grouped[2]) && count($grouped[2]) === 6 && !isset($grouped[3]) && !isset($grouped[4])) return '六对半';

  if (isFlush($head) && isFlush($middle) && isFlush($tail)) return '三同花';
  if (isStraight($head) && isStraight($middle) && isStraight($tail)) return '三顺子';
  return null;
}

function specialScore($type) {
  switch($type) {
    case '一条龙': return 13;
    case '三同花': return 4;
    case '三顺子': return 4;
    case '六对半': return 3;
    default: return 0;
  }
}

// 牌型
function getAreaType($cards, $area) {
  $vals = []; $suits = [];
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  foreach($cards as $c){ $parts=explode('_',$c); $vals[]=$order[$parts[0]]; $suits[]=$parts[2]; }
  $cnt = array_count_values($vals);
  if ($area=='head') {
    if (max($cnt)==3) return "三条";
    if (max($cnt)==2) return "对子";
    return "高牌";
  }
  if (max($cnt)==4) return "铁支";
  if (count(array_unique($suits))==1 && isStraight2($vals)) return "同花顺";
  if (in_array(3,$cnt) && in_array(2,$cnt)) return "葫芦";
  if (count(array_unique($suits))==1) return "同花";
  if (isStraight2($vals)) return "顺子";
  if (in_array(3,$cnt)) return "三条";
  if (count(array_keys($cnt,2))==2) return "两对";
  if (in_array(2,$cnt)) return "对子";
  return "高牌";
}

function areaTypeRank($type, $area) {
  if ($area=='head') {
    if ($type=="三条") return 4;
    if ($type=="对子") return 2;
    return 1;
  }
  if ($type=="同花顺") return 9;
  if ($type=="铁支") return 8;
  if ($type=="葫芦") return 7;
  if ($type=="同花") return 6;
  if ($type=="顺子") return 5;
  if ($type=="三条") return 4;
  if ($type=="两对") return 3;
  if ($type=="对子") return 2;
  if ($type=="高牌") return 1;
  return 0;
}

// 计分
function getAreaScore($cards, $area) {
  $type = getAreaType($cards, $area);
  if ($area=='head') {
    if ($type=="三条") return 3;
    return 1;
  }
  if ($area=='middle') {
    if ($type=="铁支") return 8;
    if ($type=="同花顺") return 10;
    if ($type=="葫芦") return 2;
    return 1;
  }
  if ($area=='tail') {
    if ($type=="铁支") return 4;
    if ($type=="同花顺") return 5;
    return 1;
  }
  return 1;
}

// 顺子
function isStraight($cards) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $vals=[];
  foreach($cards as $c) $vals[] = $order[explode('_',$c)[0]];
  $vals = array_unique($vals);
  sort($vals);
  if (count($vals) !== count($cards)) return false;
  $isA2345 = ($vals == [2,3,4,5,14]);
  $isNormalStraight = ($vals[count($vals)-1] - $vals[0] === count($vals)-1);
  return $isNormalStraight || $isA2345;
}
function isStraight2($vals) {
  sort($vals);
  if (count(array_unique($vals))!=count($vals)) return false;
  if ($vals[count($vals)-1]-$vals[0]==count($vals)-1) return true;
  if ($vals==[2,3,4,5,14]) return true;
  return false;
}
function isFlush($cards) {
  if (!is_array($cards) || count($cards)==0) return false;
  $suit = explode('_', $cards[0])[2];
  foreach($cards as $c) if (explode('_',$c)[2] != $suit) return false;
  return true;
}

function getGroupedValues($cards) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $counts = [];
  foreach($cards as $c) {
    $val = $order[explode('_',$c)[0]];
    if (!isset($counts[$val])) $counts[$val]=0;
    $counts[$val]++;
  }
  $groups = [];
  foreach($counts as $val=>$count) {
    if (!isset($groups[$count])) $groups[$count]=[];
    $groups[$count][]=$val;
  }
  foreach($groups as $count=>$arr) {
    rsort($groups[$count]);
  }
  return $groups;
}

// 花色权重
function suitWeight($s) {
  switch($s) {
    case "spades": return 4;
    case "hearts": return 3;
    case "clubs": return 2;
    case "diamonds": return 1;
    default: return 0;
  }
}

// 区域比牌
function compareArea($a, $b, $area) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $typeA = getAreaType($a, $area);
  $typeB = getAreaType($b, $area);
  $rankA = areaTypeRank($typeA, $area);
  $rankB = areaTypeRank($typeB, $area);
  if ($rankA != $rankB) return $rankA > $rankB ? 1 : -1;

  $groupedA = getGroupedValues($a);
  $groupedB = getGroupedValues($b);

  switch ($typeA) {
    case '同花顺':
    case '顺子': {
      $straightRankA = getStraightRank($a);
      $straightRankB = getStraightRank($b);
      if ($straightRankA != $straightRankB) return $straightRankA > $straightRankB ? 1 : -1;
      break;
    }
    case '铁支':
    case '葫芦':
    case '三条': {
      $mainA = isset($groupedA[4]) ? $groupedA[4][0] : (isset($groupedA[3]) ? $groupedA[3][0] : null);
      $mainB = isset($groupedB[4]) ? $groupedB[4][0] : (isset($groupedB[3]) ? $groupedB[3][0] : null);
      if ($mainA != $mainB) return $mainA > $mainB ? 1 : -1;
      if ($typeA == '葫芦') {
        $secA = isset($groupedA[2][0]) ? $groupedA[2][0] : 0;
        $secB = isset($groupedB[2][0]) ? $groupedB[2][0] : 0;
        if ($secA != $secB) return $secA > $secB ? 1 : -1;
      }
      break;
    }
    case '两对': {
      $pairsA = $groupedA[2];
      $pairsB = $groupedB[2];
      if ($pairsA[0] != $pairsB[0]) return $pairsA[0] > $pairsB[0] ? 1 : -1;
      if ($pairsA[1] != $pairsB[1]) return $pairsA[1] > $pairsB[1] ? 1 : -1;
      break;
    }
  }

  $sortedA = sortCards($a);
  $sortedB = sortCards($b);
  for ($i = 0; $i < count($a); ++$i) {
    if ($sortedA[$i]['value'] != $sortedB[$i]['value']) return $sortedA[$i]['value'] > $sortedB[$i]['value'] ? 1 : -1;
  }
  for ($i = 0; $i < count($a); ++$i) {
    if ($sortedA[$i]['suit'] != $sortedB[$i]['suit']) return $sortedA[$i]['suit'] > $sortedB[$i]['suit'] ? 1 : -1;
  }
  return 0;
}

function getStraightRank($cards) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $vals = [];
  foreach($cards as $c) $vals[] = $order[explode('_',$c)[0]];
  $vals = array_unique($vals);
  sort($vals);
  if (in_array(14,$vals) && in_array(13,$vals)) return 14;
  if (in_array(14,$vals) && in_array(2,$vals)) return 13.5;
  return $vals[count($vals)-1];
}

function sortCards($cards) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $suitOrder = ['spades'=>4,'hearts'=>3,'clubs'=>2,'diamonds'=>1];
  $out = [];
  foreach($cards as $c) {
    $parts = explode('_', $c);
    $out[] = [ 'value'=>$order[$parts[0]], 'suit'=>$suitOrder[$parts[2]] ];
  }
  usort($out, function($a,$b){ if($a['value']!=$b['value']) return $b['value']-$a['value']; return $b['suit']-$a['suit']; });
  return $out;
}

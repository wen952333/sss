<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';
header('Content-Type: application/json');

/**
 * 2024-06-29 十三水后端结算，完全同步前端 sssScore.js 规则
 * 1. 牌型顺序(大到小): 同花顺 > 铁支 > 葫芦 > 同花 > 顺子 > 三条 > 两对 > 对子 > 高牌
 * 2. 特殊型支持：一条龙、三同花、三顺子、六对半
 * 3. 无平局，花色决定胜负（黑桃>红桃>梅花>方块）
 * 4. 倒水：严格三道递增
 * 5. 三道计分与特殊分完全一致
 */

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
  $playerData = [];
  foreach ($all as $p) {
    $c = json_decode($p['cards'], true);
    if (!is_array($c) || count($c) != 13) continue;
    $head = array_slice($c,0,3);
    $middle = array_slice($c,3,5);
    $tail = array_slice($c,8,5);
    $foul = isFoul($head, $middle, $tail);
    $special = $foul ? null : getSpecialType($head, $middle, $tail, $c);
    $playerData[] = [
      'id' => $p['id'],
      'name' => $p['name'],
      'head' => $head,
      'middle' => $middle,
      'tail' => $tail,
      'isFoul' => $foul,
      'special' => $special,
      'score' => 0,
    ];
  }
  $N = count($playerData);
  for ($i = 0; $i < $N; ++$i) {
    for ($j = $i + 1; $j < $N; ++$j) {
      $p1 = &$playerData[$i];
      $p2 = &$playerData[$j];
      $pairScore = 0;
      // 倒水
      if ($p1['isFoul'] && !$p2['isFoul']) {
        $pairScore = -calculateTotalBaseScore($p2);
      } else if (!$p1['isFoul'] && $p2['isFoul']) {
        $pairScore = calculateTotalBaseScore($p1);
      } else if ($p1['isFoul'] && $p2['isFoul']) {
        $pairScore = 0;
      }
      // 特殊型
      else if ($p1['special'] && $p2['special']) {
        $pairScore = 0;
      } else if ($p1['special'] && !$p2['special']) {
        $pairScore = specialScore($p1['special']);
      } else if (!$p1['special'] && $p2['special']) {
        $pairScore = -specialScore($p2['special']);
      }
      // 普通三道
      else {
        foreach (['head','middle','tail'] as $area) {
          $cmp = compareArea($p1[$area], $p2[$area], $area);
          if ($cmp > 0) $pairScore += getAreaScore($p1[$area], $area);
          else if ($cmp < 0) $pairScore -= getAreaScore($p2[$area], $area);
        }
      }
      $p1['score'] += $pairScore;
      $p2['score'] -= $pairScore;
    }
  }
  // 写回
  foreach ($playerData as $p) {
    $pdo->prepare("UPDATE players SET result=? WHERE id=?")
        ->execute([json_encode([['name'=>$p['name'],'score'=>$p['score'],'isFoul'=>$p['isFoul']]]), $p['id']]);
  }
}
echo json_encode(['success'=>true]);

// =============== 规则工具函数 ===============

// 常量
function suitWeight($s) {
  switch($s) {
    case "spades": return 4;
    case "hearts": return 3;
    case "clubs": return 2;
    case "diamonds": return 1;
    default: return 0;
  }
}
function valueOrder($v) {
  static $o = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  return $o[$v];
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
  return 1;
}

function getAreaType($cards, $area) {
  $vals = []; $suits = [];
  foreach($cards as $c){ $parts=explode('_',$c); $vals[]=valueOrder($parts[0]); $suits[]=$parts[2]; }
  $cnt = array_count_values($vals);
  if (count($cards) == 3) {
    if (max($cnt)==3) return "三条";
    if (max($cnt)==2) return "对子";
    return "高牌";
  }
  if (count(array_unique($suits))==1 && isStraightVals($vals)) return "同花顺";
  if (max($cnt)==4) return "铁支";
  if (in_array(3,$cnt) && in_array(2,$cnt)) return "葫芦";
  if (count(array_unique($suits))==1) return "同花";
  if (isStraightVals($vals)) return "顺子";
  if (in_array(3,$cnt)) return "三条";
  if (count(array_keys($cnt,2))==2) return "两对";
  if (in_array(2,$cnt)) return "对子";
  return "高牌";
}
function isStraightVals($vals) {
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
function isStraight($cards) {
  $vals = [];
  foreach($cards as $c) $vals[]=valueOrder(explode('_',$c)[0]);
  return isStraightVals($vals);
}
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
function specialScore($type) {
  switch($type) {
    case '一条龙': return 13;
    case '三同花': return 4;
    case '三顺子': return 4;
    case '六对半': return 3;
    default: return 0;
  }
}
function calculateTotalBaseScore($p) {
  if ($p['special']) return specialScore($p['special']);
  return getAreaScore($p['head'], 'head') + getAreaScore($p['middle'], 'middle') + getAreaScore($p['tail'], 'tail');
}
function isFoul($head, $middle, $tail) {
  $headRank = areaTypeRank(getAreaType($head, 'head'), 'head');
  $midRank = areaTypeRank(getAreaType($middle, 'middle'), 'middle');
  $tailRank = areaTypeRank(getAreaType($tail, 'tail'), 'tail');
  if ($headRank > $midRank || $midRank > $tailRank) return true;
  if ($headRank == $midRank && compareArea($head, $middle, 'head') > 0) return true;
  if ($midRank == $tailRank && compareArea($middle, $tail, 'middle') > 0) return true;
  return false;
}
function getSpecialType($head, $middle, $tail, $all) {
  $midType = getAreaType($middle, 'middle');
  $tailType = getAreaType($tail, 'tail');
  if (in_array($midType, ['铁支', '同花顺']) || in_array($tailType, ['铁支', '同花顺'])) return null;

  // 一条龙
  $uniqVals = [];
  foreach ($all as $c) $uniqVals[explode('_', $c)[0]] = 1;
  if (count($uniqVals) === 13) return '一条龙';

  // 六对半
  $cnt = [];
  foreach ($all as $c) $cnt[explode('_', $c)[0]] = ($cnt[explode('_', $c)[0]]??0)+1;
  if (count(array_keys($cnt,2))==6 && !in_array(3,$cnt) && !in_array(4,$cnt)) return '六对半';

  // 三同花
  if (isFlush($head) && isFlush($middle) && isFlush($tail)) return '三同花';

  // 三顺子
  if (isStraight($head) && isStraight($middle) && isStraight($tail)) return '三顺子';

  return null;
}
function compareArea($a, $b, $area) {
  $typeA = getAreaType($a, $area);
  $typeB = getAreaType($b, $area);
  $rankA = areaTypeRank($typeA, $area);
  $rankB = areaTypeRank($typeB, $area);
  if ($rankA !== $rankB) return $rankA - $rankB;

  // ---- 牌型相同时，比主点数/花色/副牌 ----
  $groupA = getGroupedValues($a);
  $groupB = getGroupedValues($b);

  // 顺子/同花顺先比最大点
  if ($typeA=='顺子'||$typeA=='同花顺') {
    $maxA = getStraightRank($a);
    $maxB = getStraightRank($b);
    if ($maxA != $maxB) return $maxA-$maxB;
  }
  // 铁支/三条/对子比主点,再比副
  if (in_array($typeA,['铁支','三条','对子'])) {
    $mainA = $groupA[$typeA=='铁支'?4:($typeA=='三条'?3:2)][0];
    $mainB = $groupB[$typeA=='铁支'?4:($typeA=='三条'?3:2)][0];
    if ($mainA != $mainB) return $mainA-$mainB;
    $subA = [];
    foreach($a as $c){ $v=valueOrder(explode('_',$c)[0]); if ($v!=$mainA) $subA[]=$v; }
    $subB = [];
    foreach($b as $c){ $v=valueOrder(explode('_',$c)[0]); if ($v!=$mainB) $subB[]=$v; }
    rsort($subA); rsort($subB);
    for($i=0;$i<count($subA);++$i) if ($subA[$i]!=$subB[$i]) return $subA[$i]-$subB[$i];
    return 0;
  }
  // 葫芦
  if ($typeA=='葫芦') {
    $tA=$groupA[3][0]; $tB=$groupB[3][0];
    if ($tA!=$tB) return $tA-$tB;
    $pA=$groupA[2][0]; $pB=$groupB[2][0];
    if ($pA!=$pB) return $pA-$pB;
    return 0;
  }
  // 两对
  if ($typeA=='两对') {
    $pairsA = $groupA[2]; $pairsB = $groupB[2];
    if ($pairsA[0]!=$pairsB[0]) return $pairsA[0]-$pairsB[0];
    if ($pairsA[1]!=$pairsB[1]) return $pairsA[1]-$pairsB[1];
    $subA = isset($groupA[1]) ? $groupA[1][0] : 0;
    $subB = isset($groupB[1]) ? $groupB[1][0] : 0;
    if ($subA != $subB) return $subA-$subB;
    return 0;
  }
  // 同花
  if ($typeA=='同花') {
    $valsA = [];
    foreach($a as $c) $valsA[]=valueOrder(explode('_',$c)[0]);
    $valsB = [];
    foreach($b as $c) $valsB[]=valueOrder(explode('_',$c)[0]);
    rsort($valsA); rsort($valsB);
    for($i=0;$i<count($valsA);++$i) if ($valsA[$i]!=$valsB[$i]) return $valsA[$i]-$valsB[$i];
    return 0;
  }
  // 其它高牌
  $valsA = [];
  foreach($a as $c) $valsA[]=valueOrder(explode('_',$c)[0]);
  $valsB = [];
  foreach($b as $c) $valsB[]=valueOrder(explode('_',$c)[0]);
  rsort($valsA); rsort($valsB);
  for($i=0;$i<count($valsA);++$i) if ($valsA[$i]!=$valsB[$i]) return $valsA[$i]-$valsB[$i];
  // 花色
  $suitsA = [];
  foreach($a as $c) $suitsA[]=suitWeight(explode('_',$c)[2]);
  $suitsB = [];
  foreach($b as $c) $suitsB[]=suitWeight(explode('_',$c)[2]);
  rsort($suitsA); rsort($suitsB);
  for($i=0;$i<count($suitsA);++$i) if ($suitsA[$i]!=$suitsB[$i]) return $suitsA[$i]-$suitsB[$i];
  return 0;
}
function getGroupedValues($cards) {
  $cnt = [];
  foreach($cards as $c) {
    $v = valueOrder(explode('_',$c)[0]);
    if (!isset($cnt[$v])) $cnt[$v]=0;
    $cnt[$v]++;
  }
  $groups = [];
  foreach($cnt as $val=>$count) {
    if (!isset($groups[$count])) $groups[$count]=[];
    $groups[$count][]=$val;
  }
  foreach($groups as $count=>$arr) rsort($groups[$count]);
  return $groups;
}
function getStraightRank($cards) {
  $vals = [];
  foreach($cards as $c) $vals[]=valueOrder(explode('_',$c)[0]);
  sort($vals);
  if ($vals==[10,11,12,13,14]) return 14.9; // 最大
  if ($vals==[2,3,4,5,14]) return 5.5; // 第二大
  if ($vals==[9,10,11,12,13]) return 13;
  if ($vals==[8,9,10,11,12]) return 12;
  return max($vals);
}
?>

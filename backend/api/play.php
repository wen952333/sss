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
  $room = $pdo->query("SELECT * FROM rooms WHERE room_id='$roomId'")->fetch();
  $baseScore = intval($room['score'] ?? 1);
  $multiplier = ($room['type'] ?? 'normal') === 'double' ? 2 : 1;
  $mult = $baseScore * $multiplier;

  // 构造所有玩家三道
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

  for ($i = 0; $i < $N; ++$i) {
    for ($j = $i + 1; $j < $N; ++$j) {
      $p1 = &$playerData[$i];
      $p2 = &$playerData[$j];
      $pairScore = 0;
      // 倒水
      if ($p1['isFoul'] && !$p2['isFoul']) $pairScore = -calculateTotalBaseScore($p2);
      else if (!$p1['isFoul'] && $p2['isFoul']) $pairScore = calculateTotalBaseScore($p1);
      else if ($p1['isFoul'] && $p2['isFoul']) $pairScore = 0;
      else if ($p1['special'] && $p2['special']) $pairScore = 0;
      else if ($p1['special'] && !$p2['special']) $pairScore = specialScore($p1['special']);
      else if (!$p1['special'] && $p2['special']) $pairScore = -specialScore($p2['special']);
      else {
        $areas = ['head','middle','tail'];
        foreach ($areas as $area) {
          $cmp = compareArea($p1[$area], $p2[$area], $area);
          if ($cmp > 0) $pairScore += getAreaScore($p1[$area], $area);
          else if ($cmp < 0) $pairScore -= getAreaScore($p2[$area], $area);
        }
      }
      $p1['score'] += $pairScore;
      $p2['score'] -= $pairScore;
    }
  }

  // 写回每人得分
  foreach ($playerData as $p) {
    $pdo->prepare("UPDATE players SET result=? WHERE id=?")
        ->execute([json_encode([['name'=>$p['name'],'score'=>$p['score'],'isFoul'=>$p['isFoul']]]), $p['id']]);
  }
}
echo json_encode(['success'=>true]);

// ==== 工具函数 ====
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
  if ($type=="铁支") return 8;
  if ($type=="同花顺") return 7;
  if ($type=="葫芦") return 6;
  if ($type=="同花") return 5;
  if ($type=="顺子") return 4;
  if ($type=="三条") return 3;
  if ($type=="两对") return 2;
  if ($type=="对子") return 1;
  return 0;
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
function compareArea($a, $b, $area) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $typeA = getAreaType($a, $area);
  $typeB = getAreaType($b, $area);
  $rankA = areaTypeRank($typeA, $area);
  $rankB = areaTypeRank($typeB, $area);
  if ($rankA != $rankB) return $rankA - $rankB;
  $groupedA = getGroupedValues($a);
  $groupedB = getGroupedValues($b);

  // 对子/三条/铁支
  if (in_array($typeA, ['对子','三条','铁支'])) {
    $mainA = $groupedA[$typeA=='铁支'?4:($typeA=='三条'?3:2)][0];
    $mainB = $groupedB[$typeA=='铁支'?4:($typeA=='三条'?3:2)][0];
    if ($mainA != $mainB) return $mainA - $mainB;
    // 主花色
    $mainSuitA = maxSuit($a, $mainA);
    $mainSuitB = maxSuit($b, $mainB);
    if ($mainSuitA != $mainSuitB) return $mainSuitA - $mainSuitB;
    // 副牌点
    $subA = [];
    $subB = [];
    foreach($a as $c) { $v=$order[explode('_',$c)[0]]; if ($v!=$mainA) $subA[]=$v; }
    foreach($b as $c) { $v=$order[explode('_',$c)[0]]; if ($v!=$mainB) $subB[]=$v; }
    rsort($subA); rsort($subB);
    for($i=0;$i<count($subA);++$i) if ($subA[$i]!=$subB[$i]) return $subA[$i]-$subB[$i];
    // 副花色
    $subSuitA = [];
    $subSuitB = [];
    foreach($a as $c){ $v=$order[explode('_',$c)[0]]; if($v!=$mainA) $subSuitA[]=suitWeight(explode('_',$c)[2]); }
    foreach($b as $c){ $v=$order[explode('_',$c)[0]]; if($v!=$mainB) $subSuitB[]=suitWeight(explode('_',$c)[2]); }
    rsort($subSuitA); rsort($subSuitB);
    for($i=0;$i<count($subSuitA);++$i) if ($subSuitA[$i]!=$subSuitB[$i]) return $subSuitA[$i]-$subSuitB[$i];
    return 0;
  }
  // 两对
  if ($typeA=='两对') {
    $pairsA = $groupedA[2]; $pairsB = $groupedB[2];
    if ($pairsA[0]!=$pairsB[0]) return $pairsA[0]-$pairsB[0];
    if ($pairsA[1]!=$pairsB[1]) return $pairsA[1]-$pairsB[1];
    $subA = isset($groupedA[1]) ? $groupedA[1][0] : 0; $subB = isset($groupedB[1]) ? $groupedB[1][0] : 0;
    if ($subA!=$subB) return $subA-$subB;
    $maxPairSuitA = maxSuit($a, $pairsA[0]);
    $maxPairSuitB = maxSuit($b, $pairsB[0]);
    if ($maxPairSuitA!=$maxPairSuitB) return $maxPairSuitA-$maxPairSuitB;
    return 0;
  }
  // 葫芦
  if ($typeA=='葫芦') {
    $tripleA = $groupedA[3][0]; $tripleB = $groupedB[3][0];
    if ($tripleA!=$tripleB) return $tripleA-$tripleB;
    $pairA = $groupedA[2][0]; $pairB = $groupedB[2][0];
    if ($pairA!=$pairB) return $pairA-$pairB;
    return 0;
  }
  // 顺子/同花顺
  if ($typeA=='顺子'||$typeA=='同花顺') {
    $valsA = [];
    $valsB = [];
    foreach($a as $c) $valsA[]=$order[explode('_',$c)[0]];
    foreach($b as $c) $valsB[]=$order[explode('_',$c)[0]];
    sort($valsA); sort($valsB);
    $maxA = $valsA[count($valsA)-1]; $maxB = $valsB[count($valsB)-1];
    if ($maxA!=$maxB) return $maxA-$maxB;
    // 花色
    $suitA = explode('_',$a[0])[2];
    $suitB = explode('_',$b[0])[2];
    if (suitWeight($suitA)!=suitWeight($suitB)) return suitWeight($suitA)-suitWeight($suitB);
    return 0;
  }
  // 同花
  if ($typeA=='同花') {
    $suitA = explode('_',$a[0])[2];
    $suitB = explode('_',$b[0])[2];
    if (suitWeight($suitA)!=suitWeight($suitB)) return suitWeight($suitA)-suitWeight($suitB);
  }
  // 其它：最大单张点
  $valsA = [];
  $valsB = [];
  foreach($a as $c) $valsA[] = $order[explode('_',$c)[0]];
  foreach($b as $c) $valsB[] = $order[explode('_',$c)[0]];
  rsort($valsA); rsort($valsB);
  for($i=0;$i<count($valsA);++$i) if ($valsA[$i]!=$valsB[$i]) return $valsA[$i]-$valsB[$i];
  // 花色
  $suitsA = [];
  $suitsB = [];
  foreach($a as $c) $suitsA[] = suitWeight(explode('_',$c)[2]);
  foreach($b as $c) $suitsB[] = suitWeight(explode('_',$c)[2]);
  rsort($suitsA); rsort($suitsB);
  for($i=0;$i<count($suitsA);++$i) if ($suitsA[$i]!=$suitsB[$i]) return $suitsA[$i]-$suitsB[$i];
  return 0;
}
function maxSuit($cards, $mainVal) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $max = 0;
  foreach($cards as $c) {
    $parts = explode('_', $c);
    if ($order[$parts[0]]==$mainVal) $max = max($max, suitWeight($parts[2]));
  }
  return $max;
}
function suitWeight($s) {
  switch($s) {
    case "spades": return 4;
    case "hearts": return 3;
    case "clubs": return 2;
    case "diamonds": return 1;
    default: return 0;
  }
}

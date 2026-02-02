
// --- 矢メッセージ簡素化ヘルパー ---
function isSpecialArrowKind(kind){
  return ['bomb','bomb3','cone3','pierce','line','sleep','stop','warp','ignite','slow','stun'].includes(kind);
}
function pickupArrowMsg(kind){
  return isSpecialArrowKind(kind) ? '矢束を拾った（ランダム効果）' : '矢束を拾った';
}
function loadArrowMsg(cnt){
  return `矢を装填した（${cnt}）`;
}
function refillArrowMsg(cnt){
  return `矢を補充（${cnt}）`;
}


// === DOTSTRIKE tuning (drop rates / clutch bonus) ===
// Normal drops were too frequent; base is now 20%.
// "Clutch" triggers on near-miss with enemy bullets (grazing), boosts score + drop chance temporarily.
const DOTSTRIKE_TUNING = {
  drop: {
    baseNormal: 0.20,     // per normal enemy kill
    baseBoss:   0.85,     // per boss kill
  },
  clutch: {
    step: 0.30,           // +30% per near-miss stack
    max:  1.00,           // up to +100%
    windowSec: 1.20,      // stack window (easier)
    durSec: 4.20,         // bonus duration (longer)
    nearMargin: 0.035,    // how much larger than hitbox counts as "grazing" (easier)
  },
  // Item-type weights (selected AFTER drop chance passes).
  // For normal enemies, droneAdd is further adjusted by current drone count (see dsDropPowerup()).
  items: {
    normal: {
      barrier: 0.010,     // A: very rare
      speed:   0.060,     // P
      heal:    0.030,     // Y (heal)
      tiny:    0.050,     // T
      inv:     0.0005,    // I: SUPER SUPER rare
      maxHpUp: 0.0005, // U: SUPER SUPER rare (max HP)
      missile: 0.040,     // a/w/h
      spread:  0.10,      // S
      pierce:  0.05,      // L
      nearHom: 0.025,     // Q
      homing:  0.025,     // H
      laser:   0.018,     // Z
      erase:   0.015,     // E
      // G/R/C were hard to see after overall drop nerf, so make them a bit more common.
      heavyBomb:0.020,  // G
      saw:     0.020,  // R
      ricochet:0.015,  // C\n      rockPush: 0.012, // J (rock pusher)\n      rockSplit:0.010, // K (rock splitter)\n      rockHoming:0.010, // M (rock homing)\n      bomb:    0.025,     // B     // B
      // droneAdd: computed dynamically
      droneAddBase: 0.06,  // base for O (dynamic)
      droneAddExtra:0.06,  // extra scaled by (1 - dlen/8)
      droneAddMul1: 0.75,  // after 1 drone
      droneAddMul2: 0.60,  // after 2+ drones
    },
    boss: {
      barrier: 0.050,     // A: rare (still possible)
      droneAdd: 0.070,    // O
      inv:     0.0020,    // I: SUPER SUPER rare even on boss
      maxHpUp: 0.0020, // U: SUPER SUPER rare (max HP)
      missile: 0.145,     // a/w/h
      tiny:    0.24,      // T
      speed:   0.12,      // P
      heal:    0.06,      // Y (heal)
      laser:   0.10,      // Z
      nearHom: 0.06,      // Q
      erase:   0.05,      // E
      homing:  0.035,     // H
      pierce:  0.020,     // L
      heavyBomb:0.060,  // G
      saw:     0.055,  // R
      ricochet:0.045,  // C\n      rockPush: 0.030, // J\n      rockSplit:0.025, // K\n      rockHoming:0.025, // M\n      spreadOrBomb: 0.015 // S/B fallback
    }
  }
};


// === Arrow helpers ===
function arrowDef(kind){
  return (typeof ARROWS!=='undefined' && ARROWS.find(a=>a.kind===kind)) || {name:`${kind}矢束`, type:'arrow', dmg:5, count:0, kind};
}
function findArrowStack(g, kind){
  return g.inv && g.inv.find && g.inv.find(x=>x && x.type==='arrow' && x.kind===kind) || null;
};
function handleArrowPickup(g, it){
  if(!it || it.type!=='arrow') return false;

  const kind = it.kind;
  const dmg  = (typeof num==='function') ? num(it.dmg,5) : (it.dmg||5);
  const cnt  = (typeof num==='function') ? num(it.count,0) : (it.count||0);

  const loadedKind = (g.p && g.p.arrow && g.p.arrow.kind) ? g.p.arrow.kind : null;

  // 同じ種類を「装填中」なら、所持本数(p.ar)へ補充
  if(loadedKind && loadedKind === kind){
    g.p.ar = (typeof num==='function' ? num(g.p.ar,0) : (g.p.ar||0)) + cnt;
    if(typeof g.msg==='function') g.msg(`${it.name}を補充${cnt?`（+${cnt}）`:''}`);
    if(typeof fxSpark==='function') fxSpark();
    g.items = g.items.filter(x=>x!==it);
    return true;
  }

  // それ以外（未装填／別種類）は所持品へ追加（同種はスタック）
  const stack = (typeof findArrowStack==='function') ? findArrowStack(g, kind) : null;
  if(stack){
    const prev = (typeof num==='function') ? num(stack.count,0) : (stack.count||0);
    stack.count = prev + cnt;
    // 念のため威力・名前を補正
    stack.dmg = (typeof num==='function') ? Math.max(num(stack.dmg,0), dmg) : Math.max(stack.dmg||0, dmg);
    if(!stack.name) stack.name = it.name;
    if(typeof g.msg==='function') g.msg(`${it.name}を拾った（所持品の同種に+${cnt}）`);
    if(typeof fxSpark==='function') fxSpark();
    g.items = g.items.filter(x=>x!==it);
    return true;
  }

  if(g.inv.length>=g.baseInvMax()){
    if(typeof g.msg==='function') g.msg("これ以上持てない");
    return true; // ここで床から消さない（true返しの仕様があるなら注意）
  }

  const picked = {name:it.name, type:'arrow', kind, dmg, count:cnt, ided:it.ided};
  g.inv.push(picked);
  if(typeof g.msg==='function') g.msg(`${it.name}を拾った（所持品へ）`);
  if(typeof fxSpark==='function') fxSpark();
  g.items = g.items.filter(x=>x!==it);
  return true;
};

/*** 端末ズーム抑止 ***/
document.addEventListener('gesturestart', e => { e.preventDefault(); }, {passive:false});
let __lastTouchEnd = 0;
document.addEventListener('touchend', (e)=>{
  const now = Date.now();
  if (now - __lastTouchEnd <= 350) e.preventDefault();
  __lastTouchEnd = now;
}, {passive:false});
window.addEventListener('touchmove', (e)=>{ if(e.target.closest('#viewport, .pad, .act, .btn, .panel')) e.preventDefault(); }, {passive:false});

/*** ユーティリティ ***/
const $=q=>document.querySelector(q);
function bindTap(sel, fn){
  let els = [];
  if(typeof sel === 'string'){
    els = Array.from(document.querySelectorAll(sel));
  }else if(sel instanceof Element){
    els = [sel];
  }else if(sel && typeof sel.length === 'number'){
    els = Array.from(sel);
  }
  els.forEach(el=>{
    const h=(e)=>{ e.preventDefault(); fn(e); };
    el.addEventListener('touchstart',h,{passive:false});
    el.addEventListener('click',h,{passive:false});
  });
}
const rand=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const choice=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function toast(m, cls=""){
  const layer=$("#toast"); const d=document.createElement('div');
  d.className='toast' + (cls?(' '+cls):''); d.textContent=m; layer.appendChild(d);

  // iPhoneの狭い画面でも詰まりにくいように、表示数を上限化（古いものから間引く）
  while(layer.children && layer.children.length>6){
    layer.removeChild(layer.firstChild);
  }

  setTimeout(()=>{ d.style.opacity='0'; d.style.transform='translateY(-8px)'; setTimeout(()=>d.remove(),280); },2200);
}
// 数値ガード
const num = (v, d=0) => (typeof v === 'number' && isFinite(v)) ? v : (Number(v)===Number(v) ? Number(v) : d);
/* clone（浅い） */
function clone(o){ if(Array.isArray(o)) return o.map(x=>clone(x)); if(o && typeof o==='object') return Object.assign({},o); return o; }
/* FX helpers */
function fxSlash(){ const fx=$("#fx"); const d=document.createElement('div'); d.className='fx fx-slash'; fx.appendChild(d); setTimeout(()=>d.remove(),650); }
function fxSpark(){
  const fx=$("#fx");
  const d=document.createElement('div'); d.className='fx fx-spark'; fx.appendChild(d);
  // パーティクルを数十個
  for(let i=0;i<26;i++){
    const p=document.createElement('div'); p.className='spark-dot';
    const x=Math.random()*window.innerWidth, y=Math.random()*window.innerHeight*0.6+window.innerHeight*0.2;
    const dx=(Math.random()*120-60)+'px', dy=(-(80+Math.random()*120))+'px';
    p.style.setProperty('--x', x+'px'); p.style.setProperty('--y', y+'px');
    p.style.setProperty('--dx', dx); p.style.setProperty('--dy', dy);
    fx.appendChild(p); setTimeout(()=>p.remove(),900);
  }
  setTimeout(()=>d.remove(),800);
}
function fxOmin(){ const fx=$("#fx"); const d=document.createElement('div'); d.className='fx fx-omin'; fx.appendChild(d); setTimeout(()=>d.remove(),900); }

/*** ここから PART 2 へ続く ***/
/*** 定数・パラメータ ***/

// ===== Town mode (町) =====
const DUNGEON_W = 56;
const DUNGEON_H = 30;
const TOWN_W = 160;
const TOWN_H = 80;

const LS_TOWN_HOLD = 'townHold_v1';
const LS_TOWN_STORAGE = 'townStorage_v1';
const LS_TOWN_LOSTFOUND = 'townLostFound_v1';
const LS_PUNYO_HS = 'punyopunyoHigh_v1';
const LS_PUNYO_SCORES = 'punyopunyoScores_v1';
const LS_DOTSHOOT_HS = 'dotshootHigh_v1';
const LS_DOTSHOOT_SCORES = 'dotshootScores_v1';
const LS_DOTSTRIKE_PERMA = "dotstrikePerma_v1";
const LS_GLOBAL_GOLD = 'townGlobalGold_v1';
const LS_TOWN_STORAGE_BAK = 'townStorage_bak_v1';
const LS_TOWN_LOSTFOUND_BAK = 'townLostFound_bak_v1';
// 「脱出後はローカルセーブ再開を隠す」ためのフラグ
const LS_ESCAPED_FLAG = 'escapedAfterExit_v1';
const VIEW_W=23, VIEW_H=11; 
const MAX_FLOOR=999; 
const INV_BASE_MAX=30;           // 所持上限30
const scaleAccel = 0.18;         // 敵強化加速度
const NATURAL_SPAWN_MIN = 6;     // 自然湧き閾値
const NATURAL_SPAWN_CHECK = 8;   // 何ターンごとにチェック

/*** アイテム定義 ***/
const WEAPONS=[
  {name:"木の棒",atk:2},{name:"鉄の剣",atk:4},
  {name:"長巻(縦3)",atk:5,aoe:"v3"},
  {name:"広刃(横3)",atk:5,aoe:"h3"},
  {name:"八方刀(周囲)",atk:4,aoe:"around"},
  {name:"吸血剣",atk:3,lifesteal:0.1},
  {name:"疾風剣(二回)",atk:3,multi:2},
  {name:"一撃槌(10%特大)",atk:6,critPct:0.10,critMul:3},
  {name:"地割れ斧",atk:6,quakePct:0.10,quakeLen:10},
  {name:"豪斬(25%で3倍)",atk:7,critPct:0.25,critMul:3},
  {name:"賭斧(50%3倍/50%ミス)",atk:8,gamble:true},
  {name:"破城槌(壁破壊)",atk:5,wallBreak:true},
  {name:"巨人剣",atk:9},
  {name:"聖光剣(周囲)",atk:7,aoe:"around"},
  {name:"魔喰刃(吸収)",atk:5,lifesteal:0.15},
  {name:"旋風刃(二回)",atk:4,multi:2},
  {name:"穿突槍(直線3)",atk:5,pierce:3},
  {name:"雷迅刀(横3)",atk:6,aoe:"h3"},
  {name:"氷華刀(周囲)",atk:5,aoe:"around"},
  {name:"古代剣",atk:10}
];
const ARMORS=[
  {name:"布の服",def:1},{name:"革の盾",def:2},{name:"青銅盾",def:3},{name:"鋼鉄盾",def:5},
  {name:"重装盾(無効50%)",def:4,nullify:0.5},
  {name:"鏡盾(反射25%)",def:4,reflect:0.25},
  {name:"再生盾",def:4,regen:true},
  {name:"竜鱗盾",def:6,nullify:0.2,reflect:0.2},
  {name:"闇紋盾",def:6,nullify:0.3,reflect:0.3},
  {name:"黄金盾",def:8},
  {name:"聖盾",def:5,nullify:0.5,reflect:0.5},
  {name:"守護盾",def:5,regen:true},
  {name:"黒曜盾",def:9,nullify:0.4},
  {name:"幻盾",def:3,reflect:0.25},
  {name:"堅守盾",def:7},
  {name:"祈祷盾",def:5,regen:true,nullify:0.2},
  {name:"竜神盾",def:8,nullify:0.5,reflect:0.5,regen:true},
  {name:"霧盾",def:3,nullify:0.15},
  {name:"武者盾",def:6,nullify:0.2},
  {name:"騎士盾",def:5}
];

const HERBS=[
  {name:"回復草",type:"herb",effect:(g,t)=>{const mh=num(t.maxHp,1); t.hp=Math.min(mh, num(t.hp,1)+Math.floor(mh*0.5)); g.msg("HPが回復した！"); fxSpark(); }},
  {name:"毒草",type:"herb",effect:(g,t)=>{ if(t===g.p){ g.p.str=Math.max(1, num(g.p.str,10)-1); g.msg("力が下がった…"); }else{ t.atk=Math.max(1, num(t.atk,1)-1); g.msg(`${t.name}は弱くなった`);} }},
  {name:"ちから草",type:"herb",effect:(g,t)=>{ if(t===g.p){ g.p.str=num(g.p.str,10)+1; g.msg("力が上がった！"); fxSpark(); }else{ t.atk=num(t.atk,1)+1; g.msg(`${t.name}は少し強くなった`);} }},
  {name:"眠り草",type:"herb",effect:(g,t)=>{ t.sleep=3; g.msg((t===g.p?"眠気が…":"眠った！")); }},
  {name:"無敵草",type:"herb",effect:(g,t)=>{ if(t===g.p){ g.p.invincible=Math.max(0,num(g.p.invincible,0))+5; g.msg("しばらく無敵！"); fxSpark(); }}},
  {name:"復活草",type:"herb",revive:true,effect:()=>{}},
  // ★ 身代わり草：方向指定で当たったモンスターをデコイ化
  {name:"身代わり草",type:"herb",effect:(g)=>{ g.msg("身代わりにしたい方向を選んでください"); g.waitTarget={mode:'herbDecoy'}; }}
];

const SCROLLS=[
  {name:"識別の巻物",type:"scroll",effect:(g)=>{const u=g.inv.filter(it=>!it.ided); if(!u.length){g.msg("識別する物がない");return;} g.waitId=true; g.msg("識別するアイテムを選択");}},
  {name:"脱出の巻物",type:"scroll",effect:(g)=>{g.escapeToTitle("脱出成功！");}},
  {name:"天の恵み(武器強化)",type:"scroll",effect:(g)=>{ if(!g.p.wep){g.msg("武器がない");return;} const big=Math.random()<0.10; const up=big?3:1; g.p.wep.plus=num(g.p.wep.plus,0)+up; g.msg(`${g.p.wep.name}+${num(g.p.wep.plus,0)}${big?"（会心強化！）":""}`); g.flashInv(it=>it===g.p.wep); fxSpark(); } },
  {name:"地の恵み(盾強化)",type:"scroll",effect:(g)=>{ if(!g.p.arm){g.msg("盾がない");return;} const big=Math.random()<0.10; const up=big?3:1; g.p.arm.plus=num(g.p.arm.plus,0)+up; g.msg(`${g.p.arm.name}+${num(g.p.arm.plus,0)}${big?"（会心強化！）":""}`); g.flashInv(it=>it===g.p.arm); fxSpark(); } },
  {name:"大部屋の巻物",type:"scroll",effect:(g)=>{g.makeBigRoom();g.msg("大部屋になった！"); fxOmin(); }},
  {name:"真空斬りの巻物",type:"scroll",effect:(g)=>{g.vacuumSlash(); fxSlash(); }},
  {name:"バクスイの巻物",type:"scroll",effect:(g)=>{g.sleepAll(6);g.msg("周囲に眠りの力が広がった"); }}
];

const ARROWS = [
  {name:"木の矢束",type:"arrow",count:15,dmg:5,kind:"normal"},
  {name:"爆発矢束",type:"arrow",count:6,dmg:8,kind:"bomb"},
  {name:"拡散矢束",type:"arrow",count:6,dmg:5,kind:"cone3"},
  {name:"穿通矢束",type:"arrow",count:8,dmg:6,kind:"pierce"},
  {name:"雷撃矢束",type:"arrow",count:5,dmg:7,kind:"line"},
  {name:"眠り矢束",type:"arrow",count:6,dmg:3,kind:"sleep"},
  {name:"封脚矢束",type:"arrow",count:6,dmg:3,kind:"stop"},
  {name:"転移矢束",type:"arrow",count:4,dmg:2,kind:"warp"},
  {name:"広爆矢束",type:"arrow",count:4,dmg:6,kind:"bomb3"},
  {name:"烈火矢束",type:"arrow",count:5,dmg:9,kind:"ignite"},
  {name:"凍結矢束",type:"arrow",count:5,dmg:6,kind:"slow"},
  {name:"重圧矢束",type:"arrow",count:5,dmg:8,kind:"stun"}
];

const WANDS = [
  {name:"一時しのぎの杖",type:"wand",uses:5,cast:(g,t)=>{if(!t){g.msg("外れた");return;}const p=g.findFree();if(!p){g.msg("効果なし");return;}g.moveMonsterNoAnim(t,p.x,p.y);g.msg(`${t.name}は吹き飛ばされた！`);}},
  {name:"吹き飛ばしの杖",type:"wand",uses:8,cast:(g,t,dx,dy)=>{if(!t){g.msg("外れた");return;}for(let i=0;i<10;i++){const nx=t.x+dx,ny=t.y+dy;if(g.isWall(nx,ny)||g.monAt(nx,ny)||g.isOut(nx,ny))break;g.setMonPos(t,nx,ny);}g.msg(`${t.name}は吹き飛ばされた！`);}},
  {name:"場所替えの杖",type:"wand",uses:6,cast:(g,t)=>{if(!t){g.msg("外れた");return;}const px=g.p.x,py=g.p.y;g.setMonPos(t,px,py);g.p.x=t._ox;g.p.y=t._oy;g.msg(`${t.name}と入れ替わった！`);}},
  {name:"炎の杖",type:"wand",uses:10,cast:(g,t)=>{if(!t){g.msg("外れた");return;}g.hit(g.p,t,10);g.msg("炎が直撃！");}},
  {name:"眠りの杖",type:"wand",uses:8,cast:(g,t)=>{if(!t){g.msg("外れた");return;} t.sleep=3; g.msg(`${t.name}を眠らせた`);}},
  {name:"封脚の杖",type:"wand",uses:8,cast:(g,t)=>{if(!t){g.msg("外れた");return;} t.stop=3; g.msg(`${t.name}の足を封じた`);}},
  {name:"転移の杖",type:"wand",uses:6,cast:(g,t)=>{if(!t){g.msg("外れた");return;} const p=g.randomRoomCell(); if(p){ g.setMonPos(t,p.x,p.y); g.msg(`${t.name}を転移！`);}}},
  {name:"爆裂の杖",type:"wand",uses:6,cast:(g,t)=>{ if(!t){g.msg("外れた");return;} g.explode(t.x,t.y,2,10,true); g.msg("爆裂！"); fxSlash(); }},
  {name:"大爆裂の杖",type:"wand",uses:3,cast:(g,t)=>{ if(!t){g.msg("外れた");return;} g.explode(t.x,t.y,3,14,true); g.msg("大爆裂！"); fxSlash(); }},
  {name:"稲妻の杖",type:"wand",uses:8,cast:(g,t,dx,dy)=>{ let x=g.p.x,y=g.p.y; for(let i=0;i<10;i++){ x+=dx; y+=dy; if(g.isOut(x,y)||g.isWall(x,y)) break; const m=g.monAt(x,y); if(m){ g.hit(g.p,m,8); } } g.msg(`稲妻が走る`); fxSlash(); }},
  {name:"周囲凍結の杖",type:"wand",uses:6,cast:(g)=>{ let c=0; g.forEachAround(g.p.x,g.p.y,(x,y)=>{const m=g.monAt(x,y); if(m){ m.stop=2; g.hit(g.p,m,5); c++; }}); g.msg(`周囲を凍結（${c}体）`); }},
  {name:"部屋全滅の杖",type:"wand",uses:2,cast:(g)=>{ const rid=g.roomIdAt(g.p.x,g.p.y); let c=0; for(const m of g.mons.slice()){ if(g.roomIdAt(m.x,m.y)===rid){ g.hit(g.p,m,12); c++; }} g.msg(`部屋に雷撃！（${c}体）`); fxSlash(); }},
  {name:"強化の杖",type:"wand",uses:5,cast:(g,t)=>{ if(!t){g.msg("外れた");return;} t.atk=Math.floor(num(t.atk,1)*1.5); t.def=Math.floor(num(t.def,0)*1.5); t.maxHp=Math.floor(num(t.maxHp,1)*1.5); t.hp=num(t.maxHp,1); g.msg(`${t.name}は強化された！`); }},
  {name:"弱体の杖",type:"wand",uses:6,cast:(g,t)=>{ if(!t){g.msg("外れた");return;} t.atk=Math.max(1,Math.floor(num(t.atk,1)*0.7)); t.def=Math.max(0,Math.floor(num(t.def,0)*0.7)); t.hp=Math.max(1,Math.floor(num(t.hp,1)*0.7)); g.msg(`${t.name}は弱体化！`); }},
  // ★ 身代わりの杖：10〜40Tデコイ化
  {name:"身代わりの杖",type:"wand",uses:5,cast:(g,t)=>{ if(!t){g.msg("外れた");return;} const T=rand(10,40); g.makeDecoy(t,T); }}
];

const POTS=[{name:"保存の壺",type:"pot",cap:4},{name:"爆裂の壺",type:"potBomb",cap:1}];

const MON=[
  {name:"スライム",ch:"s",hp:10,atk:3,def:0,xp:5,ai:"normal"},
  {name:"ゴブリン",ch:"g",hp:14,atk:5,def:1,xp:8,ai:"normal"},
  {name:"アーチャ",ch:"a",hp:12,atk:4,def:1,xp:10,ai:"ranged"},
  {name:"バーサク",ch:"b",hp:20,atk:7,def:2,xp:15,ai:"mad"},
  {name:"ドラコ",ch:"D",hp:28,atk:11,def:3,xp:28,ai:"ranged"},
  {name:"店主",ch:"S",hp:60,atk:22,def:10,xp:0,ai:"shop",spd:2}
];

/*** 説明＆範囲表示 ***/
function itemDesc(it){
  const base = {weapon:()=>`攻撃+${num(it.atk,0)}${it.plus?` (+${num(it.plus,0)})`:''}`, armor:()=>`防御+${num(it.def,0)}${it.plus?` (+${num(it.plus,0)})`:''}`,
    herb:()=>`草：様々な効果`, scroll:()=>`巻物：${it.name}`, wand:()=>`杖（${num(it.uses,0)}回）`, arrow:()=>`矢 x${num(it.count,0)}`}[it.type] || (()=>it.type||'item');
  let extra=[];
  if(it.aoe==="h3") extra.push("攻撃範囲：横3");
  if(it.aoe==="v3") extra.push("攻撃範囲：縦3");
  if(it.aoe==="around") extra.push("攻撃範囲：周囲8");
  if(it.pierce) extra.push(`直線${num(it.pierce,0)}マス`);
  if(it.lifesteal) extra.push(`与ダメの${Math.floor(num(it.lifesteal,0)*100)}%吸収`);
  if(it.gamble) extra.push("50%で3倍/50%でミス");
  if(it.wallBreak) extra.push("壁破壊可能");
  if(it.nullify) extra.push(`被ダメ${Math.floor(num(it.nullify,0)*100)}%で無効`);
  if(it.reflect) extra.push(`被ダメ${Math.floor(num(it.reflect,0)*100)}%で反射`);
  if(it.regen) extra.push("自動回復");
  if(it.kind==="bomb") extra.push("命中で爆発(半径2)");
  if(it.kind==="bomb3") extra.push("命中で大爆発(半径3)");
  if(it.kind==="line") extra.push("直線10マスに雷撃");
  if(it.kind==="pierce") extra.push("敵を貫通");
  if(it.kind==="cone3") extra.push("前方3列拡散");
  if(it.kind==="sleep") extra.push("睡眠付与");
  if(it.kind==="stop") extra.push("3ターン移動不能");
  if(it.kind==="warp") extra.push("部屋ランダム転移");
  if(it.kind==="ignite") extra.push("追加火ダメ");
  if(it.kind==="slow") extra.push("行動遅延");
  if(it.kind==="stun") extra.push("1ターン硬直");
  if(it.name==="身代わりの杖"||it.name==="身代わり草") extra.push("対象を10〜40T身代わり化（緑ログ）");
  return [base(), ...extra].join(" / ");
}
function rangeAsciiFor(it){
  const W=15,H=9,cx=7,cy=4;
  const grid=Array.from({length:H},()=>Array(W).fill('.'));
  grid[cy][cx]='@';
  function mark(x,y,ch){ if(x>=0&&y>=0&&x<W&&y<H) grid[y][x]=ch; }
  const hit='*', blast='o', line='-';
  if(it.aoe==="h3"){ mark(cx-1,cy,hit); mark(cx,cy,hit); mark(cx+1,cy,hit); }
  if(it.aoe==="v3"){ mark(cx,cy-1,hit); mark(cx,cy,hit); mark(cx,cy+1,hit); }
  if(it.aoe==="around"){ for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ if(dx||dy) mark(cx+dx,cy+dy,hit); } }
  if(it.pierce){ for(let i=1;i<=num(it.pierce,0)&&cx+i<W;i++) mark(cx+i,cy,hit); }
  if(it.kind==="line"){ for(let i=1;i<=10&&cx+i<W;i++) mark(cx+i,cy,line); }
  if(it.kind==="bomb"){ mark(cx+3,cy,blast); for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){ if(dx*dx+dy*dy<=4) mark(cx+3+dx,cy+dy,blast);} }
  if(it.kind==="bomb3"){ mark(cx+3,cy,blast); for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){ if(dx*dx+dy*dy<=9) mark(cx+3+dx,cy+dy,blast);} }
  if(it.name==="稲妻の杖"){ for(let i=1;i<=10&&cx+i<W;i++) mark(cx+i,cy,line); }
  if(it.name==="爆裂の杖"||it.name==="大爆裂の杖"){ const r=(it.name==="大爆裂の杖")?3:2; for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){ if(dx*dx+dy*dy<=r*r) mark(cx+3+dx,cy+dy,blast); } }
  return grid.map(row=>row.join('')).join('\n');
}

/*** 整頓タブ補助 ***/
const TAB_ORDER = ["herb","arrow","scroll","wand","weapon","armor","pot","potBomb","other"];
const TAB_LABEL = {
  herb:"草", arrow:"矢", scroll:"巻物", wand:"杖",
  weapon:"武器", armor:"防具", pot:"壺", potBomb:"爆発壺", other:"その他"
};
function catOf(it){ if(!it||!it.type) return "other"; return TAB_ORDER.includes(it.type)?it.type:"other"; }
function sortByCategory(cat, arr){
  const getPow = it => (num(it.atk,0)+num(it.plus,0));
  const getDef = it => (num(it.def,0)+num(it.plus,0));
  if(cat==="weapon") return arr.sort((a,b)=> (getPow(b)-getPow(a)) || (a.name>b.name?1:-1));
  if(cat==="armor")  return arr.sort((a,b)=> (getDef(b)-getDef(a)) || (a.name>b.name?1:-1));
  if(cat==="wand")   return arr.sort((a,b)=> num(b.uses,0)-num(a.uses,0) || (a.name>b.name?1:-1));
  if(cat==="arrow")  return arr.sort((a,b)=> num(b.dmg,0)-num(a.dmg,0) || num(b.count,0)-num(a.count,0) || (a.kind>b.kind?1:-1));
  if(cat==="pot")    return arr.sort((a,b)=> num(b.cap,0)-num(a.cap,0) || (a.name>b.name?1:-1));
  if(cat==="potBomb")return arr.sort((a,b)=> (a.name>b.name?1:-1));
  return arr.sort((a,b)=> (a.name>b.name?1:-1));
}
function groupDisplay(arr){
  const map=new Map();
  for(const it of arr){
    const key = JSON.stringify({t:it.type,n:it.name,k:it.kind||null,p:it.plus||0,a:it.atk||0,d:it.def||0});
    if(!map.has(key)) map.set(key, {item:it, count:0, members:[]});
    const g=map.get(key); g.count++; g.members.push(it);
  }
  return [...map.values()];
}

/*** 汎用 ***/
const MON_SPAWN_POOL = MON;
function itemChar(it){ if(it.type==='weapon')return ')'; if(it.type==='armor')return ']'; if(it.type==='scroll')return '?'; if(it.type==='herb')return '!'; if(it.type==='wand')return '/'; if(it.type==='arrow')return '^'; if(it.type==='pot'||it.type==='potBomb')return '0'; if(it.type==='gold')return '$'; return '*'; }
function pickIdedWeapon(){ const w={...choice(WEAPONS)}; w.type='weapon'; w.ided=true; return w; }
function pickIdedArmor(){ const a={...choice(ARMORS)}; a.type='armor'; a.ided=true; return a; }
function priceOf(it){
  if(it.type==='weapon') return (num(it.atk,0)+num(it.plus,0))*120;
  if(it.type==='armor')  return (num(it.def,0)+num(it.plus,0))*120;
  if(it.type==='wand')   return 160+num(it.uses,5)*20;
  if(it.type==='scroll') return 120;
  if(it.type==='herb')   return 90;
  if(it.type==='arrow')  return 12*num(it.count,1);
  if(it.type==='pot')    return 220+num(it.cap,1)*60;
  if(it.type==='potBomb')return 300;
  return 80;
}
function scaleMon(def,x,y,lv){
  const m=clone(def); m.x=x; m.y=y;
  const f=Math.pow(1+scaleAccel, num(lv,1));
  m.hp=Math.max(1,Math.floor(num(m.hp,1)*f)); m.maxHp=m.hp;
  m.atk=Math.max(1,Math.floor(num(m.atk,1)*f));
  m.def=Math.max(0,Math.floor(num(m.def,0)*f));
  m.xp=Math.max(1,Math.floor(num(m.xp,1)*f));
  m.hostile=true; return m;
}

/*** Game クラス ***/
class Game{
  constructor(){
    this.w=DUNGEON_W; this.h=DUNGEON_H;
    this.map=[]; this.vis=[]; this.rooms=[]; this.nearStairs=new Set();
    this.items=[]; this.mons=[]; this.traps=[];
    this.turn=0; this.bestFloor=parseInt(localStorage.getItem('bestF')||'0',10);
    this.bestScore=parseInt(localStorage.getItem('bestScore')||'0',10);
    this.shopCells=new Set(); this.shopRooms=new Set(); this.shopExits=new Map(); this.thief=false; this.shopDialogState=null; this._resumeAfterShopDialog=null; this.mhRoomIds=new Set(); this.shopWall=new Set(); this.mhWall=new Set();
    this.autoPickup=localStorage.getItem('autoPickup')!=='OFF';
    this.invTabbed = (localStorage.getItem('invTabbed')==='ON');

    this.mode='dungeon';
    this.townStorage=[];
    this.townLostFound=[];
    this.townShopStock=[];
    this.townShopLastGen=0;
    this.loadTownPersistent();

    this.p={
      x:0,y:0,
      hp:num(36),maxHp:num(36),str:num(10),
      baseAtk:num(5),baseDef:num(1),lv:num(1),xp:num(0),
      ar:num(0),arrow:null,wep:null,arm:null,gold:num(0),
      lastDir:[0,1],invincible:num(0),_ox:0,_oy:0
    };
    this.inv=[]; this.waitTarget=null; this.waitId=false;
    this.viewW=VIEW_W; this.viewH=VIEW_H;
    this.haveEscape=false;
  }

  // ===== Town persistent / hold (localStorage) =====
  loadTownPersistent(){
    // 町保管は「消えない」方針：本体 + バックアップ（縮まない）を併用して保護する
    const safeParseArr = (key)=>{
      try{
        const a = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(a) ? a : [];
      }catch(e){ return []; }
    };
    const mainStorage = safeParseArr(LS_TOWN_STORAGE);
    const mainLost    = safeParseArr(LS_TOWN_LOSTFOUND);
    const bakStorage  = safeParseArr(LS_TOWN_STORAGE_BAK);
    const bakLost     = safeParseArr(LS_TOWN_LOSTFOUND_BAK);

    // 本体が空/破損でもバックアップがあれば復元
    this.townStorage  = (mainStorage && mainStorage.length) ? mainStorage : bakStorage;
    this.townLostFound= (mainLost && mainLost.length) ? mainLost : bakLost;

    // バックアップも同期（読み込み時点で整合）
    try{ localStorage.setItem(LS_TOWN_STORAGE_BAK, JSON.stringify(this.townStorage||[])); }catch(e){}
    try{ localStorage.setItem(LS_TOWN_LOSTFOUND_BAK, JSON.stringify(this.townLostFound||[])); }catch(e){}
  }
  saveTownPersistent(){
    // 「何をしても消えない」：バックアップは縮まない（本体が空でも過去分は保持）
    const safeParseArr = (key)=>{
      try{
        const a = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(a) ? a : [];
      }catch(e){ return []; }
    };
    const dedupe = (arr)=>{
      const seen=new Set();
      const out=[];
      for(const it of (arr||[])){
        if(!it) continue;
        const k = (it._uid!=null) ? String(it._uid) : JSON.stringify(it);
        if(seen.has(k)) continue;
        seen.add(k);
        out.push(it);
      }
      return out;
    };
    const ensureUid = (it)=>{
      if(!it || it._uid!=null) return;
      it._uid = `${Date.now()}_${Math.floor(Math.random()*1e9)}`;
    };

    const curS = (this.townStorage||[]); curS.forEach(ensureUid);
    const curL = (this.townLostFound||[]); curL.forEach(ensureUid);

    // 本体保存（現状の見た目に合わせる）
    try{ localStorage.setItem(LS_TOWN_STORAGE, JSON.stringify(curS)); }catch(e){}
    try{ localStorage.setItem(LS_TOWN_LOSTFOUND, JSON.stringify(curL)); }catch(e){}

    // バックアップは「過去分 + 現在分」の和集合で保持
    const bakS = safeParseArr(LS_TOWN_STORAGE_BAK);
    const bakL = safeParseArr(LS_TOWN_LOSTFOUND_BAK);
    const mergedS = dedupe([].concat(bakS, curS));
    const mergedL = dedupe([].concat(bakL, curL));
    try{ localStorage.setItem(LS_TOWN_STORAGE_BAK, JSON.stringify(mergedS)); }catch(e){}
    try{ localStorage.setItem(LS_TOWN_LOSTFOUND_BAK, JSON.stringify(mergedL)); }catch(e){}
  }

  // ===== Global gold wallet (for title minigames etc.) =====
  loadGlobalGold(){
    try{
      const v = parseInt(localStorage.getItem(LS_GLOBAL_GOLD)||'0',10);
      if(Number.isFinite(v) && v>=0) this.p.gold = Math.max(num(this.p.gold,0), v);
    }catch(e){}
  }
  saveGlobalGold(){
    try{ localStorage.setItem(LS_GLOBAL_GOLD, String(Math.max(0, num(this.p.gold,0)))); }catch(e){}
  }
  awardGold(delta){
    const d=num(delta,0);
    if(!d) return;
    this.p.gold = Math.max(0, num(this.p.gold,0) + d);
    this.afterGoldChange();
  }
  afterGoldChange(){
    // タイトル/町/ミニゲームなど「ダンジョン外」でも反映されるように保存
    try{ this.saveHoldToTitle(); }catch(e){}
    try{ this.saveGlobalGold(); }catch(e){}
  }

  saveHoldToTitle(){
    // 脱出・町→タイトルなどで「所持品/お金/レベル等」を保持してタイトルへ戻すための保存
    const hold = {
      v: 1,
      t: Date.now(),
      p: {
        hp: num(this.p.hp,1), maxHp: num(this.p.maxHp,1),
        str: num(this.p.str,10),
        baseAtk: num(this.p.baseAtk,5),
        baseDef: num(this.p.baseDef,1),
        lv: num(this.p.lv,1),
        xp: num(this.p.xp,0),
        gold: num(this.p.gold,0),
        // 矢（装填状態）
        arrowKind: (this.p.arrow && this.p.arrow.kind) ? this.p.arrow.kind : null,
        ar: num(this.p.ar,0),
        // 装備（返還タグ等の状態も含める）
        wep: this.p.wep ? Game._serializeItem(this.p.wep) : null,
        arm: this.p.arm ? Game._serializeItem(this.p.arm) : null
      },
      inv: (this.inv||[]).map(it=>Game._serializeItem(it)).filter(Boolean)
    };
    try{ localStorage.setItem(LS_TOWN_HOLD, JSON.stringify(hold)); }catch(e){}
  }
  loadHoldFromTitle(){
    // タイトル保持状態があれば復元（無ければ何もしない）
    let hold=null;
    try{ hold = JSON.parse(localStorage.getItem(LS_TOWN_HOLD) || 'null'); }catch(e){ hold=null; }
    if(!hold || !hold.p) return;

    // player core
    this.p.hp = num(hold.p.hp, this.p.hp);
    this.p.maxHp = num(hold.p.maxHp, this.p.maxHp);
    this.p.str = num(hold.p.str, this.p.str);
    this.p.baseAtk = num(hold.p.baseAtk, this.p.baseAtk);
    this.p.baseDef = num(hold.p.baseDef, this.p.baseDef);
    this.p.lv = num(hold.p.lv, this.p.lv);
    this.p.xp = num(hold.p.xp, this.p.xp);
    this.p.gold = num(hold.p.gold, this.p.gold);

    // equip
    this.p.wep = hold.p.wep ? Game._deserializeItem(hold.p.wep) : null;
    this.p.arm = hold.p.arm ? Game._deserializeItem(hold.p.arm) : null;

    // arrows loaded
    const ak = hold.p.arrowKind || null;
    this.p.arrow = ak ? clone(arrowDef(ak)) : null;
    this.p.ar = num(hold.p.ar, 0);

    // inventory
    this.inv = Array.isArray(hold.inv) ? hold.inv.map(o=>Game._deserializeItem(o)).filter(Boolean) : [];
  }

  // ===== carry-start helpers =====
  resetPlayerForFreshRun(){
    // 「新しく始める」と同等にステ/レベルを初期化（所持金・インベントリは呼び出し側で管理）
    this.p.hp = num(36);
    this.p.maxHp = num(36);
    this.p.str = num(10);
    this.p.baseAtk = num(5);
    this.p.baseDef = num(1);
    this.p.lv = num(1);
    this.p.xp = num(0);
    this.p.invincible = num(0);
    this.p.wep = null;
    this.p.arm = null;
    this.p.arrow = null;
    this.p.ar = num(0);
  }

  // hold側（装備/装填矢）も含めて「持ち込み対象のアイテム配列」を作る
  extractAllHoldItems(){
    const out = [];
    try{
      // 既に inv に入っている分
      if(Array.isArray(this.inv)) out.push(...this.inv);
      // 装備をアイテムとして持ち込み（装備状態は解除）
      if(this.p.wep) out.push(this.p.wep);
      if(this.p.arm) out.push(this.p.arm);
      // 装填中の矢は「矢アイテム」として持ち込み
      if(this.p.arrow && num(this.p.ar,0)>0){
        const ak = this.p.arrow.kind || 'normal';
        const a = clone(arrowDef(ak));
        a.type = 'arrow';
        a.kind = ak;
        a.count = num(this.p.ar,0);
        a.ided = true;
        out.push(a);
      }
    }catch(e){ console.error(e); }
    return out.filter(Boolean);
  }

  // ---- item serialization helpers (functions cannot be JSON'd) ----
  static _serializeItem(it){
    if(!it || typeof it !== 'object') return null;
    const o = { type: it.type, name: it.name };
    if(it.type==='weapon'){
      o.plus = num(it.plus,0); o.ided = !!it.ided; o.returnTag = !!it.returnTag;
      o.atk = num(it.atk,0);
    }else if(it.type==='armor'){
      o.plus = num(it.plus,0); o.ided = !!it.ided; o.returnTag = !!it.returnTag;
      o.def = num(it.def,0);
    }else if(it.type==='wand'){
      o.uses = num(it.uses,0); o.ided = !!it.ided;
    }else if(it.type==='arrow'){
      o.kind = it.kind || 'normal';
      o.count = num(it.count,0);
      o.dmg = num(it.dmg,0);
      o.ided = !!it.ided;
    }else if(it.type==='pot' || it.type==='potBomb'){
      o.cap = num(it.cap,0);
      if(Array.isArray(it.contents)) o.contents = it.contents.map(x=>Game._serializeItem(x)).filter(Boolean);
    }else if(it.type==='gold'){
      o.amt = num(it.amt,0);
    }else{
      o.ided = !!it.ided;
    }
    return o;
  }
  static _deserializeItem(o){
    if(!o || typeof o !== 'object') return null;
    const t = Game._templateItem(o.type, o.name, o.kind);
    if(!t) return null;
    if(o.type==='weapon'){
      t.plus = num(o.plus,0);
      t.ided = !!o.ided;
      t.returnTag = !!o.returnTag;
      if('atk' in o) t.atk = num(o.atk, t.atk);
    }else if(o.type==='armor'){
      t.plus = num(o.plus,0);
      t.ided = !!o.ided;
      t.returnTag = !!o.returnTag;
      if('def' in o) t.def = num(o.def, t.def);
    }else if(o.type==='wand'){
      t.uses = num(o.uses, t.uses);
      t.ided = !!o.ided;
    }else if(o.type==='arrow'){
      t.kind = o.kind || t.kind || 'normal';
      t.count = num(o.count, t.count);
      t.dmg = num(o.dmg, t.dmg);
      t.ided = !!o.ided;
    }else if(o.type==='pot' || o.type==='potBomb'){
      t.cap = num(o.cap, t.cap);
      if(Array.isArray(o.contents)) t.contents = o.contents.map(x=>Game._deserializeItem(x)).filter(Boolean);
    }else if(o.type==='gold'){
      t.amt = num(o.amt, t.amt);
    }else{
      t.ided = !!o.ided;
    }
    return t;
  }
  static _templateItem(type, name, kind){
    try{
      if(type==='weapon'){
        const base = WEAPONS.find(x=>x.name===name) || {name:name||'武器', atk:2};
        return Object.assign({type:'weapon', plus:0, ided:false, returnTag:false}, clone(base), {type:'weapon'});
      }
      if(type==='armor'){
        const base = ARMORS.find(x=>x.name===name) || {name:name||'盾', def:1};
        return Object.assign({type:'armor', plus:0, ided:false, returnTag:false}, clone(base), {type:'armor'});
      }
      if(type==='herb'){
        const base = HERBS.find(x=>x.name===name) || {name:name||'草', type:'herb', effect:()=>{}};
        return clone(base);
      }
      if(type==='scroll'){
        const base = SCROLLS.find(x=>x.name===name) || {name:name||'巻物', type:'scroll', effect:()=>{}};
        return clone(base);
      }
      if(type==='wand'){
        const base = WANDS.find(x=>x.name===name) || {name:name||'杖', type:'wand', uses:0, cast:()=>{}};
        return clone(base);
      }
      if(type==='arrow'){
        if(kind){
          const base = ARROWS.find(x=>x.kind===kind) || ARROWS.find(x=>x.name===name) || {name:(name||'矢束'), type:'arrow', kind:kind, count:0, dmg:5};
          return Object.assign({}, clone(base), {type:'arrow', kind:(base.kind||kind)});
        }
        const base = ARROWS.find(x=>x.name===name) || {name:(name||'矢束'), type:'arrow', kind:'normal', count:0, dmg:5};
        return Object.assign({}, clone(base), {type:'arrow', kind:(base.kind||'normal')});
      }
      if(type==='pot' || type==='potBomb'){
        const base = POTS.find(x=>x.name===name) || {name:name||'壺', type:type, cap:1};
        return Object.assign({}, clone(base), {type:type});
      }
      if(type==='gold'){
        return {name:'ゴールド', type:'gold', amt:0};
      }
      return {name:name||'?', type:type||'misc'};
    }catch(e){
      return null;
    }
  }
  // ラッパ（Game内から呼べるように）
  fxSlash(){ fxSlash(); } fxSpark(){ fxSpark(); } fxOmin(){ fxOmin(); }

  msg(s){ toast(s); }
  msgGreen(s){ toast(s,"toast-green"); }

  // ===== 攻撃FX（誰→誰を視覚化） =====
  cellAt(ax, ay){
    const vx = ax - this.offX;
    const vy = ay - this.offY;
    if(vx<0 || vy<0 || vx>=this.viewW || vy>=this.viewH) return null;
    const idx = vy*this.viewW + vx;
    return (this._cellEls && this._cellEls[idx]) ? this._cellEls[idx] : null;
  }

  enqueueAttackFx(src, dst, msgText, linePts){
    if(!this.fxQueue) this.fxQueue=[];
    if(!this._fxSeen) this._fxSeen=new Set();

    const sx=src?src.x:null, sy=src?src.y:null, dx=dst?dst.x:null, dy=dst?dst.y:null;
    const sig = `${this.turn}|${sx},${sy}->${dx},${dy}|${msgText||''}`;
    // 同一ターン内の完全重複を除外（2巡バグ対策）
    if(this._fxSeen.has(sig)) return;
    this._fxSeen.add(sig);

    this.fxQueue.push({src,dst,msgText,linePts});
  }

  playFxQueue(){
    if(this.fxBusy) return;
    if(!this.fxQueue || !this.fxQueue.length) return;
    this.fxBusy=true;

    const dur=320, gap=240;

    const step=()=>{
      if(!this.fxQueue.length){
        this.fxBusy=false;
        // ターンが進んだら重複除外セットをクリア（溜まり続けないように）
        if(this._fxSeen && this._fxSeen.size>300) this._fxSeen.clear();
        return;
      }
      const ev=this.fxQueue.shift();
      // 表示する直前に最新のセル参照を確保
      if(!this._cellEls || !this._cellEls.length) this.render();

      const srcEl = ev.src ? this.cellAt(ev.src.x, ev.src.y) : null;
      const dstEl = ev.dst ? this.cellAt(ev.dst.x, ev.dst.y) : null;
      const lineEls = [];
      if(ev.linePts && ev.linePts.length){
        for(const p of ev.linePts){
          const e=this.cellAt(p.x,p.y);
          if(e) lineEls.push(e);
        }
      }

      if(srcEl) srcEl.classList.add('fx-src');
      if(dstEl) dstEl.classList.add('fx-dst');
      lineEls.forEach(e=>e.classList.add('fx-line'));

      if(ev.msgText) toast(ev.msgText, 'toast-dmg');

      setTimeout(()=>{
        if(srcEl) srcEl.classList.remove('fx-src');
        if(dstEl) dstEl.classList.remove('fx-dst');
        lineEls.forEach(e=>e.classList.remove('fx-line'));
        setTimeout(step, gap);
      }, dur);
    };

    step();
  }

  isOut(x,y){ return x<0||y<0||x>=this.w||y>=this.h; }
  isWall(x,y){ return this.map[y][x]==='#'; }
  monAt(x,y){ return this.mons.find(m=>m.x===x&&m.y===y); }
  itemsAt(x,y){ return this.items.filter(i=>i.x===x&&i.y===y); }
  itemAt(x,y){ return this.items.find(i=>i.x===x&&i.y===y); }
  setMonPos(m,x,y){ m._ox=m.x; m._oy=m.y; m.x=x; m.y=y; }
  moveMonsterNoAnim(m,x,y){ this.setMonPos(m,x,y); }
  baseInvMax(){ let extra=0; for(const it of this.inv){ if(it.type==='pot' && it.cap) extra+=num(it.cap,0); } return INV_BASE_MAX+extra; }

  /*** 生成 ***/
  gen(floor=1){
    this.map=Array.from({length:this.h},()=>Array(this.w).fill('#'));
    this.vis=Array.from({length:this.h},()=>Array(this.w).fill(false));
    this.rooms=[]; this.items=[]; this.mons=[]; this.traps=[]; this.shopCells.clear(); this.mhRoomIds.clear(); this.nearStairs.clear(); this.shopCells.clear(); this.shopRooms.clear(); this.shopExits.clear(); this.shopWall.clear(); this.mhWall.clear();

    const R=rand(7,11);
    for(let i=0;i<R;i++){
      for(let t=0;t<60;t++){
        const rw=rand(5,12), rh=rand(4,10), rx=rand(1,this.w-rw-2), ry=rand(1,this.h-rh-2);
        const overlap=this.rooms.some(r=>rx<r.x+r.w+1 && rx+rw+1>r.x && ry<r.y+r.h+1 && ry+rh+1>r.y);
        if(overlap) continue;
        for(let y=ry;y<ry+rh;y++) for(let x=rx;x<rx+rw;x++) this.map[y][x]='.';
        const id=this.rooms.length; this.rooms.push({x:rx,y:ry,w:rw,h:rh,id}); break;
      }
    }
    if(!this.rooms.length){ const cx=~~(this.w/2)-4, cy=~~(this.h/2)-3; for(let y=cy;y<cy+6;y++) for(let x=cx;x<cx+8;x++) this.map[y][x]='.'; this.rooms.push({x:cx,y:cy,w:8,h:6,id:0}); }
    const carve=(ax,ay,bx,by)=>{ for(let x=Math.min(ax,bx);x<=Math.max(ax,bx);x++) this.map[ay][x]='.'; for(let y=Math.min(ay,by);y<=Math.max(ay,by);y++) this.map[y][bx]='.'; };
    for(let i=1;i<this.rooms.length;i++){ const A=this.rooms[i-1], B=this.rooms[i]; const ax=A.x+~~(A.w/2), ay=A.y+~~(A.h/2), bx=B.x+~~(B.w/2), by=B.y+~~(B.h/2); carve(ax,ay,bx,by); }

    const start=this.rooms[0]; this.p.x=start.x+~~(start.w/2); this.p.y=start.y+~~(start.h/2);
    const far=this.rooms.reduce((a,b)=> ( (this.d2Room(a) > this.d2Room(b)) ? a:b ));
    const stx=far.x+~~(far.w/2), sty=far.y+~~(far.h/2); this.map[sty][stx]='>';
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ if(dx||dy){ const nx=stx+dx, ny=sty+dy; if(!this.isOut(nx,ny)) this.nearStairs.add(`${nx},${ny}`);} }

    this.ensureConnectivity(this.p.x,this.p.y);

    // --- ショップ生成：1フロアあたり「だいたい2つ」 ---
    const startRoomId = this.roomIdAt(this.p.x,this.p.y);
    const eligibleShopRooms = this.rooms.filter(r=>{
      if(r.id===startRoomId) return false;
      return (r.w>=6 && r.h>=6);
    });
    for(let i=eligibleShopRooms.length-1;i>0;i--){
      const j=rand(0,i);
      const tmp=eligibleShopRooms[i]; eligibleShopRooms[i]=eligibleShopRooms[j]; eligibleShopRooms[j]=tmp;
    }
    const targetShopCount = Math.min(2, eligibleShopRooms.length);
    const shopRoomIds = new Set(eligibleShopRooms.slice(0,targetShopCount).map(r=>r.id));
    this.shopRooms.clear(); for(const id of shopRoomIds){ this.shopRooms.add(id); }

    for(const r of this.rooms){
      const isStart=(r.id===startRoomId);
      const isShop = shopRoomIds.has(r.id);
      let isMH=(Math.random()<0.08 && !isStart && r.w>=20 && r.h>=20);
      if(!isShop && !isMH && Math.random()<0.03 && r.w>=24 && r.h>=24) isMH=true;
      if(isShop) isMH=false;
      if(isShop) this.genShop(r);
      if(isMH){ this.genMH(r); this.mhRoomIds.add(r.id); }
      if(!isShop && !isMH){
        for(let i=0;i<rand(0,3);i++){ const p=this.freeIn(r,true); if(!p) break; const t=choice(MON_SPAWN_POOL.slice(0,5)); const lv=Math.max(1,Math.floor(num(this.floor,1)/1)); this.mons.push(scaleMon(t,p.x,p.y,lv)); }
        for(let i=0;i<rand(0,1);i++){ const p=this.freeIn(r,false); if(p) this.spawnRandomItem(p.x,p.y,floor); }
        if(Math.random()<0.10){ const p=this.freeIn(r,true); if(p) this.traps.push({x:p.x,y:p.y,type:"arrow",seen:false}); }
      }
    }
    for(let i=0;i<rand(2,4);i++){ const p=this.freeIn(null,false); if(p) this.spawnRandomItem(p.x,p.y,floor); }
    for(let i=0;i<rand(2,4);i++){ const p=this.freeIn(null,false); if(p) this.items.push({name:"G",type:"gold",amount:rand(10,100)*num(floor,1),ch:"$",x:p.x,y:p.y}); }

    if(this.inv.length===0){
      const w=pickIdedWeapon(), a=pickIdedArmor(); w.ided=a.ided=true; this.inv.push(w,a); this.p.wep=w; this.p.arm=a;
      const ar={...choice(ARROWS)}; ar.ided=true; this.inv.push(ar);
    }
    this.haveEscape = this.inv.some(it=>it.type==='scroll' && it.name.includes("脱出"));
    this.floor=num(floor,1);
    this.msg(`地下${this.floor}階に到着した。`);
    this.revealRoomAt(this.p.x,this.p.y,true);
    
    // 正規化：店主は初期は非敵対に固定
    if(this.mons){ for(const m of this.mons){ if(m && m.ai==='shop' && m.hostile==null){ m.hostile=false; m.isShop=true; } } }
this.render();
  }

  // ===== Town generation =====
  setWorldSize(kind){
    if(kind==='town'){ this.w=TOWN_W; this.h=TOWN_H; }
    else{ this.w=DUNGEON_W; this.h=DUNGEON_H; }
    this.viewW=VIEW_W; this.viewH=VIEW_H;
  }

  genTown(){
    this.mode='town';
    this.setWorldSize('town');
    this.map=Array.from({length:this.h},()=>Array(this.w).fill('.'));
    this.vis=Array.from({length:this.h},()=>Array(this.w).fill(true));
    this.rooms=[]; this.items=[]; this.mons=[]; this.traps=[];
    this.shopCells.clear(); this.mhRoomIds.clear(); this.nearStairs.clear();
    this.shopRooms.clear(); this.shopExits.clear(); this.shopWall.clear(); this.mhWall.clear();
    // grass base, roads
    const midX=Math.floor(this.w/2), midY=Math.floor(this.h/2);
    const roadW=3;
    for(let y=0;y<this.h;y++){
      for(let dx=-roadW;dx<=roadW;dx++){
        const x=midX+dx;
        if(x>=0 && x<this.w) this.map[y][x]='=';
      }
    }
    for(let x=0;x<this.w;x++){
      for(let dy=-roadW;dy<=roadW;dy++){
        const y=midY+dy;
        if(y>=0 && y<this.h) this.map[y][x]='=';
      }
    }
    // flowers / trees
    for(let i=0;i<2200;i++){
      const x=rand(1,this.w-2), y=rand(1,this.h-2);
      if(this.map[y][x]!=='.') continue;
      const r=Math.random();
      if(r<0.55) this.map[y][x]='f';
      else if(r<0.85) this.map[y][x]='T';
      else this.map[y][x]='~';
    }

    // buildings (letters on the road)
    const placeSign=(x,y,ch)=>{
      for(let yy=y-1;yy<=y+1;yy++) for(let xx=x-2;xx<=x+2;xx++){
        if(this.isOut(xx,yy)) continue;
        this.map[yy][xx]='=';
      }
      if(!this.isOut(x,y)) this.map[y][x]=ch;
    };
    // 施設は「最初に見つけやすい」ように中央付近へ配置（巨大マップでも迷わない）
    const fx = 12;
    const fy = 6;
    const bShop   = {x:midX-fx, y:midY-fy, ch:'S'}; // shop
    const bStore  = {x:midX-fx, y:midY+fy, ch:'B'}; // bank/storage
    const bTagger = {x:midX+fx, y:midY-fy, ch:'G'}; // tagger
    const bCasino = {x:midX+fx, y:midY+fy, ch:'C'}; // casino
    for(const b of [bShop,bStore,bTagger,bCasino]) placeSign(b.x,b.y,b.ch);

    // multiple exits
    const exits=[
      {x:2,y:2},{x:this.w-3,y:2},{x:2,y:this.h-3},{x:this.w-3,y:this.h-3},
      {x:midX,y:2},{x:midX,y:this.h-3},{x:2,y:midY},{x:this.w-3,y:midY}
    ];
    for(const e of exits){
      this.map[e.y][e.x]='>';
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        const nx=e.x+dx, ny=e.y+dy;
        if(!this.isOut(nx,ny)) this.map[ny][nx]='=';
      }
    }

    // player start
    this.p.x=midX; this.p.y=midY; this.p._ox=this.p.x; this.p._oy=this.p.y;

    // NPCs
    // 建物のすぐ近くにNPCを置く（プレイヤー開始位置から徒歩数歩）
    const npcs=[
      {name:'商人',ch:'M',x:bShop.x,   y:bShop.y+2,   role:'shop'},
      {name:'預かり屋',ch:'K',x:bStore.x,  y:bStore.y+2,  role:'storage'},
      {name:'タグ職人',ch:'F',x:bTagger.x, y:bTagger.y+2, role:'tagger'},
      {name:'カジノ係',ch:'Z',x:bCasino.x, y:bCasino.y+2, role:'casino'},
    ];
    for(const n of npcs){
      this.mons.push({name:n.name,ch:n.ch,x:n.x,y:n.y,hp:9999,atk:0,def:0,xp:0,ai:'town',role:n.role});
    }

    this.msg("町に到着した。十字路周辺に施設があります（話すで利用）。端に出るか『出る』で町を出られます。");
    this.render();
  }

  startDungeonFromTown(){
    this.mode='dungeon';
    this.setWorldSize('dungeon');
    this.floor=1;
    this.gen(1);
  }

  townTalk(){
    // adjacent NPC
    const dirs=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    let npc=null;
    for(const d of dirs){
      const m=this.monAt(this.p.x+d[0], this.p.y+d[1]);
      if(m && m.ai==='town'){ npc=m; break; }
    }
    if(!npc){
      this.msg("近くに話せる相手がいない");
      return;
    }
    this.openTownNpcMenu(npc);
  }


  // タイトル/町から確認できる共通ミニゲームハブ
  openMiniGameHub(opts={}){
    // opts.fromTitle: タイトルから開いた場合（説明を少し変える余地）
    const npc = { role:'casino', name:'カジノ係' };
    this.openTownNpcMenu(npc);
  }

  openTownNpcMenu(npc){
    const close=()=>{ const ol=$("#townOL"); if(ol) ol.style.display='none'; };
    const set=(title,desc)=>{ $("#townTitle").textContent=title||'町'; $("#townDesc").textContent=desc||''; };
    const clear=()=>{ $("#townTabs").innerHTML=''; $("#townList").innerHTML=''; $("#townActions").innerHTML=''; };
    const addAction=(label,fn)=>{ const b=document.createElement('div'); b.className='pill'; b.textContent=label; b.onclick=()=>fn(); $("#townActions").appendChild(b); };
    const addTab=(label,fn)=>{ const b=document.createElement('div'); b.className='pill'; b.textContent=label; b.onclick=()=>fn(); $("#townTabs").appendChild(b); };
    const show=()=>{ $("#townOL").style.display='flex'; };

    clear();
    if(npc.role==='shop'){
      set("商人","売買できます（品揃えは入るたびに少し変化）");
      const ensureStock=()=>{
        const now=Date.now();
        if(!this.townShopStock || !this.townShopStock.length || (now-this.townShopLastGen)>60*1000){
          this.townShopLastGen=now;
          const stock=[];
          const pool=[...HERBS.map(x=>({...x})), ...SCROLLS.map(x=>({...x})), ...WANDS.map(x=>({...x})), ...ARROWS.map(x=>({...x})), ...WEAPONS.map(x=>({...x, type:'weapon'})), ...ARMORS.map(x=>({...x, type:'armor'}))];
          for(let i=0;i<10;i++){
            const it=clone(choice(pool));
            it.type = it.type || (it.atk!=null?'weapon':(it.def!=null?'armor':it.type));
            it.ided = true;
            it.price = Math.max(10, Math.floor(priceOf(it)* (0.8 + Math.random()*0.6)));
            stock.push(it);
          }
          this.townShopStock=stock;
        }
      };
      const renderBuy=()=>{
        ensureStock();
        $("#townList").innerHTML='';
        for(const it of this.townShopStock){
          const d=document.createElement('div'); d.className='item';
          d.innerHTML=`<div>${it.name}${it.type==='arrow'?' x'+num(it.count,0):''}</div><div class="dim">${num(it.price,0)}G</div>`;
          d.onclick=()=>{
            if(this.inv.length>=this.baseInvMax()){ this.msg("持ち物がいっぱい"); return; }
            const cost=num(it.price,0);
            if(num(this.p.gold,0)<cost){ this.msg("お金が足りない"); return; }
            this.p.gold = num(this.p.gold,0)-cost;
      this.afterGoldChange();
            const bought=clone(it); delete bought.price;
            try{ bought.ch=itemChar(bought); }catch(e){}
            this.inv.push(bought);
            this.msg(`${bought.name}を買った`);
            this.render();
          };
          $("#townList").appendChild(d);
        }
        $("#townActions").innerHTML='';
        addAction("閉じる", ()=>{ close(); this.render(); });
      };
      const renderSell=()=>{
        $("#townList").innerHTML='';
        const sellables=this.inv.filter(it=>it.type!=='gold');
        if(!sellables.length){
          $("#townList").innerHTML='<div class="dim">売れるものがない</div>';
        }else{
          sellables.forEach((it,idx)=>{
            const price=Math.max(1, Math.floor(priceOf(it)*0.5));
            const d=document.createElement('div'); d.className='item';
            d.innerHTML=`<div>${it.name}${it.type==='arrow'?' x'+num(it.count,0):''}</div><div class="dim">売値 ${price}G</div>`;
            d.onclick=()=>{
              // equipped check
              if(this.p.wep===it || this.p.arm===it || this.p.arrow===it){ this.msg("装備中は売れない"); return; }
              this.inv.splice(this.inv.indexOf(it),1);
              this.p.gold = num(this.p.gold,0)+price;
      this.afterGoldChange();
              this.msg(`${it.name}を売った`);
              renderSell(); this.render();
            };
            $("#townList").appendChild(d);
          });
        }
        $("#townActions").innerHTML='';
        addAction("閉じる", ()=>{ close(); this.render(); });
      };

      addTab("買う", renderBuy);
      addTab("売る", renderSell);
      addTab("品揃え更新", ()=>{ this.townShopLastGen=0; renderBuy(); });
      renderBuy();
      show();
      return;
    }

    if(npc.role==='storage'){
      set("預かり屋","アイテムを預けたり引き取れます（預けた物は新規開始でも残ります）");
      let multi=false;
      let selected=new Set();
      const refresh=()=>{
        $("#townActions").innerHTML='';
        addAction(multi?"複数選択:ON":"複数選択:OFF", ()=>{ multi=!multi; selected.clear(); refresh(); render(); });
        addAction("閉じる", ()=>{ this.saveTownPersistent(); close(); this.render(); });
      };
      const render=()=>{
        $("#townList").innerHTML='';
        const modeLabel=$("#townTabs").querySelector('.pill.active')?.textContent||"";
      };
      const renderDeposit=()=>{
        $("#townTabs").querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
        const tabs=$("#townTabs").children; if(tabs[0]) tabs[0].classList.add('active');
        $("#townList").innerHTML='';
        if(!this.inv.length){
          $("#townList").innerHTML='<div class="dim">持ち物がない</div>';
        }else{
          this.inv.forEach((it)=>{
            const d=document.createElement('div'); d.className='item';
            const on=selected.has(it);
            d.innerHTML=`<div>${multi? (on?'☑ ':'☐ '):''}${it.name}${it.type==='arrow'?' x'+num(it.count,0):''}</div><div class="dim">${multi?'タップで選択':'預ける'}</div>`;
            d.onclick=()=>{
              if(multi){ if(on) selected.delete(it); else selected.add(it); renderDeposit(); return; }
              if(this.p.wep===it || this.p.arm===it || this.p.arrow===it){ this.msg("装備中は預けられない"); return; }
              const ser=Game._serializeItem(it);
              this.townStorage.push(ser);
              this.inv.splice(this.inv.indexOf(it),1);
              this.msg(`${it.name}を預けた`);
              renderDeposit(); this.render();
            };
            $("#townList").appendChild(d);
          });
        }
        $("#townActions").innerHTML='';
        addAction(multi?"選択を預ける":"", ()=>{});
        if(multi){
          addAction("選択を預ける", ()=>{
            const arr=[...selected];
            if(!arr.length){ this.msg("選択なし"); return; }
            for(const it of arr){
              if(this.p.wep===it || this.p.arm===it || this.p.arrow===it) continue;
              this.townStorage.push(Game._serializeItem(it));
              this.inv.splice(this.inv.indexOf(it),1);
            }
            selected.clear();
            this.msg("まとめて預けた");
            renderDeposit(); this.render();
          });
        }
        refresh();
      };
      const renderWithdraw=()=>{
        $("#townTabs").querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
        const tabs=$("#townTabs").children; if(tabs[1]) tabs[1].classList.add('active');
        $("#townList").innerHTML='';
        if(!this.townStorage.length){
          $("#townList").innerHTML='<div class="dim">預かりは空です</div>';
        }else{
          this.townStorage.forEach((o,idx)=>{
            const it=Game._restoreItem(o);
            const on=selected.has(idx);
            const d=document.createElement('div'); d.className='item';
            d.innerHTML=`<div>${multi?(on?'☑ ':'☐ '):''}${it?it.name:(o.name||'?')}${it&&it.type==='arrow'?' x'+num(it.count,0):''}</div><div class="dim">${multi?'タップで選択':'引き取る'}</div>`;
            d.onclick=()=>{
              if(multi){ if(on) selected.delete(idx); else selected.add(idx); renderWithdraw(); return; }
              if(this.inv.length>=this.baseInvMax()){ this.msg("持ち物がいっぱい"); return; }
              const got=Game._restoreItem(o);
              if(got){ this.inv.push(got); this.msg(`${got.name}を引き取った`); }
              this.townStorage.splice(idx,1);
              renderWithdraw(); this.render();
            };
            $("#townList").appendChild(d);
          });
        }
        $("#townActions").innerHTML='';
        if(multi){
          addAction("選択を引き取る", ()=>{
            const ids=[...selected].sort((a,b)=>b-a);
            if(!ids.length){ this.msg("選択なし"); return; }
            for(const idx of ids){
              if(this.inv.length>=this.baseInvMax()) break;
              const o=this.townStorage[idx];
              const got=Game._restoreItem(o);
              if(got) this.inv.push(got);
              this.townStorage.splice(idx,1);
            }
            selected.clear();
            this.msg("まとめて引き取った");
            renderWithdraw(); this.render();
          });
        }
        refresh();
      };
      const renderLost=()=>{
        $("#townTabs").querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
        const tabs=$("#townTabs").children; if(tabs[2]) tabs[2].classList.add('active');
        $("#townList").innerHTML='';
        if(!this.townLostFound.length){
          $("#townList").innerHTML='<div class="dim">返還品はありません</div>';
        }else{
          this.townLostFound.forEach((o,idx)=>{
            const it=Game._restoreItem(o);
            const d=document.createElement('div'); d.className='item';
            d.innerHTML=`<div>${it?it.name:(o.name||'?')}</div><div class="dim">受け取る</div>`;
            d.onclick=()=>{
              if(this.inv.length>=this.baseInvMax()){ this.msg("持ち物がいっぱい"); return; }
              const got=Game._restoreItem(o);
              if(got){ this.inv.push(got); this.msg(`${got.name}が返ってきた`); }
              this.townLostFound.splice(idx,1);
              this.saveTownPersistent();
              renderLost(); this.render();
            };
            $("#townList").appendChild(d);
          });
        }
        $("#townActions").innerHTML='';
        refresh();
      };

      addTab("預ける", renderDeposit);
      addTab("引き取る", renderWithdraw);
      addTab("返還品", renderLost);
      renderDeposit();
      refresh();
      show();
      return;
    }

    if(npc.role==='tagger'){
      set("タグ職人","装備に『返還タグ』を付けられます（死亡時に町へ返還され、タグも残ります）");
      const FEE=200;
      $("#townTabs").innerHTML='';
      $("#townList").innerHTML='';
      const addEquip=(label,it)=>{
        const d=document.createElement('div'); d.className='item';
        if(!it){
          d.innerHTML=`<div>${label}: なし</div><div class="dim"></div>`;
          $("#townList").appendChild(d); return;
        }
        const tagged=!!it.returnTag;
        d.innerHTML=`<div>${label}: ${it.name}${tagged?' [タグ済]':''}</div><div class="dim">${tagged?'付与済':'付ける '+FEE+'G'}</div>`;
        d.onclick=()=>{
          if(tagged){ this.msg("すでに付与済"); return; }
          if(num(this.p.gold,0)<FEE){ this.msg("お金が足りない"); return; }
          this.p.gold=num(this.p.gold,0)-FEE;
      this.afterGoldChange();
          it.returnTag=true;
          this.msg(`${it.name}にタグを付けた`);
          this.render();
          this.openTownNpcMenu(npc);
        };
        $("#townList").appendChild(d);
      };
      addEquip("武器", this.p.wep);
      addEquip("盾", this.p.arm);
      $("#townActions").innerHTML='';
      addAction("閉じる", ()=>{ close(); this.render(); });
      show();
      return;
    }

    if(npc.role==='casino'){
      set("カジノ","ゴールドで遊べます（0Gでも一部は練習できます）");
      $("#townTabs").innerHTML='';
      $("#townList").innerHTML='';
      const addGame=(name,desc,fn)=>{
        const d=document.createElement('div'); d.className='item';
        d.innerHTML=`<div>${name}</div><div class="dim">${desc}</div>`;
        d.onclick=()=>fn();
        $("#townList").appendChild(d);
      };
      addGame("HiGH&LOW","ゴールドで勝負（0Gでもプレイ可。報酬は賭け金×倍率）", ()=>{ this.openHighLow(); });
      addGame("10秒ストップ","10秒に近づけるだけ（無料）。途中で見えなくなるモードあり", ()=>{ this.openStop10(); });
      addGame("マインスイーパー","ゴールドで勝負（0GでもOK：賭け金10G扱い）。サイズ/爆弾数で難易度変化（賭け金×倍率）", ()=>{ this.openMinesweeperSetup(); });
      addGame("反射神経","合図が出た瞬間に止める（0GでもOK：賭け金10G扱い）。速いほど倍率UP", ()=>{ this.openReaction(); });
      addGame("ぷんよぷんよ","連鎖でスコア増。ゴールド獲得＆ハイスコア保存", ()=>{ this.openPunyopunyoSetup(); });
      addGame("ドットシューティング","弾幕×武器ドロップ。残機制。スコア保存", ()=>{ this.openDotShooterMenu(); });

      $("#townActions").innerHTML='';
      addAction("閉じる", ()=>{ close(); this.render(); });
      show();
      return;
    }

    set(npc.name,"…");
    $("#townActions").innerHTML='';
    addAction("閉じる", ()=>{ close(); });
    show();
  }
openHighLow(){
  const ol = $("#townOL");
  $("#townTitle").textContent = "HiGH&LOW";
  $("#townDesc").textContent = "数字(1-6)が出ます。次が高いか低いか当ててください（引き分けは負け）。報酬は賭け金×倍率。";

  $("#townTabs").innerHTML = '';
  $("#townList").innerHTML = '';
  $("#townActions").innerHTML = '';

  const gold = num(this.p.gold, 0);
  const cur = rand(1, 6);

  // 連続で賭け金を回せる前提なので倍率は控えめ
  const mult = 1.30;

  // 0Gかつ賭け金0のときは「10G賭けた扱い」にする（初期資金づくり用）
  const ZERO_G_SPECIAL_BET = 10;

  const betOptionsBase = [1, 5, 10, 20, 50, 100, 200, 500, 1000];
  const betOptions = betOptionsBase.filter(v => v <= gold);

  // 前回の賭け金を保持（次回もそのまま賭けられる）
  let bet = (this._hlBet != null) ? this._hlBet : null;

  // 0Gのときは賭け金を強制的に特別扱いにする（賭け金選択UIは出さない）
  let isZeroSpecial = false;
  if(gold <= 0){
    if(bet == null || bet <= 0){
      bet = ZERO_G_SPECIAL_BET;
      this._hlBet = bet;
    }
    isZeroSpecial = true;
  }else{
    // ゴールドがあるときは所持金に合わせてクランプ
    if(bet != null) bet = Math.min(bet, gold);
  }

  const renderHeader = ()=>{
    const d = document.createElement('div');
    d.className = 'item';
    const betTxt = (bet==null) ? '未選択' : (bet + 'G' + (isZeroSpecial ? '（0G特別）' : ''));
    d.innerHTML = `<div>現在: ${cur}</div><div class="dim">所持金:${num(this.p.gold,0)}G　賭け金:${betTxt}　倍率:${mult.toFixed(2)}</div>`;
    $("#townList").appendChild(d);
  };

  const addBtn = (label, fn)=>{
    const b = document.createElement('div');
    b.className = 'btn';
    b.textContent = label;
    b.onclick = ()=>fn();
    $("#townActions").appendChild(b);
  };

  renderHeader();

  // 所持金がある場合は賭け金を選ぶ（0Gのときは自動で特別賭け金になる）
  if(gold > 0 && bet == null){
    const info = document.createElement('div');
    info.className = 'dim';
    info.style.marginTop = '6px';
    info.textContent = '賭け金を選んでください';
    $("#townList").appendChild(info);

    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '8px';
    row.style.justifyContent = 'flex-start';
    row.style.gap = '8px';

    const addBet = (v)=>{
      const bb = document.createElement('div');
      bb.className = 'btn';
      bb.textContent = v + 'G';
      bb.onclick = ()=>{ this._hlBet = v; this.openHighLow(); };
      row.appendChild(bb);
    };

    betOptions.slice(0, 12).forEach(addBet);

    const allBtn = document.createElement('div');
    allBtn.className = 'btn';
    allBtn.textContent = '全額';
    allBtn.onclick = ()=>{ this._hlBet = gold; this.openHighLow(); };
    if(gold > 0) row.appendChild(allBtn);

    $("#townList").appendChild(row);

    addBtn('戻る', ()=>{ this.openTownNpcMenu(this.mons.find(m=>m.ai==='town' && m.role==='casino')); });
    if(ol) ol.style.display = 'flex';
    return;
  }

  const play = (guess)=>{
    const g0 = num(this.p.gold, 0);

    // 実際に賭けに使う金額
    let effBet = bet;

    // 0G時は必ず「10G賭けた扱い」（このケースは所持金からは引かない）
    if(g0 <= 0){
      effBet = ZERO_G_SPECIAL_BET;
    }else{
      // ゴールドがある場合は賭け金が所持金を超えないように
      if(effBet > g0) effBet = g0;
      if(effBet <= 0){
        this.msg('賭け金を選んでください');
        this._hlBet = null;
        return this.openHighLow();
      }
      // 賭け金を先に支払う
      this.p.gold = g0 - effBet;
      this.afterGoldChange();
    }

    // 次回も同額で賭けられるよう保存
    this._hlBet = effBet;

    const nxt = rand(1, 6);
    const win = (guess === 'H') ? (nxt > cur) : (nxt < cur);

    if(win){
      const gain = Math.max(0, Math.floor(effBet * mult));
      this.p.gold = num(this.p.gold, 0) + gain;
      this.afterGoldChange();
      this.msg(`当たり！ ${nxt} -> +${gain}G（賭け金${effBet}G / 倍率${mult.toFixed(2)}）`);
    }else{
      this.msg(`外れ… ${nxt}`);
    }

    this.render();
    this.openHighLow();
  };

  addBtn('LOW', ()=>play('L'));
  addBtn('HIGH', ()=>play('H'));
  addBtn('賭け金変更', ()=>{ this._hlBet = null; this.openHighLow(); });
  addBtn('戻る', ()=>{ this.openTownNpcMenu(this.mons.find(m=>m.ai==='town' && m.role==='casino')); });

  if(ol) ol.style.display = 'flex';
}
  openStop10(){
    const ol=$("#townOL");
    $("#townTitle").textContent="10秒ストップ";
    $("#townDesc").textContent="スタートして、10.0秒に近いところで止めてください（無料）。途中で見えなくなるモードもあります。";
    $("#townTabs").innerHTML='';
    $("#townList").innerHTML='';
    $("#townActions").innerHTML='';
    let blind = !!this._stop10Blind;

    const box=document.createElement('div');
    box.className='item';
    box.innerHTML=`
      <div id="stop10State">準備OK</div>
      <div class="dim">10.0秒±0.2でボーナス（ブラインド時は少し上乗せ）</div>
      <div class="dim" id="stop10Mode">モード: ${blind? '途中で見えなくなる' : '通常'}</div>
    `;
    $("#townList").appendChild(box);
    let t0=null, timer=null;
    let hideAt=null, hidden=false;
    const setState=(s)=>{ const el=document.getElementById('stop10State'); if(el) el.textContent=s; };
    const setMode=()=>{ const el=document.getElementById('stop10Mode'); if(el) el.textContent = 'モード: ' + (blind? '途中で見えなくなる' : '通常'); };
    const start=()=>{
      if(timer) return;
      t0=performance.now();
      hidden=false;
      // 途中で見えなくなる：1.2〜6.5秒のどこかで表示が消え、その後は「…」になる
      hideAt = blind ? (rand(120, 650) / 100) : null;
      timer=setInterval(()=>{
        const dt=(performance.now()-t0)/1000;
        if(blind && !hidden && hideAt!=null && dt>=hideAt){
          hidden=true;
        }
        if(blind && hidden){
          setState('…');
        }else{
          setState(dt.toFixed(2)+'秒');
        }
      },33);
    };
    const stop=()=>{
      if(!timer) return;
      clearInterval(timer); timer=null;
      const dt=(performance.now()-t0)/1000;
      const diff=Math.abs(dt-10);
      setState(dt.toFixed(2)+'秒（差 '+diff.toFixed(2)+'）');
      let reward=0;
      if(diff<=0.20) reward=rand(60,120);
      else if(diff<=0.50) reward=rand(20,60);
      else reward=rand(0,20);
      // ブラインドは少し上乗せ
      if(blind) reward = Math.floor(reward * 1.15);
      if(reward>0){
        this.p.gold = num(this.p.gold,0)+reward;
      this.afterGoldChange();
        this.msg(`報酬 +${reward}G`);
      }else{
        this.msg("参加賞");
      }
      this.render();
    };
    const addBtn=(label,fn)=>{ const b=document.createElement('div'); b.className='pill'; b.textContent=label; b.onclick=()=>fn(); $("#townActions").appendChild(b); return b; };
    addBtn("START", start);
    addBtn("STOP", stop);
    const blindBtn = addBtn(`ブラインド:${blind?'ON':'OFF'}`, ()=>{
      if(timer) return; // 計測中の切替は事故るので禁止
      blind = !blind;
      this._stop10Blind = blind;
      setMode();
      blindBtn.textContent = `ブラインド:${blind?'ON':'OFF'}`;
    });
    addBtn("もう一回", ()=>{ if(timer){ clearInterval(timer); timer=null; } this.openStop10(); });
    addBtn("戻る", ()=>{ if(timer){ clearInterval(timer); timer=null; } this.openTownNpcMenu(this.mons.find(m=>m.ai==='town' && m.role==='casino')); });
    if(ol) ol.style.display='flex';
  }

  openReaction(){
    const ol = $("#townOL");
    $("#townTitle").textContent = "反射神経";
    $("#townDesc").textContent = "合図『NOW!』が出たらすぐ止めてください。速いほど倍率UP（0GでもOK：賭け金10G扱い）。";
    $("#townTabs").innerHTML='';
    $("#townList").innerHTML='';
    $("#townActions").innerHTML='';

    const gold = num(this.p.gold,0);
    const ZERO_G_SPECIAL_BET = 10;

    const betOptionsBase = [10, 20, 50, 100, 200, 500, 1000];
    const betOptions = betOptionsBase.filter(v => v <= gold);
    let bet = (this._rxBet != null) ? this._rxBet : null;

    // 0Gは自動で10G扱い
    let isZeroSpecial = false;
    if(gold <= 0){
      if(bet == null || bet <= 0) bet = ZERO_G_SPECIAL_BET;
      isZeroSpecial = true;
    }else{
      if(bet != null) bet = Math.min(bet, gold);
    }

    const stateBox = document.createElement('div');
    stateBox.className = 'item';
    stateBox.innerHTML = `<div id="rxState">準備OK</div><div class="dim" id="rxSub">賭け金:${bet}G${isZeroSpecial?'（0G特別）':''}</div>`;
    $("#townList").appendChild(stateBox);

    // 所持金があるのに賭け金未選択なら選択UI
    if(gold > 0 && (bet == null || bet <= 0)){
      const info = document.createElement('div');
      info.className = 'dim';
      info.style.marginTop = '6px';
      info.textContent = '賭け金を選んでください';
      $("#townList").appendChild(info);

      const row = document.createElement('div');
      row.className = 'row';
      row.style.marginTop = '8px';
      row.style.justifyContent = 'flex-start';
      row.style.gap = '8px';
      const addBet = (v)=>{
        const bb = document.createElement('div');
        bb.className = 'btn';
        bb.textContent = v + 'G';
        bb.onclick = ()=>{ this._rxBet = v; this.openReaction(); };
        row.appendChild(bb);
      };
      betOptions.slice(0, 12).forEach(addBet);
      const allBtn = document.createElement('div');
      allBtn.className = 'btn';
      allBtn.textContent = '全額';
      allBtn.onclick = ()=>{ this._rxBet = gold; this.openReaction(); };
      row.appendChild(allBtn);
      $("#townList").appendChild(row);

      const back = document.createElement('div');
      back.className = 'btn';
      back.textContent = '戻る';
      back.onclick = ()=>{ this.openTownNpcMenu(this.mons.find(m=>m.ai==='town' && m.role==='casino')); };
      $("#townActions").appendChild(back);
      if(ol) ol.style.display='flex';
      return;
    }

    const setState = (s)=>{ const el=document.getElementById('rxState'); if(el) el.textContent=s; };
    const setSub = (s)=>{ const el=document.getElementById('rxSub'); if(el) el.textContent=s; };

    let waiting = false;
    let armed = false;
    let tNow = 0;
    let waitTimer = null;

    const start = ()=>{
      if(waiting || armed) return;

      const g0 = num(this.p.gold,0);
      let effBet = bet;
      if(g0 <= 0){
        effBet = ZERO_G_SPECIAL_BET;
        isZeroSpecial = true;
      }else{
        effBet = Math.min(Math.max(1, effBet), g0);
        // 賭け金支払い
        this.p.gold = g0 - effBet;
      this.afterGoldChange();
      }
      this._rxBet = effBet;
      bet = effBet;
      this.render();

      setSub(`賭け金:${bet}G${isZeroSpecial?'（0G特別）':''} / 所持金:${num(this.p.gold,0)}G`);
      setState('待て…');
      waiting = true;
      armed = false;
      const delay = rand(120, 380) * 10; // 1200〜3800ms
      waitTimer = setTimeout(()=>{
        waiting = false;
        armed = true;
        tNow = performance.now();
        setState('NOW!');
      }, delay);
    };

    const stop = ()=>{
      if(waiting){
        // 早押し：負け（賭け金は戻らない）
        clearTimeout(waitTimer); waitTimer=null;
        waiting = false;
        armed = false;
        setState('早すぎ！');
        this.msg('フライング…');
        this.render();
        return;
      }
      if(!armed) return;
      armed = false;
      const rt = (performance.now() - tNow) / 1000;
      setState(`反応: ${rt.toFixed(3)}s`);

      // 速いほど倍率UP（極端に稼げすぎないように上限）
      let mult = 0.9;
      if(rt <= 0.20) mult = 1.85;
      else if(rt <= 0.28) mult = 1.55;
      else if(rt <= 0.38) mult = 1.30;
      else if(rt <= 0.55) mult = 1.10;
      else mult = 0.95;
      const gain = Math.max(0, Math.floor(bet * mult));
      this.p.gold = num(this.p.gold,0) + gain;
      this.afterGoldChange();
      this.afterGoldChange();
      this.msg(`報酬 +${gain}G（賭け金${bet}G / 倍率${mult.toFixed(2)}）`);
      this.render();
      setSub(`賭け金:${bet}G${isZeroSpecial?'（0G特別）':''} / 所持金:${num(this.p.gold,0)}G`);
    };

    const addBtn=(label,fn)=>{ const b=document.createElement('div'); b.className='pill'; b.textContent=label; b.onclick=()=>fn(); $("#townActions").appendChild(b); return b; };
    addBtn('START', start);
    addBtn('STOP', stop);
    addBtn('もう一回', ()=>{ if(waitTimer){ clearTimeout(waitTimer); waitTimer=null; } waiting=false; armed=false; this.openReaction(); });
    addBtn('賭け金変更', ()=>{ if(waitTimer){ clearTimeout(waitTimer); waitTimer=null; } waiting=false; armed=false; this._rxBet = null; this.openReaction(); });
    addBtn('戻る', ()=>{ if(waitTimer){ clearTimeout(waitTimer); waitTimer=null; } waiting=false; armed=false; this.openTownNpcMenu(this.mons.find(m=>m.ai==='town' && m.role==='casino')); });

    if(ol) ol.style.display='flex';
  }




  // ===== MiniGame: ぷんよぷんよ（ぷよぷよ風） =====
  getPunyopunyoHighScore(){
    try{ return num(JSON.parse(localStorage.getItem(LS_PUNYO_HS)||'0'),0); }catch(e){ return 0; }
  }
  setPunyopunyoHighScore(v){
    try{ localStorage.setItem(LS_PUNYO_HS, JSON.stringify(num(v,0))); }catch(e){}
  }

getPunyopunyoScoreBook(){
  try{
    const raw = localStorage.getItem(LS_PUNYO_SCORES);
    if(!raw) return {v:1, combos:{}, history:[]};
    const b = JSON.parse(raw);
    if(!b || typeof b!=='object') return {v:1, combos:{}, history:[]};
    if(!b.combos || typeof b.combos!=='object') b.combos = {};
    if(!Array.isArray(b.history)) b.history = [];
    b.v = num(b.v,1) || 1;
    if(b.history.length>200) b.history = b.history.slice(-200);
    return b;
  }catch(e){
    return {v:1, combos:{}, history:[]};
  }
}
setPunyopunyoScoreBook(book){
  try{
    if(!book || typeof book!=='object') book = {v:1, combos:{}, history:[]};
    if(!book.combos || typeof book.combos!=='object') book.combos = {};
    if(!Array.isArray(book.history)) book.history = [];
    if(book.history.length>200) book.history = book.history.slice(-200);
    localStorage.setItem(LS_PUNYO_SCORES, JSON.stringify(book));
  }catch(e){}
}
ppMakeScoreComboKey(pp, bet){
  const sizeKey = String(pp?.sizeKey || 'N');
  const distKey = String(pp?.distKey || 'STD');
  const maxN = Math.max(2, Math.min(20, num(pp?.maxN,4)));
  const assist = pp?.assist ? 1 : 0;
  const b = Math.max(0, num(bet,0));
  return `${sizeKey}|${distKey}|${maxN}|${assist}|${b}`;
}
ppRecordPunyopunyoScore(pp, mul, reward, forceQuit=false){
  try{
    if(!pp) return;
    const betRaw = num(pp.bet,0);
    const loanBet = num(pp.loanBet,0);
    const virtBet = (loanBet>0) ? loanBet : betRaw;

    const key = this.ppMakeScoreComboKey(pp, virtBet);
    const book = this.getPunyopunyoScoreBook();
    const now = Date.now();
    const score = num(pp.score,0);

    const rec = book.combos[key] || {best:0, plays:0, last:0, lastScore:0, lastReward:0, lastMul:0};
    rec.plays = num(rec.plays,0) + 1;
    rec.last = now;
    rec.lastScore = score;
    rec.lastReward = Math.max(0, num(reward,0));
    rec.lastMul = num(mul,0);
    if(score > num(rec.best,0)) rec.best = score;
    book.combos[key] = rec;

    book.history.push({
      t: now,
      key,
      sizeKey: String(pp.sizeKey||'N'),
      distKey: String(pp.distKey||'STD'),
      maxN: Math.max(2, Math.min(20, num(pp.maxN,4))),
      assist: !!pp.assist,
      bet: virtBet,
      score,
      mul: num(mul,0),
      reward: Math.max(0, num(reward,0)),
      quit: !!forceQuit
    });
    if(book.history.length>200) book.history = book.history.slice(-200);

    this.setPunyopunyoScoreBook(book);
  }catch(e){}
}
ppScoreBookToText(book){
  book = book || this.getPunyopunyoScoreBook();
  const lines=[];
  lines.push("Punyopunyo Score Book v1");
  const combos = book.combos || {};
  const items = Object.keys(combos).map(k=>({k, ...combos[k]}));
  items.sort((a,b)=> num(b.best,0)-num(a.best,0));
  for(const it of items){
    const lastStr = it.last ? (new Date(it.last)).toLocaleString() : '';
    lines.push(`${it.k}\tbest=${num(it.best,0)}\tplays=${num(it.plays,0)}\tlastScore=${num(it.lastScore,0)}\tlastReward=${num(it.lastReward,0)}\tlastMul=${num(it.lastMul,0).toFixed(2)}\tlast=${lastStr}`);
  }
  return lines.join("\n");
}
ppOpenScoreBookWindow(){
  const idOL='ppScoreOL';
  let ol=document.getElementById(idOL);
  if(!ol){
    ol=document.createElement('div');
    ol.id=idOL;
    ol.className='ppScoreOL';
    ol.innerHTML = `
      <div class="ppScoreModal">
        <div class="ppScoreHead">
          <div class="ppScoreTitle">スコア一覧</div>
          <div class="ppScoreHeadBtns">
            <button class="btn ppMiniAction" id="ppScoreTextBtn">テキスト</button>
            <button class="btn ppMiniAction" id="ppScoreCloseBtn">閉じる</button>
          </div>
        </div>
        <div class="dim ppScoreNote">組み合わせ別に「最高」と「直近」を保存します（ローカル＋セーブコードにも含まれます）。</div>
        <div id="ppScoreList"></div>
        <div id="ppScoreTextBox" style="display:none; margin-top:10px;">
          <div class="dim" style="margin-bottom:6px;">コピーして保存できます</div>
          <textarea id="ppScoreTextArea" class="ppScoreTA" rows="10"></textarea>
        </div>
      </div>
    `;
    document.body.appendChild(ol);

    const close=()=>{ ol.style.display='none'; };
    ol.addEventListener('click',(e)=>{ if(e.target===ol) close(); });

    const closeBtn = document.getElementById('ppScoreCloseBtn');
    if(closeBtn) closeBtn.onclick = close;

    const textBtn = document.getElementById('ppScoreTextBtn');
    if(textBtn){
      textBtn.onclick = ()=>{
        const book = this.getPunyopunyoScoreBook();
        const box = document.getElementById('ppScoreTextBox');
        const ta  = document.getElementById('ppScoreTextArea');
        if(ta) ta.value = this.ppScoreBookToText(book);
        if(box) box.style.display='block';
        try{ if(ta){ ta.focus(); ta.select(); } }catch(e){}
      };
    }
  }

  // refresh list
  const book = this.getPunyopunyoScoreBook();
  const combos = book.combos || {};

  const sizeLabelMap = {
    N:'標準 6×12',
    L:'大 8×16',
    T:'縦 10×20',
    T2:'縦 10×24',
    W:'横 12×10',
    W2:'横+ 14×9',
    UW:'超横 16×8',
  };
  const distLabelMap = { STD:'標準', BIG:'大きめ', HUGE:'極大', FLAT:'均等' };

  const items = Object.keys(combos).map(k=>{
    const parts = String(k).split('|');
    return {
      k,
      sizeKey: parts[0] || 'N',
      distKey: parts[1] || 'STD',
      maxN: num(parts[2],4),
      assist: (parts[3] === '1'),
      bet: num(parts[4],0),
      best: num(combos[k]?.best,0),
      plays: num(combos[k]?.plays,0),
      last: num(combos[k]?.last,0),
      lastScore: num(combos[k]?.lastScore,0),
      lastReward: num(combos[k]?.lastReward,0),
      lastMul: num(combos[k]?.lastMul,0),
    };
  });
  items.sort((a,b)=> (b.best-a.best) || (b.last-a.last));

  const host = document.getElementById('ppScoreList');
  if(host){
    if(!items.length){
      host.innerHTML = '<div class="dim">（まだ記録がありません）</div>';
    }else{
      let html = '';
      const showN = 60;
      for(const it of items.slice(0, showN)){
        const sLab = sizeLabelMap[it.sizeKey] || it.sizeKey;
        const dLab = distLabelMap[it.distKey] || it.distKey;
        const lastStr = it.last ? (new Date(it.last)).toLocaleString() : '';
        html += `
          <div class="ppScoreRow">
            <div class="ppScoreCfg">${sLab} / ${dLab} / 最大${it.maxN} / 賭け金${it.bet}G${it.assist?' / ｱｼ':''}</div>
            <div class="ppScoreNums"><b>${it.best}</b><span class="dim"> best</span> <span class="dim">|</span> ${it.lastScore} <span class="dim">last</span></div>
            <div class="ppScoreMeta dim">${it.plays}回 / ${lastStr}</div>
          </div>
        `;
      }
      if(items.length>showN){
        html += `<div class="dim" style="margin-top:8px;">※上位${showN}件のみ表示（テキスト出力には全件含まれます）</div>`;
      }
      host.innerHTML = html;
    }
  }

  const box = document.getElementById('ppScoreTextBox');
  if(box) box.style.display='none';

  const ol2 = document.getElementById(idOL);
  if(ol2) ol2.style.display='flex';
}
  // ===== MiniGame: ドットシューティング =====
  getDotShootHighScore(){
    try{ return num(JSON.parse(localStorage.getItem(LS_DOTSHOOT_HS)||'0'),0); }catch(e){ return 0; }
  }
  setDotShootHighScore(v){
    try{ localStorage.setItem(LS_DOTSHOOT_HS, JSON.stringify(num(v,0))); }catch(e){}
  }
  getDotShootScoreBook(){
    try{
      const raw = localStorage.getItem(LS_DOTSHOOT_SCORES);
      if(!raw) return {v:1, best:0, plays:0, last:0, history:[]};
      const b = JSON.parse(raw);
      if(!b || typeof b!=='object') return {v:1, best:0, plays:0, last:0, history:[]};
      b.v = num(b.v,1)||1;
      b.best = num(b.best,0);
      b.plays = num(b.plays,0);
      b.last = num(b.last,0);
      if(!Array.isArray(b.history)) b.history=[];
      if(b.history.length>120) b.history=b.history.slice(-120);
      return b;
    }catch(e){
      return {v:1, best:0, plays:0, last:0, history:[]};
    }
  }
  setDotShootScoreBook(book){
    try{
      if(!book || typeof book!=='object') book = {v:1, best:0, plays:0, last:0, history:[]};
      if(!Array.isArray(book.history)) book.history=[];
      if(book.history.length>120) book.history=book.history.slice(-120);
      localStorage.setItem(LS_DOTSHOOT_SCORES, JSON.stringify(book));
    }catch(e){}
  }
  dsRecordScore(score, meta={}){
    try{
      const s = Math.max(0, num(score,0));
      const book = this.getDotShootScoreBook();
      const now = Date.now();
      book.plays = num(book.plays,0) + 1;
      book.last = now;
      if(s > num(book.best,0)) book.best = s;
      book.history.push({
        t: now,
        score: s,
        wave: num(meta.wave,0),
        time: num(meta.time,0),
        weapon: String(meta.weapon||'N'),
        dif: num(meta.dif,0),
      });
      if(book.history.length>120) book.history = book.history.slice(-120);
      this.setDotShootScoreBook(book);

      const hs = this.getDotShootHighScore();
      if(s > hs) this.setDotShootHighScore(s);
    }catch(e){}
  }
  dsScoreBookToText(book){
    try{
      const b = book || this.getDotShootScoreBook();
      const lines=[];
      lines.push('=== ドットシューティング：スコア記録 ===');
      lines.push(`Best: ${num(b.best,0)} / Plays: ${num(b.plays,0)}`);
      lines.push('');
      const hist = Array.isArray(b.history)?b.history:[];
      const sorted = [...hist].sort((a,b)=>num(b.t,0)-num(a.t,0));
      for(const r of sorted){
        const dt = r.t ? new Date(r.t).toLocaleString() : '';
        lines.push(`${dt}\t${num(r.score,0)}\tWAVE ${num(r.wave,0)}\t${String(r.weapon||'N')}\tDIF ${num(r.dif,0)}`);
      }
      return lines.join('\n');
    }catch(e){
      return '（出力に失敗しました）';
    }
  }

  openDotShooterMenu(){
    const close = ()=>{ const ol=$("#townOL"); if(ol) ol.style.display='none'; };
    const show  = ()=>{ const ol=$("#townOL"); if(ol) ol.style.display='flex'; };
    const set   = (title,sub)=>{
      const t=$("#townTitle"); if(t) t.textContent=title;
      const s=$("#townSub")||$("#townDesc"); if(s) s.textContent=sub||'';
    };

    set("ドットシューティング","弾幕×武器ドロップ。残機制。時間経過で敵が際限なく増える（重くならない範囲で上限あり）。スコアは保存されます。");
    const tabs=$("#townTabs"); if(tabs) tabs.innerHTML='';
    const list=$("#townList");
    const book = this.getDotShootScoreBook();
    const hs = this.getDotShootHighScore();

    if(list){
      list.innerHTML = `
        <div class="ppSetup">
          <div class="ppRow"><div>ハイスコア</div><div><b id="dsHighDisp">${hs}</b></div></div>
          <div class="ppRow"><div>プレイ回数</div><div><b id="dsPlaysDisp">${num(book.plays,0)}</b></div></div>
          <div class="ppRow"><div>スコア一覧</div><div><div class="btn" id="dsOpenListBtn" style="padding:8px 10px;font-size:13px;">開く</div></div></div>
          <div id="dsListBox" style="display:none;margin-top:8px;">
            <div class="dim" style="margin:6px 0;">直近の記録（最大40件）</div>
            <div id="dsListRows"></div>
            <div class="row" style="justify-content:flex-end;margin-top:8px;gap:8px;flex-wrap:wrap">
              <div class="btn" id="dsExportBtn" style="padding:8px 10px;font-size:13px;">テキスト出力</div>
              <div class="btn" id="dsCloseListBtn" style="padding:8px 10px;font-size:13px;">閉じる</div>
            </div>
            <textarea id="dsTextBox" style="display:none;width:100%;height:160px;margin-top:8px;background:#0f151b;color:#e9eef3;border:1px solid #22303b;border-radius:10px;padding:8px;font-size:12px;white-space:pre;"></textarea>
          </div>

          <div style="margin-top:10px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap">
            <div class="btn" id="dsStartBtn">START</div>
          </div>
        </div>
      `;
    }

    const renderList = ()=>{
      const box=$("#dsListBox");
      const rows=$("#dsListRows");
      if(!box || !rows) return;
      const b = this.getDotShootScoreBook();
      const hist = Array.isArray(b.history)?b.history:[];
      const sorted = [...hist].sort((a,b)=>num(b.t,0)-num(a.t,0)).slice(0,40);
      if(!sorted.length){
        rows.innerHTML = `<div class="dim">（まだ記録がありません）</div>`;
      }else{
        let html='';
        for(const r of sorted){
          const dt = r.t ? new Date(r.t).toLocaleString() : '';
          html += `<div class="ppScoreRow">
            <div class="ppScoreCfg">${dt}</div>
            <div class="ppScoreNums"><b>${num(r.score,0)}</b> <span class="dim">score</span> <span class="dim">|</span> W${num(r.wave,0)} <span class="dim">|</span> ${String(r.weapon||'N')}</div>
            <div class="ppScoreMeta dim">DIF ${num(r.dif,0)} / ${Math.floor(num(r.time,0)/1000)}s</div>
          </div>`;
        }
        rows.innerHTML = html;
      }
    };

    const openListBtn=$("#dsOpenListBtn");
    const closeListBtn=$("#dsCloseListBtn");
    const exportBtn=$("#dsExportBtn");
    const listBox=$("#dsListBox");
    const textBox=$("#dsTextBox");

    if(openListBtn){
      bindTap(openListBtn, ()=>{
        if(listBox) listBox.style.display='block';
        if(textBox) textBox.style.display='none';
        renderList();
      });
    }
    if(closeListBtn){
      bindTap(closeListBtn, ()=>{
        if(listBox) listBox.style.display='none';
        if(textBox) textBox.style.display='none';
      });
    }
    if(exportBtn){
      bindTap(exportBtn, ()=>{
        if(!textBox) return;
        const b = this.getDotShootScoreBook();
        textBox.value = this.dsScoreBookToText(b);
        textBox.style.display='block';
        try{ textBox.focus(); textBox.select(); }catch(e){}
      });
    }

    const startBtn=$("#dsStartBtn");
    if(startBtn){
      bindTap(startBtn, ()=>{ this.openDotShooterTitle(true); });
      startBtn.addEventListener('click', (e)=>{ e.preventDefault(); this.openDotShooterTitle(true); });
    }

    const actions=$("#townActions");
    if(actions) actions.innerHTML='';
    const addBtn=(label,fn)=>{
      const b=document.createElement('div');
      b.className='btn';
      b.textContent=label;
      bindTap(b, ()=>fn());
      if(actions) actions.appendChild(b);
      return b;
    };
    addBtn("戻る", ()=>{ this.openTownNpcMenu(this.mons.find(m=>m.ai==='town' && m.role==='casino') || {role:'casino',name:'カジノ係'}); });
    addBtn("閉じる", ()=>{ close(); this.render(); });

    show();
  }

  openDotShooter(){
    const ol = $("#dotShootOL");
    if(!ol){ this.msg("dotShootOL が見つかりません"); return; }

    // 町オーバーレイは隠す（ゲーム中はフルスクリーン）
    const town = $("#townOL");
    if(town) town.style.display='none';

    this.dsInitUIOnce();
    this.dsHideSplash();
    this.dsStartNewRun();

    ol.style.display='flex';
  }

  // DotShooterの「独立タイトル（スプラッシュ）」を開く
  // - autostart=true: そのままプレイ開始
  // - fromTown=true: 町(カジノ)から来た扱い（CLOSEでミニゲーム一覧へ戻す）
  openDotShooterTitle(autostart=false, fromTown=false){
    const ol = $("#dotShootOL");
    if(!ol){ this.msg("dotShootOL が見つかりません"); return; }

    // 画面の主導権をDotShooterへ（ローグライクのtitle/gameは隠す）
    try{ const t=$("#title"); if(t) t.style.display='none'; }catch(e){}
    try{ const gm=$("#game"); if(gm) gm.style.display='none'; }catch(e){}

    // 町オーバーレイも隠す
    try{ const town=$("#townOL"); if(town) town.style.display='none'; }catch(e){}

    this._dsBackToTown = !!fromTown;
    this.dsInitUIOnce();

    // 直前のRUNが残っていれば止める
    try{ if(this._ds && this._ds.raf) cancelAnimationFrame(this._ds.raf); }catch(e){}
    try{ if(this._ds) this._ds.running = false; }catch(e){}

    ol.style.display='flex';
    if(autostart){
      this.openDotShooter();
    }else{
      this.dsShowSplash();
    }
  }

  dsShowSplash(){
    const sp = $("#dsSplash");
    if(sp) sp.style.display='flex';
    // GameOverパネルは隠す
    const over = $("#dsOver");
    if(over) over.style.display='none';
    // HI表示
    const hs = this.getDotShootHighScore();
    const a=$("#dsHiSplash"); if(a) a.textContent=String(hs);
    const b=$("#dsHiNow");   if(b) b.textContent=String(hs);
    this.dsRenderPermaSplash();
  }

  dsHideSplash(){
    const sp = $("#dsSplash");
    if(sp) sp.style.display='none';
  }


  // Ensure the on-screen D-pad is present and visible (it must never disappear after START)
  dsForcePadVisible(reason=""){
    // legacy name kept for compatibility with older code paths
    // In this version, the joystick is shown only while swiping.
    try{
      const hud = document.getElementById('dsHud') || document.getElementById('dotShootOL') || document.body;
      let pad = document.getElementById('dsPad');
      if(!pad){
        pad = document.createElement('div');
        pad.id = 'dsPad';
        pad.className = 'dsJoy dsJoyFloat';
        const h = document.createElement('div');
        h.id = 'dsPadHandle';
        h.className = 'dsJoyHandle';
        const base = document.createElement('div');
        base.className = 'dsJoyBase';
        const knob = document.createElement('div');
        knob.id = 'dsPadKnob';
        knob.className = 'dsJoyKnob';
        pad.appendChild(h);
        pad.appendChild(base);
        pad.appendChild(knob);
        hud.appendChild(pad);
      }
      if(!pad.style.display) pad.style.display = 'none';
      if(!pad.style.opacity) pad.style.opacity = '0';
    }catch(e){}
  }



  dsInitUIOnce(){
    if(this._dsUIInit) return;
    this._dsUIInit = true;

    const cv = $("#dotShootCanvas");
    if(!cv) return;
    // 内部解像度（低めでドット感＆軽量化）
    cv.width = 240;
    cv.height = 360;
    cv.style.imageRendering = 'pixelated';

    const btn = (id)=>$("#"+id);

    // DotShooter standalone title buttons
    const splashStart = btn('dsStartGameBtn');
    if(splashStart) bindTap(splashStart, ()=>{ this.openDotShooter(); });


    const resetPerma = btn('dsResetPermaBtn');
    if(resetPerma) bindTap(resetPerma, ()=>{
      // confirm to prevent accidental reset
      if(!window.confirm('永続成長（引き継ぎ）をリセットしますか？\n※この操作は取り消せません')) return;
      this.dsResetPerma();
      // refresh splash label
      try{
        if(this._ds) this._ds.perma = this.dsPermaDefault();
        this.dsShowSplash(true);
      }catch(e){}
      this.dsAddToast('引き継ぎをリセットしました');
    });


    const holdBtn = (el, on, off)=>{
      if(!el) return;
      const down = (e)=>{ e.preventDefault(); on(); };
      const up = (e)=>{ e.preventDefault(); off(); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
    };    // virtual joystick: swipe anywhere to summon (space-saving)
    const hud = $("#dsHud") || document.body;
    let pad = btn('dsPad');
    let knob = btn('dsPadKnob');
    let handle = btn('dsPadHandle');

    const ensurePadNodes = ()=>{
      pad = btn('dsPad');
      knob = btn('dsPadKnob');
      handle = btn('dsPadHandle');
      if(!pad){
        // (safety) recreate pad if missing
        const np = document.createElement('div');
        np.id = 'dsPad';
        np.className = 'dsJoy dsJoyFloat';
        const h = document.createElement('div');
        h.id = 'dsPadHandle';
        h.className = 'dsJoyHandle';
        const base = document.createElement('div');
        base.className = 'dsJoyBase';
        const k = document.createElement('div');
        k.id = 'dsPadKnob';
        k.className = 'dsJoyKnob';
        np.appendChild(h); np.appendChild(base); np.appendChild(k);
        (hud || document.body).appendChild(np);
        pad = np; knob = k; handle = h;
      }
    };
    ensurePadNodes();

    const joy = {drag:false, cx:0, cy:0, rad:48, pid:null};

    const setMove = (ax, ay)=>{
      if(!this._ds || !this._ds.input) return;
      this._ds.input.ax = clamp(ax, -1, 1);
      this._ds.input.ay = clamp(ay, -1, 1);
    };

    const setKnob = (ax, ay)=>{
      if(!knob) return;
      const r = joy.rad;
      knob.style.setProperty('--dx', Math.round(ax*r)+'px');
      knob.style.setProperty('--dy', Math.round(ay*r)+'px');
    };

    const calcCenter = ()=>{
      if(!pad) return;
      const r = pad.getBoundingClientRect();
      joy.cx = r.left + r.width/2;
      joy.cy = r.top + r.height/2;
      joy.rad = Math.max(26, Math.min(r.width, r.height) * 0.24);
    };

    const clampPadToViewport = (x, y)=>{
      if(!pad) return {x,y};
      const w = window.innerWidth || document.documentElement.clientWidth || 360;
      const h = window.innerHeight || document.documentElement.clientHeight || 640;
      const pw = pad.offsetWidth || 168;
      const ph = pad.offsetHeight || 168;
      const nx = clamp(x - pw/2, 8, Math.max(8, w - pw - 8));
      const ny = clamp(y - ph/2, 8, Math.max(8, h - ph - 8));
      return {x:nx, y:ny};
    };

    const showPadAt = (x, y)=>{
      ensurePadNodes();
      if(!pad) return;
      pad.style.display = 'block';
      pad.style.opacity = '1';
      const p = clampPadToViewport(x, y);
      pad.style.left = Math.round(p.x) + 'px';
      pad.style.top  = Math.round(p.y) + 'px';
      calcCenter();
    };

    const hidePad = ()=>{
      if(!pad) return;
      pad.style.opacity = '0';
      setTimeout(()=>{
        if(pad && !joy.drag){
          pad.style.display = 'none';
        }
      }, 140);
    };

    const curve = (v)=>{
      const s = Math.sign(v);
      const a = Math.abs(v);
      const dead = 0.04;
      if(a<dead) return 0;
      const n = (a-dead)/(1-dead);
      return clamp(s * Math.pow(n, 0.68) * 1.35, -1, 1);
    };

    const joyMove = (e)=>{
      if(!joy.drag || joy.pid!==e.pointerId) return;
      try{ e.preventDefault(); }catch(err){}
      const dx = e.clientX - joy.cx;
      const dy = e.clientY - joy.cy;
      let ax = dx / joy.rad;
      let ay = dy / joy.rad;
      const len = Math.hypot(ax, ay);
      if(len>1){ ax/=len; ay/=len; }
      ax = curve(ax);
      ay = curve(ay);
      setMove(ax, ay);
      setKnob(ax, ay);
    };

    const joyUp = (e)=>{
      if(!joy.drag || joy.pid!==e.pointerId) return;
      joy.drag = false;
      joy.pid = null;
      setMove(0,0);
      setKnob(0,0);
      hidePad();
    };

    const joyDownAny = (e)=>{
      if(!this._ds || !this._ds.running || this._ds.paused) return;
      if(e.target && e.target.closest && e.target.closest('#dsBtnBar')) return;
      joy.drag = true;
      joy.pid = e.pointerId;
      showPadAt(e.clientX, e.clientY);
      try{ (e.target || document.body).setPointerCapture(e.pointerId); }catch(err){}
      joyMove(e);
    };

    const ol = $("#dotShootOL") || document.body;
    ol.addEventListener('pointerdown', joyDownAny, {passive:false});
    ol.addEventListener('pointermove', joyMove, {passive:false});
    ol.addEventListener('pointerup', joyUp);
    ol.addEventListener('pointercancel', joyUp);

    const bomb = btn('dsBombBtn');
    if(bomb) bindTap(bomb, ()=>{ this.dsUseBomb(); });
    // Missile is always AUTO in this standalone build (no missile buttons).
    if(this._ds){
      this._ds.missileAuto = true;
      this._ds.missileHold = false;
    }

    const pause = btn('dsPause');
    if(pause) bindTap(pause, ()=>{ this.dsTogglePause(); });

    const cineTog = btn('dsCineToggle');
    if(cineTog){
      const updateLabel = ()=>{
        const on = !!(this._ds && this._ds.cineEnabled !== false);
        cineTog.textContent = on ? 'S✓' : 'S×';
        cineTog.classList.toggle('dsBtnOn', on);
      };
      bindTap(cineTog, ()=>{
        if(!this._ds || !this._ds.running) return;
        this._ds.cineEnabled = !(this._ds.cineEnabled !== false);
        updateLabel();
      });
      setTimeout(updateLabel, 0);
    }


    const wlock = btn('dsWeaponLock');
    if(wlock){
      const updateLabel = ()=>{
        const st = this._ds;
        const on = !!(st && st.weaponLock && st.weaponLock.on);
        wlock.textContent = on ? '🔒' : '🔓';
        wlock.classList.toggle('dsBtnOn', on);
      };
      bindTap(wlock, ()=>{
        if(!this._ds || !this._ds.running) return;
        this.dsToggleWeaponLock();
        updateLabel();
      });
      setTimeout(updateLabel, 0);
    }


    
    const pick = btn('dsPickLock');
    if(pick){
      // Pause + pick a weapon, and keep "weapon lock" until death.
      // While this mode is active, score is reduced by 20%.
      const updatePickLabel = ()=>{
        const st = this._ds;
        const on = !!(st && st.pickLockMode && st.pickLockMode.on);
        pick.textContent = on ? '🎯' : '🎯';
        pick.classList.toggle('dsBtnOn', on);
      };
      bindTap(pick, ()=>{
        if(!this._ds || !this._ds.running) return;
        this.dsOpenPickLockMenu();
        updatePickLabel();
      });
      setTimeout(updatePickLabel, 0);
    }

const exit = btn('dsExit');
    if(exit) bindTap(exit, ()=>{ this.dsEndRun(true); });
    const exit2 = btn('dsExit2');
    if(exit2) bindTap(exit2, ()=>{ this.dsEndRun(true); });

    const retry = btn('dsRetry');
    if(retry) bindTap(retry, ()=>{ this.dsStartNewRun(); });

    // canvas drag move（ドラッグ中のみ追従。未操作で中央へ戻らない）
    const onMove = (e)=>{
      if(!this._ds || !this._ds.running) return;
      if(!this._ds.input) return;
      if(!this._ds.input.drag) return;
      const rect = cv.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(1, rect.width);
      const y = (e.clientY - rect.top) / Math.max(1, rect.height);
      this._ds.input.tx = clamp(x, 0, 1);
      this._ds.input.ty = clamp(y, 0, 1);
    };
    const onDown = (e)=>{
      if(!this._ds || !this._ds.running) return;
      if(this._ds.input) this._ds.input.drag = true;
      try{ cv.setPointerCapture(e.pointerId); }catch(err){}
      onMove(e);
    };
    const onUp = (e)=>{
      if(this._ds && this._ds.input) this._ds.input.drag = false;
      try{ cv.releasePointerCapture(e.pointerId); }catch(err){}
    };
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
  }

  dsStartNewRun(){
    // stop previous loop
    try{ if(this._ds && this._ds.raf) cancelAnimationFrame(this._ds.raf); }catch(e){}
    const cv = $("#dotShootCanvas");
    const ctx = cv ? cv.getContext('2d') : null;

    const st = {
      running: true,
      paused: false,
      t: 0,
      lastTs: 0,
      score: 0,
      scoreMul: 1,
      pickLockMode: {on:false},
      wave: 0,
      dif: 0,
      livesMax: 3,
      lives: 3,
      inv: 0,
      bomb: 1,
      // camera / time scale (cinematic)
      camZoom: 1,
      camCx: 0.5,
      camCy: 0.60,
      timeScale: 1,
      cine: {on:false, t:0, hold:0, bx:0, by:0, strength:0, lastD:1},
      cineEnabled: true,
      missileType: 'a',
      missileLv: {a:1, w:0, h:0},
      missileCd: 0,
      missileHold: false,
      missileAuto: true,
      missiles: [],
      mBursts: [],
      rings: [],
      pendingMissiles: [],
      droneInvAll: false,
      bossN: 0,
      weaponLv: {N:1,S:0,L:0,H:0,Q:0,Z:0,E:0,G:0,R:0,C:0,J:0,K:0,M:0},
      weaponLock: {on:false, w:null, xp:0},
      rocks: [],
      rockAcc: 0,
      // tx/ty: canvas drag target (only active while dragging)
      input: {ax:0, ay:0},
      player: {x:0.5, y:0.88, sp:0.62, spMul:1, hitMul:1, cd:0, weapon:'N', shield:0},
      drones: [],

      bullets: [],
      ebullets: [],
      enemies: [],
      pups: [],
      toasts: [],
      boss: null,
      spawnAcc: 0,
      nextBossAt: 9000,
      bossRespawnCd: 0,
      stars: Array.from({length:40}, ()=>({x:Math.random(), y:Math.random(), s:0.2+Math.random()*0.8})),
      cv, ctx,
      maxObjs: 240,
      // perma growth (saved)
      perma: this.dsLoadPerma(),
      bossKillsRun: 0,
      runGrowth: {weaponLvUp:{}, missileLvUp:{a:0,w:0,h:0}, maxHpUp:0},
      explosions: [],
    };
    this._ds = st;

    const over = $("#dsOver");
    if(over) over.style.display='none';
    const pbtn = $("#dsPause");
    if(pbtn) pbtn.textContent = 'Ⅱ';

    this.dsUpdateHUD();
    // Make sure D-pad / bottom controls are visible when a run starts
    this.dsForcePadVisible('start');
    this.dsLoop(performance.now());
  }


  // === DOTSTRIKE Perma Growth (saved across runs) ===
  dsPermaDefault(){
    return {
      v: 1,
      updatedAt: Date.now(),
      weaponLvBonus: {N:0,S:0,L:0,H:0,Q:0,Z:0,E:0,G:0,R:0,C:0,J:0,K:0,M:0},
      missileLvBonus: {a:0,w:0,h:0},
      maxHpBonus: 0,
      lastCarry: []
    };
  }
  dsWeaponKeyLabel(k){
    k = String(k||'').toUpperCase();
    return (k==='N'?'NORMAL':
      k==='S'?'SPREAD':
      k==='L'?'PIERCE':
      k==='H'?'HOMING':
      k==='Q'?'NEAR-HOM':
      k==='Z'?'LASER':
      k==='E'?'ERASER':
      k==='G'?'HEAVY-BOMB':
      k==='R'?'SAW':
      k==='C'?'RICOCHET':
      k==='J'?'ROCK-PUSH':
      k==='K'?'ROCK-SPLIT':
      k==='M'?'ROCK-HOM':'?');
  }

  dsPermaToPills(perma){
    perma = (perma && typeof perma==='object') ? perma : this.dsPermaDefault();
    const pills = [];

    const w = Object.assign({}, this.dsPermaDefault().weaponLvBonus, perma.weaponLvBonus||{});
    const keys = Object.keys(w);
    keys.sort();
    for(const k of keys){
      const v = num(w[k],0);
      if(v>0){
        pills.push({label:`武器 ${this.dsWeaponKeyLabel(k)}`, val:`+${v}`});
      }
    }

    const m = Object.assign({}, this.dsPermaDefault().missileLvBonus, perma.missileLvBonus||{});
    const mKeys = Object.keys(m);
    mKeys.sort();
    for(const k of mKeys){
      const v = num(m[k],0);
      if(v>0){
        pills.push({label:`MISSILE ${String(k).toUpperCase()}`, val:`+${v}`});
      }
    }

    const hp = num(perma.maxHpBonus,0);
    if(hp>0){
      pills.push({label:`最大HP`, val:`+${hp}`});
    }

    return pills;
  }

  dsRenderPermaSplash(){
    try{
      const list = document.getElementById('dsPermaList');
      if(!list) return;
      const p = this.dsLoadPerma();
      const pills = this.dsPermaToPills(p);
      list.innerHTML = '';
      if(!pills.length){
        const d = document.createElement('div');
        d.className = 'dsPermaEmpty';
        d.textContent = 'まだ永続成長がありません（ボス撃破で抽選）';
        list.appendChild(d);
        return;
      }
      for(const it of pills){
        const d = document.createElement('div');
        d.className = 'dsPermaPill';
        // safe: values are controlled; still avoid HTML injection
        d.textContent = `${it.label} ${it.val}`;
        const b = document.createElement('b');
        // style already in CSS; keep as part of pill
        // (we used textContent, so just append)
      }
      // re-render with <b> styling by building nodes
      list.innerHTML = '';
      for(const it of pills){
        const d = document.createElement('div');
        d.className = 'dsPermaPill';
        const t = document.createElement('span');
        t.textContent = it.label + ' ';
        const bb = document.createElement('b');
        bb.textContent = it.val;
        d.appendChild(t);
        d.appendChild(bb);
        list.appendChild(d);
      }
    }catch(e){}
  }



  dsLoadPerma(){
    try{
      const raw = localStorage.getItem(LS_DOTSTRIKE_PERMA);
      if(!raw) return this.dsPermaDefault();
      const obj = JSON.parse(raw);
      const d = this.dsPermaDefault();
      if(!obj || typeof obj!=='object') return d;
      // sanitize
      const wl = Object.assign({}, d.weaponLvBonus, obj.weaponLvBonus||{});
      const ml = Object.assign({}, d.missileLvBonus, obj.missileLvBonus||{});
      const mh = clamp(num(obj.maxHpBonus, 0), 0, 999);
      const lc = Array.isArray(obj.lastCarry) ? obj.lastCarry.slice(0, 24) : [];
      return {
        v: 1,
        updatedAt: num(obj.updatedAt, Date.now()),
        weaponLvBonus: wl,
        missileLvBonus: ml,
        maxHpBonus: mh,
        lastCarry: lc
      };
    }catch(e){
      return this.dsPermaDefault();
    }
  }

  dsSavePerma(perma){
    try{
      if(!perma || typeof perma!=='object') perma = this.dsPermaDefault();
      perma.updatedAt = Date.now();
      localStorage.setItem(LS_DOTSTRIKE_PERMA, JSON.stringify(perma));
    }catch(e){
      // ignore
    }
  }

  dsResetPerma(){
    try{ localStorage.removeItem(LS_DOTSTRIKE_PERMA); }catch(e){}
    try{
      if(this._ds) this._ds.perma = this.dsPermaDefault();
    }catch(e){}
  }

  dsWeaponNameJA(t){
    t = String(t||'').toUpperCase();
    return t==='S'?'拡散':
           t==='L'?'貫通':
           t==='H'?'ホーミング':
           t==='Q'?'近ホーミング':
           t==='Z'?'レーザー':
           t==='E'?'弾消去':
           t==='G'?'鈍重爆弾':
           t==='R'?'ノコ刃':
           t==='C'?'跳弾ビーム':
           t==='J'?'岩押し':
           t==='K'?'岩拡散':
           t==='M'?'岩反射追尾':
           t==='N'?'ノーマル': t;
  }

  // Effective weapon level = run weaponLv + perma bonus
  dsGetWeaponLvEff(w){
    const st=this._ds;
    const base = this.dsGetWeaponLv(w);
    const bonus = clamp(num(st?.perma?.weaponLvBonus?.[w], 0), 0, 999);
    return clamp(base + bonus, 0, 60);
  }

  dsGetMissileLvEff(k){
    const st=this._ds;
    k = String(k||'a');
    const base = num(st?.missileLv?.[k], 0);
    const bonus = clamp(num(st?.perma?.missileLvBonus?.[k], 0), 0, 999);
    return clamp(base + bonus, 0, 9);
  }

  // Build pool from THIS RUN only (runGrowth); temporary buffs are never recorded here.
  dsBuildCarryPool(runGrowth){
    const pool = [];
    if(!runGrowth || typeof runGrowth!=='object') return pool;

    const wl = runGrowth.weaponLvUp || {};
    for(const k of Object.keys(wl)){
      const n = clamp(num(wl[k], 0), 0, 999);
      for(let i=0;i<n;i++){
        pool.push({kind:'weaponLv', key:k, label: `${this.dsWeaponNameJA(k)} Lv+1`});
      }
    }

    const ml = runGrowth.missileLvUp || {};
    for(const k of Object.keys(ml)){
      const n = clamp(num(ml[k], 0), 0, 999);
      for(let i=0;i<n;i++){
        pool.push({kind:'missileLv', key:k, label: `ミサイル(${k}) Lv+1`});
      }
    }

    const mh = clamp(num(runGrowth.maxHpUp, 0), 0, 999);
    for(let i=0;i<mh;i++){
      pool.push({kind:'maxHp', key:null, label:'最大HP +1'});
    }

    return pool;
  }

  dsPickCarry(pool, n, opts={}){
    pool = Array.isArray(pool)?pool:[];
    n = clamp(num(n,0), 0, 999);
    if(!pool.length || n<=0) return [];
    const picked = [];
    const avoidRepeat = (opts && opts.avoidImmediateRepeat!==false);
    let lastKey = null;

    for(let i=0;i<n;i++){
      if(!pool.length) break;
      let tries = 0;
      let cand = null;
      while(tries < 8){
        cand = pool[(Math.random()*pool.length)|0];
        const k = cand ? (cand.kind+':'+String(cand.key)) : null;
        if(!avoidRepeat || !lastKey || k!==lastKey) break;
        tries++;
      }
      if(!cand) break;
      const key = cand.kind+':'+String(cand.key);
      picked.push(cand);
      lastKey = key;
    }
    return picked;
  }

  dsApplyCarryToPerma(perma, picked){
    perma = (perma && typeof perma==='object') ? perma : this.dsPermaDefault();
    picked = Array.isArray(picked)?picked:[];

    perma.weaponLvBonus = Object.assign({}, this.dsPermaDefault().weaponLvBonus, perma.weaponLvBonus||{});
    perma.missileLvBonus = Object.assign({}, this.dsPermaDefault().missileLvBonus, perma.missileLvBonus||{});

    const lastCarry = [];
    for(const it of picked){
      if(!it) continue;
      if(it.kind==='weaponLv'){
        const k = String(it.key||'').toUpperCase();
        perma.weaponLvBonus[k] = num(perma.weaponLvBonus[k],0) + 1;
        lastCarry.push({kind:'weaponLv', key:k, label: it.label});
      }else if(it.kind==='missileLv'){
        const k = String(it.key||'a');
        perma.missileLvBonus[k] = num(perma.missileLvBonus[k],0) + 1;
        lastCarry.push({kind:'missileLv', key:k, label: it.label});
      }else if(it.kind==='maxHp'){
        perma.maxHpBonus = num(perma.maxHpBonus,0) + 1;
        lastCarry.push({kind:'maxHp', key:null, label: it.label});
      }
    }

    perma.lastCarry = lastCarry.slice(0, 24);
    return {perma, lastCarry: perma.lastCarry};
  }

  dsShowGameOverCarry(lastCarry, bossKillsRun){
    try{
      const box = document.getElementById('dsCarryBox');
      const list = document.getElementById('dsCarryList');
      const title = document.getElementById('dsCarryTitle');
      if(!box || !list) return;
      lastCarry = Array.isArray(lastCarry)?lastCarry:[];
      bossKillsRun = clamp(num(bossKillsRun,0), 0, 999);

      box.style.display = 'block';
      if(title){
        title.textContent = bossKillsRun>0 ? `PERMA CARRY ×${bossKillsRun}` : 'PERMA CARRY';
      }

      list.innerHTML = '';
      if(!lastCarry.length){
        const d = document.createElement('div');
        d.className = 'dsCarryItem dim';
        d.textContent = (bossKillsRun>0) ? '引き継げる成長がありません' : 'ボス撃破で引き継ぎ抽選';
        list.appendChild(d);
        return;
      }

      lastCarry.forEach((it, idx)=>{
        const d = document.createElement('div');
        d.className = 'dsCarryItem';
        d.textContent = `+ ${it.label || ''}`;
        d.style.opacity = '0';
        d.style.transform = 'translateY(6px)';
        list.appendChild(d);
        setTimeout(()=>{
          d.style.transition = 'opacity 260ms ease, transform 260ms ease';
          d.style.opacity = '1';
          d.style.transform = 'translateY(0)';
        }, 60 + idx*90);
      });
    }catch(e){}
  }




dsGetWeaponLv(w){
  const st=this._ds;
  if(!st) return 1;
  if(!st.weaponLv) st.weaponLv = {N:1,S:0,L:0,H:0,Q:0,Z:0,E:0,G:0,R:0,C:0,J:0,K:0,M:0};
  const v = st.weaponLv[w];
  return clamp(isFinite(v)?v:0, 0, 60);
}
dsIncWeaponLv(w, add=1){
  const st=this._ds;
  if(!st) return 0;
  if(!st.weaponLv) st.weaponLv = {N:1,S:0,L:0,H:0,Q:0,Z:0,E:0,G:0,R:0,C:0,J:0,K:0,M:0};
  const cur = this.dsGetWeaponLv(w);
  const nv = clamp(cur + (isFinite(add)?add:1), 0, 60);
  st.weaponLv[w] = nv;
  // record run growth (only the gained part)
  const gained = Math.max(0, nv - cur);
  try{
    if(gained>0){
      st.runGrowth = st.runGrowth || {weaponLvUp:{}, missileLvUp:{a:0,w:0,h:0}, maxHpUp:0};
      st.runGrowth.weaponLvUp = st.runGrowth.weaponLvUp || {};
      const key = String(w||'').toUpperCase();
      st.runGrowth.weaponLvUp[key] = num(st.runGrowth.weaponLvUp[key],0) + gained;
    }
  }catch(e){}
  return nv;
}

  dsTogglePause(){
    if(!this._ds) return;
    this._ds.paused = !this._ds.paused;
    const p=$("#dsPause");
    if(p) p.textContent = this._ds.paused ? '▶' : 'Ⅱ';
  }


  // Weapon lock: keep current weapon equipped. While locked, picking *other* weapons adds EXP.
  // Every 10 EXP -> locked weapon level +1.
  dsToggleWeaponLock(){
    const st=this._ds; if(!st) return;
    st.weaponLock = st.weaponLock || {on:false, w:null, xp:0};
    if(st.pickLockMode && st.pickLockMode.on){
      this.dsAddToast('固定モード中は解除できません');
      return;
    }
    if(!st.weaponLock.on){
      st.weaponLock.on = true;
      st.weaponLock.w = String((st.player && st.player.weapon) ? st.player.weapon : 'N').toUpperCase();
      st.weaponLock.xp = 0;
      this.dsAddToast('武器固定: ON');
    }else{
      st.weaponLock.on = false;
      this.dsAddToast('武器固定: OFF');
    }
    this.dsUpdateHUD();
  }

  // Pick-lock mode: pause -> choose weapon from ALL weapons -> enable weaponLock until death.
  // While active: score -20% (scoreMul=0.8). WeaponLock button cannot turn off.
  dsOpenPickLockMenu(){
    const st=this._ds;
    if(!st || !st.running) return;
    // pause immediately
    st.paused = true;
    const p=$("#dsPause");
    if(p) p.textContent = '▶';

    // build modal (once)
    let modal = document.getElementById('dsPickLockModal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'dsPickLockModal';
      modal.style.position = 'fixed';
      modal.style.inset = '0';
      modal.style.display = 'none';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.zIndex = 12000;
      modal.style.pointerEvents = 'auto';
      modal.innerHTML = `
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);"></div>
        <div style="position:relative;width:min(92vw,520px);max-height:min(80vh,560px);overflow:auto;
                    border-radius:18px;border:1px solid rgba(255,255,255,0.18);
                    background:rgba(16,20,28,0.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
                    padding:14px 14px 12px 14px;color:#e9f2ff;font-family:system-ui,sans-serif;">
          <div style="font-weight:900;font-size:16px;letter-spacing:0.02em;margin-bottom:6px;">
            武器を選択（死ぬまで固定 / スコア-20%）
          </div>
          <div style="opacity:0.82;font-size:12px;line-height:1.35;margin-bottom:10px;">
            このモード中は、武器固定と同じ挙動（他武器取得→固定武器にEXP）になります。解除はできません。
          </div>
          <div id="dsPickLockGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px;">
            <button id="dsPickLockCancel" class="dsBtn">キャンセル</button>
          </div>
        </div>
      `;
      (document.getElementById('dotShootOL') || document.body).appendChild(modal);

      const cancel = modal.querySelector('#dsPickLockCancel');
      if(cancel){
        cancel.addEventListener('click', ()=>{
          // keep paused state as-is, but close menu
          modal.style.display='none';
        });
      }
      // click outside closes
      modal.addEventListener('click', (ev)=>{
        if(ev.target === modal) modal.style.display='none';
      });
    }

    // fill buttons each time (so we can show lv)
    const grid = modal.querySelector('#dsPickLockGrid');
    if(grid){
      grid.innerHTML = '';
      const weapons = [
        {k:'N', n:'ノーマル'},
        {k:'S', n:'拡散'},
        {k:'L', n:'貫通'},
        {k:'H', n:'ホーミング'},
        {k:'Q', n:'近ホーミング'},
        {k:'Z', n:'レーザー'},
        {k:'E', n:'弾消去'},
        {k:'G', n:'鈍重爆弾'},
        {k:'R', n:'ノコ刃'},
        {k:'C', n:'跳弾ビーム'},
        {k:'J', n:'岩押し'},
        {k:'K', n:'岩拡散'},
        {k:'M', n:'岩反射追尾'},
      ];
      for(const w of weapons){
        const b = document.createElement('button');
        b.className = 'dsBtn';
        b.style.padding = '10px 8px';
        b.style.borderRadius = '14px';
        b.style.fontWeight = '900';
        b.style.fontSize = '12px';
        b.style.display = 'flex';
        b.style.flexDirection = 'column';
        b.style.gap = '2px';
        const lv = this.dsGetWeaponLvEff(w.k);
        b.innerHTML = `<div>${w.n}</div><div style="opacity:0.82;font-size:11px;">Lv${lv}</div>`;
        b.addEventListener('click', ()=>{
          this.dsActivatePickLockMode(w.k);
          modal.style.display='none';
        });
        grid.appendChild(b);
      }
    }

    modal.style.display='flex';
  }

  dsActivatePickLockMode(w){
    const st=this._ds; if(!st || !st.running) return;
    const k = String(w||'N').toUpperCase();
    st.player.weapon = k;
    // Force weapon lock ON for chosen weapon
    st.weaponLock = st.weaponLock || {on:false, w:null, xp:0};
    st.weaponLock.on = true;
    st.weaponLock.w = k;
    st.weaponLock.xp = 0;

    // Enable pick-lock mode (until death)
    st.pickLockMode = st.pickLockMode || {on:false};
    st.pickLockMode.on = true;
    st.scoreMul = 0.80;

    // resume
    st.paused = false;
    const p=$("#dsPause");
    if(p) p.textContent = 'Ⅱ';

    this.dsAddToast('武器固定モード（スコア-20%）');
    this.dsUpdateHUD();
  }

  dsResetPickLockMode(){
    const st=this._ds; if(!st) return;
    if(st.pickLockMode && st.pickLockMode.on){
      st.pickLockMode.on = false;
      st.scoreMul = 1;
    }
  }


  dsEndRun(backToMenu){
    const st = this._ds;
    if(!st) return;
    st.running = false;
    this.dsResetPickLockMode();
    try{ if(st.raf) cancelAnimationFrame(st.raf); }catch(e){}

    // 記録
    this.dsRecordScore(st.score, {wave:st.wave, time:st.t, weapon:st.player.weapon, dif:st.dif});
    this.dsUpdateHUD(true);

    // --- perma carry on death (boss kills determine how many) ---
    try{
      if(!backToMenu && (isFinite(st.lives)?st.lives:1) <= 0){
        const bossKills = clamp(num(st.bossKillsRun,0), 0, 999);
        const pool = this.dsBuildCarryPool(st.runGrowth);
        const picked = this.dsPickCarry(pool, bossKills, {avoidImmediateRepeat:true});
        const curPerma = st.perma || this.dsLoadPerma();
        const applied = this.dsApplyCarryToPerma(curPerma, picked);
        st.perma = applied.perma;
        this.dsSavePerma(st.perma);
        this.dsShowGameOverCarry(applied.lastCarry, bossKills);
      }else{
        this.dsShowGameOverCarry([], 0);
      }
    }catch(e){}


    const over = $("#dsOver");
    if(over) over.style.display='flex';

    if(backToMenu){
      // タイトル（スプラッシュ）へ戻す：ローグライク側メニューとは分離
      this.dsShowSplash();
    }
  }

  dsUseBomb(){
    const st = this._ds;
    if(!st || !st.running || st.paused) return;
    if(st.bomb<=0) return;
    st.bomb--;
    // Bomb: clear enemy bullets and wipe all *non-boss* enemies.
    // Drops should still have a chance to occur as usual.
    st.ebullets.length = 0;

    // kill all normal enemies (boss excluded) and allow normal drop chance
    if(Array.isArray(st.enemies) && st.enemies.length){
      for(const e of st.enemies){
        if(!e) continue;
        // score + drop chance like a normal kill
        try{ this.dsAddScore(num(e.score,0)); }catch(err){}
        try{ this.dsDropPowerup(num(e.x,0.5), num(e.y,0.5), false); }catch(err){}
      }
      st.enemies.length = 0;
    }

    // (optional) tiny AoE damage to survivors is no longer needed since we wipe.
if(st.boss){
  const maxHp = (isFinite(st.boss.maxHp)?st.boss.maxHp:st.boss.hp) || 1;
  const tier = (isFinite(st.boss.tier)?st.boss.tier:0);
  const raw = Math.floor(maxHp * 0.018);
  const dmg = Math.max(1, Math.floor(raw / (1 + tier*0.18)));
  st.boss.hp -= clamp(dmg, 1, 8);
}
    // FX (flash)
    const fx=$("#dsFlash");
    if(fx){
      fx.classList.remove('on'); void fx.offsetWidth;
      fx.classList.add('on');
      setTimeout(()=>fx.classList.remove('on'), 120);
    }
    this.dsUpdateHUD();
  }
  // ===== DotShoot: MISSILE system =====
  dsMissileLabel(type, lv){
    const t = String(type||'a');
    const n = (t==='a')?'ARC' : (t==='w')?'WIDE' : (t==='h')?'HOMING' : 'MISSILE';
    const L = Math.max(1, num(lv,1));
    return `${n} Lv${L}`;
  }

  dsGetMissileSpec(){
    const st=this._ds; if(!st) return {type:'a', lv:1, cd:0.65, blast:0.12, dmg:6, hom:0.0, arc:0.0, bursts:0};
    const type = String(st.missileType||'a');
    const lv = clamp(num((st.missileLv && st.missileLv[type]) || 1, 1), 1, 5);

    // base tuning (low ROF): minimum about 1 shot/sec
    const baseCd = (type==='w') ? 1.08 : (type==='h') ? 1.05 : 1.06;
    const cd = clamp(baseCd - (lv-1)*0.010, 1.00, 1.20);

    const blast = (type==='w') ? (0.14 + lv*0.015) : (type==='h') ? (0.11 + lv*0.010) : (0.12 + lv*0.012);
    const dmg   = (type==='w') ? (7 + lv*1.4) : (type==='h') ? (6 + lv*1.1) : (6.5 + lv*1.2);
    const hom   = (type==='h') ? (0.95 + lv*0.10) : (type==='a') ? (0.45 + lv*0.06) : 0.0;
    const arc   = (type==='a') ? (0.85 + lv*0.12) : 0.0;

    // fireworks extra bursts
    const bursts = clamp(Math.floor((lv-1)/1.4), 0, 3) + (type==='w' ? 1 : 0);

    return {type, lv, cd, blast, dmg, hom, arc, bursts};
  }

  dsTryFireMissile(isImmediate){
    const st=this._ds; if(!st || !st.running || st.paused) return false;
    st.missileCd = isFinite(st.missileCd)?st.missileCd:0;
    if(st.missileCd > 0) return false;

    const spec = this.dsGetMissileSpec();
    // fire now
    this.dsFireMissile(st.player, spec);

    // slightly delayed drone fire (same missile)
    st.pendingMissiles = Array.isArray(st.pendingMissiles)?st.pendingMissiles:[];
    if(Array.isArray(st.drones) && st.drones.length){
      let k=0;
      for(const d of st.drones){
        if(!d) continue;
        st.pendingMissiles.push({t: 0.06 + k*0.025, unit:d, spec});
        k++;
        if(k>12) break;
      }
    }

    st.missileCd = spec.cd;
    this.dsUpdateHUD();
    return true;
  }

  dsFireMissile(unit, spec){
    const st=this._ds; if(!st) return;
    st.missiles = Array.isArray(st.missiles)?st.missiles:[];
    if(st.missiles.length > 40) st.missiles = st.missiles.slice(-40);

    const u = unit || st.player;
    const s = spec || this.dsGetMissileSpec();
    const type = String(s.type||'a');
    const lv = clamp(num(s.lv,1), 1, 5);

    const x = clamp(num(u.x,0.5), 0.06, 0.94);
    const y = clamp(num(u.y,0.88) - 0.02, 0.04, 0.98);

    // slow start, accelerates
    const sp0 = 0.10;
    const spMax = (type==='w') ? (1.15 + lv*0.05) : (type==='h') ? (1.10 + lv*0.06) : (1.12 + lv*0.06);
    const acc = 0.95 + lv*0.22;

    const m = {
      x, y,
      vx: (type==='a') ? (Math.random()*0.04-0.02) : (Math.random()*0.02-0.01),
      vy: -1,
      sp: sp0,
      spMax,
      acc,
      type,
      lv,
      t: 0,
      phase: Math.random()*Math.PI*2,
      seed: Math.random()*999,
      hitR: 0.018 + lv*0.001,
    };
    st.missiles.push(m);

    // tiny launch ring (cheap)
    st.rings = Array.isArray(st.rings)?st.rings:[];
    st.rings.push({x, y, r:0.01, max:0.06, a:0.55, hue:(type==='w'?35:type==='h'?120:200), t:0});
    if(st.rings.length>120) st.rings = st.rings.slice(-120);
  }

  dsMissileTarget(x,y){
    const st=this._ds; if(!st) return null;
    // Prefer enemies; include boss as fallback/priority if closer
    const e = this.dsNearestEnemy(x,y);
    let best = e ? {x:e.x, y:e.y, kind:'e'} : null;

    if(st.boss){
      const b=st.boss;
      const bx=b.x, by=b.y;
      const de2 = best ? ((best.x-x)**2 + (best.y-y)**2) : Infinity;
      const db2 = (bx-x)**2 + (by-y)**2;
      if(db2 < de2 * 1.10) best = {x:bx, y:by, kind:'b'};
    }
    return best;
  }

  dsBreakRocksInRadius(x,y,rad){
    const st=this._ds; if(!st) return 0;
    const rocks = Array.isArray(st.rocks)?st.rocks:null;
    if(!rocks || !rocks.length) return 0;
    const r2 = rad*rad;
    let broke=0;
    for(let i=rocks.length-1;i>=0;i--){
      const r=rocks[i];
      const dx=x-r.x, dy=y-r.y;
      const rr = (isFinite(r.r)?r.r:0.05);
      const lim = (rad*0.88 + rr*0.35);
      if(dx*dx + dy*dy <= lim*lim){
        rocks.splice(i,1);
        broke++;
      }
    }
    return broke;
  }

  dsMissileExplode(x,y,spec,stage=0){
    const st=this._ds; if(!st) return;
    st.mBursts = Array.isArray(st.mBursts)?st.mBursts:[];
    st.rings   = Array.isArray(st.rings)?st.rings:[];
    const s = spec || this.dsGetMissileSpec();
    const type = String(s.type||'a');
    const lv   = clamp(num(s.lv,1), 1, 5);

    const blast = clamp(num(s.blast,0.12), 0.08, 0.26);
    const dmg   = num(s.dmg,7);

    // visual ring
    const hue = (type==='w'?35:type==='h'?120:200);
    st.rings.push({x, y, r:0.01, max:blast*1.6, a:0.95, hue, t:0});
    if(st.rings.length>140) st.rings = st.rings.slice(-140);

    // clear enemy bullets in radius
    const keepEB=[];
    const rr2 = (blast*blast);
    for(const b of st.ebullets){
      const dx=b.x-x, dy=b.y-y;
      if(dx*dx + dy*dy > rr2) keepEB.push(b);
    }
    st.ebullets = keepEB;

    // break rocks (disabled for MISSILE: missiles should NOT break rocks)
    // this.dsBreakRocksInRadius(x,y, blast);

    // damage enemies
    for(let i=st.enemies.length-1;i>=0;i--){
      const e=st.enemies[i];
      if(!e) continue;
      const dx=e.x-x, dy=e.y-y;
      if(dx*dx + dy*dy <= rr2){
        e.hp -= dmg * (type==='w'?0.95:1.0);
        if(e.hp<=0){
          this.dsAddScore((e.score||30));

          // splitter: break into 2 minis (no further splitting)
          if(e.kind==='splitter'){
            const miniVy = (0.26 + st.dif*0.02);
            const mk=(sx)=>({kind:'mini', x:clamp(e.x + sx*(0.03+Math.random()*0.02),0.06,0.94), y:e.y, vx:sx*(0.12+Math.random()*0.06), vy:miniVy, hp:1, score:35, cd:0.90+Math.random()*0.5, t:0, phase:Math.random()*Math.PI*2, state:0});
            st.enemies.push(mk(-1));
            st.enemies.push(mk(1));
          }

          this.dsDropPowerup(e.x,e.y,false);
          st.enemies.splice(i,1);
        }
      }
    }
    // damage boss
    if(st.boss){
      const b=st.boss;
      const dx=b.x-x, dy=b.y-y;
      const br = (0.075 + (b.tier||0)*0.002);
      if(dx*dx + dy*dy <= (blast+br)*(blast+br)){
        const tier = (isFinite(b.tier)?b.tier:0);
        const bdmg = Math.max(1, Math.floor((dmg*0.85) / (1 + tier*0.14)));
        b.hp -= clamp(bdmg, 1, 20);
        if(b.hp<=0){
          // boss death handled in boss update; let it be processed there
        }
      }
    }

    // fireworks: schedule extra bursts that feel like "multiple explosions"
    if(stage===0){
      const extra = clamp(num(s.bursts,0), 0, 4);
      if(extra>0){
        for(let i=0;i<extra;i++){
          const tt = 0.07 + i*(0.08 + Math.random()*0.03);
          const ang = Math.random()*Math.PI*2;
          const rr = blast*(0.35 + Math.random()*0.45);
          const ox = clamp(x + Math.cos(ang)*rr, 0.05, 0.95);
          const oy = clamp(y + Math.sin(ang)*rr, 0.05, 0.95);
          st.mBursts.push({t:tt, x:ox, y:oy, spec:s, stage:1});
        }
        if(st.mBursts.length>80) st.mBursts = st.mBursts.slice(-80);
      }
    }
  }



  dsLoop(ts){
    const st=this._ds;
    if(!st || !st.running) return;
    const dt = st.lastTs ? Math.min(33, ts - st.lastTs) : 16;
    st.lastTs = ts;

    // Keep D-pad visible (some iOS layout changes can temporarily hide it)
    st._padTick = (st._padTick||0) + dt;
    if(st._padTick > 500){ st._padTick = 0; this.dsForcePadVisible('loop'); }

    if(!st.paused){
      const base = (isFinite(dt) ? dt : 16) / 1000;
      const scale = isFinite(st.timeScale) ? st.timeScale : 1;
      const dtS = base * clamp(scale, 0.02, 1.0);
      st._dt = (isFinite(dtS) ? dtS : 0);
      this.dsStep(st._dt);
      this.dsRender();
      this.dsUpdateHUD();
    }
    st.raf = requestAnimationFrame((t)=>this.dsLoop(t));
  }

  dsStep(dt){
    const st=this._ds; if(!st) return;
    const dt0 = (typeof dt!=='undefined' && isFinite(dt)) ? dt : 0;
    st.t += dt0*1000;
    st.bossRespawnCd = Math.max(0, num(st.bossRespawnCd,0) - dt0);

    // difficulty ramps (endless)
    const timeLv = Math.floor(st.t/20000);         // every 20s
    const scoreLv = Math.floor(st.score/6000);     // every 6k
    st.dif = timeLv + scoreLv;
    st.wave = timeLv + 1;

    // starfield
    for(const s of st.stars){
      s.y += dt0*(0.12 + s.s*0.18) * (1 + st.dif*0.08);
      if(s.y>1){ s.y-=1; s.x=Math.random(); }
    }

    // input move
    const p=st.player;
    let vx=0, vy=0;
    const ax = (st.input && isFinite(st.input.ax)) ? st.input.ax : 0;
    const ay = (st.input && isFinite(st.input.ay)) ? st.input.ay : 0;
    vx += ax;
    vy += ay;
    const vlen = Math.hypot(vx, vy);
    if(vlen>1){ vx/=vlen; vy/=vlen; }
    const pSpMul = (isFinite(p.spMul) ? p.spMul : 1);
    p.x = clamp(p.x + vx * p.sp * pSpMul * dt0, 0.06, 0.94);
    p.y = clamp(p.y + vy * p.sp * pSpMul * dt0, 0.12, 0.92);

    // drones follow / autonomous (max 8)
    st.drones = Array.isArray(st.drones)?st.drones:[];

    const dn = st.drones.length;
    let autopilotActive = false;
    st.autoPilotToastAcc = num(st.autoPilotToastAcc, 0) + dt0;

    for(let i=0;i<dn;i++){
      const d = st.drones[i];

      // Drones start in weak autopilot; items make them smarter.
      if(num(d.aiLv,0) > 0){
        autopilotActive = true;
        this.dsDroneAI(i, d, dt0);
        continue;
      }

      // default: tight formation follow
      const ring = Math.floor(i/4);
      const idx = i % 4;
      const ang = (idx/4)*Math.PI*2 + ring*0.35;
      const radX = 0.09 + ring*0.04;
      const radY = 0.06 + ring*0.03;
      const tx = clamp(p.x + Math.cos(ang)*radX, 0.06, 0.94);
      const ty = clamp(p.y + 0.06 + Math.sin(ang)*radY, 0.12, 0.94);
      const dx = tx - d.x, dy = ty - d.y;
      const dSpMul = (isFinite(d.spMul) ? d.spMul : 1);
      d.x = clamp(d.x + clamp(dx*3.2, -1.4, 1.4) * d.sp * dSpMul * dt0, 0.06, 0.94);
      d.y = clamp(d.y + clamp(dy*3.2, -1.4, 1.4) * d.sp * dSpMul * dt0, 0.12, 0.94);
    }

    // autopilot effect toast removed (requested)
    // (autopilot behavior stays; only the visual/toast is suppressed)

    // fire (rate slightly improves with weapon level)
const rateFor = (w)=>{
  const lv = this.dsGetWeaponLvEff(w||'N');
  const base =
    (w==='G') ? 0.62 : // heavy bomb: very slow fire
    (w==='R') ? 0.44 : // saw: slow fire
    (w==='C') ? 0.18 : // chain laser: medium
    (w==='Z') ? 0.22 :
    (w==='L') ? 0.16 :
    (w==='Q') ? 0.12 :
    (w==='E') ? 0.12 :
    (w==='H') ? 0.12 :
    0.10;

  // heavy weapons scale fire-rate more gently
  const gainMul = (w==='G' || w==='R') ? 0.007 : 0.015;
  const gain = clamp(lv*gainMul, 0, 0.55); // up to ~55% faster
  return base * (1 - gain);
};

    p.cd -= dt0;
    const pRate = rateFor(p.weapon||'N');
    if(p.cd<=0){
      p.cd = pRate;
      this.dsFire(p);
    }

    // drones shoot at half the player's frequency
    for(const d of st.drones){
      d.cd -= dt0;
      const dRate = rateFor(d.weapon||'N') * 2.0;
      if(d.cd<=0){
        d.cd = dRate;
        this.dsFire(d);
      }
    }

    // spawns
    const baseInt = 0.55;
    const intv = Math.max(0.12, baseInt - st.dif*0.03);
    st.spawnAcc += dt0;
    while(st.spawnAcc >= intv){
      st.spawnAcc -= intv;
      this.dsSpawnEnemy();
    }

// rocks (indestructible neon obstacles)
// NOTE: user request: enemies can ramp up, but rocks should NOT increase over time.
// We keep existing rocks (if any) moving/wrapping, but we do not spawn new ones here.
st.rocks = Array.isArray(st.rocks)?st.rocks:[];
st.rockAcc = (isFinite(st.rockAcc)?st.rockAcc:0) + dt0;
// update rocks drift (wrap)
for(const r of st.rocks){
  r.t = (r.t||0) + dt0;

  // pushed rocks move upward for a short time (J weapon)
  if((r.pushT||0) > 0){
    r.pushT = Math.max(0, num(r.pushT,0) - dt0);
    const vy = isFinite(r.pushVy) ? r.pushVy : -0.18;
    r.y += vy * dt0;
    // mild damping towards zero so it eases out
    r.pushVy = vy * (0.985 - dt0*0.08);
    // during push, rocks drift less sideways
    r.x += (r.vx||0) * dt0 * 0.35;
  }else{
    r.y += (r.vy||0.06) * dt0;
    r.x += (r.vx||0) * dt0;
  }

  if(r.x < 0.06){ r.x=0.06; r.vx = Math.abs(r.vx||0.02); }
  if(r.x > 0.94){ r.x=0.94; r.vx = -Math.abs(r.vx||0.02); }
  if(r.y > 1.28){
    r.y = -0.18 - Math.random()*0.22;
    r.x = 0.10 + Math.random()*0.80;
    // reset push state on wrap
    r.pushT = 0;
  }
  if(r.y < -0.60){
    // keep within spawn band
    r.y = -0.60;
  }
}


// boss
    if(!st.boss && num(st.bossRespawnCd,0)<=0 && st.score >= st.nextBossAt){
      // Boss spawn gate:
      // - nextBossAt is set on *boss defeat* (so kill-time doesn't compress the interval)
      // - bossRespawnCd provides a minimum readable gap
      this.dsSpawnBoss();
    }

    // update bullets
    const keepB=[];
    for(const b of st.bullets){
      if(b.laser){
        b.life = (b.life ?? 0.10) - dt0;
      }else{
        b.y += b.vy*dt0;
        b.x += (b.vx||0)*dt0;
        b.rockCd = (b.rockCd||0) - dt0;
        if(b.homing){
    let t = null;
    if(b.homingStrict && b.homingTarget){
      t = b.homingTarget;
      const alive = t && (num(t.hp,1) > 0) && Array.isArray(st.enemies) && st.enemies.includes(t) && (num(t.x,0.5) > -0.20) && (num(t.x,0.5) < 1.20) && (num(t.y,0.5) > -0.20) && (num(t.y,0.5) < 1.20);
      if(!alive){
        b.homing = false;
        b.homingStrict = false;
        b.homingTarget = null;
        t = null;
      }
    }
    if(!t){
      t = this.dsNearestEnemy(b.x,b.y);
    }
    if(t){
      const hpw = (isFinite(b.homingPow)?b.homingPow:1);
      const ax = clamp((t.x - b.x) * (1.55 + hpw*0.22), -0.95, 0.95);
      const turn = clamp(0.06 + hpw*0.004, 0.06, 0.16);
      const damp = clamp(0.92 - hpw*0.002, 0.84, 0.92);
      b.vx = (b.vx||0)*damp + ax*turn;
    }
}
        if(b.nearHoming){
  const hr = (isFinite(b.hr)?b.hr:0.26);
  const t = this.dsNearestEnemy(b.x,b.y, hr);
  if(t){
    const hpw = (isFinite(b.homingPow)?b.homingPow:1);
    const ax = clamp((t.x - b.x) * (1.65 + hpw*0.20), -1.05, 1.05);
    const turn = clamp(0.08 + hpw*0.004, 0.08, 0.18);
    const damp = clamp(0.90 - hpw*0.002, 0.82, 0.90);
    b.vx = (b.vx||0)*damp + ax*turn;
  }
}
      }      if(b.erase){
  // Eraser nerf: keep the fantasy, but no longer "near-invincible".
  // - Much smaller radius
  // - Deletes at most 1 bullet per tick per eraser bullet
  const rr = isFinite(b.eraseR) ? b.eraseR : 0.020;
  const rr2 = rr*rr;
  let erased = 0;
  for(let i=st.ebullets.length-1;i>=0;i--){
    const eb = st.ebullets[i];
    const dx = eb.x - b.x, dy = eb.y - b.y;
    if(dx*dx + dy*dy < rr2){
      st.ebullets.splice(i,1);
      erased++;
      if(erased>=1) break;
    }
  }
}

// rocks block most bullets (even pierce), but special weapons can interact with them.
if(!b.laser){
  const rock = this.dsGetRockAt(b.x, b.y, 0.010);
  if(rock){
    const k = String(b.k||'').toUpperCase();

    // cooldown for repeated interactions on the same frame/path
    if((b.rockCd||0) > 0) b.rockCd -= dt0;

    if(k==='R'){
      // Saw: keeps going while chipping rock HP
      if((b.rockCd||0) <= 0){
        this.dsDamageRock(b.x,b.y, 0.020, num(b.rockDmg, 1.2));
        b.rockCd = 0.08;
      }
      // do not block
    }else if(k==='G'){
      // Heavy bomb: explodes on rock and can break rocks
      const br = Math.max(0.06, num(b.boomR,0.22));
      const bd = num(b.boomDmg, (b.dmg||1)*2.5);
      this.dsDamageRock(b.x,b.y, Math.max(0.06, br*0.85), bd);
      // AoE damage to enemies + boss (so the explosion effect always matters)
      for(const ee of st.enemies){
        if(!ee) continue;
        const dx2 = ee.x - b.x;
        const dy2 = ee.y - b.y;
        if((dx2*dx2 + dy2*dy2) <= br*br){
          ee.hp -= bd;
        }
      }
      if(st.boss){
        const dx3 = st.boss.x - b.x;
        const dy3 = st.boss.y - b.y;
        if((dx3*dx3 + dy3*dy3) <= br*br){
          st.boss.hp -= Math.max(1, Math.floor(bd));
        }
      }
      st.fx = st.fx || {};
      st.fx.particles = Array.isArray(st.fx.particles)?st.fx.particles:[];
      for(let pi=0;pi<10;pi++){
        st.fx.particles.push({x:b.x, y:b.y, vx:(Math.random()*2-1)*0.45, vy:(Math.random()*2-1)*0.45, a:1, c:0});
      }
      continue; // remove bullet
    }else if(k==='J'){
      // Rock Pusher: push the rock upward; bullet is consumed on impact
      this.dsRockPush(rock, num(b.dmg,1));
      continue;
    }else if(k==='K'){
      // Rock Splitter: spawn scatter shots from the rock.
      // IMPORTANT: shards generated by this split should NOT re-trigger splitting, otherwise it explodes exponentially and can freeze the game.
      if(!b.splitShard){
        // original K bullet: consume and split
        this.dsRockSplit(rock.x, rock.y, num(b.dmg,1), this.dsGetWeaponLvEff('K'));
        continue;
      }
      // split shards: pass through rocks (noRockVanish=true) without triggering another split
    }else if(k==='M'){
      // Rock Homing Missile: bounce off rock (do not vanish) and enable strong homing
      if((b.rockCd||0) <= 0){
        this.dsRockHomingBounce(b, rock);
        b.rockCd = 0.06;
      }
      // do not block
    }else{
      // Default: rocks block bullets unless explicitly allowed
      if(!b.noRockVanish) continue;
    }
  }
}else{
  // compute beam stopY if rock blocks
  const len = (isFinite(b.len)?b.len:0.62);
  let topY = b.y - len;
  const bw = (isFinite(b.w)?b.w:0.035);
  if(Array.isArray(st.rocks) && st.rocks.length){
    for(const r of st.rocks){
      if(Math.abs(r.x - b.x) < (r.r + bw)){
        if(r.y < b.y && r.y > (b.y - len)){
          topY = Math.max(topY, r.y + r.r);
        }
      }
    }
  }
  b.stopY = topY;
}

// keep bullet if alive / in bounds
      if(b.laser){
        if((b.life ?? 0) > 0) keepB.push(b);
      }else if(b.y>-0.2 && b.y<1.2 && b.x>-0.2 && b.x<1.2){
        keepB.push(b);
      }
    }
    st.bullets = keepB;

    // decay chain-laser visuals
    if(Array.isArray(st.zaps) && st.zaps.length){
      const kz=[];
      for(const z of st.zaps){
        z.t = (z.t||0) - dt0;
        if(z.t>0) kz.push(z);
      }
      st.zaps = kz;
    }

    const keepEB=[];
    for(const b of st.ebullets){
      b.y += b.vy*dt0;
      b.x += (b.vx||0)*dt0;
// rocks block enemy bullets too
if(this.dsHitRock(b.x,b.y, 0.010)){
  continue;
}
if(b.y>-0.2 && b.y<1.2 && b.x>-0.2 && b.x<1.2) keepEB.push(b);
    }
    st.ebullets = keepEB;

    // cinematic danger zoom: show approaching bullet/enemy in slow-mo before impact
    try{
      const cine = st.cine || (st.cine={on:false, t:0, hold:0, bx:0, by:0, strength:0, lastD:1});
      const pp = st.player;

      // toggleable: allow turning off the danger slow/zoom
      if(!st.cineEnabled){
        cine.on = false;
        cine.hold = 0;
        cine.strength = 0;
        st.camZoom   = num(st.camZoom,1)   + (1.0 - num(st.camZoom,1))   * clamp(dt0*22, 0, 1);
        st.timeScale = num(st.timeScale,1) + (1.0 - num(st.timeScale,1)) * clamp(dt0*22, 0, 1);
        st.camCx = clamp(num(st.camCx,0.5) + (0.50 - num(st.camCx,0.5)) * clamp(dt0*12,0,1), 0, 1);
        st.camCy = clamp(num(st.camCy,0.6) + (0.60 - num(st.camCy,0.6)) * clamp(dt0*12,0,1), 0, 1);
      }else{

      // --- estimate player's current velocity (so "running into danger" also counts) ---
      const pvx = (isFinite(pp._px) && isFinite(pp._py) && dt0>1e-6) ? ((pp.x-pp._px)/dt0) : 0;
      const pvy = (isFinite(pp._px) && isFinite(pp._py) && dt0>1e-6) ? ((pp.y-pp._py)/dt0) : 0;
      pp._px = pp.x; pp._py = pp.y;

      const predictT = 1.0;      // seconds ahead to predict collision
      const triggerDist = 1.0;   // detect slightly earlier than actual hit
      const hitR = 0.034;         // approx player radius
      const enemyR = 0.040;       // approx enemy radius (used for near-miss)
      let threat = null, bestT = 1e9, bx=0, by=0, bestDNow=1e9;

      // helper: compute a [0..1] "danger strength" from distance now
      const dangerStrengthFromDist = (d)=>{
        // stepwise tiers (nearer => stronger)
        // tightened thresholds so zoom only triggers when truly dangerous
        if(d <= 0.040) return 1.00;
        if(d <= 0.060) return 0.86;
        if(d <= 0.080) return 0.72;
        if(d <= 0.100) return 0.56;
        if(d <= 0.120) return 0.40;
        if(d <= 0.150) return 0.26;
        return 0.00;
      };

      // === 1) enemy bullets (relative velocity: bullet - player) ===
      for(const eb of st.ebullets){
        const bvx = (eb.vx||0), bvy = (eb.vy||0);
        const rvx = bvx - pvx, rvy = bvy - pvy; // relative motion
        const dx = eb.x - pp.x, dy = eb.y - pp.y;
        const v2 = rvx*rvx + rvy*rvy;
        if(v2 < 1e-6) continue;

        // closest approach time to player (linear prediction, relative)
        const tcol = - (dx*rvx + dy*rvy) / v2;
        if(tcol < 0 || tcol > predictT) continue;

        const cx = dx + rvx*tcol;
        const cy = dy + rvy*tcol;
        const d2 = cx*cx + cy*cy;
        const hit2 = (hitR*hitR);
        if(d2 > hit2) continue;

        const dNow2 = dx*dx + dy*dy;
        if(dNow2 > triggerDist*triggerDist) continue;

        if(tcol < bestT){
          bestT = tcol;
          threat = eb;
          bx = eb.x; by = eb.y;
          bestDNow = Math.sqrt(dNow2);
        }
      }

      // === 2) enemies themselves (when you or they are about to collide) ===
      if(!threat && Array.isArray(st.enemies) && st.enemies.length){
        for(const e of st.enemies){
          const evx = (e.vx||0), evy = (e.vy||0);
          const rvx = evx - pvx, rvy = evy - pvy;
          const dx = e.x - pp.x, dy = e.y - pp.y;
          const v2 = rvx*rvx + rvy*rvy;

          // if both almost still, use distance now only
          const dNow = Math.sqrt(dx*dx + dy*dy);
          if(dNow > triggerDist) continue;

          let tcol = 0;
          if(v2 >= 1e-6){
            tcol = - (dx*rvx + dy*rvy) / v2;
            if(tcol < 0 || tcol > predictT) continue;
            const cx = dx + rvx*tcol;
            const cy = dy + rvy*tcol;
            const d = Math.sqrt(cx*cx + cy*cy);
            if(d > (hitR + enemyR)) continue;
          }else{
            // no relative motion: only trigger if already very close
            if(dNow > (hitR + enemyR)) continue;
          }

          threat = e;
          bestT = tcol;
          bx = e.x; by = e.y;
          bestDNow = dNow;
          break;
        }
      }

      // decide on/off + hold logic
      if(threat){
        cine.on = true;
        cine.hold = 0.26; // shorter hold: we will also return faster when safe
        cine.bx = bx; cine.by = by;
        cine.lastD = isFinite(bestDNow) ? bestDNow : cine.lastD;
        const targetStr = dangerStrengthFromDist(cine.lastD);
        cine.strength = num(cine.strength,0) + (targetStr - num(cine.strength,0)) * clamp(dt0*12, 0, 1);
      }else{
        // when no current threat: decay hold & strength quickly (escape => fast recover)
        cine.hold = Math.max(0, num(cine.hold,0) - dt0*1.6);
        cine.strength = num(cine.strength,0) + (0 - num(cine.strength,0)) * clamp(dt0*10, 0, 1);
        if(cine.hold<=0 && cine.strength < 0.02) cine.on = false;
      }

      // stepwise timeScale by strength (nearer => slower; a bit away => faster)
      const str = clamp(num(cine.strength,0), 0, 1);

      // More aggressive slow-down near impact (closer => much slower).
      // NOTE: zoom is gated separately; slow is allowed at any lives.
      let targetTS = 1.0;
      if(cine.on || str>0.02){
        if(str >= 0.92) targetTS = 0.02;
        else if(str >= 0.80) targetTS = 0.04;
        else if(str >= 0.66) targetTS = 0.07;
        else if(str >= 0.52) targetTS = 0.11;
        else if(str >= 0.38) targetTS = 0.17;
        else if(str >= 0.26) targetTS = 0.25;
        else if(str >= 0.16) targetTS = 0.40;
        else targetTS = 0.62;
      }

      // Zoom MUST be bounded (and not anchored away from player).
      // Zoom is ONLY allowed at 1 life; slow can still happen at any life.
      let targetZoom = 1.0;
      if((cine.on || str>0.02) && num(st.lives, 3) <= 1){
        targetZoom = 1.0 + 1.15*str;
        targetZoom = clamp(targetZoom, 1.0, 2.2);
      }

      // faster recovery when safe: different speeds for in/out
      const inSpd  = 14;
      const outSpd = 20;
      const zSpd = (targetZoom > num(st.camZoom,1)) ? inSpd : outSpd;
      const tSpd = (targetTS   < num(st.timeScale,1)) ? inSpd : outSpd;

      st.camZoom   = num(st.camZoom,1)   + (targetZoom - num(st.camZoom,1)) * clamp(dt0*zSpd, 0, 1);
      st.timeScale = num(st.timeScale,1) + (targetTS   - num(st.timeScale,1)) * clamp(dt0*tSpd, 0, 1);

      if(cine.on || str>0.02){
        // Keep the player as the primary anchor.
        // Nudge toward the threat, but cap the nudge (smaller when zoomed in).
        const zNow = Math.max(1, num(st.camZoom,1));
        const maxNudge = 0.10 / zNow; // at zoom 2.0 => 0.05
        const nx = clamp((num(cine.bx,pp.x) - pp.x) * 0.25, -maxNudge, maxNudge);
        const ny = clamp((num(cine.by,pp.y) - pp.y) * 0.25, -maxNudge, maxNudge);
        st.camCx = clamp(pp.x + nx, 0.08, 0.92);
        st.camCy = clamp(pp.y + ny, 0.10, 0.92);
      }else{
        st.camCx = clamp(num(st.camCx,0.5) + (0.50 - num(st.camCx,0.5)) * clamp(dt0*8,0,1), 0, 1);
        st.camCy = clamp(num(st.camCy,0.6) + (0.60 - num(st.camCy,0.6)) * clamp(dt0*8,0,1), 0, 1);
      }
      }
    }catch(e){}


    // enemies move & shoot
    const keepE=[];
    for(const e of st.enemies){
      e.t += dt0;
      e.y += e.vy*dt0;
      e.x += e.vx*dt0;
      // bounce for zig
      if(e.kind==='zig'){
        if(e.x<0.08 || e.x>0.92) e.vx *= -1;
      }
      // tricky movers
      if(e.kind==='orbiter'){
        // orbit-ish: weave around player's x
        e.phase = num(e.phase,0) + dt0*(2.2 + st.dif*0.04);
        const amp = 0.22 + Math.min(0.10, st.dif*0.004);
        const tx  = p.x + Math.sin(e.phase)*amp;
        e.vx = clamp((tx - e.x) * 1.35, -0.42, 0.42);
      }
      if(e.kind==='mirage'){
        e.phase = num(e.phase,0) + dt0*(3.0 + st.dif*0.05);
        const sway = Math.sin(e.phase) * (0.28 + Math.min(0.06, st.dif*0.003));
        const jitter = (Math.sin(e.phase*2.3+1.1)*0.06);
        e.vx = clamp((sway + jitter) * 0.9, -0.55, 0.55);
      }
      if(e.kind==='charger'){
        // drop -> dash toward player once
        if(e.state===0 && e.y>0.26){
          e.state = 1;
          e.dashT = 0.42 + Math.random()*0.10;
          const dx = p.x - e.x;
          e.vx = clamp(dx * 2.2, -0.95, 0.95);
          e.vy = 0.78 + st.dif*0.02;
        }else if(e.state===1){
          e.dashT = num(e.dashT,0) - dt0;
          if(e.dashT<=0){
            e.state = 2;
            // recover
            e.vy = (0.22 + st.dif*0.02) - 0.02;
            e.vx *= 0.25;
          }
        }
      }
      // shooter bullets
      e.cd -= dt0;

      if(e.kind==='shooter' && e.cd<=0){
        e.cd = 0.85 - Math.min(0.35, st.dif*0.02);
        this.dsEnemyShoot(e, 1);
      }
      if(e.kind==='sweeper' && e.cd<=0){
        e.cd = 1.20 - Math.min(0.45, st.dif*0.02);
        this.dsEnemyShoot(e, 3);
      }

      if(e.kind==='sniper' && e.cd<=0){
        // fast, less-random aimed shot
        e.cd = 1.35 - Math.min(0.55, st.dif*0.02);
        const aimX = p.x; // no wobble
        const aimY = p.y;
        const dx = aimX - e.x;
        const dy = aimY - e.y;
        const len = Math.max(0.001, Math.hypot(dx,dy));
        // Enemy bullets were a bit too fast; slow them slightly for readability.
        const sp = (0.52 + st.dif*0.018); // still faster than normal
        st.ebullets.push({x:e.x,y:e.y+0.02,vx:(dx/len)*sp,vy:(dy/len)*sp});
      }

      if((e.kind==='orbiter' || e.kind==='mirage') && e.cd<=0){
        // occasional spread
        e.cd = 1.05 - Math.min(0.35, st.dif*0.02) + Math.random()*0.25;
        this.dsEnemyShoot(e, (e.kind==='mirage')?3:1);
      }
      // pushed rock collision: rocks become a slow moving ram + shield
      if(e.hp>0 && Array.isArray(st.rocks) && st.rocks.length){
        for(const r of st.rocks){
          if((r.pushT||0) <= 0) continue;
          const rr = num(r.r,0.05) + 0.022;
          const dx = e.x - r.x, dy = e.y - r.y;
          if(dx*dx + dy*dy < rr*rr){
            // normal enemies: crushed. (boss is handled separately in boss update)
            e.hp = 0;
            this.dsAddScore(120 + st.dif*2, 1.0, e.x, e.y);
            // rock loses its push after a hit
            r.pushT = Math.min(num(r.pushT,0), 0.35);
            break;
          }
        }
      }
      if(e.hp>0 && e.y<1.15) keepE.push(e);
    }
    st.enemies = keepE;

// boss update
if(st.boss){
  const b=st.boss;
  b.t += dt0;
  const tier = (isFinite(b.tier)?b.tier:1);
  const mv = 0.55 + tier*0.035 + st.dif*0.01;
  const ampX = 0.16 + Math.min(0.11, tier*0.004);
  const ampY = 0.030 + Math.min(0.030, tier*0.0018);
  const seed = (isFinite(b.seed)?b.seed:0);

  if(b.kind==='spiral'){
    b.x = 0.5 + Math.sin(b.t*mv*1.05 + seed)* (ampX*1.05);
    b.y = 0.12 + Math.sin(b.t*mv*0.62 + seed*0.3)* (ampY*1.10);
  }else if(b.kind==='fan'){
    b.x = 0.5 + Math.sin(b.t*mv*0.95 + seed)* ampX;
    b.y = 0.13 + Math.sin(b.t*mv*0.55 + seed*0.3)* ampY;
  }else if(b.kind==='burst'){
    b.x = 0.5 + Math.sin(b.t*mv*0.85 + seed)* (ampX*0.92);
    b.y = 0.14 + Math.sin(b.t*mv*0.48 + seed*0.3)* (ampY*0.90);
  }else if(b.kind==='sniper'){
    // steadier, less lateral movement (keeps snipes readable)
    b.x = 0.5 + Math.sin(b.t*mv*0.62 + seed)* (ampX*0.62);
    b.y = 0.13 + Math.sin(b.t*mv*0.38 + seed*0.3)* (ampY*0.85);
  }else if(b.kind==='spray'){
    // jittery side-to-side
    b.x = 0.5 + Math.sin(b.t*mv*1.20 + seed)* (ampX*1.10) + Math.sin(b.t*3.0 + seed)*0.010;
    b.y = 0.14 + Math.sin(b.t*mv*0.52 + seed*0.3)* (ampY*0.95);
  }else{
    b.x = 0.5 + Math.sin(b.t*mv*0.80 + seed)* ampX;
    b.y = 0.14 + Math.sin(b.t*mv*0.45 + seed*0.3)* ampY;
  }

  // pushed rock collision with boss: deals damage and ends push quickly
  if(Array.isArray(st.rocks) && st.rocks.length){
    for(const r of st.rocks){
      if((r.pushT||0) <= 0) continue;
      const rr = num(r.r,0.05) + 0.030;
      const dx = b.x - r.x, dy = b.y - r.y;
      if(dx*dx + dy*dy < rr*rr){
        b.hp = Math.max(0, num(b.hp,1) - Math.max(1, Math.round(num(r.pushDmg,2))));
        this.dsAddScore(240 + st.dif*3, 1.0, b.x, b.y);
        r.pushT = Math.min(num(r.pushT,0), 0.25);
        break;
      }
    }
  }

  b.cd -= dt0;
  if(b.cd<=0){
    let baseCd = 0.78 - st.dif*0.018 - tier*0.010; // slightly slower overall
    // Pattern-based cadence tweaks
    if(b.kind==='burst') baseCd *= 1.45;
    if(b.kind==='sniper') baseCd *= 1.20;
    if(b.kind==='spray') baseCd *= 0.92;

    b.cd = Math.max(0.22, baseCd);
    this.dsBossShoot(b);
  }
  if(b.hp<=0){
    // boss kill count (for perma carry)
    try{ st.bossKillsRun = num(st.bossKillsRun,0) + 1; }catch(e){}
    this.dsAddScore(3200 + st.dif*140 + tier*180);
    // drop rare
    this.dsDropPowerup(b.x, b.y, true);
    // Keep a readable gap before the next boss appears (independent from score growth).
    st.bossRespawnCd = Math.max(num(st.bossRespawnCd,0), 6.0);
    // Next boss threshold is decided at defeat time, so the interval stays consistent
    // even if you took a long time to finish the boss.
    st.nextBossAt = st.score + (20000 + st.dif*2500);

    st.boss = null;
  }

}


    // MISSILE update
    st.missiles = Array.isArray(st.missiles)?st.missiles:[];
    st.mBursts  = Array.isArray(st.mBursts)?st.mBursts:[];
    st.rings    = Array.isArray(st.rings)?st.rings:[];
    st.pendingMissiles = Array.isArray(st.pendingMissiles)?st.pendingMissiles:[];

    // cooldown & auto fire (hold)
    st.missileCd = Math.max(0, num(st.missileCd,0) - dt0);
    if((st.missileHold || st.missileAuto) && st.missileCd<=0){
      this.dsTryFireMissile(false);
    }

    // delayed drone missile shots
    if(st.pendingMissiles.length){
      const keepPM=[];
      for(const pm of st.pendingMissiles){
        pm.t = num(pm.t,0) - dt0;
        if(pm.t<=0){
          this.dsFireMissile(pm.unit, pm.spec);
        }else{
          keepPM.push(pm);
        }
      }
      st.pendingMissiles = keepPM;
    }

    // extra burst explosions
    if(st.mBursts.length){
      const keepMB=[];
      for(const mb of st.mBursts){
        mb.t = num(mb.t,0) - dt0;
        if(mb.t<=0){
          this.dsMissileExplode(mb.x, mb.y, mb.spec, mb.stage||1);
        }else{
          keepMB.push(mb);
        }
      }
      st.mBursts = keepMB;
    }

    // rings (cheap particles)
    if(st.rings.length){
      const keepR=[];
      for(const r of st.rings){
        r.t = num(r.t,0) + dt0;
        r.r = num(r.r,0.01) + dt0*(0.26 + 0.18*(r.max||0.10));
        r.a = num(r.a,0.8) * (0.985 - dt0*0.08);
        if(r.r < (r.max||0.18) && r.a>0.04) keepR.push(r);
      }
      st.rings = keepR.slice(-140);
    }

    // missiles move & collide
    if(st.missiles.length){
      const keepM=[];
      const spec0 = this.dsGetMissileSpec();
      for(const m of st.missiles){
        m.t = num(m.t,0) + dt0;
        m.sp = Math.min(num(m.spMax,1.2), num(m.sp,0.10) + num(m.acc,1.1)*dt0);

        // steering
        const type = String(m.type||'a');
        if(type==='a'){
          // arc swing + light homing
          m.phase = num(m.phase,0) + dt0*(7.0 + m.lv*0.35);
          const amp = 0.11 * (0.80 + (m.lv||1)*0.10);
          const sway = Math.sin(m.phase) * amp;
          const tgt = this.dsMissileTarget(m.x,m.y);
          const hx = tgt ? clamp((tgt.x - m.x) * (0.55 + (m.lv||1)*0.08), -0.35, 0.35) : 0;
          m.vx = sway + hx;
        }else if(type==='h'){
          // strong homing
          const tgt = this.dsMissileTarget(m.x,m.y);
          const hx = tgt ? clamp((tgt.x - m.x) * (1.05 + (m.lv||1)*0.12), -0.65, 0.65) : 0;
          m.vx = (num(m.vx,0)*0.86) + hx*0.18;
        }else{
          // wide: mostly straight
          m.vx = num(m.vx,0) * 0.92;
        }

        // move
        m.x = m.x + (m.vx * m.sp) * dt0;
        m.y = m.y + (m.vy * m.sp) * dt0;

        // bounds
        if(m.y < -0.25 || m.x < -0.25 || m.x > 1.25) continue;

        let exploded=false;

        // rock collision
        if(this.dsHitRock(m.x,m.y, m.hitR||0.02)){
          this.dsMissileExplode(m.x,m.y, {...spec0, type:m.type, lv:m.lv});
          exploded=true;
        }

        // enemy bullet collision
        if(!exploded && st.ebullets && st.ebullets.length){
          for(let i=st.ebullets.length-1;i>=0;i--){
            const b=st.ebullets[i];
            const dx=b.x-m.x, dy=b.y-m.y;
            if(dx*dx + dy*dy <= 0.00055){
              st.ebullets.splice(i,1);
              this.dsMissileExplode(m.x,m.y, {...spec0, type:m.type, lv:m.lv});
              exploded=true;
              break;
            }
          }
        }

        // enemy collision
        if(!exploded && st.enemies && st.enemies.length){
          for(let i=st.enemies.length-1;i>=0;i--){
            const e=st.enemies[i];
            const dx=e.x-m.x, dy=e.y-m.y;
            if(dx*dx + dy*dy <= 0.0022){
              this.dsMissileExplode(m.x,m.y, {...spec0, type:m.type, lv:m.lv});
              exploded=true;
              break;
            }
          }
        }

        // boss collision
        if(!exploded && st.boss){
          const b=st.boss;
          const br = (0.085 + (b.tier||0)*0.003);
          const dx=b.x-m.x, dy=b.y-m.y;
          if(dx*dx + dy*dy <= br*br){
            this.dsMissileExplode(m.x,m.y, {...spec0, type:m.type, lv:m.lv});
            exploded=true;
          }
        }

        if(!exploded) keepM.push(m);
      }
      st.missiles = keepM;
    }

// powerups (slight magnet when near player)
    const keepP=[];
    const magR = 0.20;
    const pickR = 0.075;
    const magR2 = magR*magR;
    for(const pu of st.pups){
      pu.y += pu.vy*dt0;

      // magnetize toward player when reasonably close
      const mx = (p.x - pu.x);
      const my = (p.y - pu.y);
      const d2 = mx*mx + my*my;
      if(d2 < magR2){
        const d = Math.max(0.0001, Math.sqrt(d2));
        const t = clamp(1 - (d/magR), 0, 1);
        const pull = (0.32 + 0.62*t) * dt0;
        pu.x = clamp(pu.x + (mx/d)*pull, 0.04, 0.96);
        pu.y = clamp(pu.y + (my/d)*pull, 0.04, 0.98);
        // soften fall while being pulled
        if(d < pickR*1.25) pu.vy *= 0.88;
      }

      if(pu.y<1.2) keepP.push(pu);
    }
    st.pups = keepP;

    // collisions: player bullets vs enemies
    const hitR = 0.03; // default bullet hit radius
    const getHitR = (b)=> (isFinite(b?.hitR) ? b.hitR : hitR);
    for(let i=st.enemies.length-1;i>=0;i--){
      const e=st.enemies[i];
      if(!e) continue;
      for(let j=st.bullets.length-1;j>=0;j--){
        const b=st.bullets[j];
        const hit = b.laser ? (Math.abs(b.x-e.x) < (b.w??0.035) && e.y <= b.y && e.y >= (b.stopY ?? (b.y - (b.len??0.62)))) : (Math.abs(b.x-e.x)<getHitR(b) && Math.abs(b.y-e.y)<getHitR(b));
        if(hit){
          // base damage
          e.hp -= b.dmg;
          this.dsAddScore(12);
          // Heavy bomb AoE
          if(b.boomR && b.boomDmg){
            const br = b.boomR;
            const bd = b.boomDmg;
            for(const ee of st.enemies){
              if(!ee || ee===e) continue;
              const dx2 = ee.x - e.x;
              const dy2 = ee.y - e.y;
              if((dx2*dx2 + dy2*dy2) <= br*br){
                ee.hp -= bd;
              }
            // also affect boss if within range of impact center
            if(st.boss){
              const dx3 = st.boss.x - e.x;
              const dy3 = st.boss.y - e.y;
              if((dx3*dx3 + dy3*dy3) <= br*br){
                st.boss.hp -= Math.max(1, Math.floor(bd));
              }
            }
          }

          }
          // Ricochet chain: 1 jump to nearest enemy within range
          if(b.chain && b.chainR){
            let best=null, bestD=1e9;
            for(const ee of st.enemies){
              if(!ee || ee===e) continue;
              const dx2 = ee.x - e.x;
              const dy2 = ee.y - e.y;
              const d2 = dx2*dx2 + dy2*dy2;
              if(d2 <= (b.chainR*b.chainR) && d2 < bestD){ bestD=d2; best=ee; }
            }
                        // also allow chaining to boss (boss is stored separately from st.enemies)
            if(st.boss && st.boss!==e && st.boss.hp>0){
              const dx2 = st.boss.x - e.x;
              const dy2 = st.boss.y - e.y;
              const d2 = dx2*dx2 + dy2*dy2;
              if(d2 <= (b.chainR*b.chainR) && d2 < bestD){ bestD=d2; best=st.boss; }
            }

if(best){
              const mul = num(b.chainMul, 0.65);
              best.hp -= b.dmg * mul;
              this.dsAddScore(8);
            }
            b.chain = 0;
          }
          if(!b.pierce && !b.laser) st.bullets.splice(j,1);
          if(e.hp<=0){
            this.dsAddScore(e.score);

            // splitter: break into 2 minis (no further splitting)
            if(e.kind==='splitter'){
              const miniVy = (0.26 + st.dif*0.02);
              const mk=(sx)=>({kind:'mini', x:clamp(e.x + sx*(0.03+Math.random()*0.02),0.06,0.94), y:e.y, vx:sx*(0.12+Math.random()*0.06), vy:miniVy, hp:1, score:35, cd:0.90+Math.random()*0.5, t:0, phase:Math.random()*Math.PI*2, state:0});
              st.enemies.push(mk(-1));
              st.enemies.push(mk(1));
            }

            // drop chance
            this.dsDropPowerup(e.x,e.y,false);
            st.enemies.splice(i,1);
          }
          break;
        }
      }
    }
    // bullets vs boss
    if(st.boss){
      const e=st.boss;
      for(let j=st.bullets.length-1;j>=0;j--){
        const b=st.bullets[j];
        const hit = b.laser ? (Math.abs(b.x-e.x) < (b.w??0.05) && e.y <= b.y && e.y >= (b.stopY ?? (b.y - (b.len??0.62)))) : (Math.abs(b.x-e.x)<Math.max(0.08, getHitR(b)*2.2) && Math.abs(b.y-e.y)<Math.max(0.06, getHitR(b)*2.0));
        if(hit){
          e.hp -= b.dmg;
          this.dsAddScore(18);
          // Ricochet chain: if the bullet hits the boss first, allow the bounce to jump to a nearby normal enemy.
          if(b.chain && b.chainR){
            let best=null, bestD=1e9;
            for(const ee of st.enemies){
              if(!ee) continue;
              const dx2 = ee.x - e.x;
              const dy2 = ee.y - e.y;
              const d2 = dx2*dx2 + dy2*dy2;
              if(d2 <= (b.chainR*b.chainR) && d2 < bestD){ bestD=d2; best=ee; }
            }
            if(best){
              const mul = num(b.chainMul, 0.65);
              best.hp -= b.dmg * mul;
              this.dsAddScore(8);
            }
            b.chain = 0;
          }


          if(!b.pierce && !b.laser) st.bullets.splice(j,1);
        }
      }
    }

    // pick powerups (auto pickup when close)
    for(let i=st.pups.length-1;i>=0;i--){
      const pu=st.pups[i];
      const dx = p.x - pu.x;
      const dy = p.y - pu.y;
      if((dx*dx + dy*dy) < (0.075*0.075)){
        this.dsApplyPowerup(pu.type);
        st.pups.splice(i,1);
      }
    }


    // toast updates (near player)
    if(Array.isArray(st.toasts) && st.toasts.length){
      const keepT=[];
      for(const tt of st.toasts){
        tt.t += dt0;
        tt.y += (tt.vy ?? -0.08) * dt0;
        if(tt.t < (tt.life ?? 1.2)) keepT.push(tt);
      }
      st.toasts = keepT;
    }

    // hits (player + drones)
    if(st.inv>0) st.inv -= dt0;
    const pr = 0.035 * clamp((isFinite(p.hitMul)?p.hitMul:1), 0.45, 1);
    const drBase = 0.030;

    const droneDamage = (idx)=>{
      if(st.drones && st.drones[idx] && st.drones[idx].inv) return;

      const d = st.drones[idx];
      if(!d) return;

      // barrier blocks one hit first
      if(d.shield){
        d.shield = 0;
        this.dsUpdateHUD();
        return;
      }

      // HP system: base 3 (≈ +2 from prior), decrease then remove
      d.hp = Math.max(0, num(d.hp, num(d.hpMax, 3)) - 1);
      if(d.hp <= 0){
        st.drones.splice(idx, 1);
      }
      this.dsUpdateHUD();
    };

    // drones: enemy bullets / bodies / boss touch
    // enemy bullets -> drones (inv drone: bullets pass through; others collide)
    for(let i=st.ebullets.length-1;i>=0;i--){
      const b=st.ebullets[i];
      let consumed = false;
      for(let k=st.drones.length-1;k>=0;k--){
        const d=st.drones[k];
        let dr = drBase * clamp((isFinite(d.hitMul)?d.hitMul:1), 0.45, 1);
        // baseline autopilot is intentionally fragile
        if(num(d.aiPts,0)<=0) dr *= 1.20;
        if(Math.abs(b.x-d.x)<dr && Math.abs(b.y-d.y)<dr){
          if(d && d.inv){
            // pass through
            continue;
          }else{
            st.ebullets.splice(i,1);
            droneDamage(k);
            consumed = true;
            break;
          }
        }
      }
      if(consumed) continue;
    }

    // enemy bodies -> drones
    for(let i=st.enemies.length-1;i>=0;i--){
      const e=st.enemies[i];
      for(let k=st.drones.length-1;k>=0;k--){
        const d=st.drones[k];
        let dr = drBase * clamp((isFinite(d.hitMul)?d.hitMul:1), 0.45, 1);
          // baseline autopilot is intentionally fragile
          if(num(d.aiPts,0)<=0) dr *= 1.20;
        if(Math.abs(e.x-d.x)<dr && Math.abs(e.y-d.y)<dr){
          st.enemies.splice(i,1);
          droneDamage(k);
          break;
        }
      }
    }
    // boss touch -> drones
    if(st.boss){
      for(let k=st.drones.length-1;k>=0;k--){
        const d=st.drones[k];
        if(Math.abs(st.boss.x-d.x)<0.09 && Math.abs(st.boss.y-d.y)<0.08){
          droneDamage(k);
        }
      }
    }

    // player hit (invincibility applies to player only)
    if(st.inv<=0){
      // enemy bullet
      for(let i=st.ebullets.length-1;i>=0;i--){
        const b=st.ebullets[i];
        const dx = (b.x - p.x);
        const dy = (b.y - p.y);
        const dist = Math.hypot(dx, dy);

        // clutch: grazing near-miss (does NOT consume bullet)
        const nearMargin = num(DOTSTRIKE_TUNING?.clutch?.nearMargin, 0.020);
        if(dist >= pr && dist < (pr + nearMargin)){
          if(!b._cl){
            b._cl = 1;
            this.dsTriggerClutch(p.x, p.y);
          }
        }

        if(dist < pr){
          st.ebullets.splice(i,1);
          this.dsPlayerDamage();
          break;
        }
      }
      // enemy body
      for(let i=st.enemies.length-1;i>=0;i--){
        const e=st.enemies[i];
        // clutch: near-miss with enemy body (no damage)
        const pr = num(st.player?.r, 0.018);
        const nearMargin = num(DOTSTRIKE_TUNING?.clutch?.nearMargin, 0.035);
        const ax = Math.abs(e.x-p.x);
        const ay = Math.abs(e.y-p.y);
        const dBox = Math.max(ax, ay);
        // throttle so hovering beside one enemy doesn't spam stacks
        const last = num(e._clt, -1);
        if(dBox >= pr && dBox < (pr + nearMargin)){
          if(last < 0 || (st.t - last) > 2000){
            e._clt = st.t;
            this.dsTriggerClutch(p.x, p.y);
          }
        }

        if(Math.abs(e.x-p.x)<pr && Math.abs(e.y-p.y)<pr){
          st.enemies.splice(i,1);
          this.dsPlayerDamage();
          break;
        }
      }
if(st.boss){
        const bx = st.boss.x, by = st.boss.y;
        // clutch: near-miss with boss body (easier + throttled)
        const pr = num(st.player?.r, 0.018);
        const nearMargin = num(DOTSTRIKE_TUNING?.clutch?.nearMargin, 0.035);
        const ax = Math.abs(bx-p.x);
        const ay = Math.abs(by-p.y);
        const dBox = Math.max(ax, ay);
        const last = num(st.boss._clt, -1);
        if(dBox >= pr && dBox < (pr + nearMargin)){
          if(last < 0 || (st.t - last) > 2000){
            st.boss._clt = st.t;
            this.dsTriggerClutch(p.x, p.y);
          }
        }
        // damage (boss has larger body)
        if(Math.abs(bx-p.x)<0.09 && Math.abs(by-p.y)<0.08){
          this.dsPlayerDamage();
        }
      }
    }


    // caps (軽量化)
    const capArr=(arr)=>{ if(arr.length>st.maxObjs) arr.splice(0, arr.length-st.maxObjs); };
    capArr(st.bullets); capArr(st.ebullets); capArr(st.enemies); capArr(st.pups);
  }
  dsPlayerDamage(){
    const st=this._ds; if(!st) return;
    // barrier: one hit block
    if(st.player && st.player.shield){
      st.player.shield = 0;
      st.inv = 0.45;
      const fx=$("#dsFlash");
      if(fx){ fx.classList.remove('on'); void fx.offsetWidth; fx.classList.add('on'); setTimeout(()=>fx.classList.remove('on'), 110); }
      this.dsUpdateHUD();
      return;
    }
    st.lives--;
    st.inv = 1.2;
    // NOTE: player damage-only screen effect disabled (per request)
    if(st.lives<=0){
      this.dsEndRun(false);
      const over=$("#dsOver");
      if(over) over.style.display='flex';
      const ol=$("#dotShootOL"); if(ol) ol.style.display='flex';
    }
  }


dsFire(unit){
  const st=this._ds; if(!st) return;
  const u = unit || st.player;
  const w = (u && u.weapon) ? u.weapon : ((st.player && st.player.weapon) ? st.player.weapon : 'N');
  const lv = this.dsGetWeaponLvEff(w);
  const add=(x,y,vx,vy,opt={})=>{
    st.bullets.push({
      x,y,vx: vx||0, vy,
      dmg: opt.dmg||1,
      pierce: !!opt.pierce,
      homing: !!opt.homing,
      nearHoming: !!opt.nearHoming,
      hr: opt.hr,
      homingPow: opt.homingPow,
      erase: !!opt.erase,
      eraseR: opt.eraseR,
      laser: !!opt.laser,
      life: opt.life,
      len: opt.len,
      k: opt.k || w,
      w: opt.w,
      boomR: opt.boomR,
      boomDmg: opt.boomDmg,
      chain: opt.chain,
      chainR: opt.chainR,
      chainMul: opt.chainMul,
      hitR: opt.hitR,
      rockDmg: opt.rockDmg,
    });
  };
  const x = u.x;
  const y = u.y - 0.04;

  // common scalers
  const spUp = 1 + lv*0.012;

  if(w==='N'){
    const dmg = 1.0 + lv*0.045;
    add(x,y,0,-1.15*spUp,{dmg});
    if(lv>=10 && Math.random()<0.18) add(x,y,0,-1.15*spUp,{dmg:dmg*0.85});
    if(lv>=20 && Math.random()<0.12) add(x-0.018,y,-0.18,-1.08*spUp,{dmg:dmg*0.75});
    if(lv>=20 && Math.random()<0.12) add(x+0.018,y, 0.18,-1.08*spUp,{dmg:dmg*0.75});
  }else if(w==='S'){
    const cnt = clamp(3 + Math.floor(lv/5), 3, 8);
    const spread = 0.13 + lv*0.0025;
    const dmg = 0.90 + lv*0.030;
    for(let i=0;i<cnt;i++){
      const t = (cnt===1)?0:((i-(cnt-1)/2)/((cnt-1)/2));
      const vx = t * spread;
      add(x + vx*0.02, y, vx, -1.05*spUp, {dmg});
    }
  }else if(w==='L'){
    const dmg = 1.55 + lv*0.075;
    add(x,y,0,-1.35*spUp,{dmg, pierce:true});
    if(lv>=10) add(x-0.018,y,-0.10,-1.28*spUp,{dmg:dmg*0.75, pierce:true});
    if(lv>=10) add(x+0.018,y, 0.10,-1.28*spUp,{dmg:dmg*0.75, pierce:true});
    if(lv>=22) add(x,y,0,-1.48*spUp,{dmg:dmg*0.55, pierce:true});
  }else if(w==='H'){
    const missiles = clamp(1 + Math.floor(lv/4), 1, 5);
    const dmg = 0.90 + lv*0.045;
    const hpw = 0.95 + lv*0.14; // homing power
    for(let i=0;i<missiles;i++){
      const off = (i-(missiles-1)/2) * 0.010;
      add(x+off, y, off*4, -0.98*spUp, {dmg, homing:true, homingPow: hpw});
    }
    if(lv>=14 && Math.random()<0.18){
      add(x,y,0,-0.98*spUp,{dmg:dmg*0.7, homing:true, homingPow: hpw*1.2});
    }
  }else if(w==='Q'){
    const dmg = 1.00 + lv*0.045;
    const hr = clamp(0.22 + lv*0.010, 0.22, 0.52);
    const hpw = 0.95 + lv*0.13;
    const cnt = clamp(1 + Math.floor(lv/6), 1, 4);
    for(let i=0;i<cnt;i++){
      const off = (i-(cnt-1)/2)*0.016;
      add(x+off,y,off*3.5,-1.12*spUp,{dmg, nearHoming:true, hr, homingPow:hpw});
    }
  }else if(w==='Z'){
    // laser: short-lived beam (multi-hit while active), grows wide/long/strong
    const dmg = 0.48 + lv*0.045;
    const life = clamp(0.10 + lv*0.0035, 0.10, 0.21);
    const len = 1.55 + lv*0.01; // long beam: reaches top of screen (rocks can still block)
    const ww  = clamp(0.030 + lv*0.0010, 0.030, 0.058);
    add(x,y,0,0,{laser:true, dmg, life, len, w: ww});
    if(lv>=16 && Math.random()<0.16) add(x+0.016,y,0,0,{laser:true, dmg:dmg*0.75, life:life*0.9, len:len*0.88, w: ww*0.85});
    if(lv>=24 && Math.random()<0.14) add(x-0.016,y,0,0,{laser:true, dmg:dmg*0.75, life:life*0.9, len:len*0.88, w: ww*0.85});
  }else if(w==='E'){
    // eraser: shoots "clean" bullets that delete enemy bullets in radius (grows with lv)
    const cnt = clamp(3 + Math.floor(lv/6), 3, 6);
    const dmg = 0.82 + lv*0.045;
    const erR = clamp(0.016 + lv*0.0009, 0.016, 0.032);
    for(let i=0;i<cnt;i++){
      const off = (i-(cnt-1)/2) * 0.014;
      add(x+off, y, off*2.5, -1.06*spUp, {dmg, erase:true, eraseR: erR});
    }
    if(lv>=18 && Math.random()<0.16){
      add(x,y,0,-1.02*spUp,{dmg:dmg*0.70, erase:true, eraseR: erR*1.15});
    }
  
  }else if(w==='G'){
    // Heavy slow bomb: SUPER slow + rock-breaking + huge explosion.
    // Intended: "low-speed missile" feel. Big payoff, low RoF.
    const dmg = 1.55 + lv*0.075;
    const vy = -0.38 * (1 + lv*0.006); // ultra slow
    const boomR = clamp(0.18 + lv*0.006, 0.18, 0.34);
    const boomDmg = dmg * (1.25 + lv*0.03);
    add(x,y,0,vy,{dmg, hitR:0.046, life:2.35, boomR, boomDmg, k:'G'});

    // higher lv: occasional secondary bomb (still slow)
    if(lv>=9 && Math.random()<0.20){
      add(x + (Math.random()*2-1)*0.012, y+0.01, 0, vy*0.92, {
        dmg:dmg*0.78, hitR:0.043, life:2.20, boomR:boomR*0.90, boomDmg:boomDmg*0.78, k:'G'
      });
    }

  }else if(w==='R'){
    // Spinning saw: slow-moving grinder that can also break rocks.
    // Intended: "巻き込んで岩を破壊しゆっくり進む" feel.
    const dmg = 0.78 + lv*0.042;
    const vy = -0.62 * (1 + lv*0.006); // slower than normal bullets
    const hr = clamp(0.060 + lv*0.0014, 0.060, 0.095);
    add(x,y,0,vy,{dmg, pierce:true, hitR: hr, life:1.85, k:'R', rockDmg: (1.25 + lv*0.08)});

    // wide sweep at higher lv (still slow)
    if(lv>=7) add(x-0.018,y+0.006,0,vy*0.98,{dmg:dmg*0.64, pierce:true, hitR:hr*0.90, life:1.70, k:'R', rockDmg:(0.90 + lv*0.06)});
    if(lv>=13) add(x+0.018,y+0.006,0,vy*0.98,{dmg:dmg*0.64, pierce:true, hitR:hr*0.90, life:1.70, k:'R', rockDmg:(0.90 + lv*0.06)});

  }else if(w==='C'){
    // Chain laser (hitscan): instantly strikes nearest enemy, then keeps bouncing if next targets exist.
    // Intended: "近くの敵に一瞬で届き、跳弾先があれば跳弾しつづける" feel.
    this.dsZapChain(u, lv);
    return; // no physical bullet needed

 
  }else if(w==='J'){
    // Rock Pusher: hitting a rock pushes it upward (slow), making it a moving shield & ram.
    const dmg = 0.95 + lv*0.05;
    add(x,y,0,-1.12*spUp,{dmg,k:'J', rockDmg:1.0 + lv*0.05});
  }else if(w==='K'){
    // Rock Splitter: hitting a rock scatters multiplying shots (shots do not vanish on rocks).
    const dmg = 0.85 + lv*0.045;
    add(x,y,0,-1.10*spUp,{dmg,k:'K', rockDmg:0.9 + lv*0.05});
  }else if(w==='M'){
    // Rock Homing Missile: slow missile; when it touches a rock it bounces (doesn't vanish) and then homes hard.
    const dmg = 1.20 + lv*0.08;
    add(x,y,0,-0.55*spUp,{dmg,k:'M', missile:true, noRockVanish:true, homing:false, homingPow:0, rockCd:0});
  }else{
    const dmg = 1.0 + lv*0.05;
    add(x,y,0,-1.15*spUp,{dmg});
  }
}

  dsZapChain(unit, lv){
    const st=this._ds; if(!st) return;
    const u = unit || st.player;
    const ox = clamp(num(u.x,0.5), 0.06, 0.94);
    const oy = clamp(num(u.y,0.88) - 0.05, 0.04, 0.98);

    // tuning by level
    const hops = clamp(2 + Math.floor(lv/4), 2, 9);      // how many targets in a chain
    const range0 = clamp(0.30 + lv*0.010, 0.30, 0.46);   // initial target search radius
    const hopR  = clamp(0.22 + lv*0.008, 0.22, 0.42);    // hop radius
    const baseD = 0.95 + lv*0.060;                       // base damage
    const decay = clamp(0.78 - lv*0.010, 0.50, 0.78);    // per-hop damage decay

    const enemies = Array.isArray(st.enemies)?st.enemies:[];
    const candidates = enemies.slice();
    if(st.boss) candidates.push(st.boss);
    if(!candidates.length) return;

    const used = new Set();
    const segs = [];

    const findNearest = (cx,cy,rad)=>{
      let best=null, bestD=1e9;
      const rr2 = rad*rad;
      for(const e of candidates){
        if(!e || e.hp<=0) continue;
        if(used.has(e)) continue;
        const dx = e.x - cx, dy = e.y - cy;
        const d2 = dx*dx + dy*dy;
        if(d2 <= rr2 && d2 < bestD){ bestD=d2; best=e; }
      }
      return best;
    };

    let cx=ox, cy=oy;
    let dmg=baseD;
    for(let i=0;i<hops;i++){
      const rad = (i===0)?range0:hopR;
      const t = findNearest(cx,cy,rad);
      if(!t) break;

      // strike instantly
      used.add(t);
      t.hp -= dmg;
      this.dsAddScore(10);

      // record beam segment for rendering
      segs.push({x1:cx, y1:cy, x2:t.x, y2:t.y, a:1});

      // next hop from target
      cx=t.x; cy=t.y;
      dmg *= decay;
      if(dmg < 0.15) break;
    }

    // little visual: stash segments for ~0.12 sec
    if(segs.length){
      st.zaps = Array.isArray(st.zaps)?st.zaps:[];
      st.zaps.push({t:0.12, segs});
      if(st.zaps.length>18) st.zaps = st.zaps.slice(-18);
    }
  }



  dsSpawnEnemy(){
    const st=this._ds; if(!st) return;
    const dif = isFinite(st.dif)?st.dif:0;
    const r = Math.random();

    // 既存5種 + 追加5種（全て通常敵）
    // 追加分は「トリッキー」寄り：難易度が上がるほど少し出やすい
    const bonus = clamp(dif/24, 0, 0.20); // 最大+20%ぶんを追加種側へ
    const k = r;

    let kind = 'drone';
    // ベース配分（合計=1.0 付近）
    // 新規: sniper / splitter / orbiter / charger / mirage
    if(k < 0.38 - bonus*0.40) kind = 'drone';
    else if(k < 0.56 - bonus*0.25) kind = 'zig';
    else if(k < 0.70 - bonus*0.15) kind = 'shooter';
    else if(k < 0.80 - bonus*0.10) kind = 'tank';
    else if(k < 0.86 - bonus*0.05) kind = 'sweeper';
    else{
      // 追加5種：均等ではなく、体感が散るように
      const rr = (k - (0.86 - bonus*0.05)) / (1 - (0.86 - bonus*0.05));
      if(rr < 0.22) kind = 'sniper';
      else if(rr < 0.44) kind = 'splitter';
      else if(rr < 0.66) kind = 'orbiter';
      else if(rr < 0.84) kind = 'charger';
      else kind = 'mirage';
    }

    const x = 0.08 + Math.random()*0.84;
    const baseVy = 0.20 + dif*0.02;

    // kindごとの基礎
    const e = {
      kind,
      x, y: -0.05,
      vx: 0,
      vy: baseVy,
      hp: 1 + Math.floor(dif*0.08),
      score: 60,
      cd: 0.35 + Math.random()*0.5,
      t: 0,

      // 追加種用
      phase: Math.random()*Math.PI*2,
      state: 0,
    };

    if(kind==='zig'){
      e.vx = (Math.random()<0.5?-0.18:0.18);
      e.hp = 1 + Math.floor(dif*0.08);
      e.score = 60;
    }else if(kind==='shooter'){
      e.vx = 0;
      e.vy = baseVy;
      e.hp = 2 + Math.floor(dif*0.12);
      e.score = 90;
      e.cd = 0.30 + Math.random()*0.4;
    }else if(kind==='tank'){
      e.vy = baseVy - 0.04;
      e.hp = 5 + Math.floor(dif*0.25);
      e.score = 140;
      e.cd = 0.55 + Math.random()*0.5;
    }else if(kind==='sweeper'){
      e.vy = baseVy - 0.02;
      e.hp = 3 + Math.floor(dif*0.18);
      e.score = 120;
      e.cd = 0.40 + Math.random()*0.6;
    }else if(kind==='sniper'){
      // 遠距離狙撃：遅いが弾速が速い（後段で専用発射）
      e.vy = baseVy - 0.05;
      e.hp = 2 + Math.floor(dif*0.10);
      e.score = 125;
      e.cd = 0.65 + Math.random()*0.6;
    }else if(kind==='splitter'){
      // 分裂：倒すと小型2体に分かれる
      e.vy = baseVy - 0.01;
      e.hp = 2 + Math.floor(dif*0.09);
      e.score = 110;
      e.cd = 9; // 基本撃たない
    }else if(kind==='orbiter'){
      // 自機周りを横に揺れながら降りてくる（当たりにくい）
      e.vy = baseVy - 0.03;
      e.hp = 2 + Math.floor(dif*0.08);
      e.score = 115;
      e.cd = 0.55 + Math.random()*0.6;
      e.phase = Math.random()*Math.PI*2;
    }else if(kind==='charger'){
      // 一定高さで突進
      e.vy = baseVy - 0.02;
      e.hp = 3 + Math.floor(dif*0.10);
      e.score = 130;
      e.cd = 9; // 基本撃たない
      e.state = 0; // 0=通常降下,1=突進
    }else if(kind==='mirage'){
      // ふらつき：Xが不規則に揺れる + たまに3連射
      e.vy = baseVy - 0.02;
      e.hp = 2 + Math.floor(dif*0.10);
      e.score = 120;
      e.cd = 0.40 + Math.random()*0.6;
      e.phase = Math.random()*Math.PI*2;
    }

    st.enemies.push(e);
  }

  // --- DOT SHOOT: indestructible neon rock obstacles ---
  dsSpawnRock(){
    const st=this._ds; if(!st) return;
    st.rocks = Array.isArray(st.rocks)?st.rocks:[];
    const clamp2=(v,a,b)=>Math.max(a,Math.min(b,v));
    const dif = isFinite(st.dif)?st.dif:0;
    const base = 0.030 + Math.random()*0.045 + dif*0.0015;
    const rad = clamp2(base, 0.028, 0.095);
    const n = 7 + ((Math.random()*5)|0);
    const pts=[];
    let maxr=0;
    const rot=Math.random()*Math.PI*2;
    for(let i=0;i<n;i++){
      const a = rot + (i/n)*Math.PI*2 + (Math.random()-0.5)*0.25;
      const k = 0.72 + Math.random()*0.62;
      const dx = Math.cos(a)*rad*k;
      const dy = Math.sin(a)*rad*k*0.85;
      pts.push({x:dx, y:dy});
      const rr = Math.hypot(dx,dy);
      if(rr>maxr) maxr=rr;
    }
    st.rocks.push({
      x: 0.10 + Math.random()*0.80,
      y: -0.18 - Math.random()*0.22,
      vx: (Math.random()-0.5)*0.06,
      vy: 0.05 + Math.random()*0.08,
      r: maxr + 0.004,
      pts,
      hue: 170 + Math.random()*110,
      t: 0,
      hpMax: clamp2(3 + Math.floor(dif*0.22), 3, 9),
      hp: clamp2(3 + Math.floor(dif*0.22), 3, 9),
    });
  }

  // circle-approx hit test in normalized coords (fast; good enough for bullets)
  dsHitRock(x,y,rad){
    const st=this._ds; if(!st) return false;
    const rocks = Array.isArray(st.rocks)?st.rocks:null;
    if(!rocks || !rocks.length) return false;
    const rradd = isFinite(rad)?rad:0;
    for(const r of rocks){
      const rr = isFinite(r.r)?r.r:0.05;
      const dx = x - r.x, dy = y - r.y;
      const lim = (rr + rradd);
      if(dx*dx + dy*dy <= lim*lim) return true;
    }
    return false;
  }


  // Return the first rock object intersecting point (x,y) with radius rad.
  dsGetRockAt(x,y,rad){
    const st=this._ds; if(!st) return null;
    if(!Array.isArray(st.rocks) || !st.rocks.length) return null;
    const rr = num(rad,0.01);
    for(const r of st.rocks){
      const dx = x - r.x, dy = y - r.y;
      const rrad = num(r.r,0.05) + rr;
      if(dx*dx + dy*dy < rrad*rrad) return r;
    }
    return null;
  }

  // Rock Pusher: push rock upward slowly and let it ram enemies (including boss).
  dsRockPush(rock, dmg=1){
    const st=this._ds; if(!st || !rock) return;
    rock.pushT = Math.max(num(rock.pushT,0), 2.2);   // seconds
    rock.pushVy = -0.18;                              // normalized per second
    rock.pushDmg = Math.max(num(rock.pushDmg,0), 0.8 + num(dmg,1)*0.6);
    // visual ping
    st.fx = st.fx || {};
    st.fx.particles = Array.isArray(st.fx.particles)?st.fx.particles:[];
    for(let i=0;i<6;i++){
      st.fx.particles.push({x:rock.x, y:rock.y, vx:(Math.random()*2-1)*0.25, vy:(Math.random()*2-1)*0.25, a:1, c:0});
    }
  }

  // Rock Splitter: spawn shots from rock in random directions (shots do not vanish on rocks).
  // Rock Splitter: spawn shots from rock in random directions (shots do not vanish on rocks).
  dsRockSplit(x,y, dmg=1, lv=1){
    const st=this._ds; if(!st) return;
    st.bullets = Array.isArray(st.bullets)?st.bullets:[];
    const n = clamp(4 + Math.floor(lv/3), 4, 10);
    for(let i=0;i<n;i++){
      const ang = (-Math.PI/2) + (Math.random()*Math.PI*1.6 - Math.PI*0.8);
      const sp = 0.85 + Math.random()*0.25;
      const vx = Math.cos(ang)*sp*0.55;
      const vy = Math.sin(ang)*sp*0.55;
      st.bullets.push({x, y, vx, vy, dmg: 0.55 + num(dmg,1)*0.45, k:'K', noRockVanish:true, splitShard:true});
    }
  }

  // Rock Homing Missile: bounce and then home towards a RANDOM visible enemy.
  // If the target disappears, the shot loses tracking and flies straight off-screen.
  dsRockHomingBounce(b, rock){
    const st=this._ds; if(!st || !b || !rock) return;
    // bounce away from rock center a bit
    const dx = b.x - rock.x, dy = b.y - rock.y;
    const d = Math.sqrt(dx*dx + dy*dy) || 1e-6;
    const nx = dx/d, ny = dy/d;
    const sp = Math.max(0.25, Math.sqrt((b.vx||0)*(b.vx||0) + (b.vy||0)*(b.vy||0)));
    // reflect with slight randomness
    const jitter = (Math.random()*2-1)*0.35;
    b.vx = (nx + jitter*0.35) * sp;
    b.vy = (ny - 0.65) * sp; // keep it generally upward after bounce
    b.noRockVanish = true;

    const tgt = this.dsRandomVisibleEnemy();
    if(tgt){
      b.homing = true;
      b.homingStrict = true;
      b.homingTarget = tgt;
      b.homingPow = Math.max(num(b.homingPow,0), 5.0);
    }else{
      b.homing = false;
      b.homingStrict = false;
      b.homingTarget = null;
    }
  }
  dsDamageRock(x,y,rad,dmg){
    const st=this._ds; if(!st) return false;
    const rocks = Array.isArray(st.rocks)?st.rocks:null;
    if(!rocks || !rocks.length) return false;
    const rradd = isFinite(rad)?rad:0;
    const dd = isFinite(dmg)?dmg:1;
    for(let i=rocks.length-1;i>=0;i--){
      const r = rocks[i];
      const rr = isFinite(r.r)?r.r:0.05;
      const dx = x - r.x, dy = y - r.y;
      const lim = (rr + rradd);
      if(dx*dx + dy*dy <= lim*lim){
        r.hp = (isFinite(r.hp)?r.hp:(isFinite(r.hpMax)?r.hpMax:3)) - dd;
        if(r.hp <= 0){
          rocks.splice(i,1);

          // small rock-break particles
          st.fx = st.fx || {};
          st.fx.particles = Array.isArray(st.fx.particles)?st.fx.particles:[];
          const pc = 14;
          for(let pi=0;pi<pc;pi++){
            st.fx.particles.push({x:r.x, y:r.y, vx:(Math.random()*2-1)*0.55, vy:(Math.random()*2-1)*0.55, a:1, c:0});
          }
          this.dsAddScore(18);
        }
        return true;
      }
    }
    return false;
  }


  dsEnemyShoot(e, n){
    const st=this._ds; if(!st) return;
    const p=st.player;
    const aimX = p.x + (Math.random()*2-1)*0.02;
    const aimY = p.y;
    const dx = aimX - e.x;
    const dy = aimY - e.y;
    const len = Math.max(0.001, Math.hypot(dx,dy));
    // Enemy bullet speed tuning (slightly slower than before)
    const sp = 0.40 + st.dif*0.017;
    const ux = dx/len, uy = dy/len;
    if(n===1){
      st.ebullets.push({x:e.x,y:e.y+0.02,vx:ux*sp,vy:uy*sp});
    }else{
      const ang = Math.atan2(uy,ux);
      const spread = 0.22;
      for(let i=0;i<n;i++){
        const a = ang + (i-(n-1)/2)*spread;
        st.ebullets.push({x:e.x,y:e.y+0.02,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp});
      }
    }
  }

  dsSpawnBoss(){
    const st=this._ds; if(!st) return;

    // Boss tuning: reduce HP scaling a bit (was very tanky) and randomize boss kinds.
    const tier = clamp(Math.floor(st.dif/4), 0, 8);

    // Kinds: movement/shoot patterns vary; randomly chosen each spawn.
    const kinds = ['ring','spiral','fan','burst','sniper','spray'];
    const kind = kinds[Math.floor(Math.random()*kinds.length)] || 'ring';

    const hpBase = 150 + st.dif*30; // ↓ from 220 + dif*45
    st.boss = {
      x:0.5, y:0.14,
      hp: hpBase,
      maxHp: hpBase,
      tier,
      t:0,
      cd:0.55,
      phase:0,
      kind,
      seed: Math.random()*1000,
    };

    // small bonus
    this.dsAddScore(800);
  }

  dsBossShoot(b){
    const st=this._ds; if(!st) return;
    const p=st.player;

    const tier = (isFinite(b.tier)?b.tier:1);
    const baseSp = 0.30 + st.dif*0.012 + tier*0.004;

    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const ang0 = Math.atan2(dy,dx);

    const push=(a, spMul=1.0)=>{
      const sp = baseSp * spMul;
      st.ebullets.push({x:b.x,y:b.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp});
    };

    // Each kind tweaks the pattern.
    if(b.kind==='sniper'){
      // Aimed fast shot + tiny offset shot (pressure but readable)
      push(ang0, 1.55);
      push(ang0 + 0.08*Math.sin(b.t*1.3), 1.25);
      return;
    }

    if(b.kind==='fan'){
      // Aimed fan spread
      const n = 7;
      const spread = 0.70;
      for(let i=0;i<n;i++){
        const t = (n===1)?0:(i/(n-1));
        const a = ang0 + (t-0.5)*spread;
        push(a, 1.0);
      }
      // a light ring to keep it "bossy"
      const ring = 6;
      const rot = b.t*0.55;
      for(let i=0;i<ring;i++){
        const a = rot + i*(Math.PI*2/ring);
        push(a, 0.70);
      }
      return;
    }

    if(b.kind==='spiral'){
      // Rotating trio + a slow ring
      const rot = b.t*1.25;
      push(rot, 1.05);
      push(rot + 2.09, 1.00);
      push(rot + 4.18, 1.00);
      const ring = 5;
      for(let i=0;i<ring;i++){
        const a = rot*0.6 + i*(Math.PI*2/ring);
        push(a, 0.60);
      }
      return;
    }

    if(b.kind==='burst'){
      // Burst ring (less frequent via cd logic) + aimed shot
      push(ang0, 1.10);
      const ring = 12;
      const rot = b.t*0.85;
      for(let i=0;i<ring;i++){
        const a = rot + i*(Math.PI*2/ring);
        push(a, 0.78);
      }
      return;
    }

    if(b.kind==='spray'){
      // Chaotic downward-ish spray
      const n = 9;
      for(let i=0;i<n;i++){
        const a = (Math.PI/2) + (Math.random()-0.5)*1.25 + 0.10*Math.sin(b.t*0.7);
        push(a, 0.85);
      }
      // occasional aimed pressure shot
      if(Math.random()<0.55) push(ang0, 1.10);
      return;
    }

    // Default: ring boss (readable, classic)
    push(ang0, 1.00);
    const ring = 8;

    const rot = b.t*0.9;
    for(let i=0;i<ring;i++){
      const a = rot + i*(Math.PI*2/ring);
      push(a, 0.72);
    }
  }


  // Pick a random enemy that is currently on-screen (used by Rock Homing 'M').
  dsRandomVisibleEnemy(){
    const st=this._ds; if(!st) return null;
    const es = Array.isArray(st.enemies)?st.enemies:null;
    if(!es || !es.length) return null;
    const cand = [];
    for(const e of es){
      if(!e) continue;
      if(num(e.hp,1) <= 0) continue;
      const x = num(e.x, -9), y = num(e.y, -9);
      if(x >= -0.05 && x <= 1.05 && y >= -0.10 && y <= 1.10) cand.push(e);
    }
    if(!cand.length) return null;
    return cand[(Math.random()*cand.length)|0];
  }

  dsNearestEnemy(x,y, maxDist){
    const st=this._ds; if(!st) return null;
    let best=null, bd=1e9;
    const md = (isFinite(maxDist) && maxDist>0) ? (maxDist*maxDist) : null;
    for(const e of st.enemies){
      const d = (e.x-x)*(e.x-x) + (e.y-y)*(e.y-y);
      if(md!==null && d>md) continue;
      if(d<bd){ bd=d; best=e; }
    }
    if(st.boss){
      const d = (st.boss.x-x)*(st.boss.x-x) + (st.boss.y-y)*(st.boss.y-y);
      if(md!==null && d>md) return best;
      if(d<bd){ bd=d; best=st.boss; }
    }
    return best;
  }


  dsGetClutchBonus(){
    const st=this._ds; if(!st) return 0;
    const c = st.clutch || (st.clutch = {until:0, stack:0, last:-999, bonus:0});
    if(st.t > num(c.until,0)) return 0;
    return clamp(num(c.bonus,0), 0, num(DOTSTRIKE_TUNING?.clutch?.max, 1.0));
  }

  dsTriggerClutch(x,y){
    const st=this._ds; if(!st) return;
    st.rings = Array.isArray(st.rings)?st.rings:[];
    st.clutch = st.clutch || {until:0, stack:0, last:-999, bonus:0, timePlus:0};
    const c = st.clutch;

    const baseWin = num(DOTSTRIKE_TUNING?.clutch?.windowSec, 0.90);
    const step = num(DOTSTRIKE_TUNING?.clutch?.step, 0.10);
    const maxB = num(DOTSTRIKE_TUNING?.clutch?.max,  1.00);
    const baseDur = num(DOTSTRIKE_TUNING?.clutch?.durSec, 2.20);

    // Hard cap: remaining clutch time should never exceed 10 seconds.
    // (Keeps chaining fun, but prevents runaway timers.)
    const MAX_CLUTCH_SEC = 10;
    const MAX_CLUTCH_MS  = MAX_CLUTCH_SEC * 1000;

    // reset the per-chain time extension when the bonus has fully expired
    if(st.t > num(c.until,0)){
      c.stack = 0;
      c.timePlus = 0;
    }

    const dtMs = st.t - num(c.last, -999);
    const winEffMs = (baseWin + num(c.timePlus,0)) * 1000;

    // Each clutch trigger adds +4s to:
    // - the "extend window" (how late you can chain it)
    // - the actual bonus duration that gets added
    if(dtMs <= winEffMs){
      c.stack = clamp(num(c.stack,0) + 1, 1, Math.ceil(maxB/step));
      c.timePlus = num(c.timePlus,0) + 4;
    }else{
      c.stack = 1;
      c.timePlus = 4;
    }

    // Cap the accumulated extension so both "window" and "duration" won't grow without bound.
    c.timePlus = Math.min(num(c.timePlus,0), MAX_CLUTCH_SEC);

    c.last = st.t;

    const durEffMs = (baseDur + num(c.timePlus,0)) * 1000;

    // Extend bonus time additively (st.t is ms), but never exceed 10s remaining.
    c.until = Math.max(num(c.until,0), st.t) + durEffMs;
    c.until = Math.min(num(c.until,0), num(st.t,0) + MAX_CLUTCH_MS);
    c.bonus = clamp(c.stack * step, 0, maxB);

    //爽快エフェクト：ネオンリング + 小さなトースト
    const hue = 60; // yellow-ish pop
    st.rings.push({x, y, r:0.012, max:0.13, a:0.95, hue, t:0});
    st.rings.push({x, y, r:0.020, max:0.18, a:0.55, hue:(hue+40), t:0});
    if(st.rings.length>180) st.rings = st.rings.slice(-180);

    const mul = (1 + c.bonus);
    this.dsAddToast(mul>=1.95 ? 'CLUTCH MAX!' : ('CLUTCH x'+mul.toFixed(2)));
  }

  dsAddScore(pts){
    const st=this._ds; if(!st) return;
    const mul = 1 + this.dsGetClutchBonus();
    const sm = (st && isFinite(st.scoreMul)) ? st.scoreMul : 1;
    st.score += Math.round(num(pts,0) * mul * sm);
  }

  dsDropPowerup(x,y,isBoss){
    const st=this._ds; if(!st) return;
    st.drones = Array.isArray(st.drones)?st.drones:[];

    // ---- base drop chance (normal reduced to 20%) + clutch bonus ----
    const base = isBoss ? num(DOTSTRIKE_TUNING?.drop?.baseBoss, 0.85) : num(DOTSTRIKE_TUNING?.drop?.baseNormal, 0.20);
    const clutch = this.dsGetClutchBonus(); // 0..1 (adds to chance and score)
    const chance = clamp(base + clutch, 0, 1);
    if(Math.random() > chance) return;

    const r = Math.random();
    let type = null;

    if(isBoss){
      // boss: better odds for special items + missile evolution + (very rare) drone-inv
      const w = DOTSTRIKE_TUNING.items.boss;
      const tA = w.barrier;
      const tO = tA + w.droneAdd;
      const tI = tO + w.inv;
      const tU = tI + (w.maxHpUp||0);
      const tM = tU + w.missile;
      const tT = tM + w.tiny;
      const tP = tT + w.speed;
      const tY = tP + (w.heal||0);
      const tZ = tY + w.laser;
      const tQ = tZ + w.nearHom;
      const tE = tQ + w.erase;
      const tH = tE + w.homing;
      const tL = tH + w.pierce;
      const tG = tL + (w.heavyBomb||0);
      const tR = tG + (w.saw||0);
      const tC = tR + (w.ricochet||0);
      const tJ = tC + (w.rockPush||0);
      const tK = tJ + (w.rockSplit||0);
      const tM2 = tK + (w.rockHoming||0);
      // remaining: S/B
      if(r < tA) type='A';
      else if(r < tO) type='O';
      else if(r < tI) type='I';
      else if(r < tU) type='U';
      else if(r < tM) type = (Math.random()<1.0?'a':(Math.random()<0.5?'w':'h'));
      else if(r < tT) type='T';
      else if(r < tP) type='P';
      else if(r < tY) type='Y';
      else if(r < tZ) type='Z';
      else if(r < tQ) type='Q';
      else if(r < tE) type='E';
      else if(r < tH) type='H';
      else if(r < tL) type='L';
      else if(r < tG) type='G';
      else if(r < tR) type='R';
      else if(r < tC) type='C';
      else if(r < tJ) type='J';
      else if(r < tK) type='K';
      else if(r < tM2) type='M';
      else type = (Math.random()<0.55?'S':'B');
    }else{
      // normal
      const w = DOTSTRIKE_TUNING.items.normal;

      const dlen = st.drones.length;
      let droneChance = num(w.droneAddBase, 0.06) + num(w.droneAddExtra, 0.06) * (1 - (dlen/8));
      // after the 1st/2nd drone, make further drone-add items rarer (so "dead drones => easier again")
      if(dlen>=2) droneChance *= num(w.droneAddMul2, 0.60);
      else if(dlen>=1) droneChance *= num(w.droneAddMul1, 0.75);

      const tO = droneChance;
      const tA = tO + num(w.barrier, 0.010);
      const tP = tA + num(w.speed,   0.060);
      const tY = tP + num(w.heal,    0.030);
      const tT = tY + num(w.tiny,    0.050);
      const tI = tT + num(w.inv,     0.0005);
      const tU = tI + num(w.maxHpUp, 0.0005);
      const tM = tU + num(w.missile, 0.040);
      const tS = tM + num(w.spread,  0.10);
      const tL = tS + num(w.pierce,  0.05);
      const tQ = tL + num(w.nearHom, 0.025);
      const tH = tQ + num(w.homing,  0.025);
      const tZ = tH + num(w.laser,   0.018);
      const tE = tZ + num(w.erase,   0.015);
      const tG = tE + num(w.heavyBomb, 0.010);
      const tR = tG + num(w.saw,      0.010);
      const tC = tR + num(w.ricochet, 0.008);
      const tJ = tC + num(w.rockPush, 0.006);
      const tK = tJ + num(w.rockSplit, 0.005);
      const tM2 = tK + num(w.rockHoming, 0.005);
      const tB = tM2 + num(w.bomb,    0.025);

      if(r < tO) type='O';
      else if(r < tA) type='A';
      else if(r < tP) type='P';
      else if(r < tY) type='Y';
      else if(r < tT) type='T';
      else if(r < tI) type='I';
      else if(r < tU) type='U';
      else if(r < tM) type = (Math.random()<1.0?'a':(Math.random()<0.5?'w':'h'));
      else if(r < tS) type='S';
      else if(r < tL) type='L';
      else if(r < tQ) type='Q';
      else if(r < tH) type='H';
      else if(r < tZ) type='Z';
      else if(r < tE) type='E';
      else if(r < tG) type='G';
      else if(r < tR) type='R';
      else if(r < tC) type='C';
      else if(r < tJ) type='J';
      else if(r < tK) type='K';
      else if(r < tM2) type='M';
      else if(r < tB) type='B';
    }

    if(!type) return;
    st.pups.push({x,y,vy:0.22,type});
  }




  dsAddDrone(){
    const st=this._ds; if(!st) return false;
    st.drones = Array.isArray(st.drones)?st.drones:[];
    if(st.drones.length>=8) return false;
    const p=st.player;
    st.drones.push({
      x: clamp(p.x + (Math.random()*0.06-0.03), 0.06, 0.94),
      y: clamp(p.y + 0.06 + (Math.random()*0.04), 0.12, 0.94),
      sp: 0.58,
      spMul: 1,
      hitMul: 1,
      cd: 0.10 + Math.random()*0.18,
      weapon: (p.weapon||'N'),
      shield: 0,
      hpMax: 3,
      hp: 3,
      inv: false,
      invFxT: 0,

      // --- drone AI (0 = follow player / 1+ = autonomous) ---
      aiPts: 0,      // how many powerups were assigned to this drone
      aiLv: 1,       // baseline weak autopilot (items make it smarter)
      aiSeed: Math.random()*1000, // stable randomness for patterns
      _vx: 0, _vy: 0 // smoothed velocity
    });
    return true;
  }

  // Upgrade a drone's AI when it receives any powerup.
  // aiPts: number of assigned powerups to that drone
  // aiLv : 0=follow, 1=beginner dodge, 2=decent dodge, 3=good dodge + joins fights, 4=smart
  dsUpgradeDroneAI(drone, addPts=1){
    if(!drone) return;
    const pts = num(drone.aiPts, 0) + Math.max(1, num(addPts, 1));
    drone.aiPts = pts;

    let lv = 1;
    if(pts >= 8) lv = 4;
    else if(pts >= 5) lv = 3;
    else if(pts >= 3) lv = 2;

    drone.aiLv = lv;
    if(!isFinite(drone.aiSeed)) drone.aiSeed = Math.random()*1000;
    if(!isFinite(drone._vx)) drone._vx = 0;
    if(!isFinite(drone._vy)) drone._vy = 0;
  }

  // Autonomous movement AI for drones (normalized coords)
  dsDroneAI(idx, drone, dt0){
    const st=this._ds; if(!st || !drone) return;
    const p = st.player || {x:0.5,y:0.85};
    const lv = clamp(num(drone.aiLv,0), 0, 4);
    if(lv<=0) return;

    // perception ranges scale by level
    // lv1 is intentionally weak: small perception (often fails to dodge)
    const avoidR = (lv===1)?0.060 : (lv===2)?0.125 : (lv===3)?0.155 : 0.18;
    const avoidR2 = avoidR*avoidR;

    // pull-back to prevent drones from running away too far
    // lv1 is allowed to roam far from the player (can be risky)
    const maxDist = (lv===1)?0.55:(0.20 + lv*0.08);

    // --- compute threat vector (repulsion) ---
    let ax=0, ay=0;
    let nearestThreat = 9;

    // enemy bullets
    const ebs = Array.isArray(st.ebullets)?st.ebullets:[];
    for(const b of ebs){
      const dx = drone.x - b.x, dy = drone.y - b.y;
      const d2 = dx*dx + dy*dy;
      if(d2 < avoidR2 && d2 > 1e-6){
        const dist = Math.sqrt(d2);
        nearestThreat = Math.min(nearestThreat, dist);
        const k = (avoidR - dist) / avoidR;
        const w = k*k * (lv>=3 ? 1.25 : 0.95);
        ax += (dx/dist) * w;
        ay += (dy/dist) * w;
      }
    }

    // enemies (avoid body contact; also "predict" a bit for higher levels)
    const ens = Array.isArray(st.enemies)?st.enemies:[];
    for(const e of ens){
      if(!e) continue;
      const ex = e.x, ey = e.y;
      const dx = drone.x - ex, dy = drone.y - ey;
      const d2 = dx*dx + dy*dy;
      const rr = (lv>=3) ? 0.065 : 0.055;
      if(d2 < rr*rr && d2 > 1e-6){
        const dist = Math.sqrt(d2);
        nearestThreat = Math.min(nearestThreat, dist);
        const k = (rr - dist) / rr;
        const w = 1.6 + k*2.2;
        ax += (dx/dist) * w;
        ay += (dy/dist) * w;
      }
    }

    // boss
    if(st.boss){
      const e = st.boss;
      const dx = drone.x - e.x, dy = drone.y - e.y;
      const d2 = dx*dx + dy*dy;
      const rr = 0.075;
      if(d2 < rr*rr && d2 > 1e-6){
        const dist = Math.sqrt(d2);
        nearestThreat = Math.min(nearestThreat, dist);
        const k = (rr - dist) / rr;
        const w = 2.2 + k*3.0;
        ax += (dx/dist) * w;
        ay += (dy/dist) * w;
      }
    }

    // rocks
    const rocks = Array.isArray(st.rocks)?st.rocks:[];
    for(const r of rocks){
      const rr = num(r.r,0.05) + 0.012;
      const dx = drone.x - r.x, dy = drone.y - r.y;
      const d2 = dx*dx + dy*dy;
      if(d2 < rr*rr && d2 > 1e-6){
        const dist = Math.sqrt(d2);
        nearestThreat = Math.min(nearestThreat, dist);
        const k = (rr - dist) / rr;
        const w = 1.4 + k*2.0;
        ax += (dx/dist) * w;
        ay += (dy/dist) * w;
      }
    }

    // --- compute goal point ---
    // if safe -> move to attack position around nearest enemy; else retreat a bit toward player
    const safe = (nearestThreat > avoidR*0.80);

    let tx = p.x, ty = p.y + 0.06; // default: near player
    let target = null;
    if(lv>=3){
      // pick closest enemy (prefer boss)
      if(st.boss) target = st.boss;
      else{
        let best=null, bestD=9;
        for(const e of ens){
          const dx = (e.x - drone.x), dy = (e.y - drone.y);
          const d2 = dx*dx + dy*dy;
          if(d2<bestD){ bestD=d2; best=e; }
        }
        target = best;
      }
    }else if(lv===2 && safe){
      // occasionally engage even at lv2
      if(Math.random() < 0.35){
        let best=null, bestD=9;
        for(const e of ens){
          const dx = (e.x - drone.x), dy = (e.y - drone.y);
          const d2 = dx*dx + dy*dy;
          if(d2<bestD){ bestD=d2; best=e; }
        }
        target = best;
      }
    }

    if(target && safe){
      const t = (st.t/1000) + num(drone.aiSeed,0)*0.01;
      const ang = t*0.9 + idx*1.3;
      const rad = 0.12 + lv*0.02;
      tx = clamp(target.x + Math.cos(ang)*rad, 0.06, 0.94);
      ty = clamp(target.y + Math.sin(ang)*rad, 0.12, 0.92);
    }else{
      // wandering:
      //  - lv1: roams freely & randomly (often away from player), risky
      //  - lv2+: mostly orbits near player
      const t = (st.t/1000) + num(drone.aiSeed,0)*0.01;
      if(lv===1){
        // wide roam across the arena
        const ang = t*0.42 + idx*2.1;
        const ang2 = t*0.73 + idx*1.4;
        const baseX = 0.5 + Math.cos(ang)*0.34 + Math.cos(ang2)*0.10;
        const baseY = 0.52 + Math.sin(ang*0.9)*0.30 + Math.sin(ang2)*0.08;

        // push away from player a bit (so it doesn't just hover around)
        const rx = baseX - p.x, ry = baseY - (p.y+0.02);
        const rlen = Math.hypot(rx, ry) || 1;
        const push = 0.10;
        tx = clamp(baseX + (rx/rlen)*push, 0.06, 0.94);
        ty = clamp(baseY + (ry/rlen)*push, 0.12, 0.92);
      }else{
        const ang = t*0.55 + idx*1.7;
        const radX = 0.10 + lv*0.02;
        const radY = 0.06 + lv*0.015;
        tx = clamp(p.x + Math.cos(ang)*radX, 0.06, 0.94);
        ty = clamp(p.y + 0.06 + Math.sin(ang)*radY, 0.12, 0.92);
      }
    }

    // if too far from player, force return
    const px = drone.x - p.x, py = drone.y - p.y;
    const pd = Math.hypot(px, py);
    if(pd > maxDist){
      const k = clamp((pd - maxDist) / 0.12, 0, 1);
      tx = tx*(1-k) + p.x*k;
      ty = ty*(1-k) + (p.y+0.06)*k;
    }

    // --- steering ---
    const gx = (tx - drone.x);
    const gy = (ty - drone.y);

    // weights by level
    const gW = (lv===1)?0.90 : (lv===2)?1.25 : (lv===3)?1.45 : 1.65;
    const aW = (lv===1)?0.20 : (lv===2)?1.10 : (lv===3)?1.35 : 1.55;

    let vx = gx*gW + ax*aW;
    let vy = gy*gW + ay*aW;

    const vlen = Math.hypot(vx, vy);
    if(vlen>1e-6){ vx/=vlen; vy/=vlen; }
    else { vx=0; vy=0; }

    // smooth velocity
    const smooth = (lv===1)?0.06:clamp(0.10 + lv*0.05, 0.12, 0.32);
    drone._vx = (isFinite(drone._vx)?drone._vx:0) * (1-smooth) + vx * smooth;
    drone._vy = (isFinite(drone._vy)?drone._vy:0) * (1-smooth) + vy * smooth;

    const spMul = (isFinite(drone.spMul) ? drone.spMul : 1);
    drone.x = clamp(drone.x + drone._vx * drone.sp * spMul * dt0, 0.06, 0.94);
    drone.y = clamp(drone.y + drone._vy * drone.sp * spMul * dt0, 0.12, 0.94);
  }


  dsAddToast(msg){
    const st=this._ds; if(!st) return;
    const p=st.player||{x:0.5,y:0.9};
    st.toasts = Array.isArray(st.toasts)?st.toasts:[];
    st.toasts.push({
      msg: String(msg||''),
      x: p.x,
      y: clamp(p.y-0.07, 0.06, 0.96),
      t: 0,
      life: 1.25,
      vy: -0.10,
    });
    if(st.toasts.length>3) st.toasts.shift();
  }

  dsApplyPowerup(type){
    const st=this._ds; if(!st) return;
    // normalize type (robust against lowercase or longer labels)
    type = String(type||'').trim();
    if(type.length>1){
      // allow label-ish inputs
      const tL = type.toLowerCase();
      if(tL.includes('heavy') || tL.includes('bomb')) type='G';
      else if(tL.includes('saw')) type='R';
      else if(tL.includes('rico')) type='C';
      else if(tL.includes('rock') && (tL.includes('push')||tL.includes('pusher'))) type='J';
      else if(tL.includes('rock') && (tL.includes('split')||tL.includes('scatter'))) type='K';
      else if(tL.includes('rock') && (tL.includes('home')||tL.includes('homing'))) type='M';
      else if(tL.includes('maxhp') || tL.includes('hpup') || tL.includes('hp+') || tL.includes('hp')) type='U';
      else type = type[0];
    }
    // missiles are lowercase (a/w/h). Everything else uses uppercase single-letter codes.
    if(type && !('awh'.includes(type))) type = type.toUpperCase();
    st.drones = Array.isArray(st.drones)?st.drones:[];
    st.toasts = Array.isArray(st.toasts)?st.toasts:[];

    const weaponName = (t)=>{
      return t==='S'?'拡散':
             t==='L'?'貫通':
             t==='H'?'ホーミング':
             t==='Q'?'近ホーミング':
             t==='Z'?'レーザー':
             t==='E'?'弾消去':
             t==='G'?'鈍重爆弾':
             t==='R'?'ノコ刃':
             t==='C'?'跳弾ビーム':
             t==='J'?'岩押し':
             t==='K'?'岩拡散':
             t==='M'?'岩反射追尾':
             t==='N'?'ノーマル':
             String(t||'');
    };
    const targetLabel = (tgt)=>{
      if(tgt===st.player) return '自機';
      const idx = st.drones.indexOf(tgt);
      return idx>=0 ? ('子機'+(idx+1)) : '子機';
    };

    if(type==='B'){
      // bomb is always for the player (button action)
      st.bomb = Math.min(9, st.bomb+1);
      this.dsAddToast('ボム +1');
      this.dsUpdateHUD();
      return;
    }

    if(type==='I'){
      // ONE drone invincible until game over (SUPER SUPER rare)
      st.drones = Array.isArray(st.drones)?st.drones:[];
      if(!st.drones.length){
        // if no drones yet, grant one first, then make it invincible
        this.dsAddDrone();
      }
      // pick a target drone: lowest hp first; if hp not tracked, just first.
      let idx = 0;
      let best = 1e9;
      for(let i=0;i<st.drones.length;i++){
        const d = st.drones[i];
        if(d && d.inv) continue;
        const h = num(d?.hp, 999);
        if(h < best){ best = h; idx = i; }
      }
      const d = st.drones[idx];
      if(d){
        d.inv = true;
        d.invFxT = 0;
      }
      this.dsAddToast('子機1機 無敵');
      this.dsUpdateHUD();
      return;
    }

    if(type==='a' || type==='w' || type==='h'){
      // missile evolution / upgrade (levels are saved per type)
      st.missileLv = st.missileLv || {a:1, w:0, h:0};
      const key = String(type);
      const cur = num(st.missileLv[key] || 0, 0);
      st.missileLv[key] = clamp(cur + 1, 1, 5);
      st.missileType = key;
      // record run growth
      try{
        st.runGrowth = st.runGrowth || {weaponLvUp:{}, missileLvUp:{a:0,w:0,h:0}, maxHpUp:0};
        st.runGrowth.missileLvUp = st.runGrowth.missileLvUp || {a:0,w:0,h:0};
        st.runGrowth.missileLvUp[key] = num(st.runGrowth.missileLvUp[key],0) + 1;
      }catch(e){}
      this.dsAddToast('ミサイル '+this.dsMissileLabel(key, this.dsGetMissileLvEff(key)));
      this.dsUpdateHUD();

    if(type==='Y'){
      // Heal item:
      // - Prefer restoring player lives (max livesMax)
      // - Also heals all drones by +1 up to hpMax
      st.livesMax = isFinite(st.livesMax)?st.livesMax:3;
      st.lives = isFinite(st.lives)?st.lives:st.livesMax;

      let healed = false;

      if(st.lives < st.livesMax){
        st.lives = Math.min(st.livesMax, st.lives + 1);
        healed = true;
      }

      if(Array.isArray(st.drones) && st.drones.length){
        for(const d of st.drones){
          if(!d) continue;
          const hm = isFinite(d.hpMax)?d.hpMax:3;
          const h  = isFinite(d.hp)?d.hp:hm;
          if(h < hm){
            d.hp = Math.min(hm, h + 1);
            healed = true;
          }else{
            d.hp = h;
          }
          d.hpMax = hm;
        }
      }

      this.dsAddToast(healed ? '回復' : '回復（満タン）');
      this.dsUpdateHUD();
      return;
    }

    if(type==='U'){
      // Max HP up (SUPER SUPER rare) — eligible for perma carry
      st.livesMax = isFinite(st.livesMax)?st.livesMax:3;
      st.lives = isFinite(st.lives)?st.lives:st.livesMax;
      st.livesMax = Math.min(99, st.livesMax + 1);
      st.lives = Math.min(st.livesMax, st.lives + 1);
      // record run growth
      try{
        st.runGrowth = st.runGrowth || {weaponLvUp:{}, missileLvUp:{a:0,w:0,h:0}, maxHpUp:0};
        st.runGrowth.maxHpUp = num(st.runGrowth.maxHpUp,0) + 1;
      }catch(e){}
      this.dsAddToast('最大HP +1');
      this.dsUpdateHUD();
      return;
    }

    return;
    }

    // items are picked by the player, but the benefit is randomly assigned to player or one of drones
    // Weapon pickups should always equip the player (so the bullet pattern changes immediately).
    const isWeapon = (t)=>('NSLHQZEGRCJKM'.indexOf(String(t||'').toUpperCase())>=0);
    const targets = [st.player, ...st.drones];
    const tgt = isWeapon(type) ? st.player : targets[Math.floor(Math.random()*targets.length)];

    if(type==='O'){ // option/drone add
      const ok = this.dsAddDrone();
      this.dsAddToast(ok ? '子機 +1' : '子機 MAX');
    }else if(type==='A'){ // barrier (one hit)
      tgt.shield = 1;
      this.dsAddToast('バリア → '+targetLabel(tgt));
    }else if(type==='P'){ // speed up
      tgt.spMul = clamp((isFinite(tgt.spMul)?tgt.spMul:1) + 0.10, 1, 2.20);
      this.dsAddToast('スピード↑ → '+targetLabel(tgt));
    }else if(type==='T'){ // smaller hitbox
      tgt.hitMul = clamp((isFinite(tgt.hitMul)?tgt.hitMul:1) * 0.90, 0.45, 1);
      this.dsAddToast('当たり判定↓ → '+targetLabel(tgt));
}else if(isWeapon(type)){
  // weapon pickup: level up per-weapon, persists until game over
  const w = String(type||'N').toUpperCase();

  // --- weapon lock EXP ---
  // While locked, picking a *different* weapon does NOT change equipped weapon.
  // Instead, it adds EXP to the locked weapon; every 10 EXP -> +1 level.
  if(st.weaponLock && st.weaponLock.on && tgt===st.player){
    const lockedW = String(st.weaponLock.w || (st.player && st.player.weapon) || 'N').toUpperCase();
    st.weaponLock.w = lockedW;
    if(w !== lockedW){
      st.weaponLock.xp = num(st.weaponLock.xp, 0) + 1;
      const xp = st.weaponLock.xp;
      if(xp >= 10){
        st.weaponLock.xp = xp - 10;
        const lv2 = this.dsIncWeaponLv(lockedW, 1);
        this.dsAddToast(`固定EXP 10/10 → ${weaponName(lockedW)} Lv${lv2}`);
      }else{
        this.dsAddToast(`固定EXP ${xp}/10`);
      }
      this.dsUpdateHUD();
      return;
    }
  }

  const lv = this.dsIncWeaponLv(w, 1);
  tgt.weapon = w;
  this.dsAddToast('武器:'+weaponName(w)+' Lv'+lv+' → '+targetLabel(tgt));
}else{
  // unknown type: ignore
  return;
}

    // If a drone receives any powerup, it becomes autonomous and scales its intelligence with assigned item count.
    if(tgt && tgt!==st.player && type!=='O'){
      this.dsUpgradeDroneAI(tgt, 1);
    }
    this.dsUpdateHUD();
  }


  dsUpdateHUD(ending=false){
    const st=this._ds;
    const set=(id, v)=>{ const el=$("#"+id); if(el) el.textContent = String(v); };
    if(!st){
      set('dsScore',0); set('dsLives',0); set('dsWeapon','-'); set('dsBombCount',0); set('dsMissile','-');
      return;
    }
    set('dsScore', st.score);
    set('dsLives', Math.max(0, st.lives));
    const wName = (st.player.weapon==='N'?'NORMAL':
  st.player.weapon==='S'?'SPREAD':
  st.player.weapon==='L'?'PIERCE':
  st.player.weapon==='H'?'HOMING':
  st.player.weapon==='Q'?'NEAR-HOM':
  st.player.weapon==='Z'?'LASER':
  st.player.weapon==='G'?'HEAVY-BOMB':
  st.player.weapon==='R'?'SAW':
  st.player.weapon==='C'?'RICOCHET':
  st.player.weapon==='J'?'ROCK-PUSH':
  st.player.weapon==='K'?'ROCK-SPLIT':
  st.player.weapon==='M'?'ROCK-HOM':'?');
const wLv = this.dsGetWeaponLvEff(st.player.weapon||'N');
const dCount = (Array.isArray(st.drones)?st.drones.length:0);
    const sh = (st.player.shield?1:0);
    set('dsWeapon', `${wName} Lv${wLv} D${dCount}${sh?(' S'+sh):''}`);
    set('dsBombCount', st.bomb);
    const mLabel = this.dsMissileLabel(st.missileType || 'a', this.dsGetMissileLvEff(st.missileType || 'a') || 1);
    set('dsMissile', mLabel);

    // clutch badge was removed (duplicate white text) — keep only green countdown near the player.
    try{
      const badge = document.getElementById('dsClutchBadge');
      if(badge) badge.style.display = 'none';
    }catch(e){}
    // weapon badge: always show current weapon on a screen edge
    try{
      let wb = document.getElementById('dsWeaponBadge');
      if(!wb){
        const host = document.getElementById('dotShootOL') || document.getElementById('dsHud') || document.body;
        wb = document.createElement('div');
        wb.id = 'dsWeaponBadge';
        wb.style.position = 'absolute';
        wb.style.right = '6px';
        wb.style.top = '34px';
        wb.style.padding = '4px 10px';
        wb.style.borderRadius = '10px';
        wb.style.background = 'rgba(0,0,0,0.38)';
        wb.style.border = '1px solid rgba(255,255,255,0.18)';
        wb.style.backdropFilter = 'blur(8px)';
        wb.style.webkitBackdropFilter = 'blur(8px)';
        wb.style.color = 'rgba(255,255,255,0.95)';
        wb.style.fontSize = '12px';
        wb.style.fontFamily = 'sans-serif';
        wb.style.letterSpacing = '0.02em';
        wb.style.pointerEvents = 'none';
        wb.style.zIndex = 9999;
        host.appendChild(wb);
      }
      const w = String(st.player.weapon||'N');
      const lv = this.dsGetWeaponLvEff(w);
      const jp = (w==='N'?'ノーマル':
                  w==='S'?'拡散':
                  w==='L'?'貫通':
                  w==='H'?'ホーミング':
                  w==='Q'?'近ホーミング':
                  w==='Z'?'レーザー':
                  w==='E'?'弾消去':
                  w==='G'?'鈍重爆弾':
                  w==='R'?'ノコ刃':
                  w==='C'?'跳弾ビーム':
                  w==='J'?'岩押し':
                  w==='K'?'岩拡散':
                  w==='M'?'岩反射追尾':w);
      {
      let lockTxt = '';
      try{
        if(st.weaponLock && st.weaponLock.on){
          const xp = num(st.weaponLock.xp, 0);
          lockTxt = ` 🔒固定EXP ${xp}/10`;
        }
      }catch(e){}
      wb.textContent = `武器: ${jp} Lv${lv}${lockTxt}`;
    }
      wb.style.display = 'block';
    }catch(e){}



    // game over panel
    const over=$("#dsOver");
    if(over && !ending){
      over.style.display = (st.lives<=0 || !st.running) ? 'flex' : 'none';
    }
    const hs = this.getDotShootHighScore();
    const elHs=$("#dsHiNow");
    if(elHs) elHs.textContent = String(hs);
  }

  dsRender(){
    const st=this._ds; if(!st || !st.ctx) return;
    const dtR = (st && isFinite(st._dt)) ? st._dt : 0;
    const ctx=st.ctx;
    const W=st.cv.width, H=st.cv.height;
    // safety: ensure transform/state is reset even if previous frame threw before restoring
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0,0,W,H);

    // background stars
    ctx.fillStyle='rgba(0,0,0,0)';
    ctx.fillRect(0,0,W,H);
    for(const s of st.stars){
      const x = Math.floor(s.x*W);
      const y = Math.floor(s.y*H);
      ctx.fillStyle='rgba(255,255,255,'+(0.25+0.35*s.s)+')';
      ctx.fillRect(x,y,1,1);
    }



    // camera (zoom / focus) for cinematic slow-mo
    const z = isFinite(st.camZoom) ? st.camZoom : 1;
    const ccx = (isFinite(st.camCx) ? st.camCx : 0.5) * W;
    const ccy = (isFinite(st.camCy) ? st.camCy : 0.60) * H;
    ctx.save();
    try{
      if(z !== 1){
      ctx.translate(ccx, ccy);
      ctx.scale(z, z);
      ctx.translate(-ccx, -ccy);
    }
    const toPX=(x)=>Math.floor(x*W);
    const toPY=(y)=>Math.floor(y*H);

    // small "damage state" visuals: sparks + smoke when HP/lives are low
    const _fract = (v)=>v-Math.floor(v);
    const _rand = (a,b)=>_fract(Math.sin(a*12.9898 + b*78.233)*43758.5453);
    const drawDamageFx = (x,y,sev)=>{
      // sev: 0..1
      if(sev<=0) return;
      const t = st.t*0.001;
      const nSmoke = sev>0.66 ? 2 : 1;
      const nSpark = sev>0.66 ? 3 : 2;

      // smoke (gray)
      for(let k=0;k<nSmoke;k++){
        const rr = _rand(t, 31.7 + k*9.1);
        const a = (0.10 + 0.18*sev) * (0.55 + 0.45*Math.sin((t*2.1)+k));
        const ox = (rr*2-1) * (6 + 4*sev);
        const oy = (-6 - 6*sev) + (rr*2-1)*2;
        ctx.save();
        ctx.globalAlpha = clamp(a, 0, 0.35);
        ctx.fillStyle = 'rgba(180,190,200,1)';
        ctx.beginPath();
        ctx.arc(x+ox, y+oy, 2.2 + 2.6*sev, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }

      // sparks (orange/yellow)
      for(let k=0;k<nSpark;k++){
        const rr = _rand(t, 91.3 + k*13.9);
        const a = (0.20 + 0.25*sev) * (0.40 + 0.60*Math.sin((t*7.0)+k*1.7));
        const ox = (rr*2-1) * (7 + 5*sev);
        const oy = (rr*2-1) * (5 + 3*sev);
        ctx.save();
        ctx.globalAlpha = clamp(a, 0, 0.55);
        ctx.fillStyle = 'rgba(255,210,120,1)';
        ctx.fillRect(Math.floor(x+ox), Math.floor(y+oy), 1, 1);
        // tiny trailing ember
        ctx.fillStyle = 'rgba(255,255,255,1)';
        ctx.fillRect(Math.floor(x+ox)+1, Math.floor(y+oy), 1, 1);
        ctx.restore();
      }
    };



// rocks (neon skeleton obstacles)
if(Array.isArray(st.rocks) && st.rocks.length){
  for(const r of st.rocks){
    const cx = toPX(r.x), cy = toPY(r.y);
    const hue = isFinite(r.hue)?r.hue:200;
    // glow stroke
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(180,255,255,0.14)`;
    ctx.beginPath();
    const pts = Array.isArray(r.pts)&&r.pts.length ? r.pts : null;
    if(pts){
      ctx.moveTo(cx + pts[0].x*W, cy + pts[0].y*H);
      for(let i=1;i<pts.length;i++) ctx.lineTo(cx + pts[i].x*W, cy + pts[i].y*H);
      ctx.closePath();
    }else{
      ctx.arc(cx,cy, Math.max(6, Math.floor((r.r||0.05)*W)), 0, Math.PI*2);
    }
    ctx.stroke();
    // neon core
    ctx.lineWidth = 1;
    ctx.strokeStyle = `hsla(${hue}, 95%, 70%, 0.85)`;
    ctx.beginPath();
    if(pts){
      ctx.moveTo(cx + pts[0].x*W, cy + pts[0].y*H);
      for(let i=1;i<pts.length;i++) ctx.lineTo(cx + pts[i].x*W, cy + pts[i].y*H);
      ctx.closePath();
    }else{
      ctx.arc(cx,cy, Math.max(6, Math.floor((r.r||0.05)*W)), 0, Math.PI*2);
    }
    ctx.stroke();
    // inner bones
    ctx.strokeStyle = `hsla(${hue}, 95%, 85%, 0.25)`;
    ctx.beginPath();
    ctx.moveTo(cx-3,cy); ctx.lineTo(cx+3,cy);
    ctx.moveTo(cx,cy-3); ctx.lineTo(cx,cy+3);
    ctx.stroke();
  }
}
    // missile explosion rings (lightweight)
    if(Array.isArray(st.rings) && st.rings.length){
      for(const r of st.rings){
        const x=toPX(r.x), y=toPY(r.y);
        const rr = Math.max(2, Math.floor((r.r||0.05)*W));
        const hue = num(r.hue, 200);
        const a = clamp(num(r.a,0.6), 0, 1);
        ctx.strokeStyle = `hsla(${hue}, 95%, 70%, ${0.25*a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI*2);
        ctx.stroke();
        ctx.strokeStyle = `hsla(${hue}, 95%, 85%, ${0.45*a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, rr-2), 0, Math.PI*2);
        ctx.stroke();
      }
    }



    // player
    const px=toPX(st.player.x), py=toPY(st.player.y);
    ctx.fillStyle = st.inv>0 ? 'rgba(180,255,220,0.9)' : 'rgba(220,240,255,0.95)';
    // simple ship sprite (7x6)
    const ship=[
      '...#...',
      '..###..',
      '.#####.',
      '###.###',
      '..#.#..',
      '.#...#.',
    ];
    for(let yy=0;yy<ship.length;yy++){
      for(let xx=0;xx<ship[0].length;xx++){
        if(ship[yy][xx]==='#') ctx.fillRect(px-3+xx, py-4+yy, 1, 1);
      }
    }
    // player barrier (one-hit)
    if(st.player && st.player.shield){
      ctx.strokeStyle = 'rgba(200,255,255,0.70)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI*2);
      ctx.stroke();
    }
    // damage stage: based on remaining lives (3..0)
    const lmax = isFinite(st.livesMax)?st.livesMax:3;
    const lcur = isFinite(st.lives)?st.lives:lmax;
    const sevP = clamp(1 - (lcur/Math.max(1,lmax)), 0, 1);
    drawDamageFx(px, py, sevP);

    // clutch remaining time near player (counts down)
    try{
      const c = st.clutch;
      const rem = (c && isFinite(c.until)) ? ((num(c.until,0) - num(st.t,0)) / 1000) : 0;
      if(rem > 0){
        const t = `CLUTCH ${Math.max(0, rem).toFixed(1)}s`;
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.font = '700 11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 3;
        ctx.strokeText(t, px, py-10);
        ctx.fillStyle = 'rgba(160,255,200,0.95)';
        ctx.fillText(t, px, py-10);
        ctx.restore();
      }
    }catch(e){}

    // drones (options)
    if(Array.isArray(st.drones) && st.drones.length){
      const dShip=[
        '.#.#.',
        '#####',
        '.###.',
        '..#..',
      ];
      for(const d of st.drones){
        const dx=toPX(d.x), dy=toPY(d.y);
        if(d && d.inv){
          const pulse = 0.5 + 0.5*Math.sin((st.t*0.012) + (d.x*19.1));
          ctx.fillStyle = 'rgba(80,0,120,'+(0.10 + 0.10*pulse)+')';
          ctx.beginPath();
          ctx.arc(dx, dy, 10, 0, Math.PI*2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(210,160,255,'+(0.35 + 0.25*pulse)+')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(dx, dy, 9, 0, Math.PI*2);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(235,225,255,0.95)';
        for(let yy=0;yy<dShip.length;yy++){
          for(let xx=0;xx<dShip[0].length;xx++){
            if(dShip[yy][xx]==='#') ctx.fillRect(dx-2+xx, dy-2+yy, 1, 1);
          }
        }
        // damage stage for drones: based on HP fraction
        const dhm = isFinite(d.hpMax)?d.hpMax:3;
        const dh  = isFinite(d.hp)?d.hp:dhm;
        const sevD = clamp(1 - (dh/Math.max(1,dhm)), 0, 1);
        drawDamageFx(dx, dy, sevD);
        if(d.shield){
          ctx.strokeStyle = 'rgba(200,255,255,0.55)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(dx, dy, 7, 0, Math.PI*2);
          ctx.stroke();
        }
      }
    }


    // bullets
    for(const b of st.bullets){
      const x=toPX(b.x), y=toPY(b.y);
      if(b.laser){
        const topY = toPY(Math.max(0, (b.stopY ?? (b.y - (b.len??0.62)))));
        const wpx = Math.max(2, Math.round(((b.w??0.035)*W)));
        ctx.fillStyle = 'rgba(160,240,255,0.55)';
        ctx.fillRect(x - (wpx>>1), topY, wpx, (y - topY));
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.fillRect(x, topY, 1, (y - topY));
        continue;
      }

      // custom visuals per weapon kind (makes G/R/C clearly distinguishable)
      const k = String(b.k||'');
      if(k==='G'){
        // Heavy bomb: big glowing orb
        const pulse = 0.5 + 0.5*Math.sin((st.t*0.012) + (b.x*13.7));
        ctx.save();
        ctx.fillStyle = 'rgba(255,210,120,'+(0.70+0.20*pulse)+')';
        ctx.beginPath(); ctx.arc(x, y+1, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,'+(0.18+0.10*pulse)+')';
        ctx.beginPath(); ctx.arc(x-1, y, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        continue;
      }else if(k==='R'){
        // Saw: spinning ring with teeth
        const ang = (st.t*0.012) + (b.y*9.0);
        ctx.save();
        ctx.translate(x, y+1);
        ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(255,235,170,0.95)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0,0,3.2,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,200,120,0.92)';
        for(let i=0;i<8;i++){
          const a=i*(Math.PI*2/8);
          const tx=Math.cos(a)*4.0, ty=Math.sin(a)*4.0;
          ctx.fillRect(tx-0.6, ty-0.6, 1.2, 1.2);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
        continue;
      }else if(k==='C'){
        // Ricochet: sharp cyan bolt
        const pulse = 0.5 + 0.5*Math.sin((st.t*0.016) + (b.x*21.3));
        ctx.save();
        ctx.strokeStyle = 'rgba(160,240,255,'+(0.75+0.18*pulse)+')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y+3);
        ctx.lineTo(x+2, y+1);
        ctx.lineTo(x-1, y-1);
        ctx.lineTo(x+1, y-3);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,'+(0.25+0.12*pulse)+')';
        ctx.fillRect(x, y-2, 1, 1);
        ctx.restore();
        continue;
      }

      ctx.fillStyle = b.pierce ? 'rgba(255,220,140,0.95)' : (b.homing ? 'rgba(170,255,170,0.95)' : (b.nearHoming ? 'rgba(210,200,255,0.95)' : (b.erase ? 'rgba(170,210,255,0.95)' : 'rgba(255,255,255,0.95)')));
      ctx.fillRect(x, y, 1, 3);
      if(b.pierce) ctx.fillRect(x-1,y+1,3,1);
    }

    // chain-laser visuals (C): brief beam segments
    if(Array.isArray(st.zaps) && st.zaps.length){
      ctx.save();
      ctx.lineWidth = 2;
      for(const z of st.zaps){
        const a = clamp(num(z.t,0.08)/0.12, 0, 1);
        ctx.strokeStyle = 'rgba(180,245,255,'+(0.55*a)+')';
        if(z && Array.isArray(z.segs)){
          for(const s of z.segs){
            ctx.beginPath();
            ctx.moveTo(toPX(s.x1), toPY(s.y1));
            ctx.lineTo(toPX(s.x2), toPY(s.y2));
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    // MISSILE draw (slow start -> accelerates)
    if(Array.isArray(st.missiles) && st.missiles.length){
      for(const m of st.missiles){
        const x=toPX(m.x), y=toPY(m.y);
        const type = String(m.type||'a');
        const lv = clamp(num(m.lv,1),1,5);
        const hue = (type==='w'?35:type==='h'?120:200);
        const tail = 4 + Math.floor(lv*0.6) + Math.floor((num(m.sp,0.2))*1.6);
        const w = 2;
        // afterburn glow
        const pulse = 0.5 + 0.5*Math.sin((st.t*0.015) + num(m.seed,0));
        ctx.fillStyle = `hsla(${hue}, 95%, 70%, ${0.20 + 0.15*pulse})`;
        ctx.fillRect(x-2, y-2, 5, 5);
        // body
        ctx.fillStyle = `hsla(${hue}, 95%, 85%, 0.92)`;
        ctx.fillRect(x-1, y-1, 3, 3);
        // tail
        ctx.fillStyle = `hsla(${hue}, 95%, 80%, 0.55)`;
        ctx.fillRect(x-0, y+1, 1, tail);
        // nose sparkle
        ctx.fillStyle = `hsla(${hue}, 95%, 96%, 0.65)`;
        ctx.fillRect(x, y-2, 1, 1);
      }
    }



    // enemy bullets (add ominous aura for visibility)
    for(const b of st.ebullets){
      const x=toPX(b.x), y=toPY(b.y);
      const pulse = 0.5 + 0.5*Math.sin((st.t*0.010) + (b.x*17.3));
      ctx.fillStyle = 'rgba(255,40,90,'+(0.18 + 0.14*pulse)+')';
      ctx.fillRect(x-4, y-4, 10, 10);
      ctx.fillStyle = 'rgba(255,120,200,'+(0.22 + 0.12*pulse)+')';
      ctx.fillRect(x-2, y-2, 6, 6);
      ctx.fillStyle='rgba(255,235,245,0.96)';
      ctx.fillRect(x, y, 2, 2);
    }

    // enemies (more "enemy-like" silhouettes to distinguish from items)
    for(const e of st.enemies){
      const x=toPX(e.x), y=toPY(e.y);
      const body =
        e.kind==='tank'    ? 'rgba(255,150,90,0.98)' :
        e.kind==='shooter' ? 'rgba(255,110,190,0.98)' :
        e.kind==='sweeper' ? 'rgba(180,120,255,0.98)' :
        'rgba(120,200,255,0.98)';
      const sz = e.kind==='tank'? 10 : (e.kind==='sweeper'? 8 : 7);
      const h  = Math.floor(sz/2);
      // ominous aura (visibility boost, cheap)
      const ep = 0.5 + 0.5*Math.sin((st.t*0.006) + (e.x*13.1));
      ctx.fillStyle = 'rgba(255,60,120,'+(0.10 + 0.14*ep)+')';
      ctx.fillRect(x-h-5, y-h-5, sz+10, sz+10);
      ctx.fillStyle = 'rgba(255,160,80,'+(0.06 + 0.10*ep)+')';
      ctx.fillRect(x-h-3, y-h-3, sz+6, sz+6);


      // outline
      ctx.fillStyle='rgba(0,0,0,0.55)';
      ctx.fillRect(x-h-1, y-h-1, sz+2, sz+2);
      // body
      ctx.fillStyle=body;
      ctx.fillRect(x-h, y-h, sz, sz);

      // little "horns" / spikes
      ctx.fillStyle='rgba(0,0,0,0.55)';
      ctx.fillRect(x-h, y-h-2, 2, 2);
      ctx.fillRect(x+h-1, y-h-2, 2, 2);

      // eyes
      ctx.fillStyle='rgba(255,255,255,0.92)';
      ctx.fillRect(x-2, y-1, 1, 1);
      ctx.fillRect(x+1, y-1, 1, 1);
      ctx.fillStyle='rgba(0,0,0,0.55)';
      ctx.fillRect(x-2, y, 1, 1);
      ctx.fillRect(x+1, y, 1, 1);

      // kind accents
      if(e.kind==='tank'){
        // thicker front plate
        ctx.fillStyle='rgba(0,0,0,0.35)';
        ctx.fillRect(x-h, y+h-2, sz, 2);
      }else if(e.kind==='shooter'){
        // small gun nub
        ctx.fillStyle='rgba(0,0,0,0.45)';
        ctx.fillRect(x+h-1, y-1, 3, 2);
      }else if(e.kind==='sweeper'){
        // "X" mark
        ctx.fillStyle='rgba(0,0,0,0.40)';
        ctx.fillRect(x-3,y+2,6,1);
        ctx.fillRect(x-2,y+1,4,1);
      }
    }

// rocks (indestructible neon obstacles; increase over time)
st.rocks = Array.isArray(st.rocks)?st.rocks:[];
st.rockAcc = (isFinite(st.rockAcc)?st.rockAcc:0) + dtR;
const rockIntv = Math.max(0.85, 4.20 - st.dif*0.08);
const rockCap = Math.min(28, 6 + Math.floor(st.dif*0.55));
while(st.rockAcc >= rockIntv && st.rocks.length < rockCap){
  st.rockAcc -= rockIntv;
  this.dsSpawnRock();
}
// update rocks drift (wrap)
for(const r of st.rocks){
  r.t = (r.t||0) + dtR;
  r.y += (r.vy||0.06) * dtR;
  r.x += (r.vx||0) * dtR;
  if(r.x < 0.06){ r.x=0.06; r.vx = Math.abs(r.vx||0.02); }
  if(r.x > 0.94){ r.x=0.94; r.vx = -Math.abs(r.vx||0.02); }
  if(r.y > 1.28){
    r.y = -0.18 - Math.random()*0.22;
    r.x = 0.10 + Math.random()*0.80;
  }
}

// boss
    if(st.boss){
      const b=st.boss;
      const x=toPX(b.x), y=toPY(b.y);
      ctx.fillStyle='rgba(255,255,255,0.95)';
      ctx.fillRect(x-22,y-10,44,20);
      ctx.fillStyle='rgba(0,0,0,0.35)';
      ctx.fillRect(x-18,y-6,36,12);
      // hp bar
      const maxHp = num(b.maxHp, 0) || (150 + st.dif*30);
      const hp = clamp(num(b.hp,0)/maxHp,0,1);
      ctx.fillStyle='rgba(120,255,230,0.95)';
      ctx.fillRect(6,6, Math.floor((W-12)*hp), 3);
      ctx.fillStyle='rgba(255,255,255,0.25)';
      ctx.fillRect(6,6, W-12, 3);
    }

    // powerups (soft glow)
    for(const pu of st.pups){
      const x=toPX(pu.x), y=toPY(pu.y);

      // glow halo (pulse)
      const pulse = 0.5 + 0.5*Math.sin((st.t*0.008) + (pu.x*11.7));
      ctx.save();
      ctx.fillStyle = 'rgba(200,230,255,'+(0.10 + 0.10*pulse)+')';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,'+(0.06 + 0.08*pulse)+')';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      if(pu.type==='O'){
        // drone add: make it visually distinct (tiny satellite + plus)
        ctx.save();
        ctx.globalAlpha = 0.98;
        ctx.fillStyle = 'rgba(210,160,255,0.98)';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.fillRect(x-7, y-1, 3, 2);
        ctx.fillRect(x+4, y-1, 3, 2);
        ctx.fillRect(x-1, y-7, 2, 3);
        ctx.fillRect(x-1, y+4, 2, 3);

        ctx.fillStyle = 'rgba(255,255,255,0.90)';
        ctx.fillRect(x-1, y-4, 2, 8);
        ctx.fillRect(x-4, y-1, 8, 2);
        ctx.restore();
        continue;
      }

      if(pu.type==='A'){
        // barrier: small glass ring
        ctx.save();
        ctx.strokeStyle = 'rgba(170,250,255,0.98)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI*2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.beginPath();
        ctx.arc(x-1, y-1, 2.5, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      if(pu.type==='P'){
        // speed: arrow/wing icon
        ctx.save();
        ctx.globalAlpha = 0.98;
        ctx.fillStyle = 'rgba(140,255,200,0.98)';
        ctx.fillRect(x-4, y-2, 8, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(x+2, y-4, 2, 8);
        ctx.fillRect(x+4, y-3, 2, 6);
        ctx.fillStyle = 'rgba(20,22,30,0.45)';
        ctx.fillRect(x-3, y-1, 3, 2);
        ctx.restore();
        continue;
      }

      if(pu.type==='Y'){
        // heal: green cross
        const pulse2 = 0.5 + 0.5*Math.sin((st.t*0.009) + (pu.y*13.3));
        ctx.save();
        ctx.globalAlpha = 0.98;
        ctx.fillStyle = 'rgba(140,255,170,'+(0.70+0.18*pulse2)+')';
        ctx.fillRect(x-1, y-5, 2, 10);
        ctx.fillRect(x-5, y-1, 10, 2);
        ctx.fillStyle = 'rgba(255,255,255,'+(0.28+0.22*pulse2)+')';
        ctx.fillRect(x-1, y-3, 2, 6);
        ctx.fillRect(x-3, y-1, 6, 2);
        ctx.restore();
        continue;
      }

      if(pu.type==='T'){
        // tiny hitbox: target icon
        ctx.save();
        ctx.strokeStyle = 'rgba(210,200,255,0.98)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI*2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI*2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(x-1, y-1, 2, 2);
        ctx.restore();
        continue;
      }

      if(pu.type==='G'){
        // heavy bomb pickup: big orb with inner spark
        const pulse = 0.5 + 0.5*Math.sin((st.t*0.010) + (pu.x*9.7));
        ctx.save();
        ctx.fillStyle = 'rgba(255,210,120,'+(0.70+0.18*pulse)+')';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,'+(0.18+0.10*pulse)+')';
        ctx.beginPath(); ctx.arc(x-1, y-1, 2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        continue;
      }

      if(pu.type==='R'){
        // saw pickup: toothed ring
        const ang = (st.t*0.010) + (pu.y*7.0);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(255,235,170,0.98)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,200,120,0.92)';
        for(let i=0;i<10;i++){
          const a=i*(Math.PI*2/10);
          const tx=Math.cos(a)*6.0, ty=Math.sin(a)*6.0;
          ctx.fillRect(tx-0.7, ty-0.7, 1.4, 1.4);
        }
        ctx.restore();
        continue;
      }

      if(pu.type==='C'){
        // ricochet pickup: lightning bolt
        const pulse = 0.5 + 0.5*Math.sin((st.t*0.014) + (pu.x*15.3));
        ctx.save();
        ctx.strokeStyle = 'rgba(160,240,255,'+(0.78+0.16*pulse)+')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x-4, y+5);
        ctx.lineTo(x+1, y+1);
        ctx.lineTo(x-2, y-1);
        ctx.lineTo(x+4, y-6);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      ctx.fillStyle =
        pu.type==='B' ? 'rgba(255,190,220,0.95)' :   // bomb
        pu.type==='I' ? 'rgba(210,160,255,0.95)' :   // drone-inv
        (pu.type==='a'||pu.type==='w'||pu.type==='h') ? 'rgba(150,210,255,0.95)' :   // missile evo
        pu.type==='S' ? 'rgba(140,255,200,0.95)' :
        pu.type==='L' ? 'rgba(255,220,140,0.95)' :
        pu.type==='H' ? 'rgba(180,255,180,0.95)' :
        pu.type==='E' ? 'rgba(170,210,255,0.95)' :
        pu.type==='Q' ? 'rgba(210,200,255,0.95)' :
        pu.type==='G' ? 'rgba(255,210,120,0.95)' :
        pu.type==='R' ? 'rgba(255,235,170,0.95)' :
        pu.type==='C' ? 'rgba(160,240,255,0.95)' :
                pu.type==='Z' ? 'rgba(160,240,255,0.95)' :
        'rgba(255,255,255,0.95)';
      // diamond-ish blob (different from enemy squares)
      ctx.fillRect(x-2, y-4, 5, 9);
      ctx.fillRect(x-4, y-2, 9, 5);
    }

    // pickup toast (near player)
    if(Array.isArray(st.toasts) && st.toasts.length){
      ctx.save();
      ctx.textBaseline='middle';
      ctx.font='10px sans-serif';
      for(const tt of st.toasts){
        const life = (tt.life ?? 1.25);
        const a = Math.max(0, Math.min(1, 1 - (tt.t / life)));
        const tx=toPX(tt.x), ty=toPY(tt.y);
        const msg=String(tt.msg||'');
        const pad=4, h=16;
        const w=ctx.measureText(msg).width + pad*2;

        let x0 = tx - w/2;
        let y0 = ty - 18;

        x0 = Math.max(6, Math.min(W-6-w, x0));
        y0 = Math.max(6, Math.min(H-6-h, y0));

        const r=6;
        ctx.fillStyle = 'rgba(20,22,30,'+(0.42*a)+')';
        ctx.strokeStyle = 'rgba(255,255,255,'+(0.16*a)+')';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(x0+r, y0);
        ctx.arcTo(x0+w, y0, x0+w, y0+h, r);
        ctx.arcTo(x0+w, y0+h, x0, y0+h, r);
        ctx.arcTo(x0, y0+h, x0, y0, r);
        ctx.arcTo(x0, y0, x0+w, y0, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(240,245,255,'+(0.92*a)+')';
        ctx.fillText(msg, x0+pad, y0+h/2+0.5);
      }
      ctx.restore();
    }
  
    // end camera

      // --- Cinematic overlays: hitbox glow + clutch mesh + remaining seconds ---
      // Show during slow mode (timeScale < 1). These are purely visual aids.
      const _tsNow = num(st.timeScale, 1);
      const _slowActive = (_tsNow < 0.999);
      if(_slowActive){
        const p = st.player || {x:0.5,y:0.88,hitMul:1};
        const prN = 0.035 * clamp((isFinite(p.hitMul)?p.hitMul:1), 0.45, 1);
        const nearMargin = num(DOTSTRIKE_TUNING?.clutch?.nearMargin, 0.035);
        const meshRN = (prN + nearMargin);

        const scale = Math.min(W, H);
        const px = toPX(p.x), py = toPY(p.y);
        const prPx = Math.max(2, prN * scale);
        const meshPx = Math.max(prPx+6, meshRN * scale);

        // (A) colored mesh ring for clutch range
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(120,240,255,0.22)';
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.arc(px, py, meshPx, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        // radial mesh lines
        ctx.strokeStyle = 'rgba(180,120,255,0.12)';
        for(let a=0;a<Math.PI*2;a+=Math.PI/10){
          const x0 = px + Math.cos(a)*(meshPx*0.70);
          const y0 = py + Math.sin(a)*(meshPx*0.70);
          const x1 = px + Math.cos(a)*(meshPx*1.03);
          const y1 = py + Math.sin(a)*(meshPx*1.03);
          ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
        }
        ctx.restore();

        // (B) hitbox glow helper
        const glow = (x,y,r,alpha=1)=>{
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = clamp(alpha, 0, 1);
          ctx.shadowColor = 'rgba(255,255,255,0.95)';
          ctx.shadowBlur = 10;
          ctx.strokeStyle = 'rgba(255,255,255,0.70)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
          ctx.restore();
        };

        // player hitbox
        glow(px, py, prPx, 1);

        // enemy bullets hitboxes (small)
        if(Array.isArray(st.ebullets)){
          for(const b of st.ebullets){
            const bx = toPX(b.x), by = toPY(b.y);
            glow(bx, by, 6, 0.85);
          }
        }

        // enemy bodies hitboxes
        if(Array.isArray(st.enemies)){
          for(const e of st.enemies){
            const ex = toPX(e.x), ey = toPY(e.y);
            glow(ex, ey, 10, 0.75);
          }
        }
        if(st.boss){
          const ex = toPX(st.boss.x), ey = toPY(st.boss.y);
          glow(ex, ey, 18, 0.80);
        }
      }

    }catch(e){
      console.error(e);
    }finally{
      ctx.restore();
    }
  }

  // セットアップ（賭け金選択）

  // セットアップ（賭け金選択）
  openPunyopunyoSetup(){
    const close = ()=>{ const ol=$("#townOL"); if(ol) ol.style.display='none'; };
    const show  = ()=>{ const ol=$("#townOL"); if(ol) ol.style.display='flex'; };
    const set   = (title,sub)=>{
      const t=$("#townTitle"); if(t) t.textContent=title;
      const s=$("#townSub")||$("#townDesc"); if(s) s.textContent=sub||'';
    };

    // タイトルから直接ミニゲームを開いている場合など、保持/財布を読み込む
    try{ if(this.loadHoldFromTitle) this.loadHoldFromTitle(); }catch(e){}
    try{ if(this.loadGlobalGold) this.loadGlobalGold(); }catch(e){}

    const gold = num(this.p.gold,0);
    const hs = this.getPunyopunyoHighScore();
    const lastBet = num(this._ppBet, 0);

    // ぷんよ設定（最大かたまり＆アシスト）
    if(this._ppMaxN==null) this._ppMaxN = 4; // 既定: 4
    if(this._ppDistKey==null) this._ppDistKey = 'STD';
    if(this._ppAssist==null) this._ppAssist = true;


    set("ぷんよぷんよ","連鎖でスコアUP。報酬は賭け金×実力倍率");

    const tabs=$("#townTabs"); if(tabs) tabs.innerHTML='';
    const list=$("#townList");
    if(list){
      list.innerHTML = `
        <div class="ppSetup">
          <div class="ppRow"><div>所持金</div><div><b id="ppGoldDisp">${gold}</b>G</div></div>
          <div class="ppRow"><div>ハイスコア</div><div><b>${hs}</b></div></div>
                    <div class="ppRow"><div>盤面</div><div id="ppSizeLine"></div></div>
<div class="ppRow"><div>分布</div><div id="ppDistLine"></div></div>
<div class="ppRow"><div>最大かたまり</div><div id="ppMaxLine"></div></div>
<div class="ppRow"><div>アシスト</div><label style="display:flex;align-items:center;gap:10px;user-select:none;"><input type="checkbox" id="ppAssistChk" style="transform:scale(1.25);"><span class="dim">少ない列へ自動</span></label></div>
<div class="ppRow"><div>賭け金</div><div id="ppBetLine"></div></div>
          <div class="dim" style="margin-top:8px; line-height:1.35">
            ※0Gでも遊べます（賭け金10G扱い）。勝てばそのまま次の賭け金にできます。最大かたまり・分布・盤面が大きいほど倍率が上がります。
          </div>

          <div style="margin-top:10px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap">
            <div class="btn" id="ppStartBtn">START</div>
          </div>
        </div>
      `;
    }

    const betLine = $("#ppBetLine");
    const maxLine = $("#ppMaxLine");
    const distLine = $("#ppDistLine");
    const assistChk = $("#ppAssistChk");

    
const sizeLine = $("#ppSizeLine");
    const ppSizePresets = [
      {k:'N',  w:8,  h:12, label:'小 8×12'},
      {k:'L',  w:10, h:16, label:'標準 10×16'},
      {k:'T',  w:12, h:20, label:'縦 12×20'},
      {k:'T2', w:12, h:24, label:'縦+ 12×24'},
      {k:'W',  w:12, h:10, label:'横 12×10'},
      {k:'W2', w:14, h:9,  label:'横+ 14×9'},
      {k:'UW', w:16, h:8,  label:'超横 16×8'},
    ];
    if(!this._ppSizeKey) this._ppSizeKey = 'L';

    const sizeByKey = (k)=> ppSizePresets.find(p=>p.k===k) || ppSizePresets[1];

    // かたまり最大数が大きいほど、盤面が小さいと即死しやすいので組み合わせを制限
    const ppMaxAllowedForSize = (w,h)=>{
      const area = w*h;
      let maxA = 20;
      if(area <= 84) maxA = 12;         // 小盤面は20/16を禁止
      else if(area <= 110) maxA = 16;   // 中盤面は20を禁止
      else maxA = 20;
      const mn = Math.min(w,h);
      if(mn <= 7) maxA = Math.min(maxA, 12);
      else if(mn <= 9) maxA = Math.min(maxA, 16);
      return maxA;
    };

    const normalizeSizeAndMax = ()=>{
      // maxNが現在の盤面に対して大きすぎるならclamp
      const curSize = sizeByKey(this._ppSizeKey);
      const maxAllowed = ppMaxAllowedForSize(curSize.w, curSize.h);
      if(this._ppMaxN == null) this._ppMaxN = 8;
      this._ppMaxN = Math.max(2, Math.min(maxAllowed, num(this._ppMaxN,8)));

      // 盤面がmaxNに対して小さすぎるなら、入る盤面へ自動で寄せる
      const want = Math.max(2, Math.min(20, num(this._ppMaxN,8)));
      const ok = ppSizePresets.filter(p=> ppMaxAllowedForSize(p.w,p.h) >= want);
      if(ok.length){
        const nowOk = ok.some(p=>p.k===this._ppSizeKey);
        if(!nowOk) this._ppSizeKey = ok[0].k;
      }
    };

    normalizeSizeAndMax();

    const renderSize = ()=>{
      if(!sizeLine) return;
      const curMax = Math.max(2, Math.min(20, num(this._ppMaxN,8)));
      const allowedKeys = new Set(ppSizePresets.filter(p=>ppMaxAllowedForSize(p.w,p.h) >= curMax).map(p=>p.k));
      sizeLine.innerHTML = `<div class="dim">盤面</div>
        <select id="ppSizeSel">
          ${ppSizePresets.map(p=>{
            const dis = allowedKeys.has(p.k) ? '' : 'disabled';
            const sel = (p.k===this._ppSizeKey)?'selected':'';
            return `<option value="${p.k}" ${sel} ${dis}>${p.label}</option>`;
          }).join('')}
        </select>`;
      const sel=$("#ppSizeSel");
      if(sel){
        sel.onchange=()=>{
          this._ppSizeKey = sel.value;
          normalizeSizeAndMax();
          renderSize();
          renderMax();
        };
      }
    };

    const renderMax = ()=>{
      if(!maxLine) return;
      const curSize = sizeByKey(this._ppSizeKey);
      const maxAllowed = ppMaxAllowedForSize(curSize.w, curSize.h);
      // 粒度を適度に（細かすぎない）
      const optsAll = [2,3,4,6,8,10,12,16,20].filter(v=>v<=maxAllowed);
      if(!optsAll.includes(this._ppMaxN)) this._ppMaxN = optsAll[optsAll.length-1] || 8;

      maxLine.innerHTML = `<div class="dim">最大かたまり</div>
        <select id="ppMaxSel">
          ${optsAll.map(v=>`<option value="${v}" ${v===this._ppMaxN?'selected':''}>${v}</option>`).join('')}
        </select>
        <div class="dim">（小盤面では20/16は選べません）</div>`;
      const sel=$("#ppMaxSel");
      if(sel){
        sel.onchange=()=>{
          this._ppMaxN = num(sel.value,8);
          normalizeSizeAndMax();
          renderSize();
          renderMax();
        };
      }
    };


    // 分布（ブロック数の出やすさ）
    const distPresets = [
      {k:'STD',  label:'標準'},
      {k:'BIG',  label:'大きめ'},
      {k:'FLAT', label:'均等'},
    ];
    const renderDist = ()=>{
      if(!distLine) return;
      distLine.innerHTML='';
      const cur = String(this._ppDistKey || 'STD');
      this._ppDistKey = cur;

      const sel=document.createElement('select');
      sel.className='ppSelect';
      for(const d of distPresets){
        const opt=document.createElement('option');
        opt.value=d.k;
        opt.textContent=d.label;
        if(d.k===cur) opt.selected=true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', ()=>{
        this._ppDistKey = String(sel.value||'STD');
      });
      distLine.appendChild(sel);
    };
// assist checkbox (default ON)
    if(assistChk){
      assistChk.checked = (this._ppAssist!==false);
      assistChk.addEventListener('change', ()=>{
        this._ppAssist = !!assistChk.checked;
      });
    }

const betOptionsBase = [10,50,100,500,1000,5000,10000];
let betOptions = betOptionsBase.filter(v=>v<=gold);
if(gold<=0) betOptions = [0];
if(gold>0 && lastBet>0 && !betOptions.includes(lastBet) && lastBet<=gold) betOptions.unshift(lastBet);

const renderBet = ()=>{
  if(!betLine) return;
  betLine.innerHTML='';
  const cur = (gold<=0) ? 0 : (num(this._ppBet,0) || Math.min( (lastBet>0 && lastBet<=gold)?lastBet:10, gold));
  if(gold>0 && (this._ppBet==null || this._ppBet===0)) this._ppBet = cur;
  if(gold<=0) this._ppBet = 0;

  const sel=document.createElement('select');
  sel.className='ppSelect';

  if(gold<=0){
    const opt=document.createElement('option');
    opt.value='0';
    opt.textContent='10G扱い';
    sel.appendChild(opt);
    sel.value='0';
  }else{
    for(const v of betOptions){
      const opt=document.createElement('option');
      opt.value=String(v);
      opt.textContent= v+'G';
      sel.appendChild(opt);
    }
    const optAll=document.createElement('option');
    optAll.value='-1';
    optAll.textContent='全額';
    sel.appendChild(optAll);

    const want = String(num(this._ppBet, cur));
    sel.value = (Array.from(sel.options).some(o=>o.value===want)) ? want : String(cur);
    this._ppBet = parseInt(sel.value,10);
  }

  sel.addEventListener('change', ()=>{
    const v = parseInt(sel.value,10);
    this._ppBet = isFinite(v) ? v : 0;
  });
  betLine.appendChild(sel);
};

renderSize();

    renderDist();
    renderMax();
    renderBet();

    // START（iPhoneで押せない/無反応に見える時があるため、リスト内にも配置して確実に拾う）
    const doStart = ()=>{
      try{
      // 最新の財布を反映（タイトル放置→別ミニゲームなどのズレ対策）
      try{ if(this.loadGlobalGold) this.loadGlobalGold(); }catch(e){}
      const goldNow = num(this.p.gold,0);

      const betRaw = num(this._ppBet,0);
      let bet = betRaw;

      if(goldNow<=0){
        bet = 0; // 10G扱い
      }else{
        if(betRaw===-1) bet = goldNow;
        bet = Math.max(0, Math.min(bet, goldNow));
        if(bet===0) bet = Math.min(10, goldNow);
      }
      this.startPunyopunyo({bet, sizeKey: this._ppSizeKey, maxN: this._ppMaxN, distKey: this._ppDistKey, assist: (this._ppAssist!==false)});
          }catch(err){
        console.error(err && err.stack ? err.stack : err);
        try{ this.msg("START失敗: "+(err && err.message ? err.message : String(err))); }catch(e){}
      }
    };

    // リスト内 START ボタン
    const ppStartBtn = $("#ppStartBtn");
    if(ppStartBtn){
      bindTap(ppStartBtn, ()=>doStart());
      ppStartBtn.addEventListener('click', (e)=>{ e.preventDefault(); doStart(); });
    }

    const actions=$("#townActions");
    if(actions) actions.innerHTML='';
    const addBtn=(label,fn)=>{
      const b=document.createElement('div');
      b.className='btn';
      b.textContent=label;
      bindTap(b, ()=>fn());
      if(actions) actions.appendChild(b);
      return b;
    };

    addBtn("戻る", ()=>{
      // 町のカジノ一覧に戻す（タイトルから来た場合でも同じUI）
      this.openTownNpcMenu(this.mons.find(m=>m.ai==='town' && m.role==='casino') || {role:'casino',name:'カジノ係'});
    });

    addBtn("閉じる", ()=>{
      close();
      this.render();
    });

    show();
  }

  // 報酬倍率（HiGH&LOWより良く）
  ppCalcMultiplier(score){
    // ぷんよぷんよ：スコアが基準未満だと倍率1未満（＝マイナス収支）になり得るようにする
    // ※スコア0は完全に0扱い（報酬も0）
    score = num(score, 0);
    if(score<=0) return 0;

    const pp = this._pp || {};
    const maxN = Math.max(2, Math.min(20, num(pp?.maxN ?? this._ppMaxN, 4)));
    const distKey = String(pp?.distKey ?? this._ppDistKey ?? 'STD');

    // 難しい設定ほど「必要スコア」を下げる（=同じスコアでも倍率が上がりやすい）
    const maxBoost = Math.min(1.70, 1 + (maxN - 2) * 0.03); // 2→1.00, 20→1.54
    const distBoostMap = { STD:1.00, BIG:1.12, HUGE:1.25, FLAT:1.08 };
    const distBoost = distBoostMap[distKey] ?? 1.00;

    const area = Math.max(1, num(pp?.w,6) * num(pp?.h,12));
    const baseArea = 6*12;
    const sizeBoost = 1 + Math.min(0.40, Math.max(0, (area - baseArea) / 400)); // 最大 +40%

    const diff = Math.max(0.70, maxBoost * distBoost * sizeBoost);

    // ブレークイーブン基準（ここを"越えない"と倍率1未満になりやすい）
    // 難しいほど基準は下がる
    const baseTarget = 2400;
    const target = Math.max(500, Math.floor(baseTarget / diff));

    const r = score / target;
    let m;

    if(r <= 1){
      // 基準未満は 0.0〜0.98 の範囲（=収支マイナス）
      m = 0.05 + 0.93 * Math.max(0, r); // r=1 でも 0.98
    }else{
      // 基準超えでやっとプラス帯へ（伸びは抑える）
      m = 0.98 + (r - 1) * 0.90;
    }

    // 安全柵
    if(!isFinite(m)) m = 0;
    return Math.max(0, Math.min(6.00, m));
  }

  startPunyopunyo(cfg){
    const betReq = num(cfg?.bet,0);
    const goldNow = num(this.p.gold,0);

    // 0G特別(借り賭け)の内部用
    this._ppLoanBet = 0;

    // 実際に賭けに使う金額（0G時は 10G扱い）
    let effBet = betReq;
    let betStore = betReq;

    if(goldNow<=0){
      // 0G時は「借り賭け(10G)」扱いに固定（開始時の差し引きはしない）
      // ※賭け金を指定されても0Gでは支払えないため、ここでは一律10G扱いにして精算時に差額だけ反映する
      effBet = 10;
      betStore = 0;   // 実際に所持金からは引かない
      this._ppBet = 0;
      this._ppLoanBet = effBet;
    }else{
      if(betReq===-1) effBet = goldNow; // 全額
      effBet = Math.max(0, Math.min(effBet, goldNow));
      if(effBet===0) effBet = Math.min(10, goldNow);
      betStore = effBet;

      // 差し引き（開始時に支払う）
      this.p.gold = goldNow - effBet;
      this.afterGoldChange();
      this._ppBet = betStore;
    }

    const bet = betStore;

    const ppSizes = {
  N:{w:8,h:12,label:'小 8×12'},
  L:{w:10,h:16,label:'標準 10×16'},
  T:{w:12,h:20,label:'縦 12×20'},
  T2:{w:12,h:24,label:'縦+ 12×24'},
  W:{w:12,h:10,label:'横 12×10'},
  W2:{w:14,h:9,label:'横+ 14×9'},
  UW:{w:16,h:8,label:'超横 16×8'},
};
    const sizeKey = (cfg && cfg.sizeKey) ? cfg.sizeKey : (this._ppSizeKey || 'N');
    const sz = ppSizes[sizeKey] || ppSizes.N;
    const W = sz.w, H = sz.h;
    this._ppSizeKey = sizeKey;

    let maxN = Math.max(2, Math.min(20, num(cfg?.maxN, (this._ppMaxN==null?4:this._ppMaxN))));
    // 盤面が小さいのに「最大かたまり」が大きいと即死しやすいので、開始時にも安全側へclamp
    const areaPP = sz.w * sz.h;
    let maxAllowedPP = 20;
    // short-height boards become too punishing with big clusters
    if(sz.h <= 9) maxAllowedPP = Math.min(maxAllowedPP, 8);
    else if(sz.h <= 10) maxAllowedPP = Math.min(maxAllowedPP, 10);
    else if(sz.h <= 12) maxAllowedPP = Math.min(maxAllowedPP, 12);

    if(areaPP <= 84) maxAllowedPP = 12;
    else if(areaPP <= 110) maxAllowedPP = 16;
    const mnPP = Math.min(sz.w, sz.h);
    if(mnPP <= 7) maxAllowedPP = Math.min(maxAllowedPP, 12);
    else if(mnPP <= 9) maxAllowedPP = Math.min(maxAllowedPP, 16);
    maxN = Math.max(2, Math.min(maxAllowedPP, maxN));
    this._ppMaxN = maxN;

    const distKey = (cfg && cfg.distKey) ? String(cfg.distKey) : String(this._ppDistKey || 'STD');
    this._ppDistKey = distKey;

    this._ppMaxN = maxN;
    const assist = (cfg && cfg.assist!=null) ? !!cfg.assist : (this._ppAssist!==false);
    this._ppAssist = assist;


    const nextSpec = this.ppGenPieceSpec(maxN, distKey);
    this._pp = {
      w:W, h:H,      board: Array.from({length:H}, ()=>Array(W).fill(null)),
      cur:null,
      next: nextSpec.previewColors,
      nextSpec: nextSpec,
      fallMs: 320, // そこそこ早め
      soft:false,
      score:0,
      chain:0,
      resolving:false,
      sizeKey,
      maxN,
      assist,
      distKey,
      over:false,
      bet,
      loanBet: this._ppLoanBet,
      effBet,
      paid:false, // 精算済
      lastTs:0,
      acc:0,
      anim:null,
      animResolve:null,
      fx:{particles:[], chainBanner:null, flash:0, shake:0},
    };
    this.spawnPunyopunyo();
    this.openPunyopunyoPlay();
  }
  // ぷんよぷんよ：おじゃま（隣接消しでのみ消える）
  static get PP_OJAMA(){ return -1; }


  ppRandColor(){
    // 見分けやすい 5 色
    const cs=[0,1,2,3,4];
    return cs[rand(0, cs.length-1)];
  }

  // ぷんよぷんよ：おじゃま混入（賭け金×かたまりサイズで増える）
  ppApplyOjamaToBlocks(blocks){
    if(!Array.isArray(blocks)) return blocks;
    const n = blocks.length|0;
    if(n<=2) return blocks; // 2個ピースは遊びやすさ優先で通常のみ

    const pp=this._pp||{};
    const betRaw = num(pp.bet,0);
    const betDisp = (betRaw===0) ? 10 : Math.max(0, betRaw);

    // betFactor: 10→0, 10000→1（対数スケール）
    const log10 = (x)=>Math.log(x)/Math.LN10;
    const betFactor = Math.max(0, Math.min(1, (log10(Math.max(10, betDisp)) - 1) / 3));

    // 大きいかたまりほど、低賭けでもそれなりに混ざる
    const baseN = Math.max(0, Math.min(1, (n - 2) / 18)); // 2→0, 20→1
    let rate = 0.05 + baseN*0.25 + betFactor*0.45;        // 20個＆10000Gで約0.75
    rate = Math.max(0, Math.min(0.85, rate));

    let oj = Math.round(rate * n);
    oj = Math.max(0, Math.min(n-1, oj)); // 最低1個は通常を残す

    if(oj<=0) return blocks;

    // pivotは残しやすく（見た目の分かりやすさ）
    const idxs = [];
    for(let i=0;i<n;i++){
      if(blocks[i] && blocks[i].pivot) continue;
      idxs.push(i);
    }
    const pool = (idxs.length>=oj) ? idxs : Array.from({length:n}, (_,i)=>i);

    // shuffle
    for(let i=pool.length-1;i>0;i--){
      const j = rand(0,i);
      const t=pool[i]; pool[i]=pool[j]; pool[j]=t;
    }
    const pick = pool.slice(0, oj);
    for(const i of pick){
      if(blocks[i]) blocks[i].c = Game.PP_OJAMA;
    }
    return blocks;
  }



  // ぷんよぷんよ：次ピース仕様（2個落下に加えて、たまに3-6ブロックの大ピース）
  ppGenPieceSpec(maxNIn, distKeyIn){
    const r = Math.random();
    const maxN = Math.max(2, Math.min(20, num(maxNIn, 4)));
    const distKey = String(distKeyIn || (this._pp && this._pp.distKey) || this._ppDistKey || 'STD');

    let n = 2;

    // 分布：maxN の範囲で「大きいほど出にくい」を基調に、プリセットで調整
    //  - STD: 標準（2が多い）
    //  - BIG: 大きめ多め
    //  - HUGE: 極大多め
    //  - FLAT: ほぼ均等
    if(maxN > 2){
      const keys = [];
      for(let k=2;k<=maxN;k++) keys.push(k);

      let alpha = 0.35; // 大きいほど減衰（STD）
      if(distKey==='BIG')  alpha = 0.25;
      if(distKey==='HUGE') alpha = 0.15;
      if(distKey==='FLAT') alpha = 0.00;

      const weights = keys.map(k=>{
        if(alpha<=0) return 1;
        let w = Math.exp(-alpha*(k-2));
        // BIG/HUGE は「上側」を少し持ち上げる（maxNが大きいほど効果が出る）
        if(distKey==='BIG' || distKey==='HUGE'){
          const t = (maxN<=2) ? 0 : (k-2)/(maxN-2);
          w *= (1 + 0.35*t);
        }
        return w;
      });

      const sum = weights.reduce((a,b)=>a+b,0) || 1;
      let acc = 0;
      for(let i=0;i<keys.length;i++){
        acc += (weights[i]/sum);
        if(r <= acc){ n = keys[i]; break; }
      }
    }

    if(n === 2){
      const a = this.ppRandColor();
      const b = this.ppRandColor();
      const blocks = [
        {dx:0, dy:0, c:a, pivot:true},
        {dx:0, dy:-1, c:b, pivot:false},
      ];
      return { n, blocks, previewColors:[a,b] };
    }

    const blocks = this.ppGenRandomClusterBlocks(n);
    this.ppApplyOjamaToBlocks(blocks);
    const previewColors = [
      blocks[0]?.c ?? this.ppRandColor(),
      blocks[1]?.c ?? blocks[0]?.c ?? this.ppRandColor(),
    ];
    return { n, blocks, previewColors };
  }

  // ランダム生成：連結したブロックの集合を作る（固定パターン非依存）
  ppGenRandomClusterBlocks(n){
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    const maxSpan = Math.max(4, Math.ceil(Math.sqrt(Math.max(1,n))) + 2);
    const tries = (n<=10) ? 120 : 220;

    const makeOnce = ()=>{
      const set = new Set(["0,0"]);
      const cells = [{dx:0, dy:0}];

      const bounds = ()=>{
        let minX=999, maxX=-999, minY=999, maxY=-999;
        for(const c of cells){
          minX = Math.min(minX, c.dx); maxX = Math.max(maxX, c.dx);
          minY = Math.min(minY, c.dy); maxY = Math.max(maxY, c.dy);
        }
        return {w:(maxX-minX+1), h:(maxY-minY+1)};
      };

      while(cells.length < n){
        const base = cells[rand(0, cells.length-1)];
        const d = dirs[rand(0, dirs.length-1)];
        const nx = base.dx + d[0];
        const ny = base.dy + d[1];
        const key = nx + "," + ny;
        if(set.has(key)) continue;

        cells.push({dx:nx, dy:ny});
        const b = bounds();
        if(b.w > maxSpan || b.h > maxSpan){
          cells.pop();
          continue;
        }
        set.add(key);
      }
      return cells;
    };

    let cells = null;
    for(let t=0;t<tries;t++){
      const cand = makeOnce();
      if(cand && cand.length === n){ cells = cand; break; }
    }
    if(!cells){
      cells = Array.from({length:n}, (_,i)=>({dx:0, dy:-i}));
    }

    
// 色割り当て：同色が4つ以上つながる頻度を下げる（2～3連結は残す）
const palette = [0,1,2,3,4];
const colors = new Array(cells.length).fill(null);

const neighIdx = cells.map((a,i)=>{
  const out=[];
  for(let j=0;j<cells.length;j++){
    if(i===j) continue;
    const b=cells[j];
    if(Math.abs(a.dx-b.dx)+Math.abs(a.dy-b.dy)===1) out.push(j);
  }
  return out;
});

const compSizeWith = (i, col)=>{
  // i を col として見たときの同色連結サイズ（ピース内のみ）
  const seen=new Set([i]);
  const st=[i];
  while(st.length){
    const cur=st.pop();
    for(const nb of neighIdx[cur]){
      if(seen.has(nb)) continue;
      const c = (nb===i) ? col : colors[nb];
      if(c===col){
        seen.add(nb);
        st.push(nb);
      }
    }
  }
  return seen.size;
};

for(let i=0;i<cells.length;i++){
  const nbCols = neighIdx[i].map(j=>colors[j]).filter(v=>v!=null);
  let picked=null;
  const tryN=24;
  for(let t=0;t<tryN;t++){
    let cand;
    // 近接色に寄せて2～3連結は作るが、4以上は抑える
    if(nbCols.length && Math.random()<0.55){
      cand = nbCols[rand(0, nbCols.length-1)];
    }else{
      cand = palette[rand(0, palette.length-1)];
    }

    const sz = compSizeWith(i, cand);
    if(sz>=4){
      // “爽快感”のために極まれに許可（ただし大ピースほど抑える）
      const allow = (cells.length<=6) ? 0.08 : 0.03;
      if(Math.random()<allow){
        picked=cand; break;
      }
      continue;
    }
    picked=cand; break;
  }
  if(picked==null) picked = palette[rand(0, palette.length-1)];
  colors[i]=picked;
}

const blocks = cells.map((c,i)=>({
  dx:c.dx, dy:c.dy, c:colors[i],
  pivot:(c.dx===0 && c.dy===0)
}));
blocks.sort((a,b)=> (b.pivot?1:0) - (a.pivot?1:0));
    if(!blocks[0].pivot) blocks[0].pivot = true;

    return blocks;
  }

  ppRotVec(dx,dy,o){
    const r = ((o%4)+4)%4;
    if(r===0) return {x:dx, y:dy};
    if(r===1) return {x:-dy, y:dx};
    if(r===2) return {x:-dx, y:-dy};
    return {x:dy, y:-dx};
  }


  ppCellsOfCur(cur){
    const x=cur.x, y=cur.y;
    const o=((cur.o%4)+4)%4;

    if(cur.blocks && Array.isArray(cur.blocks)){
      const out=[];
      for(const b of cur.blocks){
        const v = this.ppRotVec(b.dx, b.dy, o);
        out.push({x:x+v.x, y:y+v.y, c:b.c, pivot:!!b.pivot});
      }
      return out;
    }

    let dx=0, dy=-1;
    if(o===0){ dx=0; dy=-1; }
    if(o===1){ dx=1; dy=0; }
    if(o===2){ dx=0; dy=1; }
    if(o===3){ dx=-1; dy=0; }
    return [
      {x:x, y:y, c:cur.a, pivot:true},
      {x:x+dx, y:y+dy, c:cur.b, pivot:false},
    ];
  }

  ppIsInside(x,y){
    const pp=this._pp;
    return x>=0 && x<pp.w && y<pp.h; // y can be negative while falling
  }

  // ぷんよぷんよ：盤面外アクセス防止（大ピース＋連鎖重力の安全策）
  ppSanitizeBoard(){
    const pp=this._pp;
    if(!pp || !pp.board) return;
    // 行数補正
    if(!Array.isArray(pp.board) || pp.board.length !== pp.h){
      const old = Array.isArray(pp.board) ? pp.board : [];
      pp.board = Array.from({length:pp.h}, (_,y)=> Array.isArray(old[y]) ? old[y].slice(0,pp.w) : Array(pp.w).fill(null));
    }
    for(let y=0;y<pp.h;y++){
      if(!Array.isArray(pp.board[y])) pp.board[y] = Array(pp.w).fill(null);
      if(pp.board[y].length !== pp.w){
        pp.board[y] = (pp.board[y]||[]).slice(0,pp.w);
        while(pp.board[y].length < pp.w) pp.board[y].push(null);
      }
      for(let x=0;x<pp.w;x++){
        if(pp.board[y][x] === undefined) pp.board[y][x] = null;
      }
    }
  }

  ppWriteCell(x,y,c){
    const pp=this._pp;
    if(!pp) return false;
    if(x<0 || x>=pp.w || y<0 || y>=pp.h){
      // ここに来るのは基本的にバグ/境界ケース。強制終了ではなくゲーム終了扱いにして落ちないようにする。
      pp.over = true;
      try{ this.msg('ぷんよぷんよ：盤面外への落下を検出したため終了しました。'); }catch(e){}
      try{ this.ppFinish(); }catch(e){}
      return false;
    }
    if(!pp.board || !pp.board[y]) this.ppSanitizeBoard();
    pp.board[y][x] = c;
    return true;
  }


  ppBlockedAt(x,y){
    const pp=this._pp;
    if(x<0 || x>=pp.w) return true;
    if(y>=pp.h) return true;
    if(y<0) return false;
    return pp.board[y][x]!=null;
  }


  ppAssistApply(){
    const pp=this._pp;
    if(!pp || pp.over || !pp.cur) return;

    // 各列の“埋まり具合”（ブロック数）を計算
    const heights = new Array(pp.w).fill(0);
    for(let x=0;x<pp.w;x++){
      let c=0;
      for(let y=0;y<pp.h;y++){
        if(pp.board[y] && pp.board[y][x]!=null) c++;
      }
      heights[x]=c;
    }

    const cols = [];
    for(const b of pp.cur.blocks || []){
      if(cols.indexOf(b.dx)===-1) cols.push(b.dx);
    }
    if(!cols.length) cols.push(0);

    // 現在のピースが置ける範囲を推定
    let minX=999, maxX=-999;
    for(const b of pp.cur.blocks || []){
      minX=Math.min(minX, b.dx);
      maxX=Math.max(maxX, b.dx);
    }
    if(!isFinite(minX)){ minX=0; maxX=0; }

    const minSpawnX = -minX;
    const maxSpawnX = (pp.w-1) - maxX;

    let bestX = pp.cur.x;
    let bestCost = Infinity;

    for(let x=minSpawnX; x<=maxSpawnX; x++){
      // 置けない位置は除外
      const test = {...pp.cur, x};
      if(!this.ppCanPlace(test)) continue;

      let cost = 0;
      for(const dx of cols){
        const cx = x + dx;
        if(cx>=0 && cx<pp.w) cost += heights[cx];
        else cost += 999;
      }
      // タイブレーク：現在位置に近い方
      const tie = Math.abs(x-pp.cur.x)*0.01;
      cost += tie;

      if(cost < bestCost){
        bestCost = cost;
        bestX = x;
      }
    }

    pp.cur.x = bestX;
  }

  ppCanPlace(cur){
    const pp=this._pp;
    for(const p of this.ppCellsOfCur(cur)){
      if(this.ppBlockedAt(p.x,p.y)) return false;
    }
    return true;
  }

  spawnPunyopunyo(){
    const pp=this._pp;
    const spec = pp.nextSpec || this.ppGenPieceSpec(pp.maxN);
    pp.nextSpec = this.ppGenPieceSpec(pp.maxN);
    pp.next = pp.nextSpec.previewColors;

    const blocks = spec.blocks || [];
    let minX=999, maxX=-999, minY=999, maxY=-999;
    for(const b of blocks){
      minX=Math.min(minX, b.dx); maxX=Math.max(maxX, b.dx);
      minY=Math.min(minY, b.dy); maxY=Math.max(maxY, b.dy);
    }
    if(!isFinite(minX)){ minX=0; maxX=0; minY=0; maxY=0; }

    const minSpawnX = -minX;
    const maxSpawnX = (pp.w-1) - maxX;

    let sx = Math.floor(pp.w/2);
    sx = clamp(sx, minSpawnX, maxSpawnX);
    sx = clamp(sx + rand(-1,1), minSpawnX, maxSpawnX);

    const sy = -minY;

    const cur={x:sx, y:sy, o:0, blocks: blocks};
    if(!this.ppCanPlace(cur)){
      pp.over=true;
      this.ppFinish();
      return;
    }
    pp.cur=cur;
    // Assist: 少ない列へ自動で寄せる
    try{ if(pp.assist) this.ppAssistApply(); }catch(e){}
  }

  openPunyopunyoPlay(){
    const pp=this._pp;
    if(!pp) return;

    const close = ()=>{ const ol=$("#townOL"); if(ol) ol.style.display='none'; };
    const show = ()=>{ const ol=$("#townOL"); if(ol) ol.style.display='flex'; };
    const set = (title,sub)=>{ const t=$("#townTitle"); if(t) t.textContent=title; const s=$("#townSub")||$("#townDesc"); if(s) s.textContent=sub||''; };

    const gold = num(this.p.gold,0);
    const betRaw = num(pp.bet,0);
    const betDisp = (betRaw===0) ? 10 : betRaw;

    set("ぷんよぷんよ", `SCORE ${pp.score} / 連鎖 ${pp.chain} / 賭け金 ${betDisp}G`);

    $("#townTabs").innerHTML='';
    $("#townList").innerHTML = `
      <div class="ppWrap">
        <div class="ppHud" id="ppHud">
          <div class="ppHudRow">
            <div>Score: <b id="ppScore">${pp.score}</b></div>
            <div>Chain: <b id="ppChain">${pp.chain}</b></div>
          </div>
          <div class="ppHudRow dim">
            <div>High: <b id="ppHigh">${this.getPunyopunyoHighScore()}</b></div>
            <button class="ppMiniBtn" id="ppScoreBookBtn">スコア一覧</button>
            <div>Gold: <b id="ppGold">${gold}</b>G</div>
          </div>
          <div class="ppHudRow dim">
            <div id="ppStatus"></div>
          </div>
        </div>
        <canvas id="ppCanvas" class="ppCanvas"></canvas>
      </div>
    `;

    const sbBtn = $("#ppScoreBookBtn");
    if(sbBtn) bindTap(sbBtn, ()=>this.ppOpenScoreBookWindow());

    // controls（iPhoneで押しやすい大きさ＆間隔にする）
    const actions=$("#townActions");
    if(actions) actions.innerHTML='';

    const ctrl=document.createElement('div');
    ctrl.className='ppCtrlWrap';
    if(actions) actions.appendChild(ctrl);

    
    
// 1行目：回転＆ソフトドロップ（長押し）
const row1=document.createElement('div'); row1.className='ppCtrlRow';
ctrl.appendChild(row1);
const mkRow=(row,label,fn,cls='')=>{
  const b=document.createElement('div');
  b.className=('ppBtn '+cls).trim();
  b.textContent=label;
  bindTap(b, ()=>fn());
  row.appendChild(b);
  return b;
};
mkRow(row1,'⟲', ()=>this.ppRotate(-1),'ppWide');
const downBtn=document.createElement('div');
downBtn.className='ppBtn ppWide';
downBtn.textContent='↓(長押し)';
downBtn.addEventListener('pointerdown', (e)=>{ e.preventDefault(); this.ppSoft(true); }, {passive:false});
downBtn.addEventListener('pointerup',   (e)=>{ e.preventDefault(); this.ppSoft(false); }, {passive:false});
downBtn.addEventListener('pointercancel',(e)=>{ e.preventDefault(); this.ppSoft(false); }, {passive:false});
row1.appendChild(downBtn);
mkRow(row1,'⟳', ()=>this.ppRotate(1),'ppWide');

// 2行目：左右＆ハードドロップ（重要なので下段中央）
const row2=document.createElement('div'); row2.className='ppCtrlRow';
ctrl.appendChild(row2);
mkRow(row2,'←', ()=>this.ppMove(-1),'ppWide ppEmph');
mkRow(row2,'DROP', ()=>this.ppHardDrop(),'ppWide ppEmph ppDrop');
mkRow(row2,'→', ()=>this.ppMove(1),'ppWide ppEmph');

// アシスト（少ない列へ寄せる）
    const rowA=document.createElement('div'); rowA.className='ppCtrlRow';
    ctrl.appendChild(rowA);
    const assistBtn = mkRow(rowA, (pp.assist?'アシストON':'アシストOFF'), ()=>{
      pp.assist = !pp.assist;
      this._ppAssist = pp.assist;
      assistBtn.textContent = (pp.assist?'アシストON':'アシストOFF');
    },'ppWide');
// 3行目：終了系（誤タップ防止で幅広）
    const row3=document.createElement('div'); row3.className='ppCtrlRow';
    ctrl.appendChild(row3);
    mkRow(row3,'やめる', ()=>{ this.ppFinish(true); },'ppWide');
// resize canvas
    this.ppResizeCanvas();


    // keep it fit on screen even on rotate / address bar changes
    if(!pp._resizeBound){
      pp._onResize = ()=>{ try{ this.ppResizeCanvas(); this.ppDraw(); }catch(e){} };
      window.addEventListener('resize', pp._onResize, {passive:true});
      window.addEventListener('orientationchange', pp._onResize, {passive:true});
      pp._resizeBound = true;
    }

    // start loop
    pp.lastTs = 0;
    const loop = (ts)=>{
      if(!this._pp || this._pp!==pp) return;
      if(pp.over) return; // stop
      this.ppStep(ts);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    show();
    this.ppDraw();
  }

  ppResizeCanvas(){
    const pp=this._pp; if(!pp) return;
    const cv=$("#ppCanvas"); if(!cv) return;

    // Always fit on a single screen (iPhone Safari etc.)
    // Compute available height by subtracting HUD + controls area (townActions).
    const pad = 14;
    const modalMaxW = Math.min(window.innerWidth, 520);
    const wAvail = Math.max(200, modalMaxW - pad*2);

    let usedH = 0;
    try{
      const hud = $("#ppHud");
      const actions = $("#townActions");
      if(hud) usedH += hud.getBoundingClientRect().height;
      if(actions) usedH += actions.getBoundingClientRect().height;
    }catch(e){}
    // extra margins (overlay padding / gaps / safe areas)
    usedH += 70;

    const hAvail = Math.max(160, Math.floor(window.innerHeight - usedH));

    const cellByW = Math.floor(wAvail / pp.w);
    const cellByH = Math.floor(hAvail / pp.h);

    // clamp: keep playable but compact
    const cell = Math.max(10, Math.min(34, Math.min(cellByW, cellByH)));
    pp.cell = cell;

    const cssW = cell*pp.w;
    const cssH = cell*pp.h;
    const dpr = window.devicePixelRatio || 1;

    cv.style.width = cssW+'px';
    cv.style.height = cssH+'px';
    cv.width = Math.floor(cssW*dpr);
    cv.height = Math.floor(cssH*dpr);
    pp.dpr = dpr;
  }


  

  ppCleanup(){
    const pp=this._pp;
    if(pp && pp._resizeBound && pp._onResize){
      try{ window.removeEventListener('resize', pp._onResize); }catch(e){}
      try{ window.removeEventListener('orientationchange', pp._onResize); }catch(e){}
      pp._resizeBound = false;
      pp._onResize = null;
    }
  }

ppDrawMaybe(ts, force=false){
  const pp=this._pp; if(!pp) return;
  if(!pp._drawMin) pp._drawMin = 33; // about 30fps
  if(!pp._lastDraw) pp._lastDraw = 0;
  const now = (ts!=null) ? ts : (performance && performance.now ? performance.now() : Date.now());
  if(force || (now - pp._lastDraw >= pp._drawMin)){
    pp._lastDraw = now;
    this.ppDraw();
  }
}

ppStep(ts){
    const pp=this._pp; if(!pp || pp.over) return;

    if(!pp.lastTs) pp.lastTs = ts;
    const dt = ts - pp.lastTs;
    pp.lastTs = ts;

    this.ppFxStep(dt);

    if(pp.anim){
      this.ppAnimStep(dt);
      this.ppDrawMaybe(ts);
      return;
    }

    if(pp.resolving) { this.ppDrawMaybe(ts); return; }

    pp.acc += dt;
    const fall = pp.soft ? 55 : pp.fallMs;
    while(pp.acc >= fall){
      pp.acc -= fall;
      if(!this.ppMoveDown()){
        this.ppLock();
        return;
      }
    }
    this.ppDrawMaybe(ts);
  }

  ppFxStep(dt){
    const pp=this._pp; if(!pp) return;
    const fx=pp.fx || (pp.fx={particles:[], chainBanner:null, flash:0, shake:0, rings:[]});

    if(fx.flash>0) fx.flash = Math.max(0, fx.flash - dt/260);
    if(fx.shake>0) fx.shake = Math.max(0, fx.shake - dt/220);

    if(fx.chainBanner){
      fx.chainBanner.t += dt;
      if(fx.chainBanner.t > fx.chainBanner.dur){
        fx.chainBanner = null;
      }
    }

    if(fx.rings && fx.rings.length){
      for(const r of fx.rings){
        r.t += dt;
        const k = r.t / r.dur;
        r.a = Math.max(0, (r.a0 ?? 1) * (1 - k));
      }
      fx.rings = fx.rings.filter(r=>r.t < r.dur && (r.a ?? 0)>0.01);
    }

    if(fx.particles && fx.particles.length){
      for(const p of fx.particles){
        p.t += dt;
        const k = p.t / p.dur;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.g * dt;
        p.a = Math.max(0, 1 - k);
      }
      fx.particles = fx.particles.filter(p=>p.t < p.dur && p.a>0.01);
    }
  }
ppTriggerClearFx(cells, chain){
  const pp=this._pp; if(!pp) return;
  const fx=pp.fx || (pp.fx={particles:[], chainBanner:null, flash:0, shake:0, rings:[]});
  const cell=pp.cell||32;

  // big, juicy feedback
  fx.flash = Math.min(1, fx.flash + 0.55 + 0.15*Math.min(8, chain));
  fx.shake = Math.min(1, fx.shake + 0.40 + 0.12*Math.min(8, chain));

  // Center of the clear (for rings / shockwave)
  let cxm=0, cym=0;
  for(const c of cells){
    cxm += (c.x + 0.5) * cell;
    cym += (c.y + 0.5) * cell;
  }
  if(cells.length){
    cxm /= cells.length;
    cym /= cells.length;
  }else{
    cxm = (pp.w*cell)/2;
    cym = (pp.h*cell)/2;
  }

  // Expanding glow rings (clear + chain)
  fx.rings = fx.rings || [];
  fx.rings.push({
    x: cxm, y: cym,
    r0: cell*0.2,
    r1: cell*(2.8 + Math.min(7, chain)*0.35),
    t: 0,
    dur: 520 + Math.min(7, chain)*120,
    a0: 0.85
  });

  if(chain>=2){
    // chain banner (bigger & longer)
    fx.chainBanner = { chain, t:0, dur: 1100 + Math.min(6, chain)*120 };
    // extra ring
    fx.rings.push({
      x: cxm, y: cym,
      r0: cell*0.3,
      r1: cell*(3.4 + Math.min(7, chain)*0.55),
      t: 0,
      dur: 720 + Math.min(7, chain)*160,
      a0: 0.95
    });
  }

  // Particle burst: more, larger, faster (chain amplifies)
  const maxParticles = 1200;
  if(fx.particles.length > maxParticles) fx.particles = fx.particles.slice(-maxParticles);
  const baseN = Math.min(12, 6 + Math.floor(cells.length/3.2));
  const chainBoost = 1 + 0.22*Math.min(8, chain);
  for(const c of cells){
    const cx = (c.x + 0.5) * cell;
    const cy = (c.y + 0.5) * cell;

    const n = Math.floor(baseN * (0.8 + Math.random()*0.45));
    for(let i=0;i<n;i++){
      const ang = Math.random()*Math.PI*2;
      const sp = (0.10 + Math.random()*1.0) * chainBoost;
      if(fx.particles.length >= maxParticles) break;
      fx.particles.push({
        x:cx, y:cy,
        vx:Math.cos(ang)*sp,
        vy:Math.sin(ang)*sp - (0.08 + Math.random()*0.10),
        g:0.00052,
        r:(3 + Math.random()*7) * (chain>=2?1.18:1.0),
        c:c.c,
        t:0,
        dur: 520 + Math.random()*420 + Math.min(7,chain)*60,
        a:1
      });
    }

    // sparkle streaks (few)
    const sN = 2 + Math.floor(Math.random()*3) + Math.floor(Math.min(6,chain)/2);
    for(let k=0;k<sN;k++){
      const ang = Math.random()*Math.PI*2;
      const sp = (0.22 + Math.random()*0.38) * chainBoost;
      if(fx.particles.length >= maxParticles) break;
      fx.particles.push({
        x:cx, y:cy,
        vx:Math.cos(ang)*sp,
        vy:Math.sin(ang)*sp - 0.10,
        g:0.00035,
        r:1.5 + Math.random()*2.5,
        c:c.c,
        t:0,
        dur: 420 + Math.random()*260,
        a:1
      });
    }
  }
}


  ppAnimStep(dt){
    const pp=this._pp; if(!pp || !pp.anim) return;
    const a=pp.anim;
    a.t += dt;
    if(a.t >= a.dur){
      if(a.type==='gravity'){
        pp.board = a.boardTo;
        this.ppSanitizeBoard();
      }
      pp.anim = null;
      if(pp.animResolve){
        const r = pp.animResolve; pp.animResolve=null;
        try{ r(); }catch(e){}
      }
    }
  }


  ppAnimateGravity(){
    const pp=this._pp; if(!pp) return Promise.resolve();
    // gravity animation: avoid overlap by drawing a "base board" where moved cells are cleared
    const from = pp.board.map(row=>row.slice());

    const to = Array.from({length:pp.h}, ()=>Array(pp.w).fill(null));
    const base = from.map(row=>row.slice());
    let moved = [];

    for(let x=0;x<pp.w;x++){
      let write=pp.h-1;
      for(let y=pp.h-1;y>=0;y--){
        const v = from[y][x];
        if(v==null) continue;
        to[write][x] = v;
        if(write!==y){
          moved.push({x, y0:y, y1:write, c:v});
          // clear original so we don't draw duplicate while animating
          base[y][x] = null;
        }
        write--;
      }
    }

    // no movement -> just apply board and continue
    if(!moved.length){
      pp.board = to;
      this.ppSanitizeBoard();
      return Promise.resolve();
    }

    // during animation, keep board as "base" (holes at origins) and draw moved pieces interpolated
    pp.board = base;
    this.ppSanitizeBoard();

    return new Promise((resolve)=>{
      pp.anim = {
        type:'gravity',
        t:0,
        dur: Math.max(140, Math.min(420, 140 + moved.length*10)),
        moved,
        boardTo: to
      };
      pp.animResolve = resolve;
    });
  }


  ppMove(dx){
    const pp=this._pp; if(!pp || pp.over || pp.resolving) return;
    const cur={...pp.cur, x:pp.cur.x+dx};
    if(this.ppCanPlace(cur)){
      pp.cur=cur;
      this.ppDraw();
    }
  }

  ppRotate(dir){
    const pp=this._pp; if(!pp || pp.over || pp.resolving) return;
    let o = pp.cur.o + (dir<0?-1:1);
    const cand={...pp.cur, o};
    if(this.ppCanPlace(cand)){
      pp.cur=cand; this.ppDraw(); return;
    }
    // wall kick small
    const cand2={...cand, x:cand.x+1};
    if(this.ppCanPlace(cand2)){ pp.cur=cand2; this.ppDraw(); return; }
    const cand3={...cand, x:cand.x-1};
    if(this.ppCanPlace(cand3)){ pp.cur=cand3; this.ppDraw(); return; }
  }

  ppSoft(on){
    const pp=this._pp; if(!pp || pp.over) return;
    pp.soft = !!on;
  }

  ppHardDrop(){
    const pp=this._pp; if(!pp || pp.over || pp.resolving) return;
    while(this.ppMoveDown()){}
    this.ppLock();
  }

  ppMoveDown(){
    const pp=this._pp;
    const cand={...pp.cur, y:pp.cur.y+1};
    if(this.ppCanPlace(cand)){ pp.cur=cand; return true; }
    return false;
  }

  ppLock(){
    const pp=this._pp; if(!pp || pp.over) return;
    const cells=this.ppCellsOfCur(pp.cur);
    for(const p of cells){
      if(p.y<0){ pp.over=true; this.ppFinish(); return; }
      // 安全策：盤面外へ書き込もうとしたら落とさずに終了扱い
      if(!this.ppWriteCell(p.x, p.y, p.c)) return;
    }
    this.ppSanitizeBoard();
    pp.cur=null;
    pp.resolving=true;
    pp.chain=0;
    this.ppResolveAsync();
  }
async ppResolveAsync(){
  const pp=this._pp; if(!pp) return;
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  try{
    // First settle after locking (smooth)
    await this.ppAnimateGravity();

    while(true){
      const cleared = this.ppClearGroups();
      if(cleared.count<=0) break;

      pp.chain += 1;

      // score
      const add = this.ppScoreAdd((cleared.normalCount!=null?cleared.normalCount:cleared.count), pp.chain);
      pp.score = num(pp.score,0) + add;

      // clear cells
      for(const c of cleared.cells){
        if(c.y>=0 && c.y<pp.h && c.x>=0 && c.x<pp.w){
          pp.board[c.y][c.x] = null;
        }
      }
      this.ppSanitizeBoard();

      // FX (bigger)
      this.ppTriggerClearFx(cleared.cells, pp.chain);

      // tiny pause, then gravity (smooth) -> this is the "extra gravity after clear"
      await sleep(80);
      await this.ppAnimateGravity();
    }
  }catch(e){
    // Safari sometimes prints {} for Error; prefer message+stack
    try{
      const msg = (e && (e.stack || e.message)) ? (e.stack || e.message) : String(e);
      console.error("ppResolveAsync error:", msg);
    }catch(_){}
  }finally{
    pp.resolving=false;
  }

  // spawn next if still playable
  if(pp.over) return;
  if(!pp.cur){
    this.spawnPunyopunyo();
  }
  this.ppDraw();
}



  ppApplyGravity(){
    const pp=this._pp;
    for(let x=0;x<pp.w;x++){
      let write=pp.h-1;
      for(let y=pp.h-1;y>=0;y--){
        const v=pp.board[y][x];
        if(v!=null){
          if(write!==y){
            pp.board[write][x]=v;
            pp.board[y][x]=null;
          }
          write--;
        }
      }
    }
  }
  ppClearGroups(){
    const pp=this._pp;
    const vis=Array.from({length:pp.h}, ()=>Array(pp.w).fill(false));
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    const normalClear=[];
    const seenNormal=new Set();

    for(let y=0;y<pp.h;y++){
      for(let x=0;x<pp.w;x++){
        if(vis[y][x]) continue;
        const v=pp.board[y][x];
        if(v==null) continue;
        if(v===Game.PP_OJAMA) { vis[y][x]=true; continue; } // おじゃまは連結消し対象外
        vis[y][x]=true;
        const comp=[[x,y]];
        const q=[[x,y]];
        while(q.length){
          const [cx,cy]=q.pop();
          for(const [dx,dy] of dirs){
            const nx=cx+dx, ny=cy+dy;
            if(nx<0||nx>=pp.w||ny<0||ny>=pp.h) continue;
            if(vis[ny][nx]) continue;
            if(pp.board[ny][nx]===v){
              vis[ny][nx]=true;
              q.push([nx,ny]);
              comp.push([nx,ny]);
            }
          }
        }
        if(comp.length>=4){
          for(const p of comp){
            const k=p[0]+","+p[1];
            if(seenNormal.has(k)) continue;
            seenNormal.add(k);
            normalClear.push({x:p[0],y:p[1]});
          }
        }
      }
    }

    if(normalClear.length<=0) return {count:0, normalCount:0, cells:[]};

    // おじゃまは「消えた通常ぷんよに隣接している分だけ」一緒に消える
    const ojamaClear=[];
    const seenOj=new Set();
    for(const p of normalClear){
      for(const [dx,dy] of dirs){
        const nx=p.x+dx, ny=p.y+dy;
        if(nx<0||nx>=pp.w||ny<0||ny>=pp.h) continue;
        if(pp.board[ny][nx]===Game.PP_OJAMA){
          const k=nx+","+ny;
          if(seenOj.has(k)) continue;
          seenOj.add(k);
          ojamaClear.push({x:nx,y:ny});
        }
      }
    }

    const toClear = normalClear.concat(ojamaClear);

    for(const p of toClear){
      pp.board[p.y][p.x]=null;
    }
    return {count:toClear.length, normalCount:normalClear.length, cells:toClear};
  }

  ppScoreAdd(cleared, chain){
    const base = cleared * 10;
    // 連鎖が強いほど伸びが良い（やりすぎない範囲で）
    const mult = 1 + (chain-1)*0.75;
    const add = Math.floor(base * mult * chain);
    return Math.max(0, add);
  }

  ppFinish(forceQuit=false){
    const pp=this._pp; if(!pp) return;
    if(pp.paid) return;
    // 精算：forceQuit でもスコアに応じて支払う（途中終了もOK）
    const betRaw = num(pp.bet,0);
    const loanBet = num(pp.loanBet,0);
    const virtBet = (loanBet>0) ? loanBet : betRaw;

    const mul = this.ppCalcMultiplier(pp.score);
    const reward = (pp.score<=0) ? 0 : Math.floor(virtBet * mul);

    // スコア記録（設定別・ローカル＋セーブコード対象）
    this.ppRecordPunyopunyoScore(pp, mul, reward, forceQuit);

    if(loanBet>0){
      // 0G特別（借り賭け）：差額だけ反映（負けは0で止める）
      const delta = reward - virtBet;
      this.p.gold = Math.max(0, num(this.p.gold,0) + delta);
    }else{
      // 通常：開始時に賭け金を支払い済みなので、払い戻し額(reward)を加算
      this.p.gold = num(this.p.gold,0) + reward;
    }
    this.afterGoldChange();

    // high score save
    const hs = this.getPunyopunyoHighScore();
    if(pp.score>hs){
      this.setPunyopunyoHighScore(pp.score);
    }

    pp.paid=true;
    pp.over=true;

    const hs2 = this.getPunyopunyoHighScore();
    const status = $("#ppStatus");
    if(status){
      status.innerHTML = `<span class="dim">倍率</span> <b>${mul.toFixed(2)}</b> / <span class="dim">報酬</span> <b>${reward}</b>G`;
    }
    $("#ppGold") && ($("#ppGold").textContent = num(this.p.gold,0));

    // show result and buttons
    { const s=$("#townSub")||$("#townDesc"); if(s) s.textContent = `SCORE ${pp.score} / HIGH ${hs2} / 報酬 ${reward}G`; }

    // replace actions with post buttons
    $("#townActions").innerHTML='';
    const addBtn=(label,fn)=>{
      const b=document.createElement('button');
      b.className='btn';
      b.textContent=label;
      b.onclick=()=>fn();
      $("#townActions").appendChild(b);
      return b;
    };

    addBtn('もう一回（同額）', ()=>{
      const goldNow = num(this.p.gold,0);
      let nextBet = betRaw;
      if(goldNow<=0) nextBet = 0;
      if(nextBet===-1) nextBet = goldNow;
      if(nextBet>goldNow && goldNow>0) nextBet = goldNow;
      this.startPunyopunyo({bet: nextBet, sizeKey: pp.sizeKey, maxN: pp.maxN, assist: pp.assist});
    });
    addBtn('続ける（全額）', ()=>{
      const goldNow = num(this.p.gold,0);
      if(goldNow<=0){
        this.startPunyopunyo({bet:0, sizeKey: pp.sizeKey, maxN: pp.maxN, assist: pp.assist, sizeKey: pp.sizeKey, maxN: pp.maxN, assist: pp.assist});
      }else{
        this.startPunyopunyo({bet: goldNow});
      }
    });
    addBtn('賭け金変更', ()=>{ this.ppCleanup(); this._pp=null; this.openPunyopunyoSetup(); });
    addBtn('戻る', ()=>{ this.ppCleanup(); this._pp=null; this.openTownNpcMenu(this.mons.find(m=>m.ai==='town' && m.role==='casino') || {role:'casino',name:'カジノ係'}); });
  }

  ppDraw(){
    const pp=this._pp; if(!pp) return;
    const cv=$("#ppCanvas"); if(!cv) return;
    const ctx=cv.getContext('2d');
    const dpr=pp.dpr||1;
    const cell=pp.cell||32;
    ctx.save();
    ctx.scale(dpr,dpr);

    const W=cell*pp.w, H=cell*pp.h;

    // screen shake
    const fx=pp.fx||{};
    if(fx.shake>0){
      const mag = (cell*0.10) * fx.shake;
      const sx = (Math.random()*2-1)*mag;
      const sy = (Math.random()*2-1)*mag;
      ctx.translate(sx,sy);
    }

    // background
    ctx.clearRect(0,0,W,H);
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'rgba(20,24,32,0.72)');
    bg.addColorStop(1,'rgba(8,10,14,0.86)');
    ctx.fillStyle=bg;
    ctx.fillRect(0,0,W,H);

    // grid subtle
    ctx.strokeStyle='rgba(120,227,255,0.06)';
    ctx.lineWidth=1;
    for(let x=0;x<=pp.w;x++){
      ctx.beginPath(); ctx.moveTo(x*cell+0.5,0); ctx.lineTo(x*cell+0.5,H); ctx.stroke();
    }
    for(let y=0;y<=pp.h;y++){
      ctx.beginPath(); ctx.moveTo(0,y*cell+0.5); ctx.lineTo(W,y*cell+0.5); ctx.stroke();
    }

    // rings / shockwaves (behind pieces)
if(fx && fx.rings && fx.rings.length){
  for(const r of fx.rings){
    const t = clamp(r.t / r.dur, 0, 1);
    const ease = 1 - Math.pow(1-t, 2);
    const rad = (r.r0 || 0) + ((r.r1 || 0) - (r.r0 || 0)) * ease;
    const a = Math.max(0, (r.a ?? 0.8) * (1 - t));
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, rad);
    g.addColorStop(0,'rgba(255,255,255,0.0)');
    g.addColorStop(0.35,'rgba(255,255,255,0.18)');
    g.addColorStop(0.65,'rgba(120,240,255,0.16)');
    g.addColorStop(1,'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(r.x, r.y, rad, 0, Math.PI*2);
    ctx.fill();
    // thin rim
    ctx.strokeStyle='rgba(255,255,255,0.22)';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, Math.max(0, rad*0.98), 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}

const palette=[
      ['rgba(255,90,120,1)','rgba(255,190,205,0.9)'],  // red/pink
      ['rgba(90,210,255,1)','rgba(190,245,255,0.9)'],  // cyan
      ['rgba(120,255,170,1)','rgba(210,255,235,0.9)'], // green
      ['rgba(255,220,110,1)','rgba(255,245,205,0.92)'],// yellow
      ['rgba(175,120,255,1)','rgba(230,210,255,0.92)'],// purple
    ];


    const colors = palette.map(p=>p[0]);

    const drawP=(x,y,c,ghost=false)=>{
      const px=x*cell, py=y*cell;
      const r=cell*0.42;
      const cx=px+cell/2, cy=py+cell/2;
      if(c===Game.PP_OJAMA){
        // おじゃま：灰色＋×（隣接消しでのみ消える）
        ctx.save();
        ctx.globalAlpha = ghost ? 0.35 : 1.0;

        const grad=ctx.createRadialGradient(cx-r*0.25, cy-r*0.35, r*0.2, cx, cy, r);
        grad.addColorStop(0,'rgba(245,245,255,0.95)');
        grad.addColorStop(0.35,'rgba(190,190,205,0.95)');
        grad.addColorStop(1,'rgba(80,80,95,1)');
        ctx.fillStyle=grad;
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();

        ctx.strokeStyle='rgba(0,0,0,0.65)';
        ctx.lineWidth=Math.max(1, cell*0.08);
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();

        // ×
        ctx.strokeStyle='rgba(20,20,24,0.85)';
        ctx.lineWidth=Math.max(1, cell*0.07);
        const s=r*0.55;
        ctx.beginPath();
        ctx.moveTo(cx-s, cy-s); ctx.lineTo(cx+s, cy+s);
        ctx.moveTo(cx+s, cy-s); ctx.lineTo(cx-s, cy+s);
        ctx.stroke();

        ctx.restore();
        return;
      }

      const [base,hi]=palette[c%palette.length];
      const grad=ctx.createRadialGradient(cx-r*0.35, cy-r*0.35, r*0.15, cx, cy, r*1.15);
      grad.addColorStop(0, hi);
      grad.addColorStop(0.35, base);
      grad.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle=grad;
      ctx.globalAlpha = ghost?0.85:1.0;
      ctx.beginPath();
      ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.fill();
      // glossy highlight
      const g2=ctx.createRadialGradient(cx-r*0.35, cy-r*0.45, 0, cx-r*0.35, cy-r*0.45, r*0.95);
      g2.addColorStop(0,'rgba(255,255,255,0.65)');
      g2.addColorStop(0.35,'rgba(255,255,255,0.16)');
      g2.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g2;
      ctx.beginPath();
      ctx.arc(cx-r*0.15, cy-r*0.25, r*0.9, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha=1;
      // outline
      ctx.strokeStyle='rgba(0,0,0,0.35)';
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.stroke();
    };

    // draw settled
    if(pp.anim && pp.anim.type==='gravity'){
      const a=pp.anim;
      const t = clamp(a.t / a.dur, 0, 1);
      const boardStatic = (a.boardStatic && Array.isArray(a.boardStatic) && a.boardStatic.length===pp.h) ? a.boardStatic : pp.board;
      for(let y=0;y<pp.h;y++){
        const row = boardStatic[y];
        if(!row) continue;
        for(let x=0;x<pp.w;x++){
          const v=row[x];
          if(v!=null) drawP(x,y,v);
        }
      }
      const movers = a.moved || a.items || [];
      for(const it of movers){
        if(!it) continue;
        const yy = it.y0 + (it.y1 - it.y0) * t;
        drawP(it.x, yy, it.c, true);
      }
    }else{
      for(let y=0;y<pp.h;y++){
        for(let x=0;x<pp.w;x++){
          const v=pp.board[y][x];
          if(v!=null) drawP(x,y,v);
        }
      }
    }
    // draw current (smooth falling)
    if(pp.cur){
      const fall = pp.soft ? 55 : pp.fallMs;
      const frac = fall>0 ? clamp(pp.acc / fall, 0, 0.95) : 0;
      for(const p of this.ppCellsOfCur(pp.cur)){
        const yy = p.y + frac;
        if(yy>=0) drawP(p.x, yy, p.c, true, true);
      }
    }

    
    // particles & chain banner & flash overlay
    if(fx && fx.particles && fx.particles.length){
      for(const p of fx.particles){
        const col = colors[p.c] || 'rgba(255,255,255,0.9)';
        ctx.globalAlpha = 0.85 * (p.a ?? 1);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if(fx && fx.chainBanner){
  const t = fx.chainBanner.t / fx.chainBanner.dur;
  const a = Math.max(0, 1 - t);
  const bump = Math.sin(Math.min(1,t)*Math.PI);
  const scale = 1.35 + 0.55*bump;
  const rot = (Math.sin(t*8*Math.PI))*0.03;
  const chain = fx.chainBanner.chain;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W/2, H*1.0);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.textAlign='center';
  ctx.textBaseline='middle';

  const fs = Math.floor(cell*1.45);
  ctx.font = '900 ' + fs + 'px system-ui, -apple-system, sans-serif';

  // neon glow outline
  ctx.lineJoin='round';
  ctx.lineWidth = Math.max(5, Math.floor(cell*0.22));
  ctx.shadowColor='rgba(0,0,0,0.65)';
  ctx.shadowBlur=22;

  // color cycles by chain
  const hue = (190 + chain*36) % 360;
  ctx.strokeStyle = 'hsla(' + hue + ', 95%, 62%, 0.95)';
  ctx.strokeText(chain + ' 連鎖!!', 0, 0);

  // inner bright stroke
  ctx.lineWidth = Math.max(2, Math.floor(cell*0.10));
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeText(chain + ' 連鎖!!', 0, 0);

  // fill gradient
  const g = ctx.createLinearGradient(-cell*4, -cell, cell*4, cell);
  g.addColorStop(0, 'rgba(255,255,255,0.98)');
  g.addColorStop(0.55, 'hsla(' + hue + ', 100%, 85%, 0.98)');
  g.addColorStop(1, 'rgba(255,255,255,0.98)');
  ctx.fillStyle = g;
  ctx.shadowBlur=0;
  ctx.fillText(chain + ' 連鎖!!', 0, 0);

  // small subtext
  ctx.globalAlpha = a * 0.85;
  ctx.font = '800 ' + Math.floor(cell*0.72) + 'px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('CHAIN BONUS!', 0, Math.floor(cell*1.05));

  ctx.restore();
}

    if(fx && fx.flash>0){
      ctx.save();
      ctx.globalAlpha = 0.22 * fx.flash;
      const g=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*0.65);
      g.addColorStop(0,'rgba(255,255,255,0.75)');
      g.addColorStop(0.45,'rgba(255,255,255,0.22)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g;
      ctx.fillRect(0,0,W,H);
      ctx.restore();
    }

    ctx.restore();

    // hud update
    const s=$("#ppScore"); if(s) s.textContent = pp.score;
    const c=$("#ppChain"); if(c) c.textContent = pp.chain;
    const sub = $("#townSub")||$("#townDesc");
    if(sub){
      const gold2=num(this.p.gold,0);
      const betRaw=num(pp.bet,0);
      const loanBet=num(pp.loanBet,0);
      const betDisp=(loanBet>0)?loanBet:betRaw;
      sub.textContent = `SCORE ${pp.score} / 連鎖 ${pp.chain} / 賭け金 ${betDisp}G`;
    }
  }


  d2Room(r){ const cx=r.x+~~(r.w/2), cy=r.y+~~(r.h/2); const dx=this.p.x-cx, dy=this.p.y-cy; return dx*dx+dy*dy; }


  msCalcMultiplier(w,h,bombs){
    const cells = w*h;
    const density = bombs / Math.max(1, cells);
    const ratio = bombs / Math.max(1, (cells - bombs));
    let mult = 1.55 + ratio * (cells/36) * 2.0;
    // densityが極端に低いと旨味が出ないので少し底上げ
    mult += Math.max(0, (density - 0.08)) * (cells/36) * 3.0;
    mult = Math.min(8.0, Math.max(1.55, mult));
    return mult;
  }

  openMinesweeperSetup(){
    const ol = $("#townOL");
    $("#townTitle").textContent = "マインスイーパー";
    $("#townDesc").textContent = "ゴールドで遊びます（0GでもOK：賭け金10G扱い）。サイズと爆弾数で難易度が変わり、クリア報酬は賭け金×倍率です。";
    $("#townTabs").innerHTML = '';
    $("#townList").innerHTML = '';
    $("#townActions").innerHTML = '';

    const gold = num(this.p.gold, 0);
    const ZERO_G_SPECIAL_BET = 10;

    if(!this._msSetup) this._msSetup = {};

    // 前回の賭け金を維持（0Gのときは「10G扱い」で開始できる）
    if(gold > 0){
      const prev = (this._msLastBet != null) ? this._msLastBet : gold;
      const cur = (this._msSetup.bet != null) ? num(this._msSetup.bet, prev) : prev;
      this._msSetup.bet = Math.min(Math.max(1, cur), gold);
    }else{
      // 0G時は賭け金選択を省略し、開始時に10G扱いにする（bet=0を特殊扱い）
      this._msSetup.bet = 0;
    }
    const sizes = [
      {w:6,h:6,label:'小(6×6)'},
      {w:8,h:8,label:'中(8×8)'},
      {w:10,h:10,label:'大(10×10)'},
      {w:12,h:12,label:'特大(12×12)'},
    ];

    const betBase = [10, 20, 50, 100, 200, 500, 1000];
    let betOpts = [];
    if(gold > 0){
      betOpts = betBase.filter(v=>v<=gold);
      if(!betOpts.length) betOpts = [Math.max(1, gold)];
    }

    const makeBombOpts = (w,h)=>{
      const cells = w*h;
      const a = Math.max(4, Math.floor(cells*0.12));
      const b = Math.max(6, Math.floor(cells*0.18));
      const c = Math.max(8, Math.floor(cells*0.25));
      // 一意にして昇順
      return [...new Set([a,b,c])].sort((x,y)=>x-y);
    };

    const render = ()=>{
      $("#townList").innerHTML = '';
      const head = document.createElement('div'); head.className='item';
      const bet = this._msSetup.bet || 0;
      const displayBet = (gold <= 0 && bet <= 0) ? ZERO_G_SPECIAL_BET : bet;
      const sz = sizes[this._msSetup.sizeIdx ?? -1];
      const bombs = this._msSetup.bombs || 0;
      let multTxt='-'; let payoutTxt='-';
      if(displayBet>0 && sz && bombs>0){
        const mult=this.msCalcMultiplier(sz.w,sz.h,bombs);
        multTxt = mult.toFixed(2);
        payoutTxt = Math.floor(displayBet*mult) + 'G';
      }
      head.innerHTML = `<div>設定</div><div class="dim">所持金:${gold}G　賭け金:${displayBet}G${(gold<=0 && bet<=0)?'（10G扱い）':''}　サイズ:${sz?sz.label:'未選択'}　爆弾:${bombs?bombs:'未選択'}　倍率:${multTxt}　予想報酬:${payoutTxt}</div>`;
      $("#townList").appendChild(head);

      const section = (title)=>{
        const t=document.createElement('div'); t.className='dim'; t.style.marginTop='10px'; t.textContent=title;
        $("#townList").appendChild(t);
      };
      const row = ()=>{ const r=document.createElement('div'); r.className='row'; r.style.justifyContent='flex-start'; r.style.gap='8px'; r.style.marginTop='6px'; return r; };
      const mkBtn=(label,selected,onClick)=>{
        const b=document.createElement('div'); b.className='btn'+(selected?' sel':''); b.textContent=label; b.onclick=()=>onClick(); return b;
      };

      if(gold <= 0){
        section('賭け金（0GでもOK）');
        const info = document.createElement('div'); info.className='item';
        info.innerHTML = `<div>所持金0でも遊べます</div><div class="dim">賭け金は自動で${ZERO_G_SPECIAL_BET}G扱い（勝つとゴールドが増え、次回はそのまま賭けられます）</div>`;
        $("#townList").appendChild(info);
      }else{
        section('賭け金（必須）');
        const r1=row();
        for(const v of betOpts){ r1.appendChild(mkBtn(v+'G', this._msSetup.bet===v, ()=>{ this._msSetup.bet=v; render(); })); }
        const allBtn = mkBtn('全額', this._msSetup.bet===gold, ()=>{ this._msSetup.bet=gold; render(); });
        r1.appendChild(allBtn);
        $("#townList").appendChild(r1);
      }

      section('サイズ');
      const r2=row();
      sizes.forEach((s,idx)=>{ r2.appendChild(mkBtn(s.label, this._msSetup.sizeIdx===idx, ()=>{ this._msSetup.sizeIdx=idx; this._msSetup.bombs=null; render(); })); });
      $("#townList").appendChild(r2);

      if(this._msSetup.sizeIdx!=null){
        const s=sizes[this._msSetup.sizeIdx];
        section('爆弾数（難易度）');
        const r3=row();
        const opts = makeBombOpts(s.w,s.h);
        for(const v of opts){ r3.appendChild(mkBtn(v+'個', this._msSetup.bombs===v, ()=>{ this._msSetup.bombs=v; render(); })); }
        $("#townList").appendChild(r3);
      }
    };

    render();

    const addBtn=(label,fn)=>{ const b=document.createElement('div'); b.className='btn'; b.textContent=label; b.onclick=()=>fn(); $("#townActions").appendChild(b); };
    addBtn('開始', ()=>{
      const goldNow = num(this.p.gold,0);
      const betRaw = num(this._msSetup.bet, 0);
      const szIdx = this._msSetup.sizeIdx;
      const bombs = this._msSetup.bombs || 0;

      const betSpecialOk = (goldNow <= 0 && betRaw <= 0);
      if((!betSpecialOk && !betRaw) || szIdx==null || !bombs){
        this.msg('賭け金・サイズ・爆弾数を選んでください');
        return;
      }
      const s = sizes[szIdx];
      // betRaw=0のときは startMinesweeper 側で「10G扱い」にする
      this.startMinesweeper({w:s.w,h:s.h,bombs,bet:betRaw});
    });
    addBtn('戻る', ()=>{ this.openTownNpcMenu(this.mons.find(m=>m.ai==='town' && m.role==='casino')); });
    if(ol) ol.style.display='flex';
  }

  startMinesweeper(cfg){
    const w=cfg.w, h=cfg.h, bombs=cfg.bombs;
    const ZERO_G_SPECIAL_BET = 10;

    let bet = num(cfg.bet, 0);
    const gold = num(this.p.gold, 0);
    let usedSpecial = false;

    // 0Gかつ賭け金0（未選択）のときは「10G賭けた扱い」で開始できる
    if(gold <= 0 && bet <= 0){
      bet = ZERO_G_SPECIAL_BET;
      usedSpecial = true;
    }

    // それ以外は通常どおり賭け金必須
    if(!usedSpecial){
      if(bet <= 0){
        this.msg('賭け金を選んでください');
        return this.openMinesweeperSetup();
      }
      if(gold < bet){
        this.msg('所持金が足りません');
        return this.openMinesweeperSetup();
      }
      // 賭け金を先に支払う
      this.p.gold = gold - bet;
    this.afterGoldChange();
    }

    // 前回賭け金として保持（次回のデフォルトに使う）
    this._msLastBet = bet;
    const cells=w*h;
    // 盤面生成（爆弾配置は即時、初手爆弾は返金してやり直し）
    const board=Array.from({length:h},()=>Array(w).fill(0));
    const bombsSet=new Set();
    const key=(x,y)=>y*w+x;
    while(bombsSet.size < bombs){
      const x=rand(0,w-1), y=rand(0,h-1);
      const k=key(x,y);
      if(bombsSet.has(k)) continue;
      bombsSet.add(k);
    }
    for(const k of bombsSet){
      const x=k%w, y=Math.floor(k/w);
      board[y][x] = -1;
    }
    const dirs=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      if(board[y][x]===-1) continue;
      let c=0;
      for(const [dx,dy] of dirs){
        const nx=x+dx, ny=y+dy;
        if(nx<0||ny<0||nx>=w||ny>=h) continue;
        if(board[ny][nx]===-1) c++;
      }
      board[y][x]=c;
    }
    this._ms={ w,h,bombs,bet, board, revealed: Array.from({length:h},()=>Array(w).fill(false)), flags: Array.from({length:h},()=>Array(w).fill(false)), mode:'dig', first:true, over:false };
    this.openMinesweeperPlay();
  }

  openMinesweeperPlay(){
    const ol = $("#townOL");
    const ms = this._ms;
    if(!ms) return this.openMinesweeperSetup();
    $("#townTitle").textContent = "マインスイーパー";
    const mult = this.msCalcMultiplier(ms.w, ms.h, ms.bombs);
    $("#townDesc").textContent = `掘る/旗を切替できます。クリア報酬: 賭け金×倍率（倍率${mult.toFixed(2)}）`;
    $("#townTabs").innerHTML = '';
    $("#townList").innerHTML = '';
    $("#townActions").innerHTML = '';

    const head=document.createElement('div'); head.className='item';
    head.innerHTML = `<div>賭け金:${ms.bet}G　爆弾:${ms.bombs}　モード:${ms.mode==='dig'?'掘る':'旗'}　所持金:${num(this.p.gold,0)}G</div><div class="dim">初手爆弾は返金して仕切り直し</div>`;
    $("#townList").appendChild(head);

    const grid=document.createElement('div');
    grid.className='msGrid';
    grid.style.gridTemplateColumns = `repeat(${ms.w}, 32px)`;
    for(let y=0;y<ms.h;y++){
      for(let x=0;x<ms.w;x++){
        const cell=document.createElement('div');
        cell.className='msCell';
        const val=ms.board[y][x];
        const rev=ms.revealed[y][x];
        const fl=ms.flags[y][x];
        if(rev){
          cell.classList.add('revealed');
          if(val===-1){ cell.textContent='💣'; cell.classList.add('bomb'); }
          else if(val===0){ cell.textContent=''; }
          else { cell.textContent=String(val); cell.classList.add('n'+val); }
        }else{
          if(fl){ cell.textContent='⚑'; cell.classList.add('flag'); }
          else cell.textContent='';
        }
        cell.onclick = ()=>{
          if(ms.over) return;
          if(ms.mode==='flag'){ this.msToggleFlag(x,y); }
          else { this.msReveal(x,y); }
        };
        grid.appendChild(cell);
      }
    }
    $("#townList").appendChild(grid);

    const addBtn=(label,sel,fn)=>{ const b=document.createElement('div'); b.className='btn'+(sel?' sel':''); b.textContent=label; b.onclick=()=>fn(); $("#townActions").appendChild(b); };
    addBtn('掘る', ms.mode==='dig', ()=>{ ms.mode='dig'; this.openMinesweeperPlay(); });
    addBtn('旗', ms.mode==='flag', ()=>{ ms.mode='flag'; this.openMinesweeperPlay(); });
    addBtn('続ける（全額）', false, ()=>{
      // 勝ったゴールドをそのまま賭けられる（所持金0のときは10G扱い）
      const cfg={w:ms.w,h:ms.h,bombs:ms.bombs,bet:num(this.p.gold,0)};
      this._ms=null;
      this.startMinesweeper(cfg);
    });
    addBtn('もう一回（同額）', false, ()=>{
      // 同額で続行
      const cfg={w:ms.w,h:ms.h,bombs:ms.bombs,bet:ms.bet};
      this._ms=null;
      this.startMinesweeper(cfg);
    });
    addBtn('設定変更', false, ()=>{
      const cfg={w:ms.w,h:ms.h,bombs:ms.bombs,bet:ms.bet};
      this._ms=null;
      // セットアップに戻す（同値を残す）
      const szList=[{w:6,h:6},{w:8,h:8},{w:10,h:10},{w:12,h:12}];
      const szIdx=szList.findIndex(s=>s.w===cfg.w&&s.h===cfg.h);
      this._msSetup = { bet: Math.min(cfg.bet, Math.max(0, num(this.p.gold,0))), sizeIdx: szIdx, bombs: cfg.bombs };
      this.openMinesweeperSetup();
    });

addBtn('やめる', false, ()=>{ this._ms=null; this.openTownNpcMenu(this.mons.find(m=>m.ai==='town' && m.role==='casino')); });
    if(ol) ol.style.display='flex';
  }

  msToggleFlag(x,y){
    const ms=this._ms; if(!ms||ms.over) return;
    if(ms.revealed[y][x]) return;
    ms.flags[y][x] = !ms.flags[y][x];
    this.openMinesweeperPlay();
  }

  msReveal(x,y){
    const ms=this._ms; if(!ms||ms.over) return;
    if(ms.flags[y][x]) return;
    if(ms.revealed[y][x]) return;
    const val = ms.board[y][x];
    if(ms.first && val===-1){
      // 返金して仕切り直し（同条件で盤面だけ作り直す）
      this.p.gold = num(this.p.gold,0) + ms.bet;
      this.afterGoldChange();
      this.msg('初手が爆弾だったので返金して仕切り直し');
      const cfg={w:ms.w,h:ms.h,bombs:ms.bombs,bet:ms.bet};
      this._ms=null;
      return this.startMinesweeper(cfg);
    }
    ms.first=false;
    if(val===-1){
      ms.over=true;
      // 全表示
      for(let yy=0;yy<ms.h;yy++) for(let xx=0;xx<ms.w;xx++) ms.revealed[yy][xx]=true;
      this.msg('爆弾！ 失敗…');
      return this.openMinesweeperPlay();
    }
    const dirs=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    const q=[[x,y]];
    while(q.length){
      const [cx,cy]=q.pop();
      if(ms.revealed[cy][cx]) continue;
      if(ms.flags[cy][cx]) continue;
      ms.revealed[cy][cx]=true;
      if(ms.board[cy][cx]===0){
        for(const [dx,dy] of dirs){
          const nx=cx+dx, ny=cy+dy;
          if(nx<0||ny<0||nx>=ms.w||ny>=ms.h) continue;
          if(ms.revealed[ny][nx]) continue;
          if(ms.board[ny][nx]===-1) continue;
          q.push([nx,ny]);
        }
      }
    }
    // 勝利判定
    let revCount=0;
    for(let yy=0;yy<ms.h;yy++) for(let xx=0;xx<ms.w;xx++) if(ms.revealed[yy][xx]) revCount++;
    const cells=ms.w*ms.h;
    if(revCount >= (cells - ms.bombs)){
      ms.over=true;
      const mult=this.msCalcMultiplier(ms.w,ms.h,ms.bombs);
      const reward=Math.max(0, Math.floor(ms.bet*mult));
      this.p.gold = num(this.p.gold,0) + reward;
      this.afterGoldChange();
      // 全表示（爽快）
      for(let yy=0;yy<ms.h;yy++) for(let xx=0;xx<ms.w;xx++) ms.revealed[yy][xx]=true;
      this.msg(`クリア！ +${reward}G（倍率${mult.toFixed(2)}）`);
      return this.openMinesweeperPlay();
    }
    this.openMinesweeperPlay();
  }

  ensureConnectivity(sx,sy){
    const vis=Array.from({length:this.h},()=>Array(this.w).fill(false));
    const st=[[sx,sy]]; vis[sy][sx]=true;
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    while(st.length){ const [x,y]=st.pop(); for(const d of dirs){ const nx=x+d[0], ny=y+d[1]; if(nx<0||ny<0||nx>=this.w||ny>=this.h) continue; if(vis[ny][nx]) continue; if(this.map[ny][nx]==='#') continue; vis[ny][nx]=true; st.push([nx,ny]); } }
    let changed=false;
    for(let y=1;y<this.h-1;y++) for(let x=1;x<this.w-1;x++){
      if(this.map[y][x]==='.' && !vis[y][x]){ let tx=sx, ty=sy; let cx=x, cy=y;
        while(cx!==tx){ this.map[cy][cx]='.'; cx+=(tx>cx?1:-1); }
        while(cy!==ty){ this.map[cy][cx]='.'; cy+=(ty>cy?1:-1); }
        changed=true;
      }
    }
    if(changed) this.ensureConnectivity(sx,sy);
  }

  genShop(r){
    const cx=r.x+~~(r.w/2), cy=r.y+~~(r.h/2);
    const keep=scaleMon(MON[5],cx,cy,1); keep.hostile=false; keep.isShop=true; this.mons.push(keep);
    for(let i=0;i<9;i++){ const p=this.freeIn(r,false); if(!p) continue; const it=this.spawnRandomItem(p.x,p.y,Math.max(1,num(this.floor,1))); it.price=priceOf(it); this.shopCells.add(`${p.x},${p.y}`); }
    this.shopExits.set(r.id, this.calcShopOriginalExits(r));
  }
  genMH(r){
    for(let y=r.y;y<r.y+r.h;y++) for(let x=r.x;x<r.x+r.w;x++){
      if(this.map[y][x]!=='.') continue;
      if(Math.random()<0.75){ if(!this.monAt(x,y)){ const t=choice(MON_SPAWN_POOL.slice(0,5)); const lv=Math.max(1,Math.floor(num(this.floor,1)/1)); this.mons.push(scaleMon(t,x,y,lv)); } }
      else if(Math.random()<0.32){ if(!this.itemAt(x,y)) this.spawnRandomItem(x,y,this.floor); }
      if(Math.random()<0.22){ this.traps.push({x,y,type:"arrow",seen:false}); }
    }
  }
  freeIn(room,avoidAll=false){
    for(let t=0;t<200;t++){
      const x=rand(room?room.x+1:1, room?room.x+room.w-2:this.w-2);
      const y=rand(room?room.y+1:1, room?room.y+room.h-2:this.h-2);
      if(this.map[y][x]!=='.') continue;
      if((avoidAll && (x===this.p.x&&y===this.p.y)) || (avoidAll && this.monAt(x,y)) ) continue;
      return {x,y};
    } return null;
  }
  findFree(){ for(let t=0;t<500;t++){ const x=rand(1,this.w-2), y=rand(1,this.h-2); if(this.map[y][x]==='.' && !this.monAt(x,y) && !(x===this.p.x&&y===this.p.y)) return {x,y}; } return null; }
  randomRoomCell(){ const r=choice(this.rooms); return this.freeIn(r,false); }

  spawnRandomItem(x,y,floor){
    if(!this.haveEscape && Math.random()<0.18){
      const scroll=SCROLLS.find(s=>s.name.includes("脱出"));
      const it={...scroll}; it.x=x; it.y=y; it.ch=itemChar(it); this.items.push(it); return it;
    }
    const r=Math.random(); let it=null;
    // 出現傾斜（草→矢→巻→杖→武→防）
    if      (r < 0.30){ it={...choice(HERBS)}; }
    else if (r < 0.52){ it={...choice(ARROWS)}; }
    else if (r < 0.70){ it={...choice(SCROLLS)}; }
    else if (r < 0.82){ it={...choice(WANDS)}; }
    else if (r < 0.92){ it={...choice(WEAPONS), type:'weapon'}; }
    else              { it={...choice(ARMORS), type:'armor'}; }
    it.x=x; it.y=y; it.ch=itemChar(it); this.items.push(it);
    return it;
  }

  revealRoomAt(x,y){
    const rid=this.roomIdAt(x,y);
    if(rid<0){ for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const nx=x+dx, ny=y+dy; if(this.isOut(nx,ny)) continue; this.vis[ny][nx]=true; } return; }
    const r=this.rooms.find(r=>r.id===rid);
    for(let yy=r.y;yy<r.y+r.h;yy++) for(let xx=r.x;xx<r.x+r.w;xx++) this.vis[yy][xx]=true;
    for(let yy=r.y-1;yy<=r.y+r.h;yy++) for(let xx=r.x-1;xx<=r.x+r.w;xx++){ if(xx<0||yy<0||xx>=this.w||yy>=this.h) continue; if(this.map[yy][xx]==='.') this.vis[yy][xx]=true; }
  }
  roomIdAt(x,y){ for(const r of this.rooms){ if(x>=r.x && x<r.x+r.w && y>=r.y && y<r.y+r.h) return r.id; } return -1; }
  isInShop(x,y){
    const rid=this.roomIdAt(x,y);
    return (rid>=0 && this.shopRooms && this.shopRooms.has(rid));
  }
  shopRoomId(x,y){
    const rid=this.roomIdAt(x,y);
    return (rid>=0 && this.shopRooms && this.shopRooms.has(rid)) ? rid : -1;
  }
  isShopMerchOnFloor(it){
    if(!it) return false;
    const key=`${it.x},${it.y}`;
    return this.isInShop(it.x,it.y) && this.shopCells.has(key) && it.price!=null;
  }
  calcShopOriginalExits(r){
    const exits=new Set();
    // 生成時点の「元からある出入口」だけを記録（壁破壊などで増えた出口は含めない）
    for(let y=r.y;y<r.y+r.h;y++){
      for(let x=r.x;x<r.x+r.w;x++){
        const onEdge = (x===r.x || x===r.x+r.w-1 || y===r.y || y===r.y+r.h-1);
        if(!onEdge) continue;
        if(this.map[y][x]!=='.') continue;
        const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
        for(const [dx,dy] of dirs){
          const nx=x+dx, ny=y+dy;
          if(this.isOut(nx,ny)) continue;
          const outside = !(nx>=r.x && nx<r.x+r.w && ny>=r.y && ny<r.y+r.h);
          if(!outside) continue;
          if(this.map[ny][nx]!=='.' && this.map[ny][nx]!=='>' ) continue;
          exits.add(`${x},${y}`);
        }
      }
    }
    return exits;
  }
  unpaidItemsForRoom(rid){
    return this.inv.filter(it=>it && it.unpaid && it.shopRid===rid);
  }
  hasUnpaidInInv(){
    return this.inv.some(it=>it && it.unpaid);
  }
  becomeThief(reason){
    if(this.thief) return;
    this.thief=true;
    this.msg(reason||"泥棒だ！");
    fxOmin();
    for(const m of this.mons){ if(m && m.isShop){ m.hostile=true; } }
  }
  checkThiefState(){
    if(this.thief) return;
    if(!this.hasUnpaidInInv()) return;
    if(!this.isInShop(this.p.x,this.p.y)){
      this.becomeThief("泥棒だ！店主が敵対した");
    }
  }
  clearThiefAndUnpaidOnDescend(){
    // 階段を降りたら「泥棒状態」「売り物タグ」を必ず解除し、持ち物は自分の物になる
    this.thief=false;
    for(const it of this.inv){
      if(it && it.unpaid){
        delete it.unpaid;
        delete it.shopRid;
        delete it.price;
      }
    }
  }
  onItemPlacedOnFloor(item,x,y){
    item.x=x; item.y=y;
    const rid=this.shopRoomId(x,y);
    const key=`${x},${y}`;
    if(rid>=0){
      // 店内の床に置かれた状態なら、会計も出ないし外に出ても敵対しない（売り物を戻した扱い）
      if(item.unpaid){ delete item.unpaid; }
      // もともと売り物だった品だけを「売り物床」として扱う（自分の私物を勝手に売り物化しない）
      if(item.shopRid!=null || item.price!=null){
        item.shopRid = rid;
        if(item.price==null) item.price = priceOf(item);
        this.shopCells.add(key);
      }
    }else{
      // 店外に置いたら、その座標は売り物床ではない
      this.shopCells.delete(key);
    }
  }
  openShopDialogPickup(it, after){
    this.shopDialogState={mode:'pickup', item:it, after};
    const title=$("#shopDialogTitle"); if(title) title.textContent="売り物";
    $("#shopDialogText").textContent=`${it.name}（${num(it.price,0)}G）を拾いますか？`;
    $("#shopBillList").innerHTML="";
    $("#shopMoney").textContent=`所持金: ${num(this.p.gold,0)}G`;
    $("#btnPay").textContent="拾う";
    $("#btnRefuse").textContent="拾わない";
    $("#shopDialog").style.display="flex";
  }
  openShopDialogCheckout(rid, dx, dy){
    const items=this.unpaidItemsForRoom(rid);
    const total=items.reduce((s,it)=>s+num(it.price,0),0);
    this.shopDialogState={mode:'checkout', rid, dx, dy, items, total};
    const title=$("#shopDialogTitle"); if(title) title.textContent="お会計";
    $("#shopDialogText").textContent=`未払い ${items.length}個 / 合計 ${total}G`;
    $("#shopBillList").innerHTML = items.map(it=>(
      `<div class="row" style="justify-content:space-between"><div>${it.name}</div><div class="dim">${num(it.price,0)}G</div></div>`
    )).join("");
    $("#shopMoney").textContent=`所持金: ${num(this.p.gold,0)}G`;
    $("#btnPay").textContent="支払う";
    $("#btnRefuse").textContent="支払わない";
    $("#shopDialog").style.display="flex";
  }
  closeShopDialog(){
    $("#shopDialog").style.display="none";
    this.shopDialogState=null;
  }
  onShopDialogPay(){
    const st=this.shopDialogState; if(!st) return;
    if(st.mode==='pickup'){
      const it=st.item;
      this.closeShopDialog();
      if(typeof st.after==='function') st.after(true, it);
      return;
    }
    if(st.mode==='checkout'){
      if(num(this.p.gold,0) < num(st.total,0)){
        this.msg("所持金が足りない");
        this.render();
        return;
      }
      this.p.gold = num(this.p.gold,0) - num(st.total,0);
      this.afterGoldChange();
      for(const it of st.items){
        delete it.unpaid; delete it.shopRid; delete it.price;
      }
      this.msg(`支払い完了（${st.total}G）`);
      const dx=st.dx, dy=st.dy;
      this.closeShopDialog();
      // そのまま移動を再実行（会計チェックはスキップ）
      this.tryMove(dx,dy,{skipShopCheckout:true});
      return;
    }
  }
  onShopDialogRefuse(){
    const st=this.shopDialogState; if(!st) return;
    if(st.mode==='pickup'){
      const it=st.item;
      this.closeShopDialog();
      if(typeof st.after==='function') st.after(false, it);
      return;
    }
    if(st.mode==='checkout'){
      this.msg("会計しないと持ち出せない");
      this.closeShopDialog();
      this.render();
      return;
    }
  }
  pickupShopMerch(it){
    if(!it) return false;
    if(this.inv.length>=this.baseInvMax()){ this.msg("これ以上持てない"); return false; }
    // 店の品は「自動装填/自動装備」しない（装備扱いになりやすいので）
    this.inv.push(it);
    it.unpaid=true;
    it.shopRid=this.shopRoomId(it.x,it.y);
    this.shopCells.delete(`${it.x},${it.y}`);
    this.items=this.items.filter(x=>x!==it);
    this.msg(`${it.name}を拾った（売り物）`);
    return true;
  }


  tileChar(x,y){
    if(this.isOut(x,y)) return " ";
    if(!this.vis[y][x]) return "#";
    if(this.map[y][x]==='#') return "#";
    const layers=[];
    if(this.map[y][x]==='>') layers.push('>');
    const its=this.itemsAt(x,y); if(its.length) layers.push(its[0].ch||'*');
    const m=this.monAt(x,y); if(m) layers.push(m.ch);
    if(this.p.x===x && this.p.y===y) layers.push('@');
    if(layers.length===0) return (this.nearStairs.has(`${x},${y}`)?'·':'.');
    const pick = layers[(Math.floor(Date.now()/1000)) % layers.length];
    return pick;
  }

  render(){
    const halfW=~~(this.viewW/2), halfH=~~(this.viewH/2);
    this.offX=clamp(this.p.x-halfW, 0, this.w-this.viewW);
    this.offY=clamp(this.p.y-halfH, 0, this.h-this.viewH);

    // マップは span(cell) で描画（1ch固定）→ FXもズレない
    let out="";
    for(let y=0;y<this.viewH;y++){
      for(let x=0;x<this.viewW;x++){
        out+=this.tileSpan(x+this.offX,y+this.offY);
      }
      out+='<br>';
    }
    const vp=$("#viewport");
    vp.innerHTML=out;

    // cell参照（FX用）
    this._cellEls = Array.from(vp.querySelectorAll('.cell'));

    // ステータスなど
    $("#chipBest").textContent=`Best ${this.bestFloor}F / Score ${this.bestScore}`;
    const eW=this.p.wep?`（E）`:""; const eA=this.p.arm?`（E）`:""; const eAr=this.p.arrow?`（E）`:"";
    $("#stats").textContent =
`Lv:${num(this.p.lv,1)}  HP:${num(this.p.hp,0)}/${num(this.p.maxHp,1)}  STR:${num(this.p.str,10)}  階:${num(this.floor,1)}  G:${num(this.p.gold,0)}${this.thief?'  【泥棒中】':''}
攻:${this.calcPlayerAtk()}  守:${this.calcPlayerDef()}
矢:${num(this.p.ar,0)}（${this.p.arrow?this.p.arrow.kind:'なし'}）
武:${this.p.wep?this.p.wep.name+(this.p.wep.plus?('+'+num(this.p.wep.plus,0)):''):'なし'}${this.p.wep?eW:''}
盾:${this.p.arm?this.p.arm.name+(this.p.arm.plus?('+'+num(this.p.arm.plus,0)):''):'なし'}${this.p.arm?eA:''}
矢装填:${this.p.arrow?this.p.arrow.kind:'なし'}${this.p.arrow?eAr:''}
自動拾い:${this.autoPickup?'ON':'OFF'}`;
    // Town: action labels
    const shootBtn=document.querySelector('[data-act="shoot"]');
    if(shootBtn) shootBtn.textContent = (this.mode==='town'?'話す':'撃つ');
    const descBtn=document.querySelector('[data-act="descend"]');
    if(descBtn) descBtn.textContent = (this.mode==='town'?'出る':'降りる');
    $("#lowHP").style.opacity = (num(this.p.hp,0)/Math.max(1,num(this.p.maxHp,1))<0.2)?1:0;

    // FXキューがあれば再生
    if(this.fxQueue && this.fxQueue.length && !this.fxBusy){
      this.playFxQueue();
    }
  }


  calcPlayerAtk(){
    const base = num(this.p.baseAtk, 0);
    const wAtk = this.p.wep ? num(this.p.wep.atk, 0) + num(this.p.wep.plus, 0) : 0;
    const str  = num(this.p.str, 10);
    let a = base + wAtk;
    a = Math.floor(num(a,0) * (str/10));
    return Math.max(0, a);
  }
  calcPlayerDef(){
    const base = num(this.p.baseDef, 0);
    const aDef = this.p.arm ? num(this.p.arm.def, 0) + num(this.p.arm.plus, 0) : 0;
    return Math.max(0, base + aDef);
  }
  needExp(){ return 100; }
/*** ここから PART 3 へ続く ***/
  // ダメージ処理
  
hit(att,def,base){
    const atk = (att===this.p) ? this.calcPlayerAtk() : num(att && att.atk, 0);
    let defv  = (def===this.p) ? this.calcPlayerDef() : num(def && def.def, 0);
    let dmgBase = num(base, 0);
    const rnd = rand(-1,1);

    let dmg = (dmgBase + atk - defv + rnd);

    // 店主は「攻撃されたら敵対」
    if(att===this.p && def && def.ai==='shop' && def.hostile===false){
      for(const m of this.mons){ if(m && m.ai==='shop') m.hostile=true; }
      this.msg("店主が怒った！");
    }

    if(att===this.p && this.p.wep){
      const w=this.p.wep;
      if(w.gamble){
        if(Math.random()<0.5){ this.msg("空振り！"); dmg = 0; }
        else { dmg = Math.max(1, num(dmg,1)) * 3; this.msg("会心の超一撃！"); }
      }
      if(w.critPct && Math.random() < num(w.critPct,0)){
        dmg = Math.max(1, num(dmg,1)) * num(w.critMul,2);
        this.msg("会心！");
      }
    }

    dmg = Math.floor(num(dmg, 1));
    if (!isFinite(dmg) || dmg < 0) dmg = 0;

    const attIsPlayer = (att===this.p);
    const defIsPlayer = (def===this.p);
    const invActive = (defIsPlayer && num(this.p.invincible,0)>0);
    let invBlocked = false;
    if(invActive && dmg>0){
      invBlocked = true;
      dmg = 0;
    }

    let fxCombatMsgShown = false;

    const vp=$("#viewport"); vp.classList.remove('shake'); void vp.offsetWidth; vp.classList.add('shake');
    if(dmg>0) fxSlash();

    if(defIsPlayer && this.p.arm && !invBlocked){
      const a=this.p.arm;
      if(a.nullify && Math.random() < num(a.nullify,0)){ this.msg("攻撃を無効化した！"); dmg=0; }
      if(dmg>0 && a.reflect && Math.random() < num(a.reflect,0)){
        this.msg("攻撃を反射！");
        const ret = Math.max(1, dmg);
        if(att){ att.hp = Math.max(0, num(att.hp,1) - ret); if(att.hp<=0) this.kill(att,this.p); }
        dmg=0;
      }
    }

    // ===== 攻撃FX＆被ダメ/与ダメトースト（点滅と同期） =====
    try{
      const s = (att && typeof att.x==='number') ? {x:att.x,y:att.y} : null;
      const d = (def && typeof def.x==='number') ? {x:def.x,y:def.y} : null;
      let msgText = "";
      if(invBlocked){
        msgText = `無敵！`;
      }else if(dmg>0){
        if(defIsPlayer){
          const an = (att && att.name) ? att.name : "敵";
          const ach = (att && att.ch) ? att.ch : "?";
          msgText = `${an}(${ach}) から ${dmg} ダメージ！`;
        }else if(attIsPlayer){
          const dn = (def && def.name) ? def.name : "敵";
          const dch = (def && def.ch) ? def.ch : "?";
          msgText = `${dn}(${dch}) に ${dmg} ダメージ！`;
        }
      }
      fxCombatMsgShown = !!msgText;
      const linePts = [];
      if(s && d){
        const dist = Math.max(Math.abs(s.x-d.x), Math.abs(s.y-d.y));
        if(dist>1){
          // bresenham（端点除外）
          let x0=s.x,y0=s.y,x1=d.x,y1=d.y;
          let dx=Math.abs(x1-x0), sx=(x0<x1)?1:-1;
          let dy=-Math.abs(y1-y0), sy=(y0<y1)?1:-1;
          let err=dx+dy;
          while(!(x0===x1 && y0===y1)){
            const e2=2*err;
            if(e2>=dy){ err+=dy; x0+=sx; }
            if(e2<=dx){ err+=dx; y0+=sy; }
            if(!(x0===x1 && y0===y1)) linePts.push({x:x0,y:y0});
          }
        }
      }
      if(s && d && (dmg>0 || invBlocked)) this.enqueueAttackFx(s,d,msgText,linePts);
    }catch(e){}

    if(dmg<=0){ this.render(); return; }
    def.hp = Math.max(0, num(def.hp,1) - dmg);

    if(defIsPlayer){
      if(!fxCombatMsgShown) this.msg(`${dmg}のダメージ！`);
      if(num(this.p.hp,0)<=0){
        const idx=this.inv.findIndex(x=>x.type==="herb" && x.revive);
        if(idx>=0){
          this.inv.splice(idx,1);
          this.p.maxHp = Math.max(1, num(this.p.maxHp,1));
          this.p.hp = Math.max(1, Math.floor(num(this.p.maxHp,1)*0.7));
          this.msg("復活草が発動！");
          fxSpark();
          this.render(); return;
        }
        this.gameOver();
      }
    }else{
      if(!fxCombatMsgShown) this.msg(`${def.name}に${dmg}ダメージ`);
      if(num(def.hp,0)<=0) this.kill(def,att);
      else if(att===this.p && this.p.wep && this.p.wep.lifesteal){
        const heal = Math.floor(Math.max(0, dmg * num(this.p.wep.lifesteal,0)));
        if(heal>0){
          this.p.hp = Math.min(num(this.p.maxHp,1), num(this.p.hp,1)+heal);
          this.msg(`HPを${heal}回復`);
          fxSpark();
        }
      }
    }
    this.render();
  }

  // キル後処理（デコイ対応）
  kill(m,killer){
    // デコイの勝敗で強化
    if(killer && killer.decoy){
      killer.atk=Math.max(1,num(killer.atk,1)*2);
      killer.def=Math.max(0,num(killer.def,0)*2);
      killer.maxHp=Math.max(1,num(killer.maxHp,1)*2);
      killer.hp=killer.maxHp; killer.doubled=true;
      this.msgGreen(`${killer.name}（身代わり）が強化された！`);
    }
    // デコイが倒された場合、倒した側を強化
    if(m.decoy){
      const foe = killer && killer!==this.p ? killer : null;
      if(foe){
        foe.atk=Math.max(1,num(foe.atk,1)*2);
        foe.def=Math.max(0,num(foe.def,0)*2);
        foe.maxHp=Math.max(1,num(foe.maxHp,1)*2);
        foe.hp=foe.maxHp; foe.doubled=true;
        this.msgGreen(`${foe.name}が身代わりを倒し、強化された！`);
      }
    }

    if(killer===this.p){
      let exp = m.doubled ? num(m.xp,1)*5 : num(m.xp,1);
      this.p.xp = num(this.p.xp,0) + exp;
      this.msg(`EXP ${exp} を得た`);
      while(num(this.p.xp,0)>=this.needExp()){
        this.p.xp -= this.needExp();
        this.p.lv = num(this.p.lv,1) + 1;
        this.p.maxHp = num(this.p.maxHp,1) + 5;
        this.p.hp = num(this.p.maxHp,1);
        this.p.baseAtk = num(this.p.baseAtk,0) + 1;
        this.p.baseDef = num(this.p.baseDef,0) + 1;
        this.msg(`Lv${this.p.lv}！`);
        fxSpark();
      }
    }
    if(Math.random()<0.10){ const it=this.spawnRandomItem(m.x,m.y,this.floor); it.x=m.x; it.y=m.y; }
    this.mons=this.mons.filter(x=>x!==m);
  }

  tryMove(dx,dy,opts={}){
    if(this.shopDialogState){ return; }
    // 方向指定モード（射撃/杖/身代わり草）は「移動」と同居させない
    if(this.waitTarget){
      const wt=this.waitTarget;
      if(wt.mode==='wand'){
        // オーバーレイ方向選択中でも、D-pad/キー入力で方向指定できるように
        this.closeShootOL();
        this.castWand(wt.item,dx,dy);
      }
      else if(wt.mode==='shoot'){
        this.shootDir(dx,dy);
      }
      else if(wt.mode==='throw'){
        this.throwDir(dx,dy);
      }
      else if(wt.mode==='throwGold'){
        this.throwGoldDir(dx,dy);
      }
      else if(wt.mode==='herbDecoy'){
        this.castHerbDecoy(dx,dy);
      }
      return;
    }
    this.p.lastDir=[dx,dy];
    const nx=this.p.x+dx, ny=this.p.y+dy;
    // Town: allow leaving from map edges ("画面端から出られない"対策)
    if(this.isOut(nx,ny)){
      if(this.mode==='town'){
        // edge as an exit
        this.openTownExitMenu("町の外に出ますか？");
        this.render();
      }
      return;
    }

    // --- ショップ：元の出入口から「売り物」を持ち出すときだけ会計確認 ---
    if(!opts.skipShopCheckout){
      const curRid=this.shopRoomId(this.p.x,this.p.y);
      const nextRid=this.shopRoomId(nx,ny);
      if(curRid>=0 && nextRid!==curRid){
        const exits=this.shopExits.get(curRid);
        const isOrigExit = exits && exits.has(`${this.p.x},${this.p.y}`);
        if(isOrigExit){
          const unpaid=this.unpaidItemsForRoom(curRid);
          if(unpaid.length){
            this.openShopDialogCheckout(curRid, dx, dy);
            return;
          }
        }
      }
    }

    if(this.isWall(nx,ny)){ if(this.p.wep && this.p.wep.wallBreak){ this.map[ny][nx]='.'; this.msg("壁を砕いた"); } this.render(); return; }
    const m=this.monAt(nx,ny);
    if(m){
      // Town: bump into NPC = talk (no combat)
      if(this.mode==='town' && m.ai==='town'){
        this.openTownNpcMenu(m);
        this.render();
        return;
      }
      this.hit(this.p,m,0); this.turnStep(); this.render(); return;
    }
    else{
      this.p._ox=this.p.x; this.p._oy=this.p.y;
      this.p.x=nx; this.p.y=ny;
      const tr=this.traps.find(t=>t.x===nx && t.y===ny);
      if(tr && !tr.seen){ tr.seen=true; if(tr.type==="arrow"){ this.msg("矢のワナ！"); this.hit({atk:10,hp:1,def:0}, this.p, 0); } }
      if(this.map[ny][nx]==='>'){ this.msg("階段がある"); fxOmin(); }
      this.revealRoomAt(nx,ny);

      // --- ショップ：売り物の上に乗ったら拾う/拾わないを確認（このターンはここで一旦止める） ---
      const it=this.itemAt(this.p.x,this.p.y);
    // 店の売り物が店外にある状態で拾ったら、その瞬間から泥棒扱い（次の敵行動前に敵対）
    if(it && it.price!=null && it.shopRid!=null && !this.isInShop(it.x,it.y)){
      it.unpaid=true;
    }

      if(this.isShopMerchOnFloor(it)){
        this.openShopDialogPickup(it, (pick)=>{
          if(pick){ this.pickupShopMerch(it); }
          this.turnStep();
          this.render();
        });
        return;
      }

      if(this.autoPickup){ this.doPickupHere(); }
      this.turnStep();
    }
    this.render();
  }

  doPickupHere(){
    const it=this.itemAt(this.p.x,this.p.y);
    if(!it) return;
    if(this.shopCells.has(`${it.x},${it.y}`) && it.price!=null){
      if(num(this.p.gold,0)>=num(it.price,0)){ this.p.gold=num(this.p.gold,0)-num(it.price,0);
      this.afterGoldChange(); this.msg(`購入: ${it.name}`); fxSpark(); }
      else return;
    }

    // 矢：種類と本数の整合を保ち、別種類は所持品へ（同種はスタック）
    if(it.type==='arrow'){
      handleArrowPickup(this, it);
      return;
    }

    // 金
    if(it.type==='gold'){
      this.p.gold = num(this.p.gold,0) + num(it.amount,0);
      this.afterGoldChange();
      this.msg(`${num(it.amount,0)}Gを拾った`);
      fxSpark();
      this.items=this.items.filter(x=>x!==it);
      return;
    }

    // それ以外
    if(this.inv.length>=this.baseInvMax()){ this.msg("これ以上持てない"); return; }
    this.inv.push(it);
    this.msg(`${it.name}を拾った`);
    fxSpark();
    if((it.type==='weapon' && num(it.atk,0)>=8) || (it.type==='armor' && num(it.def,0)>=7)){
      this.msg("強力な装備だ！"); this.flashInv(x=>x===it);
    }
    if(it.type==='scroll' && it.name.includes("脱出")) this.haveEscape=true;
    this.items=this.items.filter(x=>x!==it);
  }

  descend(){
    if(this.mode==='town'){
      // 「出る」ボタンは町のどこからでも利用可能（出入口タイルに居なくてもOK）
      const onGate = (this.map && this.map[this.p.y] && this.map[this.p.y][this.p.x]==='>');
      this.openTownExitMenu(onGate ? "どこへ行きますか？" : "町を出ますか？（どこからでも選べます）");
      return;
    }
    if(this.map[this.p.y][this.p.x]!=='>'){ this.msg("ここには階段がない"); return; }
    this.floor=Math.min(MAX_FLOOR, num(this.floor,1)+1);
    if(this.floor>this.bestFloor){ this.bestFloor=this.floor; localStorage.setItem('bestF',this.bestFloor); }
    this.gen(this.floor);
  }

  askShoot(){
    if(this.mode==='town'){
      this.townTalk();
      return;
    }
    if(!this.p.arrow || num(this.p.ar,0)<=0){
      this.msg("矢がない");
      return;
    }
    // 方向をオーバーレイUIで選ぶ（移動入力と分離する）
    this.waitTarget = {mode:'shoot'};
    this.openShootOL("方向を選んで射撃");
    this.msg("撃つ方向を選んでください");
  }

  // Town: exit menu (shared by stairs and map edges)
  openTownExitMenu(descText){
    $("#townTabs").innerHTML='';
    $("#townList").innerHTML='';
    $("#townActions").innerHTML='';
    $("#townTitle").textContent="出入口";
    $("#townDesc").textContent=descText || "どこへ行きますか？";
    const addBtn=(label,fn)=>{
      const b=document.createElement('div');
      b.className='pill';
      b.textContent=label;
      b.onclick=()=>fn();
      $("#townActions").appendChild(b);
    };
    addBtn("ダンジョンへ", ()=>{ $("#townOL").style.display='none'; this.startDungeonFromTown(); });
    addBtn("タイトルへ戻る", ()=>{ $("#townOL").style.display='none'; this.saveHoldToTitle(); showTitle(); });
    addBtn("キャンセル", ()=>{ $("#townOL").style.display='none'; });
    $("#townOL").style.display='flex';
  }

  openShootOL(title){
    const ol = $("#shootOL");
    if(!ol) return;
    const t = $("#shootTitle");
    if(t && typeof title === 'string' && title.trim()) t.textContent = title;
    ol.style.display = "flex";
  }
  closeShootOL(){
    const ol = $("#shootOL");
    if(ol) ol.style.display = "none";
  }
  cancelTargeting(){
    // 射撃/投げ/杖の方向選択キャンセル
    if(this.waitTarget && ['shoot','throw','throwGold','wand'].includes(this.waitTarget.mode)){
      this.waitTarget = null;
      this.closeShootOL();
      this.msg("キャンセル");
      this.render();
    }
  }

  selectDirFromOL(dx,dy){
    if(!this.waitTarget) return;
    const m = this.waitTarget.mode;
    if(m==='shoot') return this.shootDir(dx,dy);
    if(m==='throw') return this.throwDir(dx,dy);
    if(m==='throwGold') return this.throwGoldDir(dx,dy);
    if(m==='wand'){
      this.closeShootOL();
      const w = this.waitTarget.item;
      this.waitTarget = null;
      this.castWand(w,dx,dy);
      return;
    }
    // herbDecoyなどは現状は移動入力で指定（必要なら後で拡張）
  }



  // 直線上の最初の命中対象を探す（矢/射撃系共通）
  // 戻り値: 命中モンスター or null
  // ついでに this._lineLast へ「最後に到達できた座標」を保存する（外れた矢の落下位置などに利用）
  lineHit(sx,sy,dx,dy,range){
    let x=sx, y=sy;
    let last={x:sx, y:sy};
    const r = Math.max(1, num(range, 8));
    for(let i=0;i<r;i++){
      x += dx; y += dy;
      if(this.isOut(x,y)) break;
      if(this.isWall(x,y)) break;
      last = {x, y};
      const m = this.monAt(x,y);
      if(m){
        this._lineLast = last;
        return m;
      }
    }
    this._lineLast = last;
    return null;
  }



  shootDir(dx,dy){
    if(!this.waitTarget || this.waitTarget.mode!=='shoot') return;
    this.closeShootOL();

    if(!this.p.arrow || num(this.p.ar,0)<=0){
      this.msg("矢が装填されていない");
      this.waitTarget=null;
      this.render();
      return;
    }

    // 射撃だけ実行（移動しない）
    const hit = this.lineHit(this.p.x,this.p.y,dx,dy, (this.p.arrow.range||8));
    if(hit){
      // 命中
      if(this.p.arrow.kind==="poison"){ hit.poison=3; this.hit(this.p,hit,3); }
      else if(this.p.arrow.kind==="sleep"){ hit.sleep=2; this.hit(this.p,hit,1); }
      else if(this.p.arrow.kind==="slow"){ hit.slow=3; this.hit(this.p,hit,1); }
      else if(this.p.arrow.kind==="stun"){ hit.stun=1; this.hit(this.p,hit,8); }
      else { this.hit(this.p,hit,num(this.p.arrow.dmg,5)); }
    }else{
      // 外れた矢は届いた最後のマスに落ちる（拾える）
      try{
        const last = this._lineLast || {x:this.p.x, y:this.p.y};
        if(last && (last.x!==this.p.x || last.y!==this.p.y)){
          const dropped = Game._templateItem('arrow', '矢束', this.p.arrow.kind);
          if(dropped){
            dropped.count = 1;
            dropped.dmg = num(this.p.arrow.dmg, 5);
            dropped.kind = this.p.arrow.kind || 'normal';
            dropped.ided = true;
            this.onItemPlacedOnFloor(dropped, last.x, last.y);
            this.items.push(dropped);
          }
        }
      }catch(e){}
    }

    this.p.ar = Math.max(0, num(this.p.ar,0)-1);
    this.waitTarget=null;
    this.turnStep();
    this.render();
  }


  useItemMenu(idx){
    const it=this.inv[idx]; if(!it) return;
    if(this.waitId){ if(!it.ided){ it.ided=true; this.msg(`${it.name}を識別した！`);} else this.msg("既に識別済み"); this.waitId=false; this.render(); if($("#invOL").style.display==='flex'){ this.openInv(); } return; }

    // 店の品（売り物）を店内で使った時点で泥棒（装備もアウト）
    if(it.unpaid && this.isInShop(this.p.x,this.p.y)){
      this.becomeThief("店の品を店内で使用した");
    }

    if(it.type==='weapon'){ this.p.wep=it; this.msg(`${it.name}を装備した`); this.flashInv(x=>x===it); }
    else if(it.type==='armor'){ this.p.arm=it; this.msg(`${it.name}を装備した`); this.flashInv(x=>x===it); }
    else if(it.type==='herb'){
      if(it.name==="身代わり草"){ this.msg("身代わりにしたい方向を選んでください"); this.waitTarget={mode:'herbDecoy', idx}; return; }
      it.effect(this,this.p); this.consume(idx);
    }
    else if(it.type==='scroll'){ it.effect(this); this.consume(idx); }
    else if(it.type==='wand'){
      if(num(it.uses,0)<=0 || it.depleted){ this.msg("杖は力を失っている（投げると効果）"); return; }
      this.waitTarget={mode:'wand', item:it};
      this.openShootOL("方向を選んで杖を振る");
      this.msg("杖を振る方向を選んでください");
      return;
    }
    else if(it.type==='pot'){ this.openPot(it); return; }
    else if(it.type==='potBomb'){ this.msg("壺は投げて使おう"); }
    else if(it.type==='arrow'){ 
      this.p.arrow={kind:it.kind,dmg:num(it.dmg,5)}; 
      this.p.ar=num(this.p.ar,0)+num(it.count,0); 
      this.consume(idx,false); 
      this.msg(`装填: ${it.name}（${this.p.ar}）`); 
    }

    this.turnStep(); this.render();
    if($("#invOL").style.display==='flex'){ this.openInv(); }
  }

  // 身代わり草：方向決定→最初の命中モンスターに適用
  castHerbDecoy(dx,dy){
    const idx = (this.waitTarget && this.waitTarget.idx!=null) ? this.waitTarget.idx : -1;
    let x=this.p.x,y=this.p.y, tgt=null;
    for(let i=0;i<10;i++){ x+=dx; y+=dy; if(this.isOut(x,y)||this.isWall(x,y)) break; const m=this.monAt(x,y); if(m){ tgt=m; break; } }
    if(!tgt){ this.msg("外れた"); return; }
    const T=rand(10,40); this.makeDecoy(tgt,T);
    if(idx>=0){ this.consume(idx,true); }
    this.turnStep(); this.render();
  }

  // デコイ化
  makeDecoy(m,T){
    m.decoy=true; m.decoyT=num(T,10);
    m.hostile=true; // 動く
    this.msgGreen(`${m.name}は身代わりになった（${m.decoyT}T）`);
  }


  // === お金（G）投げ：金額ぶんの固定ダメージ ===
  openGoldMenu(){
    $("#menuTitle").textContent=`『お金』`;
    $("#menuDesc").textContent=`投げると投げた金額ぶんのダメージ（消費）`;
    const box=$("#menuBtns"); box.innerHTML="";
    const range=$("#menuRange"); if(range){ range.style.display='none'; }

    const add=(label,fn)=>{
      const b=document.createElement('div');
      b.className='pill'; b.textContent=label;
      b.onclick=()=>{ $("#menuOL").style.display='none'; fn(); };
      box.appendChild(b);
    };

    add('投げる', ()=>this.throwGoldMenu());
    add('キャンセル', ()=>{});
    $("#menuOL").style.display='flex';
  }

  throwGoldMenu(){
    const max = Math.max(0, num(this.p.gold,0));
    if(max<=0){ this.msg("お金がない"); return; }
    let amt = 0;
    try{
      const s = prompt(`投げる金額（1〜${max}）`, String(Math.min(50,max)));
      if(s==null) return;
      amt = Math.floor(Number(s));
    }catch(e){ amt = 0; }
    if(!isFinite(amt) || amt<=0){ this.msg("キャンセル"); return; }
    amt = Math.min(max, amt);

    this.waitTarget = {mode:'throwGold', amount: amt};
    this.openShootOL(`方向を選んでお金を投げる（${amt}G）`);
    this.msg("投げる方向を選んでください");
  }

  // 防御無視の固定ダメージ（主に投げ金用）
  rawDamage(att,def,dmg){
    const attIsPlayer = (att===this.p);
    const defIsPlayer = (def===this.p);
    const invActive = (defIsPlayer && num(this.p.invincible,0)>0);
    if(invActive && num(dmg,0)>0){
      try{ toast("無敵！","toast-dmg"); }catch(e){}
      this.render();
      return 0;
    }

    dmg = Math.floor(num(dmg,0));
    if(!isFinite(dmg) || dmg<=0){ this.render(); return 0; }

    const vp=$("#viewport"); vp.classList.remove('shake'); void vp.offsetWidth; vp.classList.add('shake');
    fxSlash();
    try{
      const dn = (def && def.name) ? def.name : "敵";
      const dch = (def && def.ch) ? def.ch : "?";
      toast(`${dn}(${dch}) に ${dmg} ダメージ！`,'toast-dmg');
    }catch(e){}

    def.hp = Math.max(0, num(def.hp,1) - dmg);

    if(defIsPlayer){
      if(num(this.p.hp,0)<=0){
        const idx=this.inv.findIndex(x=>x.type==="herb" && x.revive);
        if(idx>=0){
          this.inv.splice(idx,1);
          this.p.maxHp = Math.max(1, num(this.p.maxHp,1));
          this.p.hp = Math.max(1, Math.floor(num(this.p.maxHp,1)*0.7));
          this.msg("復活草が発動！");
          fxSpark();
          this.render();
          return dmg;
        }
        this.gameOver();
      }
    }else{
      if(def.hp<=0) this.kill(def, attIsPlayer ? this.p : att);
    }
    return dmg;
  }

  throwGoldDir(dx,dy){
    if(!this.waitTarget || this.waitTarget.mode!=='throwGold') return;
    const amt = Math.max(0, num(this.waitTarget.amount,0));
    this.closeShootOL();
    this.waitTarget = null;

    const have = Math.max(0, num(this.p.gold,0));
    if(have<=0 || amt<=0){ this.msg("お金がない"); return; }

    const spend = Math.min(have, amt);
    this.p.gold = have - spend;

    // 投げた方向を記憶（次の行動の既定方向）
    this.p.lastDir=[dx,dy];

    let x=this.p.x, y=this.p.y, hit=null, last={x,y};
    for(let i=0;i<10;i++){ x+=dx; y+=dy; if(this.isOut(x,y)||this.isWall(x,y)) break; last={x,y}; const m=this.monAt(x,y); if(m){ hit=m; break; } }

    if(hit){
      this.rawDamage(this.p, hit, spend);
    }else{
      // 外したら落ちる（拾える）
      this.items.push({name:"G",type:"gold",amount:spend,ch:"$",x:last.x,y:last.y});
      this.msg(`${spend}Gを投げ捨てた`);
    }

    this.turnStep(); this.render();
    if($("#invOL").style.display==='flex'){ this.openInv(); }
  }

  throwItemMenu(idx){
    const it=this.inv[idx]; if(!it) return;

    // 方向をオーバーレイUIで選ぶ（矢と同様）
    this.waitTarget = {mode:'throw', idx};
    this.openShootOL("方向を選んで投げる");
    this.msg("投げる方向を選んでください");
    return;
  }

  throwDir(dx,dy){
    if(!this.waitTarget || this.waitTarget.mode!=='throw') return;
    const idx = this.waitTarget.idx;
    const it = this.inv[idx];
    this.closeShootOL();
    this.waitTarget = null;

    if(!it){ this.msg("投げる物がない"); return; }

    // 投げた方向を記憶（次の行動の既定方向）
    this.p.lastDir=[dx,dy];

    let x=this.p.x, y=this.p.y, hit=null, last={x,y};
    for(let i=0;i<10;i++){ x+=dx; y+=dy; if(this.isOut(x,y)||this.isWall(x,y)) break; last={x,y}; const m=this.monAt(x,y); if(m){ hit=m; break; } }
    if(it.type==='herb'){
      if(it.name==="身代わり草" && hit){ const T=rand(10,40); this.makeDecoy(hit,T); this.consume(idx,true); this.turnStep(); this.render(); return; }
      if(hit){ it.effect(this,hit); } else { const dropped={...it}; this.onItemPlacedOnFloor(dropped,last.x,last.y); this.items.push(dropped); }
      this.consume(idx,true);
    }
    else if(it.type==='wand'){
      // 杖は「残り回数0でもOK」：投げたら効果発動（投擲で消費）
      if(typeof it.cast==='function'){ it.cast(this, hit, dx, dy); }
      else{ this.msg("何も起きなかった"); }
      this.inv.splice(idx,1);
    }
    else if(it.type==='weapon'){
      const wAtk = Math.max(0, num(it.atk,0) + num(it.plus,0));
      const base = Math.max(6, Math.floor(wAtk*3 + 4));
      if(hit){ this.hit({atk:0,x:this.p.x,y:this.p.y,name:"投擲"}, hit, base); }
      else { const dropped={...it}; this.onItemPlacedOnFloor(dropped,last.x,last.y); this.items.push(dropped); }
      this.inv.splice(idx,1);
    }
    else if(it.type==='armor'){
      const aDef = Math.max(0, num(it.def,0) + num(it.plus,0));
      const base = Math.max(5, Math.floor(aDef*2 + 3));
      if(hit){ this.hit({atk:0,x:this.p.x,y:this.p.y,name:"投擲"}, hit, base); }
      else { const dropped={...it}; this.onItemPlacedOnFloor(dropped,last.x,last.y); this.items.push(dropped); }
      this.inv.splice(idx,1);
    }
    else if(it.type==='potBomb'){
      const cx=hit?hit.x:last.x, cy=hit?hit.y:last.y;
      this.msg("壺が爆ぜた！");
      this.explode(cx,cy,3,12,true);
      this.consume(idx,true);
      fxSlash();
    }
    else{
      if(hit){ this.hit({atk:0,x:this.p.x,y:this.p.y,name:"投擲"}, hit,2); }
      else { const dropped={...it}; this.onItemPlacedOnFloor(dropped,last.x,last.y); this.items.push(dropped); }
      this.consume(idx,true);
    }
    this.turnStep(); this.render();
    if($("#invOL").style.display==='flex'){ this.openInv(); }
  }

  consume(idx,remove=true){ const it=this.inv[idx]; if(!it) return;
    if(it.type==='wand'){
      it.uses = Math.max(0, num(it.uses,0)-1);
      if(it.uses<=0){
        it.uses = 0;
        it.depleted = true;
        if(it.name && !it.name.includes('（空）')) it.name += '（空）';
        this.msg("杖の力が尽きた（投げると効果）");
      }
    }
    else if(remove){ this.inv.splice(idx,1); }
  }

  explode(cx,cy,r,d,breakWall){
    for(let y=cy-r;y<=cy+r;y++) for(let x=cx-r;x<=cx+r;x++){
      if(this.isOut(x,y)) continue;
      if((x-cx)**2+(y-cy)**2<=r*r){
        if(breakWall && this.isWall(x,y)) this.map[y][x]='.';
        const m=this.monAt(x,y); if(m) this.hit(this.p,m,d);
      }
    }
  }
  vacuumSlash(){
    const rid=this.roomIdAt(this.p.x,this.p.y);
    if(rid>=0){ let hit=0; for(const m of this.mons.slice()){ if(this.roomIdAt(m.x,m.y)===rid){ this.hit(this.p,m,10); hit++; } } this.msg(`真空斬り！ ${hit}体にダメージ`); }
    else{ let hit=0; this.forEachAround(this.p.x,this.p.y,(x,y)=>{ const t=this.monAt(x,y); if(t){ this.hit(this.p,t,8); hit++; }}); this.msg(`真空斬り！（周囲${hit}）`); }
  }
  sleepAll(t){ for(const m of this.mons) m.sleep=num(t,0); }
  forEachAround(x,y,fn){ for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ if(dx===0&&dy===0) continue; const nx=x+dx, ny=y+dy; if(this.isOut(nx,ny)) continue; fn(nx,ny);} }
  castWand(w,dx,dy){
    if(!w || w.type!=='wand'){ this.msg("振れない"); return; }
    if(num(w.uses,0)<=0 || w.depleted){ this.msg("杖は力を失っている（投げると効果）"); return; }
    let x=this.p.x, y=this.p.y, hit=null;
    for(let i=0;i<10;i++){ x+=dx; y+=dy; if(this.isOut(x,y)||this.isWall(x,y)) break; const m=this.monAt(x,y); if(m){ hit=m; break; } }
    w.cast(this, hit, dx, dy);
    const idx=this.inv.indexOf(w);
    if(idx>=0){ this.consume(idx,false); }
    this.turnStep(); this.render();
    if($("#invOL").style.display==='flex'){ this.openInv(); }
  }

  turnStep(){
    if(this.mode==='town'){
      this.turn++;
      if(this.turn%5===0 && num(this.p.hp,0)<num(this.p.maxHp,1)) this.p.hp=num(this.p.hp,0)+1;
      if(this.p.arm && this.p.arm.regen && this.turn%4===0) this.p.hp=Math.min(num(this.p.maxHp,1),num(this.p.hp,0)+1);
      return;
    }
    this.turn++;
    this.checkThiefState();
    if(this.turn%5===0 && num(this.p.hp,0)<num(this.p.maxHp,1)) this.p.hp=num(this.p.hp,0)+1;
    if(this.p.arm && this.p.arm.regen && this.turn%4===0) this.p.hp=Math.min(num(this.p.maxHp,1),num(this.p.hp,0)+1);
    if(this.turn%NATURAL_SPAWN_CHECK===0 && this.mons.length<NATURAL_SPAWN_MIN){
      const p=this.freeIn(null,true); if(p){ const t=choice(MON_SPAWN_POOL.slice(0,5)); const lv=Math.max(1,Math.floor(num(this.floor,1)/1)); this.mons.push(scaleMon(t,p.x,p.y,lv)); this.msg("どこからか気配が…"); }
    }
    // デコイ寿命
    for(const m of this.mons){ if(m.decoy){ m.decoyT=num(m.decoyT,0)-1; if(m.decoyT<=0){ m.decoy=false; this.msgGreen(`${m.name}の身代わり効果が切れた`); } } }
    this.enemyPhase();
    // 無敵（ターン制）：敵フェーズ後に1減らす（使用直後から効く）
    if(num(this.p.invincible,0)>0){
      const before = num(this.p.invincible,0);
      this.p.invincible = Math.max(0, before-1);
      if(before>0 && this.p.invincible===0) this.msg("無敵が切れた");
    }
  }

  // 敵AI（デコイ優先／デコイはモンスターを狙う）
  enemyPhase(){
    // デコイを探索
    const decoys = this.mons.filter(m=>m.decoy);
    const findNearest = (sx,sy, filterFn) => {
      let best=null, bd=1e9;
      for(const m of this.mons){ if(!filterFn(m)) continue; const d=Math.abs(m.x-sx)+Math.abs(m.y-sy); if(d<bd){ bd=d; best=m; } }
      return best;
    };

    for(const m of this.mons.slice()){
      if(m.sleep && m.sleep>0){ m.sleep--; continue; }
      if(m.stun){ m.stun--; continue; }
      const slowStep = m.slow? (this.turn%2===0) : true;
      if(!slowStep) continue;
      if(m.stop){ m.stop--; continue; }

      // 店主は「攻撃されるまで非敵対」
      if(m.ai==='shop' && !m.hostile){ continue; }

      if(Math.abs(m.x-this.p.x)<=1 && Math.abs(m.y-this.p.y)<=1 && !(m.x===this.p.x && m.y===this.p.y) && !m.decoy){
        this.hit(m,this.p,0); continue;
      }

      let target=null;
      if(m.decoy){
        // デコイは最も近い「自分以外のモンスター」を狙う
        target = findNearest(m.x,m.y, t=>t!==m );
      }else if(decoys.length){
        // 通常はデコイを最優先で狙う
        target = findNearest(m.x,m.y, t=>t.decoy );
      }else{
        // デコイがいない通常時
        target = this.p;
      }

      // 遠距離AI
      const inSame=(target!==this.p)? (this.roomIdAt(m.x,m.y)===this.roomIdAt(target.x,target.y)) : (this.roomIdAt(m.x,m.y)===this.roomIdAt(this.p.x,this.p.y));
      if(target===this.p){
        if( (m.x===this.p.x && Math.abs(m.y-this.p.y)<=10 && this.clearLine(m.x,m.y,this.p.x,this.p.y)) ||
            (m.y===this.p.y && Math.abs(m.x-this.p.x)<=10 && this.clearLine(m.x,m.y,this.p.x,this.p.y)) ){
							
					const dist = Math.max(Math.abs(this.p.x - m.x), Math.abs(this.p.y - m.y));
					if (m.ai === 'ranged' && dist >= 2 && dist <= 7 && this.hasLOS(m.x, m.y, this.p.x, this.p.y)) {
					  // 既存の与ダメ式・演出をそのまま維持（下は例）
					  this.msg(`${m.name}の遠距離攻撃！`);
					  const base = (m.name === 'ドラコ')
					    ? Math.max(5, 7 + Math.floor((this.floor - 5) * 0.6))
					    : 5;
					  this.hit(m, this.p, base);
					  return;
					}
        }
      }

      let step=null;
      if(target && target!==this.p){
        // ターゲットがモンスターの場合（= デコイ戦闘）
        const s=this.nextStep8(m.x,m.y,target.x,target.y);
        if(s) step=s;
      }else if(inSame){
        step=this.nextStep8(m.x,m.y,this.p.x,this.p.y);
      }else{
        const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
        while(dirs.length){ const d=dirs.splice(rand(0,dirs.length-1),1)[0]; const nx=m.x+d[0], ny=m.y+d[1]; if(!this.isOut(nx,ny)&&!this.isWall(nx,ny)&&!this.monAt(nx,ny)) { step=[nx,ny]; break; } }
      }

      if(step){
        const [nx,ny]=step;
        // 1ターン1行動：ここでは「移動 or 攻撃」のどちらかだけにする
        // 既に隣接している場合の攻撃は、上の隣接判定（continue）で処理済み。
        // ここでは基本的に「移動」し、ターゲットのマスへは踏み込まない（踏み込みそうなら攻撃扱い）。
        if(target && nx===target.x && ny===target.y){
          // ターゲットの位置へ踏み込む＝攻撃扱い（同マス移動はしない）
          this.hit(m, target===this.p ? this.p : target, 0);
        }else{
          if(!this.monAt(nx,ny)) { this.moveMonsterNoAnim(m,nx,ny); }
        }
      }

      if(m.spd===2){
        // 2倍速の追撃
        let t2 = (target && target!==this.p)? target : this.p;
        if(Math.abs(m.x-t2.x)<=1 && Math.abs(m.y-t2.y)<=1 && !(m.x===t2.x && m.y===t2.y)){ this.hit(m,t2,0); }
        else{ const s=this.nextStep8(m.x,m.y,t2.x,t2.y); if(s && !this.monAt(s[0],s[1])){ this.moveMonsterNoAnim(m,s[0],s[1]); } }
      }
    }
  }

  nextStep8(sx,sy,gx,gy){
    const vis=Array.from({length:this.h},()=>Array(this.w).fill(false));
    const q=[[sx,sy]]; vis[sy][sx]=true; const par={}; const key=(x,y)=>`${x},${y}`;
    const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    while(q.length){ const [x,y]=q.shift(); if(x===gx && y===gy) break;
      for(const d of dirs){ const nx=x+d[0], ny=y+d[1]; if(this.isOut(nx,ny)||vis[ny][nx]||this.isWall(nx,ny)) continue; vis[ny][nx]=true; par[key(nx,ny)]=[x,y]; q.push([nx,ny]); } }
    if(!vis[gy]||!vis[gy][gx]) return null;
    let cur=[gx,gy], prev=par[key(cur[0],cur[1])];
    while(prev && !(prev[0]===sx && prev[1]===sy)){ cur=prev; prev=par[key(cur[0],cur[1])]; }
    return cur;
  }
  clearLine(x1,y1,x2,y2){
    if(x1===x2){ const s=Math.min(y1,y2), e=Math.max(y1,y2); for(let y=s+1;y<e;y++) if(this.isWall(x1,y)) return false; return true; }
    if(y1===y2){ const s=Math.min(x1,x2), e=Math.max(x1,y2); for(let x=s+1;x<e;x++) if(this.isWall(x,y1)) return false; return true; }
    return false;
  }

  /* 所持品UI（整頓：重複タブ初期化対策） */
  openInv(){
    $("#invOL").style.display='flex';
    // ★ タブ置き場を必ず初期化
    const host=$("#invTabsHost"); host.innerHTML="";
    const list=$("#invList"); list.innerHTML="";

    const addGoldLine = ()=>{
      const gAmt = Math.max(0, num(this.p.gold,0));
      if(gAmt<=0) return;
      const d=document.createElement('div'); d.className='item'; d.dataset.gold='1';
      d.innerHTML=`<div>お金 ${gAmt}G</div><div class="dim">投げると金額ぶんダメージ</div>`;
      d.onclick=()=>this.openGoldMenu();
      list.appendChild(d);
    };


    const tbtn = $("#invOL .invSortToggle");
    if(tbtn){ tbtn.textContent = this.invTabbed ? "整頓：ON（解除）" : "整頓：OFF（有効）"; tbtn.onclick=()=>{ this.toggleInvTabbed(); }; }

    if(!this.invTabbed){
      addGoldLine();
      if(!this.inv.length){
        if(!list.children.length) list.innerHTML='<div class="dim">（空）</div>';
        return;
      }
      this.inv.forEach((it,i)=>{
        let nm=it.name; if((it.type==='weapon'||it.type==='armor') && it.plus) nm+=`+${num(it.plus,0)}`;
        if(it.type==='arrow') nm+=` x${num(it.count,0)}`;
        if( (it.type==='weapon' && this.p.wep===it) || (it.type==='armor' && this.p.arm===it) ) nm+=` (E)`;
        if( it.type==='arrow' && this.p.arrow && this.p.arrow.kind===it.kind ) nm+=` (E)`;
        if(it.unpaid) nm+=` [売]`;
        const d=document.createElement('div'); d.className='item';
        d.innerHTML=`<div>${nm}</div><div class="dim">${itemDesc(it)}</div>`;
        d.onclick=()=>this.openItemMenu(i); list.appendChild(d);
      });
      return;
    }

    // ==== タブ表示 ====
    const tabs = document.createElement('div'); tabs.className='tabs';
    host.appendChild(tabs); // ← hostにのみ挿入（増殖防止）
    const catToItems = {}; TAB_ORDER.forEach(c=>catToItems[c]=[]);
    for(const it of this.inv){ catToItems[catOf(it)].push(it); }
    TAB_ORDER.forEach(c=>{
      const b=document.createElement('div'); b.className='tab'; b.dataset.cat=c;
      const cnt = catToItems[c].length;
      b.textContent = `${TAB_LABEL[c]}${cnt?`（${cnt}）`:''}`;
      b.onclick = ()=>{
        [...tabs.children].forEach(x=>x.classList.toggle('active', x===b));
        renderTab(c);
      };
      tabs.appendChild(b);
    });

    const firstCat = TAB_ORDER.find(c=>catToItems[c].length) || TAB_ORDER[0];
    [...tabs.children].forEach(x=>x.classList.toggle('active', x.dataset.cat===firstCat));

    const renderTab=(cat)=>{
      list.innerHTML="";
      addGoldLine();
      const arr = catToItems[cat];
      if(!arr.length){
        if(!list.children.length) list.innerHTML='<div class="dim">（なし）</div>';
        return;
      }
      const sorted = sortByCategory(cat, [...arr]);
      const grouped = groupDisplay(sorted);
      grouped.forEach(g=>{
        const it=g.item; let nm=it.name;
        if((it.type==='weapon'||it.type==='armor') && it.plus) nm+=`+${num(it.plus,0)}`;
        if(it.type==='arrow') nm+=` x${g.members.reduce((s,x)=>s+num(x.count,0),0)}`;
        if( (it.type==='weapon' && this.p.wep && g.members.includes(this.p.wep)) ||
            (it.type==='armor' && this.p.arm && g.members.includes(this.p.arm)) ||
            (it.type==='arrow' && this.p.arrow && this.p.arrow.kind===it.kind) ){
          nm+=" (E)";
        }
        if(g.members.some(x=>x && x.unpaid)) nm+=` [売]`;
        if(g.count>1) nm+=`  ×${g.count}`;
        const d=document.createElement('div'); d.className='item';
        d.innerHTML=`<div>${nm}</div><div class="dim">${itemDesc(it)}</div>`;
        d.onclick=()=>{ const idx = this.inv.indexOf(g.members[0]); if(idx>=0){ this.openItemMenu(idx); } };
        list.appendChild(d);
      });
    };
    renderTab(firstCat);
  }
  closeInv(){ $("#invOL").style.display='none'; }
  flashInv(matchFn){
    if($("#invOL").style.display!=='flex') return;
    const list=$("#invList"); const nodes=[...list.children];
    let invIdx=0;
    nodes.forEach((nd)=>{
      nd.classList.remove('flash'); void nd.offsetWidth;
      if(nd.dataset && nd.dataset.gold==='1') return;
      const it = this.inv[invIdx++];
      if(matchFn && it && matchFn(it)) nd.classList.add('flash');
    });
  }
  toggleInvTabbed(){
    this.invTabbed = !this.invTabbed;
    localStorage.setItem('invTabbed', this.invTabbed ? 'ON' : 'OFF'); // 保存
    if(!this.invTabbed){
      const catBins = {}; TAB_ORDER.forEach(c=>catBins[c]=[]);
      for(const it of this.inv){ catBins[catOf(it)].push(it); }
      let ordered=[];
      for(const c of TAB_ORDER){
        const sorted = sortByCategory(c, [...catBins[c]]);
        ordered = ordered.concat(sorted);
      }
      this.inv = ordered;
    }
    if($("#invOL").style.display==='flex') this.openInv();
  }

  openItemMenu(i){
    const it=this.inv[i]; if(!it) return;
    $("#menuTitle").textContent=`『${it.name}』`;
    $("#menuDesc").textContent=itemDesc(it);
    const box=$("#menuBtns"); box.innerHTML="";
    const range=$("#menuRange");
    if(it.aoe || it.pierce || (it.type==='arrow' && it.kind) || (it.type==='wand' && (it.name.includes("爆裂")||it.name.includes("稲妻")||it.name.includes("部屋全滅")))){
      range.style.display='block'; range.textContent=rangeAsciiFor(it);
    } else { range.style.display='none'; }
    const add=(label,fn)=>{ const b=document.createElement('div'); b.className='pill'; b.textContent=label; b.onclick=()=>{ $("#menuOL").style.display='none'; fn(); }; box.appendChild(b); };
    if(it.type==='weapon' || it.type==='armor'){ add('装備する', ()=>this.useItemMenu(i)); add('投げる', ()=>this.throwItemMenu(i)); }
    else if(it.type==='arrow'){ add('装填する', ()=>this.useItemMenu(i)); add('投げる', ()=>this.throwItemMenu(i)); }
    else if(it.type==='pot' || it.type==='potBomb'){ add('壺を開く/使う', ()=>this.useItemMenu(i)); add('投げる', ()=>this.throwItemMenu(i)); }
    else { add('使う/振る', ()=>this.useItemMenu(i)); add('投げる', ()=>this.throwItemMenu(i)); }
    add('置く（足元に捨てる）', ()=>{ const t=this.itemAt(this.p.x,this.p.y); if(t){ this.msg("ここには置けない"); return;} const item=this.inv.splice(i,1)[0]; this.onItemPlacedOnFloor(item,this.p.x,this.p.y); this.items.push(item); this.msg(`${item.name}を置いた`); this.render(); });
    add('キャンセル', ()=>{});
    $("#menuOL").style.display='flex';
  }

  openPot(pot){
    $("#potOL").style.display='flex';
    $("#potTitle").textContent=`${pot.name} [容量:${num(pot.cap,1)}]`;
    const add=$("#potAdd"), take=$("#potTake"); const inPot=pot.contents||[]; add.innerHTML=""; take.innerHTML="";
    this.inv.forEach((it,i)=>{ if(it===pot) return; const full=(inPot.length>=num(pot.cap,1)); const d=document.createElement('div'); d.className='item'; d.innerHTML=`<div>${it.name}${it.type==='arrow'?' x'+num(it.count,0):''}</div><div class="dim">${full?'（満杯）':'入れる'}</div>`; d.onclick=()=>{ if(full){ this.msg("もう入らない"); return; } (pot.contents||(pot.contents=[])).push(it); this.inv.splice(i,1); this.msg(`${it.name}をしまった`); this.openPot(pot); this.render(); }; add.appendChild(d); });
    if(!inPot.length){ take.innerHTML='<div class="dim">空です</div>'; } else inPot.forEach((it,i)=>{ const d=document.createElement('div'); d.className='item'; d.innerHTML=`<div>${it.name}${it.type==='arrow'?' x'+num(it.count,0):''}</div><div class="dim">取り出す</div>`; d.onclick=()=>{ if(this.inv.length>=this.baseInvMax()){ this.msg("持ち物がいっぱい"); return;} this.inv.push(it); inPot.splice(i,1); this.msg(`${it.name}を取り出した`); this.openPot(pot); this.render(); }; take.appendChild(d); });
  }

  saveLocal(){ localStorage.setItem('save3', this.getCode()); this.msg("セーブしました"); }
getCode(){
  const payload = {
    floor: num(this.floor,1),
    gold: num(this.p.gold,0),
    ppHigh: this.getPunyopunyoHighScore(),
    ppScoreBook: this.getPunyopunyoScoreBook(),
    dsHigh: this.getDotShootHighScore(),
    dsScoreBook: this.getDotShootScoreBook(),
  };
  return 'R3:'+btoa(encodeURIComponent(JSON.stringify(payload)));
}
loadCode(code){
  try{
    if(!code.startsWith('R3:')) throw 0;
    const st = JSON.parse(decodeURIComponent(atob(code.slice(3))));
    this.floor = num(st.floor,1) || 1;
    this.p.gold = num(st.gold,0) || 0;

    // ぷんよスコア帳（あれば復元）
    if(st.ppHigh!=null) this.setPunyopunyoHighScore(num(st.ppHigh,0));
    if(st.ppScoreBook) this.setPunyopunyoScoreBook(st.ppScoreBook);

    // ドットシューティング スコア帳（あれば復元）
    if(st.dsHigh!=null) this.setDotShootHighScore(num(st.dsHigh,0));
    if(st.dsScoreBook) this.setDotShootScoreBook(st.dsScoreBook);

    this.gen(this.floor);
    this.msg("ロードしました");
  }catch(e){
    alert("読み込みに失敗しました");
  }
}

  escapeToTitle(reason){
    this.msg(reason||"脱出！");
    this.saveHoldToTitle();
    // 脱出後は「ローカルセーブから続き」を隠す（持ち物差異による上書き消失を防ぐ）
    try{ localStorage.setItem(LS_ESCAPED_FLAG, String(Date.now())); }catch(e){}
    showTitle();
  }

  win(msg){ this.msg(msg||"クリア！"); this.gameEnd(true); }
  gameOver(){
    this.msg(`あなたは倒れた… (到達:${num(this.floor,1)}F)`);
    // 返還タグ：死亡時に町へ返還（タグは消える）
    const ret=[];
    const pullIfTagged=(it)=>{
      if(!it) return;
      if(it.returnTag){
        const ser=Game._serializeItem(it);
        if(ser) { ser.returnTag=false; ret.push(ser); }
        // inv/equipから除去
        if(this.p.wep===it) this.p.wep=null;
        if(this.p.arm===it) this.p.arm=null;
        if(this.p.arrow===it) this.p.arrow=null;
        const idx=this.inv.indexOf(it);
        if(idx>=0) this.inv.splice(idx,1);
      }
    };
    pullIfTagged(this.p.wep);
    pullIfTagged(this.p.arm);
    if(ret.length){
      this.townLostFound = (this.townLostFound||[]).concat(ret);
      this.saveTownPersistent();
      this.msgGreen("タグ装備が町へ返還された！");
    }
    this.gameEnd(false);
  }
  gameEnd(){
    const score=Math.floor(num(this.floor,1)*(this.calcPlayerAtk()+this.calcPlayerDef()+num(this.p.str,10) + (this.p.wep?num(this.p.wep.atk,0)+num(this.p.wep.plus,0):0) + (this.p.arm?num(this.p.arm.def,0)+num(this.p.arm.plus,0):0) + num(this.p.maxHp,1)/2)+num(this.p.gold,0)/10);
    if(num(this.floor,1)>this.bestFloor){ this.bestFloor=num(this.floor,1); localStorage.setItem('bestF',this.bestFloor); }
    if(score>this.bestScore){ this.bestScore=score; localStorage.setItem('bestScore',this.bestScore); }
    localStorage.removeItem('save3'); showTitle();
  }

  makeBigRoom(){
    const r={x:1,y:1,w:this.w-2,h:this.h-2,id:999};
    for(let y=r.y;y<r.y+r.h;y++) for(let x=r.x;x<r.x+r.w;x++) this.map[y][x]='.';
    this.rooms=[r]; this.mhRoomIds.clear(); this.revealRoomAt(this.p.x,this.p.y,true); this.render();
  }

  renderFullMap(){
    let out="";
    for(let y=0;y<this.h;y++){
      for(let x=0;x<this.w;x++){
        if(!this.vis[y][x]){ out+="#"; continue; }
        const ch=this.map[y][x];
        if(this.p.x===x && this.p.y===y) out+='@';
        else if(this.monAt(x,y)) out+=this.monAt(x,y).ch;
        else if(this.itemAt(x,y)) out+=(this.itemAt(x,y).ch||'*');
        else out+=ch;
      } out+="\n";
    }
    $("#fullMap").textContent=out;
  }
}

// === LOS（壁越し不可：Bresenham の整数ライン走査） ===
Game.prototype.hasLOS = function(x0,y0,x1,y1){
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;

  while (true) {
    // 始点・終点は通過可。途中に壁があれば不可。
    if (!(x === x0 && y === y0) && !(x === x1 && y === y1)) {
      if (this.isWall(x, y)) return false;
    }
    if (x === x1 && y === y1) break;

    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return true;
};




/*** 初期化/入力 ***/
window.addEventListener('DOMContentLoaded', ()=>{
  let g=null;

  (function applyIOSInteractionLock(){
    const allowSel = (t)=>{
      try{
        return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]'));
      }catch(e){ return false; }
    };

    // 文字選択/コンテキストメニュー抑止
    document.addEventListener('selectstart', (e)=>{ if(allowSel(e.target)) return; e.preventDefault(); }, {passive:false});
    document.addEventListener('contextmenu', (e)=>{ if(allowSel(e.target)) return; e.preventDefault(); }, {passive:false});

    // スクロール/オーバースクロール抑止
    document.addEventListener('touchmove', (e)=>{ if(allowSel(e.target)) return; e.preventDefault(); }, {passive:false});

    // ピンチズーム/ダブルタップズーム抑止（iOS）
    document.addEventListener('gesturestart', (e)=>{ e.preventDefault(); }, {passive:false});
    document.addEventListener('gesturechange', (e)=>{ e.preventDefault(); }, {passive:false});
    document.addEventListener('gestureend', (e)=>{ e.preventDefault(); }, {passive:false});
    document.addEventListener('dblclick', (e)=>{ if(allowSel(e.target)) return; e.preventDefault(); }, {passive:false});
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e)=>{
      const now = Date.now();
      if(now - lastTouchEnd <= 300){
        if(!allowSel(e.target)) e.preventDefault();
      }
      lastTouchEnd = now;
    }, {passive:false});

    // 画面位置固定（慣性スクロール対策）
    const lock = ()=>{ try{ window.scrollTo(0,0); }catch(e){} };
    window.addEventListener('scroll', lock, {passive:true});
    lock();

    // body を固定化（Safariでの意図しないスクロールを減らす）
    try{
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.overflow = 'hidden';
    }catch(e){}
  })()

  // ---- DotShooter 単体起動（ローグライク/ミニゲーム一覧は廃止） ----
  try{ g = new Game(); }catch(e){ console.error(e); g=null; }
  try{ window._dotShooterGame = g; }catch(e){}

  // すぐにタイトル（スプラッシュ）を出す
  try{
    if(g && g.openDotShooterTitle) g.openDotShooterTitle(false, false);
    else{
      const ol = document.getElementById('dotShootOL'); if(ol) ol.style.display='flex';
      const sp = document.getElementById('dsSplash'); if(sp) sp.style.display='flex';
    }
  }catch(e){
    console.error(e);
  }
});


Game.prototype.normalizeShopkeepers = function(){
  if(!this.mons) return;
  for(const m of this.mons){
    if(m && m.ai==='shop' && (m.hostile===undefined || m.hostile===null)){
      m.hostile = false; m.isShop = true;
    }
  }
};


Game.prototype.tileSpan = function(x,y){
  const key = `${x},${y}`;
  const chWall = '#';
  const visible = !!(this.vis[y] && this.vis[y][x]);
  const data = `data-x="${x}" data-y="${y}"`;
  if(this.isOut(x,y)) return `<span class="cell" ${data}> </span>`;
  if(!visible) return `<span class="cell dimFog" ${data}>#</span>`;

  if(this.map[y][x] === chWall){
    const cls = this.shopWall.has(key) ? 'wall-shop' : (this.mhWall.has(key) ? 'wall-mh' : 'wall');
    return `<span class="cell ${cls}" ${data}>#</span>`;
  }
  const isPlayer = (this.p.x===x && this.p.y===y);
  const mon = this.monAt(x,y);
  const items = this.itemsAt(x,y);
  const stair = (this.map[y][x]==='>');

  if(isPlayer) return `<span class="cell player" ${data}>@</span>`;

  if(mon){
    const cls = (mon.ai==='town') ? 'mon-town' : ((mon.ai==='shop' && !mon.hostile)?'mon-shop':'mon-enemy');
    return `<span class="cell ${cls}" ${data}>${mon.ch}</span>`;
  }

  if(items.length){
    const it = items[0];
    const cls = (it.type==='gold' || it.ch==='$') ? 'map-gold' : 'map-item';
    return `<span class="cell ${cls}" ${data}>${it.ch || '*'}</span>`;
  }

  // Town tiles: render actual ground/building symbols
  if(this.mode==='town'){
    let cls='cell';
    const t=this.map[y][x];
    let ch=t;
    if(t==='>'){ cls+=' stair'; ch='>'; }
    else if(t==='.') cls+=' town-grass';
    else if(t==='=') cls+=' town-road';
    else if(t==='f'){ cls+=' town-flower'; ch='✿'; }
    else if(t==='T'){ cls+=' town-tree'; ch='♣'; }
    else if(t==='~'){ cls+=' town-water'; ch='≈'; }
    else if(['S','B','G','C'].includes(t)) cls+=' town-building';
    return `<span class="${cls}" ${data}>${ch}</span>`;
  }

  if(stair) return `<span class="cell stair" ${data}>></span>`;
  return `<span class="cell" ${data}>${this.nearStairs.has(key)?'·':'.'}</span>`;
}


/*
=== LEGACY (kept for reference / rollback safety) ===
-- dsForcePadVisible (old) --
dsForcePadVisible(reason=""){
    try{
      const ba = document.getElementById('dsBottomArea');
      if(ba){
        ba.style.display = 'flex';
        ba.style.visibility = 'visible';
        ba.style.opacity = '1';
        ba.style.pointerEvents = 'auto';
        ba.style.zIndex = '9999';
      }
      let pad = document.getElementById('dsPad');
      if(!pad && ba){
        // Recreate D-pad if it was removed for some reason
        pad = document.createElement('div');
        pad.id = 'dsPad';
        pad.className = 'dsJoy';
        const h = document.createElement('div');
        h.id = 'dsPadHandle';
        h.className = 'dsJoyHandle';
        const base = document.createElement('div');
        base.className = 'dsJoyBase';
        const knob = document.createElement('div');
        knob.id = 'dsPadKnob';
        knob.className = 'dsJoyKnob';
        pad.appendChild(h);
        pad.appendChild(base);
        pad.appendChild(knob);
        ba.insertBefore(pad, ba.firstChild);
      }
      if(pad){
        pad.style.display = 'block';
        pad.style.visibility = 'visible';
        pad.style.opacity = '1';
        pad.style.pointerEvents = 'auto';
        pad.style.zIndex = '9999';
      }
    }catch(e){}
  }

-- fixed-bottom draggable joystick (old) --
// virtual joystick pad (draggable) for iPhone-friendly movement
    const pad = btn('dsPad');
    const knob = btn('dsPadKnob');
    const handle = btn('dsPadHandle');

    // Ensure D-pad exists and is visible (some layouts/splash states could hide it)
    this.dsForcePadVisible('init');
    const bottomArea = $("#dsBottomArea");
    if(bottomArea){
      bottomArea.style.display = 'flex';
      bottomArea.style.visibility = 'visible';
      bottomArea.style.opacity = '1';
    }


    const joy = {drag:false, cx:0, cy:0, rad:48, padDrag:false, sx:0, sy:0, sl:0, st:0, area:null};

    const setMove = (ax, ay)=>{
      if(!this._ds || !this._ds.input) return;
      this._ds.input.ax = clamp(ax, -1, 1);
      this._ds.input.ay = clamp(ay, -1, 1);
    };

    const setKnob = (ax, ay)=>{
      if(!knob) return;
      const r = joy.rad;
      knob.style.setProperty('--dx', Math.round(ax*r)+'px');
      knob.style.setProperty('--dy', Math.round(ay*r)+'px');
    };

    const calcCenter = ()=>{
      if(!pad) return;
      const r = pad.getBoundingClientRect();
      // joystick center is the base center (not including handle), but close enough
      joy.cx = r.left + r.width/2;
      joy.cy = r.top + r.height/2;
      // a bit more sensitive: smaller radius means less finger travel
      joy.rad = Math.max(28, Math.min(r.width, r.height) * 0.22);
    };

    const joyDown = (e)=>{
      if(!this._ds || !this._ds.running) return;
      if(!pad) return;
      // avoid starting joystick control from the handle area
      if(handle && (e.target===handle)) return;
      joy.drag = true;
      calcCenter();
      try{ pad.setPointerCapture(e.pointerId); }catch(err){}
      joyMove(e);
    };
    const joyMove = (e)=>{
      if(!joy.drag) return;
      try{ e.preventDefault(); }catch(err){}
      const dx = e.clientX - joy.cx;
      const dy = e.clientY - joy.cy;
      let ax = dx / joy.rad;
      let ay = dy / joy.rad;
      const len = Math.hypot(ax, ay);
      if(len>1){ ax/=len; ay/=len; }

      // gentle curve + small boost (better near-center response)
      const dead = 0.04;
      const curve = (v)=>{
        const s = Math.sign(v);
        const a = Math.abs(v);
        if(a<dead) return 0;
        const n = (a-dead)/(1-dead);
        return clamp(s * Math.pow(n, 0.68) * 1.35, -1, 1);
      };
      ax = curve(ax);
      ay = curve(ay);
      setMove(ax, ay);
      setKnob(ax, ay);
    };
    const joyUp = (e)=>{
      if(!joy.drag) return;
      joy.drag = false;
      setMove(0,0);
      setKnob(0,0);
      try{ pad.releasePointerCapture(e.pointerId); }catch(err){}
    };

    if(pad){
      pad.addEventListener('pointerdown', joyDown, {passive:false});
      pad.addEventListener('pointermove', joyMove, {passive:false});
      pad.addEventListener('pointerup', joyUp);
      pad.addEventListener('pointercancel', joyUp);
      pad.addEventListener('pointerleave', joyUp);
    }

    // pad drag (handle)
    const loadPos = ()=>{
      try{
        const raw = localStorage.getItem('ds_pad_pos');
        if(!raw) return;
        const v = JSON.parse(raw);
        if(pad && v && isFinite(v.l) && isFinite(v.t)){
          pad.style.left = Math.max(0, v.l) + 'px';
          pad.style.top  = Math.max(0, v.t) + 'px';
        }
      }catch(err){}
    };
    const savePos = ()=>{
      if(!pad) return;
      try{
        localStorage.setItem('ds_pad_pos', JSON.stringify({l: pad.offsetLeft, t: pad.offsetTop}));
      }catch(err){}
    };
    loadPos();

    const clampPadPos = ()=>{
      if(!pad) return;
      const area = pad.parentElement || document.body;
      const ar = area.getBoundingClientRect();
      const pr = pad.getBoundingClientRect();
      const maxL = Math.max(0, Math.round(ar.width - pr.width));
      const maxT = Math.max(0, Math.round(ar.height - pr.height));
      let l = pad.offsetLeft;
      let t = pad.offsetTop;

      // NaN/undefined 対策（まれに0扱いにならず飛ぶことがある）
      if(!isFinite(l) || !isFinite(t)){
        l = 14;
        t = Math.max(14, maxT - 24);
      }

      const nl = clamp(l, 0, maxL);
      const nt = clamp(t, 0, maxT);
      if(nl!==l || nt!==t){
        pad.style.left = Math.round(nl) + 'px';
        pad.style.top  = Math.round(nt) + 'px';
        try{ savePos(); }catch(e){}
      }
    };

    // 読み込み直後に画面内へ収める（向き変更で外へ出た場合の復帰）
    setTimeout(clampPadPos, 0);
    window.addEventListener('resize', ()=>{ clampPadPos(); }, {passive:true});
    window.addEventListener('orientationchange', ()=>{ setTimeout(clampPadPos, 60); }, {passive:true});

    const dragDown = (e)=>{
      if(!pad || !handle) return;
      if(!this._ds || !this._ds.running) return;
      joy.padDrag = true;
      joy.area = pad.parentElement;
      joy.sx = e.clientX; joy.sy = e.clientY;
      joy.sl = pad.offsetLeft; joy.st = pad.offsetTop;
      try{ handle.setPointerCapture(e.pointerId); }catch(err){}
      try{ e.preventDefault(); }catch(err){}
    };
    const dragMove = (e)=>{
      if(!joy.padDrag || !pad) return;
      try{ e.preventDefault(); }catch(err){}
      const dx = e.clientX - joy.sx;
      const dy = e.clientY - joy.sy;
      const area = joy.area;
      const maxL = area ? Math.max(0, area.clientWidth  - pad.offsetWidth)  : 9999;
      const maxT = area ? Math.max(0, area.clientHeight - pad.offsetHeight) : 9999;
      const nl = clamp(joy.sl + dx, 0, maxL);
      const nt = clamp(joy.st + dy, 0, maxT);
      pad.style.left = Math.round(nl) + 'px';
      pad.style.top  = Math.round(nt) + 'px';
      calcCenter();
    };
    const dragUp = (e)=>{
      if(!joy.padDrag) return;
      joy.padDrag = false;
      savePos();
      try{ handle.releasePointerCapture(e.pointerId); }catch(err){}
    };

    if(handle){
      handle.addEventListener('pointerdown', dragDown, {passive:false});
      handle.addEventListener('pointermove', dragMove, {passive:false});
      handle.addEventListener('pointerup', dragUp);
      handle.addEventListener('pointercancel', dragUp);
    }

    
*/


/* === Added Weapons: Rock Interaction Series ===
 W1: Rock Pusher Gun
 W2: Rock Splitter Gun
 W3: Rock Homing Missile
*/
if(typeof window.DS_EXTRA_WEAPONS==='undefined'){
  window.DS_EXTRA_WEAPONS = true;

  // Rock pusher: rocks become moving shields
  window.dsRockPush = function(rock){
    if(!rock) return;
    rock.vy = -0.03;        // slow upward drift (normalized)
    rock.isShield = true;   // treat as shield if collision logic checks it
  };

  // Rock splitter: spawn random shards (do not vanish on rocks)
  window.dsRockSplit = function(x,y){
    if(typeof dsBullets==='undefined') return;
    for(let i=0;i<6;i++){
      dsBullets.push({x,y,vx:(Math.random()*0.1-0.05),vy:(Math.random()*0.1-0.05),dmg:4,life:120,noRockVanish:true});
    }
  };

  // Rock homing missile: slow, strong homing
  window.dsRockHoming = function(x,y){
    if(typeof dsBullets==='undefined') return;
    dsBullets.push({x,y,vx:0,vy:-0.02,homing:true,homingPow:1.0,dmg:18,life:200,missile:true,noRockVanish:true});
  };
}


// === DOTSTRIKE Perma (Persistent Growth) ===
function dsDefaultPerma(){
  return {
    v:1,
    updatedAt: Date.now(),
    weaponLvBonus:{},
    maxHpBonus:0,
    lastCarry:[]
  };
}
function dsLoadPerma(){
  try{
    const raw = localStorage.getItem(LS_DOTSTRIKE_PERMA);
    if(!raw) return dsDefaultPerma();
    const o = JSON.parse(raw);
    if(!o || o.v!==1) return dsDefaultPerma();
    o.weaponLvBonus = o.weaponLvBonus||{};
    o.maxHpBonus = o.maxHpBonus||0;
    o.lastCarry = Array.isArray(o.lastCarry)?o.lastCarry:[];
    return o;
  }catch(e){
    console.error("perma load failed", e);
    return dsDefaultPerma();
  }
}
function dsSavePerma(p){
  try{
    p.updatedAt = Date.now();
    localStorage.setItem(LS_DOTSTRIKE_PERMA, JSON.stringify(p));
  }catch(e){
    console.error("perma save failed", e);
  }
}
function dsResetPerma(){
  try{
    localStorage.removeItem(LS_DOTSTRIKE_PERMA);
  }catch(e){
    console.error("perma reset failed", e);
  }
}

// NOTE: The DotStrike UI binds reset button via dsInitUIOnce() with confirmation.

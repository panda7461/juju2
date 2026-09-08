const INITIAL_STATE = Object.freeze({
  player: 1000,
  enemy: 1200,
  energy: 45,
  combo: 0,
  score: 0,
  over: false,
  sound: true,
  danger: false,
  dodging: false,
});

let state = { ...INITIAL_STATE };
let enemyTimer;
let dangerTimer;
let audioContext;

const $ = (id) => document.getElementById(id);
const els = {
  arena: $('arena'),
  player: $('player'),
  enemy: $('enemy'),
  impact: $('impact'),
  message: $('message'),
  combo: $('combo'),
  energy: $('energy'),
  energyText: $('energyText'),
  playerHealth: $('playerHealth'),
  enemyHealth: $('enemyHealth'),
  playerHpText: $('playerHpText'),
  enemyHpText: $('enemyHpText'),
  enemyIntent: $('enemyIntent'),
  score: $('score'),
  modal: $('modal'),
  soundButton: $('soundBtn'),
};

function getAudioContext() {
  if (!state.sound) return null;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function tone(frequency, duration, type = 'sine', volume = 0.08, slide = 0) {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), context.currentTime + duration);
  gain.gain.setValueAtTime(volume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function sound(name) {
  if (!state.sound) return;
  const sounds = {
    rush: () => { tone(180, 0.12, 'square', 0.06, 260); setTimeout(() => tone(90, 0.18, 'sawtooth', 0.08, -30), 70); },
    flash: () => { tone(70, 0.45, 'sawtooth', 0.13, 500); setTimeout(() => tone(840, 0.16, 'square', 0.06, -500), 60); },
    domain: () => { [55, 82, 110, 165].forEach((note, index) => setTimeout(() => tone(note, 0.8, 'sawtooth', 0.055, 150), index * 80)); },
    warning: () => tone(520, 0.11, 'square', 0.045, -180),
    hit: () => tone(75, 0.28, 'sawtooth', 0.11, -35),
    dodge: () => tone(280, 0.22, 'sine', 0.07, 520),
    ready: () => { tone(440, 0.12, 'sine', 0.05, 220); setTimeout(() => tone(660, 0.18, 'sine', 0.05, 220), 100); },
  };
  sounds[name]?.();
}

function announce(text) {
  els.message.textContent = text;
  els.message.classList.remove('show');
  void els.message.offsetWidth;
  els.message.classList.add('show');
}

function update() {
  els.playerHealth.style.width = `${state.player / 10}%`;
  els.enemyHealth.style.width = `${state.enemy / 12}%`;
  els.energy.style.width = `${state.energy}%`;
  els.energyText.textContent = `${state.energy}%`;
  els.playerHpText.textContent = `${state.player} / 1000`;
  els.enemyHpText.textContent = `${state.enemy} / 1200`;
  els.combo.querySelector('strong').textContent = state.combo;
  els.combo.classList.toggle('show', state.combo > 0);
  els.score.textContent = String(state.score).padStart(6, '0');
  const domain = document.querySelector('[data-skill="domain"]');
  const wasLocked = domain.classList.contains('locked');
  domain.classList.toggle('locked', state.energy < 100);
  if (wasLocked && state.energy === 100) sound('ready');
}

function getDistance() {
  const player = els.player.getBoundingClientRect();
  const enemy = els.enemy.getBoundingClientRect();
  return Math.abs((player.left + player.width / 2) - (enemy.left + enemy.width / 2));
}

function impact(target) {
  els.impact.classList.remove('burst');
  void els.impact.offsetWidth;
  els.impact.classList.add('burst');
  target.classList.remove('hit');
  void target.offsetWidth;
  target.classList.add('hit');
}

function attack(type) {
  if (state.over) return;
  const moves = {
    rush: { cost: 10, damage: 90, name: '逕庭拳！', range: 260, sound: 'rush' },
    flash: { cost: 32, damage: 205, name: '黒 閃！', range: 330, sound: 'flash' },
    domain: { cost: 100, damage: 540, name: '領域展開——伏魔御厨子', range: Infinity, sound: 'domain' },
  };
  const move = moves[type];
  if (state.energy < move.cost) return announce('呪力不足');
  if (getDistance() > move.range) {
    state.combo = 0;
    announce('間合いが遠い');
    return update();
  }

  state.energy -= move.cost;
  const counterBonus = state.danger ? 1.5 : 1;
  const critical = type === 'flash' && Math.random() < 0.35;
  const damage = Math.round((move.damage + Math.random() * 25) * counterBonus * (critical ? 1.45 : 1));
  state.enemy = Math.max(0, state.enemy - damage);
  state.combo += 1;
  state.score += damage * (state.combo + (critical ? 4 : 0));
  sound(move.sound);
  impact(els.enemy);
  announce(critical ? '極致の黒閃！' : state.danger ? `カウンター ${move.name}` : move.name);
  cancelDanger();
  update();
  if (state.enemy <= 0) end(true);
}

function scheduleEnemyAttack(delay = 1500 + Math.random() * 1500) {
  clearTimeout(enemyTimer);
  if (!state.over) enemyTimer = setTimeout(warnEnemyAttack, delay);
}

function warnEnemyAttack() {
  if (state.over) return;
  state.danger = true;
  els.arena.classList.add('danger');
  els.enemyIntent.textContent = 'ATTACK INCOMING';
  sound('warning');
  dangerTimer = setTimeout(resolveEnemyAttack, 720);
}

function cancelDanger() {
  clearTimeout(dangerTimer);
  state.danger = false;
  els.arena.classList.remove('danger');
  els.enemyIntent.textContent = 'READ THE CURSE';
  scheduleEnemyAttack();
}

function resolveEnemyAttack() {
  if (state.over) return;
  state.danger = false;
  els.arena.classList.remove('danger');
  els.enemyIntent.textContent = 'READ THE CURSE';
  if (!state.dodging) {
    const damage = 90 + Math.floor(Math.random() * 85);
    state.player = Math.max(0, state.player - damage);
    state.combo = 0;
    sound('hit');
    impact(els.player);
    announce(`-${damage} 呪炎直撃`);
  }
  update();
  if (state.player <= 0) end(false);
  else scheduleEnemyAttack();
}

function dodge() {
  if (state.over || state.dodging) return;
  state.dodging = true;
  els.player.classList.remove('dodge');
  void els.player.offsetWidth;
  els.player.classList.add('dodge');
  if (state.danger) {
    state.energy = Math.min(100, state.energy + 22);
    state.score += 500;
    sound('dodge');
    announce('JUST回避 +22%');
    cancelDanger();
  } else {
    state.energy = Math.min(100, state.energy + 4);
    announce('回避 +4%');
  }
  setTimeout(() => { state.dodging = false; }, 460);
  update();
}

function movePlayer(direction) {
  if (state.over) return;
  const arena = els.arena.getBoundingClientRect();
  const fighter = els.player.getBoundingClientRect();
  const current = parseFloat(getComputedStyle(els.player).left);
  const next = current + (direction === 'left' ? -18 : 18);
  els.player.style.left = `${Math.max(8, Math.min(arena.width - fighter.width - 8, next))}px`;
}

function end(win) {
  state.over = true;
  clearTimeout(enemyTimer);
  clearTimeout(dangerTimer);
  setTimeout(() => {
    els.modal.classList.add('show');
    els.modal.setAttribute('aria-hidden', 'false');
    $('resultTitle').textContent = win ? '祓除完了' : '戦闘不能';
    $('resultText').textContent = win ? `SCORE ${state.score}・最大 ${state.combo} COMBO` : '予兆を見て、攻撃直前に回避しよう。';
  }, 500);
}

document.querySelectorAll('.skill').forEach((button) => button.addEventListener('click', () => attack(button.dataset.skill)));
document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  const key = event.key.toLowerCase();
  if (key === 'q') attack('rush');
  if (key === 'w') attack('flash');
  if (key === 'e') attack('domain');
  if (event.code === 'Space') { event.preventDefault(); dodge(); }
  if (key === 'a' || key === 'd') movePlayer(key === 'a' ? 'left' : 'right');
});
document.querySelectorAll('[data-move]').forEach((button) => {
  let timer;
  const stop = () => { clearInterval(timer); timer = undefined; };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    movePlayer(button.dataset.move);
    timer = setInterval(() => movePlayer(button.dataset.move), 70);
  });
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('lostpointercapture', stop);
});
$('dodgeButton').addEventListener('pointerdown', (event) => { event.preventDefault(); dodge(); });
$('restart').addEventListener('click', () => location.reload());
els.soundButton.addEventListener('click', () => {
  state.sound = !state.sound;
  els.soundButton.querySelector('b').textContent = state.sound ? 'ON' : 'OFF';
  els.soundButton.setAttribute('aria-pressed', String(state.sound));
  if (state.sound) { getAudioContext(); sound('ready'); }
});

setInterval(() => {
  if (!state.over && state.energy < 100) {
    state.energy = Math.min(100, state.energy + 1);
    update();
  }
}, 900);

update();
setTimeout(() => announce('戦闘開始'), 400);
scheduleEnemyAttack(1800);

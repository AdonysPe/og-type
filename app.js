import { words as englishWords } from './data.js';

const spanishWords = 'vida tiempo mundo casa trabajo mano forma parte lugar persona momento camino palabra historia noche punto nuevo siempre cada desde algo sobre hasta donde ahora mucho antes manera mismo aunque claro cerca luego poder hacer tener saber pensar mirar sentir escribir aprender ritmo tecla espacio texto calma foco seguir llegar volver empezar mejor pequeño grande bueno fácil rápido lento paso día tarde mañana libro gente idea aire mesa luz color frase voz signo sonido juego letra curso práctica prueba mente meta orden línea fondo vista serie cambio fuerza cuando mientras porque también entre hacia después además todavía pronto nunca aquí allá solo todos juntos'.split(' ');
const $ = (selector) => document.querySelector(selector);
const area = $('#typing-area');
const reading = $('#reading');
const input = $('#typing-input');
const result = $('#result');
const timer = $('#timer');
const progress = $('#progress');
const status = $('#status');
const liveWpm = $('#live-wpm');
const liveAccuracy = $('#live-accuracy');
const accuracyTrack = $('#accuracy-track');
const accuracyFill = $('#accuracy-fill');
const soundToggle = $('#sound-toggle');
const language = $('#language');
const best = $('#best');
const focusChrome = document.querySelectorAll('.site-header, .intro, .guide, .site-footer');
let soundEnabled = false;
let audioContext;
let clickBuffer;
const state = {
  duration: 30, words: [], index: 0, value: '', completedCorrect: 0,
  completedTyped: 0, startedAt: 0, remaining: 30, interval: null, finished: false
};

function shuffledWords(source) {
  const list = [];
  while (list.length < 220) {
    const batch = [...source];
    for (let i = batch.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [batch[i], batch[j]] = [batch[j], batch[i]];
    }
    list.push(...batch);
  }
  return list.slice(0, 220);
}

function bestKey() {
  return `ogtype-best-${language.value}-${state.duration}`;
}

function showBest() {
  try {
    const value = Number(localStorage.getItem(bestKey()));
    best.textContent = value > 0 ? `${value} PPM · ${state.duration} s` : 'Aún no hay sesiones';
  } catch {
    best.textContent = 'No disponible en este navegador';
  }
}

function setFocusMode(active) {
  document.body.classList.toggle('is-focused', active);
  // Hidden navigation must also leave the keyboard and screen-reader order.
  focusChrome.forEach((element) => { element.inert = active; });
}

function reset() {
  clearInterval(state.interval);
  setFocusMode(false);
  Object.assign(state, {
    words: shuffledWords(language.value === 'es' ? spanishWords : englishWords),
    index: 0, value: '', completedCorrect: 0, completedTyped: 0,
    startedAt: 0, remaining: state.duration, interval: null, finished: false
  });
  const fragment = document.createDocumentFragment();
  state.words.forEach((word) => {
    const wordEl = document.createElement('span');
    wordEl.className = 'word';
    for (const char of word) {
      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = char;
      wordEl.append(letter);
    }
    fragment.append(wordEl);
  });
  reading.replaceChildren(fragment);
  reading.scrollTop = 0;
  area.hidden = false;
  result.classList.remove('visible');
  input.value = '';
  timer.textContent = state.duration;
  progress.style.transform = 'scaleX(0)';
  status.textContent = 'Listo para empezar';
  liveWpm.textContent = '0';
  liveAccuracy.textContent = '—';
  accuracyFill.style.transform = 'scaleX(0)';
  accuracyTrack.removeAttribute('aria-valuenow');
  accuracyTrack.setAttribute('aria-valuetext', 'Sin datos');
  updateLetters();
  showBest();
}

function counts() {
  const target = state.words[state.index] || '';
  const currentCorrect = [...state.value].filter((char, i) => char === target[i]).length;
  return {
    correct: state.completedCorrect + currentCorrect,
    typed: state.completedTyped + state.value.length
  };
}

function updateMetrics() {
  const { correct, typed } = counts();
  const elapsed = state.startedAt ? Math.max((Date.now() - state.startedAt) / 1000, 1) : 0;
  // PPM uses the standard five-correct-characters-per-word convention.
  liveWpm.textContent = elapsed ? String(Math.round((correct / 5) / (elapsed / 60))) : '0';
  const accuracy = typed ? Math.round(correct / typed * 100) : null;
  liveAccuracy.textContent = accuracy === null ? '—' : String(accuracy);
  accuracyFill.style.transform = `scaleX(${accuracy === null ? 0 : accuracy / 100})`;
  if (accuracy === null) {
    accuracyTrack.removeAttribute('aria-valuenow');
    accuracyTrack.setAttribute('aria-valuetext', 'Sin datos');
  } else {
    accuracyTrack.setAttribute('aria-valuenow', String(accuracy));
    accuracyTrack.setAttribute('aria-valuetext', `${accuracy} por ciento`);
  }
}

function updateLetters() {
  const wordEl = reading.children[state.index];
  if (!wordEl) return;
  wordEl.classList.add('current');
  $('#current-word').textContent = `Palabra actual: ${state.words[state.index]}`;
  [...wordEl.children].forEach((letter, i) => {
    letter.className = 'letter';
    if (i < state.value.length) letter.classList.add(state.value[i] === letter.textContent ? 'correct' : 'incorrect');
  });
  const position = Math.min(state.value.length, wordEl.children.length - 1);
  wordEl.children[position]?.classList.add('active');
  if (state.value.length >= wordEl.children.length) wordEl.children[position]?.classList.add('end');
  reading.scrollTop = Math.max(0, wordEl.offsetTop - reading.offsetTop - 60);
  updateMetrics();
}

function start() {
  if (state.startedAt) return;
  state.startedAt = Date.now();
  setFocusMode(true);
  status.textContent = 'Sesión en curso';
  state.interval = setInterval(() => {
    state.remaining = Math.max(0, state.duration - (Date.now() - state.startedAt) / 1000);
    timer.textContent = String(Math.ceil(state.remaining));
    progress.style.transform = `scaleX(${1 - state.remaining / state.duration})`;
    updateMetrics();
    if (state.remaining <= 0) finish();
  }, 100);
}

function commitWord() {
  if (state.finished || !state.value.length) return;
  const word = state.words[state.index];
  const wordEl = reading.children[state.index];
  const correct = [...state.value].filter((char, i) => char === word[i]).length;
  state.completedCorrect += correct;
  state.completedTyped += Math.max(state.value.length, word.length);
  wordEl.classList.remove('current');
  wordEl.classList.add('completed');
  if (state.value !== word) wordEl.classList.add('missed');
  wordEl.querySelectorAll('.active').forEach((letter) => letter.classList.remove('active', 'end'));
  state.index++;
  state.value = '';
  input.value = '';
  if (state.index >= state.words.length) {
    finish();
    return;
  }
  updateLetters();
}

function finish() {
  if (state.finished) return;
  state.finished = true;
  clearInterval(state.interval);
  setFocusMode(false);
  const { correct, typed } = counts();
  const elapsed = state.startedAt ? Math.min(state.duration, Math.max((Date.now() - state.startedAt) / 1000, 1)) : state.duration;
  const wpm = Math.round((correct / 5) / (elapsed / 60));
  const accuracy = typed ? Math.round(correct / typed * 100) : 0;
  $('#result-wpm').textContent = String(wpm);
  $('#result-accuracy').textContent = `${accuracy}%`;
  $('#result-message').textContent = typed
    ? 'Cada sesión es un paso más hacia tu ritmo.'
    : 'Prueba de nuevo y empieza a escribir cuando estés listo.';
  try {
    if (typed && wpm > Number(localStorage.getItem(bestKey()) || 0)) {
      localStorage.setItem(bestKey(), String(wpm));
    }
  } catch {}
  showBest();
  area.hidden = true;
  result.classList.add('visible');
  status.textContent = 'Sesión terminada';
  input.blur();
}

input.addEventListener('input', () => {
  if (state.finished) return;
  playKeySound();
  const raw = input.value.toLowerCase();
  if (/\s/.test(raw)) {
    state.value = raw.split(/\s/)[0];
    if (state.value) {
      start();
      updateLetters();
      commitWord();
    } else input.value = '';
    return;
  }
  state.value = raw.slice(0, Math.max(state.words[state.index].length, 1));
  input.value = state.value;
  if (state.value) start();
  updateLetters();
});

input.addEventListener('keydown', (event) => {
  if (event.key === ' ') {
    event.preventDefault();
    playKeySound();
    commitWord();
  }
});
area.addEventListener('click', () => input.focus());
area.addEventListener('keydown', (event) => {
  if (event.target === area && event.key === 'Enter') {
    event.preventDefault();
    input.focus();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    reset();
    input.focus();
    return;
  }
  if (state.finished || event.altKey || event.ctrlKey || event.metaKey || event.key.length !== 1 || /INPUT|SELECT|BUTTON|TEXTAREA/.test(document.activeElement.tagName)) return;
  event.preventDefault();
  input.focus();
  if (event.key === ' ') {
    playKeySound();
    commitWord();
  }
  else {
    input.value += event.key;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
// A short filtered noise burst makes a key click without loading audio assets.
function playKeySound() {
  if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  source.buffer = clickBuffer;
  filter.type = 'highpass';
  filter.frequency.value = 750;
  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  source.connect(filter).connect(gain).connect(audioContext.destination);
  source.start(now);
  source.stop(now + 0.025);
}

soundToggle.addEventListener('click', async () => {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      soundToggle.disabled = true;
      soundToggle.title = 'El sonido no está disponible en este navegador';
      return;
    }
    audioContext = new AudioContextClass();
    clickBuffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * 0.025), audioContext.sampleRate);
    const samples = clickBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
  }
  if (audioContext.state === 'suspended') await audioContext.resume();
  soundEnabled = !soundEnabled;
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
  soundToggle.setAttribute('aria-label', soundEnabled ? 'Desactivar sonido de teclas' : 'Activar sonido de teclas');
  soundToggle.title = soundEnabled ? 'Sonido de teclas activado' : 'Sonido de teclas desactivado';
});
document.querySelectorAll('.duration').forEach((button) => button.addEventListener('click', () => {
  state.duration = Number(button.dataset.seconds);
  document.querySelectorAll('.duration').forEach((item) => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  reset();
}));
language.addEventListener('change', reset);
$('#reset').addEventListener('click', reset);
$('#retry').addEventListener('click', () => {
  reset();
  input.focus();
});
reset();

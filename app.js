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
const language = $('#language');
const best = $('#best');
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

function reset() {
  clearInterval(state.interval);
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
  liveWpm.textContent = elapsed ? String(Math.round((correct / 5) / (elapsed / 60))) : '0';
  liveAccuracy.textContent = typed ? String(Math.round(correct / typed * 100)) : '—';
}

function updateLetters() {
  const wordEl = reading.children[state.index];
  if (!wordEl) return;
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
    commitWord();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    reset();
    input.focus();
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
  if (state.finished || event.altKey || event.ctrlKey || event.metaKey || event.key.length !== 1 || /INPUT|SELECT|BUTTON|TEXTAREA/.test(document.activeElement.tagName)) return;
  event.preventDefault();
  input.focus();
  if (event.key === ' ') commitWord();
  else {
    input.value += event.key;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
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

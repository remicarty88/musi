const $ = (s) => document.querySelector(s);
const audio = $('#audio');
let queue = [];
let index = -1;

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function api(path) {
  const r = await fetch(path);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Ошибка ${r.status}`);
  return data;
}

function setCover(el, url) {
  el.style.backgroundImage = url ? `url("${url}")` : '';
}

function showMessage(text) {
  $('#msg').textContent = text;
}

function renderList() {
  const list = $('#list');
  list.replaceChildren();
  queue.forEach((t, i) => {
    const li = document.createElement('li');
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row';
    row.dataset.i = i;

    const cover = document.createElement('div');
    cover.className = 'cover';
    setCover(cover, t.cover);

    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = t.title;
    const artist = document.createElement('span');
    artist.textContent = t.artists;
    info.append(title, artist);

    const time = document.createElement('time');
    time.textContent = fmt(t.duration);

    row.append(cover, info, time);
    row.addEventListener('click', () => play(i));
    li.append(row);
    list.append(li);
  });
  markActive();
}

function markActive() {
  document.querySelectorAll('.row').forEach((r) => {
    r.classList.toggle('active', Number(r.dataset.i) === index);
  });
}

async function load(path, emptyText) {
  showMessage('Загружаю…');
  try {
    queue = await api(path);
    index = -1;
    renderList();
    showMessage(queue.length ? '' : emptyText);
  } catch (e) {
    showMessage(e.message);
  }
}

async function play(i) {
  const t = queue[i];
  if (!t) return;
  index = i;
  markActive();
  $('#player').hidden = false;
  $('#now-title').textContent = t.title;
  $('#now-artist').textContent = t.artists;
  setCover($('#now-cover'), t.cover);
  try {
    const { url } = await api(`/api/stream/${encodeURIComponent(t.id)}`);
    audio.src = url;
    await audio.play();
  } catch (e) {
    showMessage(`Не удалось запустить «${t.title}»: ${e.message}`);
  }
}

const step = (d) => queue.length && play((index + d + queue.length) % queue.length);

// Поиск и вкладки
$('#search').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#q').value.trim();
  if (q) load(`/api/search?q=${encodeURIComponent(q)}`, 'Ничего не нашлось. Попробуйте другой запрос.');
});

function setTab(name) {
  $('#tab-search').classList.toggle('on', name === 'search');
  $('#tab-likes').classList.toggle('on', name === 'likes');
}
$('#tab-search').addEventListener('click', () => setTab('search'));
$('#tab-likes').addEventListener('click', () => {
  setTab('likes');
  load('/api/likes', 'В «Мне нравится» пока пусто.');
});

// Плеер
$('#toggle').addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));
$('#prev').addEventListener('click', () => step(-1));
$('#next').addEventListener('click', () => step(1));
audio.addEventListener('play', () => ($('#toggle').textContent = '⏸'));
audio.addEventListener('pause', () => ($('#toggle').textContent = '▶'));
audio.addEventListener('ended', () => step(1));
audio.addEventListener('loadedmetadata', () => {
  $('#dur').textContent = fmt(audio.duration);
  const t = queue[index];
  if (t && t.duration && audio.duration < t.duration * 0.6) {
    showMessage(`«${t.title}»: пришёл отрывок ${fmt(audio.duration)} вместо ${fmt(t.duration)}. Яндекс отдаёт превью для этого токена или аккаунта.`);
  }
});
audio.addEventListener('timeupdate', () => {
  $('#cur').textContent = fmt(audio.currentTime);
  if (audio.duration) $('#bar').value = (audio.currentTime / audio.duration) * 100;
});
$('#bar').addEventListener('input', (e) => {
  if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
});

api('/api/status').then((s) => {
  if (!s.authorized) {
    showMessage(s.error
      ? `Токен не принят Яндексом: ${s.error}. Получите новый токен и перезапустите сервер.`
      : 'Сервер запущен без токена: будут отрывки по 30 секунд. Задайте YANDEX_MUSIC_TOKEN или файл token.txt.');
  } else if (s.plus === false) {
    showMessage(`Вход выполнен (${s.login}), но на аккаунте нет Яндекс Плюс: часть треков может играть отрывками.`);
  } else {
    showMessage(`Вы вошли как ${s.login || 'пользователь'}. Введите название трека или исполнителя.`);
  }
}).catch(() => {});

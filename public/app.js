// Tidy: 페이지 트리 + 블록 편집기. 이 브라우저의 localStorage에 저장하고, 로그인하면 cloud.js가 Firestore와 동기화한다.
const KEY = 'note.v1';
const $ = (s, el = document) => el.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 사이드바용 얇은 선 아이콘
const ICON = {"plus": "<svg viewBox=\"0 0 20 20\" width=\"16\" height=\"16\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 4.5v11M4.5 10h11\"/></svg>", "trash": "<svg viewBox=\"0 0 20 20\" width=\"16\" height=\"16\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 6h12M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6\"/></svg>", "chev": "<svg viewBox=\"0 0 20 20\" width=\"16\" height=\"16\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 5.5l4.5 4.5L8 14.5\"/></svg>"};
const ICONS = ['📄', '📝', '📌', '💡', '📚', '🗂️', '✅', '🎯', '🌱', '☕️', '🧠', '📅', '✈️', '🎨', '🎵', '🍀',
  '🏠', '💼', '💰', '🛒', '🍳', '🏃', '❤️', '⭐️', '🔥', '🌙', '📷', '🎁', '🧩', '🔖', '📮', '🐶'];

const TYPES = {
  text: { label: '텍스트', hint: '일반 글을 써요', ico: 'Aa', keys: 'text 텍스트 글' },
  h1: { label: '제목 1', hint: '큰 제목', ico: 'H1', keys: 'h1 heading 제목' },
  h2: { label: '제목 2', hint: '중간 제목', ico: 'H2', keys: 'h2 heading 제목' },
  h3: { label: '제목 3', hint: '작은 제목', ico: 'H3', keys: 'h3 heading 제목' },
  bullet: { label: '글머리 기호 목록', hint: '점으로 나열해요', ico: '•', keys: 'bullet list 목록 글머리' },
  number: { label: '번호 목록', hint: '번호를 붙여 나열해요', ico: '1.', keys: 'number numbered list 번호 목록' },
  todo: { label: '할 일 목록', hint: '체크박스로 관리해요', ico: '☑', keys: 'todo check task 할일 할 일 체크' },
  quote: { label: '인용', hint: '인용문을 적어요', ico: '❝', keys: 'quote 인용' },
  toggle: { label: '토글 목록', hint: '눌러서 접고 펼쳐요', ico: '▸', keys: 'toggle 토글 접기 펼치기' },
  callout: { label: '콜아웃', hint: '눈에 띄게 강조해요', ico: '💡', keys: 'callout 콜아웃 강조' },
  code: { label: '코드', hint: '코드를 적어요', ico: '</>', keys: 'code 코드' },
  divider: { label: '구분선', hint: '구역을 나눠요', ico: '—', keys: 'divider hr line 구분선 선' },
  image: { label: '이미지', hint: '사진을 올려요', ico: '🖼', keys: 'image 이미지 사진 갤러리 gallery' },
  file: { label: '파일', hint: '파일을 올려요 (700KB까지)', ico: '📎', keys: 'file 파일 첨부' },
  math: { label: '공식', hint: 'LaTeX 수식을 써요', ico: 'ƒx', keys: 'math 공식 수식 latex' },
  table: { label: '표', hint: '칸을 나눠 정리해요', ico: '▦', keys: 'table 표 테이블' },
  page: { label: '페이지', hint: '안에 새 페이지를 만들어요', ico: '📄', keys: 'page 페이지 하위' },
};
const PH = { text: "'/'를 입력해 명령어 사용", h1: '제목 1', h2: '제목 2', h3: '제목 3', bullet: '목록', number: '목록', todo: '할 일', quote: '인용', callout: '내용을 입력하세요', code: '코드', toggle: '토글', math: '수식 (LaTeX)  예: E = mc^2' };
const LISTS = ['bullet', 'number', 'todo'];

/* ---------- 저장 ---------- */

function makePage(parent, title = '', icon = '📄', blocks) {
  const p = { id: uid(), parent, title, icon, children: [], open: true, updated: Date.now(),
    blocks: blocks || [{ id: uid(), type: 'text', html: '' }] };
  db.pages[p.id] = p;
  (parent ? db.pages[parent].children : db.root).push(p.id);
  return p;
}

function seed() {
  db = { root: [], pages: {} };
  const b = (type, html, extra) => ({ id: uid(), type, html, ...extra });
  const tg = (title, items) => [b('toggle', title, { open: true }), ...items.map(t => b('bullet', t, { indent: 1 }))];
  makePage(null, 'Tidy 시작하기', '', [
    b('text', '생각을 가볍게 적고, 깔끔하게 정리하는 노트예요.'),
    b('text', ''),
    ...tg('블록 만들기', [
      '빈 줄에서 <b>/</b> 를 누르면 블록 메뉴가 열려요.',
      '위쪽 <b>＋</b> 버튼으로 이미지, 표, 공식을 넣을 수 있어요.',
      '블록 왼쪽 ⋮⋮ 를 끌어서 순서를 바꿔요.',
    ]),
    ...tg('빠르게 쓰기', [
      '<code># </code> 제목 · <code>- </code> 목록 · <code>[] </code> 할 일 · <code>&gt; </code> 인용',
      '<b>Tab</b> 들여쓰기 · <b>Shift+Tab</b> 내어쓰기',
      '다른 앱에서 복사한 목록과 할 일도 그대로 붙여넣어져요.',
    ]),
    ...tg('단축키', [
      '<b>⌘A</b> 두 번 누르면 페이지 전체 선택',
      '<b>⌘Z</b> 되돌리기 · <b>⇧⌘Z</b> 다시 하기',
      '<b>⌘K</b> 페이지 검색 · <b>⌘\\</b> 사이드바 접기',
    ]),
    ...tg('저장과 공유', [
      '쓰는 대로 자동 저장돼요.',
      '<b>구글로 로그인</b>하면 모든 기기에서 이어서 써요.',
      '오른쪽 위 <b>공유</b>에서 PDF, Word, Markdown으로 내보내요.',
    ]),
  ]);
  return db;
}

let db;
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.pages && Array.isArray(d.root)) return d;
  } catch {}
  return seed();
}
db = load();

/* ---------- 되돌리기 (⌘Z / ⇧⌘Z) ---------- */

const hist = { page: null, last: null, undo: [], redo: [], timer: null, restoring: false };
const snap = () => JSON.stringify({ title: db.pages[hist.page]?.title, icon: db.pages[hist.page]?.icon, blocks: db.pages[hist.page]?.blocks });
function histReset() {
  clearTimeout(hist.timer);
  hist.page = cur;
  hist.last = cur ? snap() : null;
  hist.undo = [];
  hist.redo = [];
}
function checkpoint() {
  clearTimeout(hist.timer);
  hist.timer = null;
  if (!hist.page || hist.restoring || !db.pages[hist.page]) return;
  const now = snap();
  if (now === hist.last) return;
  hist.undo.push(hist.last);
  if (hist.undo.length > 200) hist.undo.shift();
  hist.redo = [];
  hist.last = now;
}
function restore(from, to) {
  checkpoint();
  if (!from.length) return flash(to === hist.redo ? '더 되돌릴 게 없어요' : '다시 할 게 없어요');
  to.push(hist.last);
  hist.last = from.pop();
  const state = JSON.parse(hist.last), p = db.pages[hist.page];
  hist.restoring = true;
  p.title = state.title;
  p.icon = state.icon;
  p.blocks = state.blocks;
  const keep = lastBlockId && p.blocks.some(b => b.id === lastBlockId) ? lastBlockId : null;
  renderPage();
  renderTree();
  if (keep) place(keep, -1);
  save();
  hist.restoring = false;
}
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || !cur) return;
  e.preventDefault();
  if (e.shiftKey) restore(hist.redo, hist.undo); else restore(hist.undo, hist.redo);
}, true);

let saveTimer;
function save() {
  // 입력은 0.6초 단위로 묶어서 되돌리기 한 번에 들어가게 한다
  if (!hist.restoring && hist.page === cur) { clearTimeout(hist.timer); hist.timer = setTimeout(checkpoint, 600); }
  const p = db.pages[cur];
  if (p) p.updated = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      if (!window.cloud?.user) flash('저장됨');
    } catch {
      flash('저장하지 못했어요');
    }
    window.cloud?.schedule();
  }, 300);
}
function flash(msg) {
  const el = $('#saved');
  el.textContent = msg;
  el.style.opacity = 1;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => { el.style.opacity = 0; }, 1400);
}

/* ---------- 페이지 ---------- */

let cur = null;
const page = () => db.pages[cur];
const blk = id => page().blocks.find(b => b.id === id);
const idx = id => page().blocks.findIndex(b => b.id === id);

function pathOf(id) {
  const out = [];
  for (let p = db.pages[id]; p; p = db.pages[p.parent]) out.unshift(p);
  return out;
}

function go(id) {
  if (!db.pages[id]) id = db.root[0] || makePage(null, '', '📄').id;
  location.hash = `#/p/${id}`;
}

function deletePage(id) {
  const p = db.pages[id];
  if (!p) return;
  [...p.children].forEach(deletePage);
  const list = p.parent ? db.pages[p.parent]?.children : db.root;
  if (list) list.splice(list.indexOf(id), 1);
  delete db.pages[id];
}

function removePageWithConfirm(id) {
  const p = db.pages[id];
  const n = countDesc(id);
  const msg = `'${p.title || '제목 없음'}' 페이지${n ? `와 하위 페이지 ${n}개` : ''}를 삭제할까요? 되돌릴 수 없어요.`;
  if (!confirm(msg)) return;
  const back = p.parent;
  const wasOpen = pathOf(cur).some(x => x.id === id);
  deletePage(id);
  // 지운 페이지를 가리키던 링크 블록도 함께 지운다
  Object.values(db.pages).forEach(p => { p.blocks = p.blocks.filter(b => b.type !== 'page' || db.pages[b.page]); });
  save();
  if (wasOpen) go(back || db.root[0]); else { renderTree(); renderBlocks(); }
}
const countDesc = id => db.pages[id].children.reduce((n, c) => n + 1 + countDesc(c), 0);

/* ---------- 사이드바 ---------- */

function renderTree() {
  const q = $('#search').value.trim().toLowerCase();
  const tree = $('#tree');
  if (q) {
    const hits = Object.values(db.pages).filter(p => (p.title || '제목 없음').toLowerCase().includes(q));
    tree.innerHTML = hits.length ? hits.map(p => treeItem(p.id, 0, true)).join('') : '<p class="empty-tree">찾는 페이지가 없어요</p>';
    return;
  }
  tree.innerHTML = db.root.length ? db.root.map(id => treeItem(id, 0)).join('') : '<p class="empty-tree">페이지가 없어요</p>';
}

function treeItem(id, depth, flat) {
  const p = db.pages[id];
  const kids = p.children.length;
  const tw = flat || !kids ? '' : ICON.chev;
  return `<div class="ti${id === cur ? ' on' : ''}${p.open ? ' open' : ''}" data-id="${id}" role="treeitem" style="padding-left:${4 + depth * 14}px">
      <button class="tw" data-act="toggle" aria-label="${p.open ? '접기' : '펼치기'}" ${kids && !flat ? '' : 'tabindex="-1"'}>${tw}</button>
      <span class="ti-ico emoji">${esc(p.icon)}</span>
      <span class="ti-title">${esc(p.title || '제목 없음')}</span>
      <button class="ti-btn" data-act="add" aria-label="하위 페이지 추가" title="하위 페이지 추가">${ICON.plus}</button>
      <button class="ti-btn" data-act="del" aria-label="페이지 삭제" title="삭제">${ICON.trash}</button>
    </div>${kids && p.open && !flat ? p.children.map(c => treeItem(c, depth + 1)).join('') : ''}`;
}

$('#tree').addEventListener('click', e => {
  const row = e.target.closest('.ti');
  if (!row) return;
  const id = row.dataset.id, act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'toggle') {
    if (!db.pages[id].children.length) return go(id);
    db.pages[id].open = !db.pages[id].open;
    save();
    return renderTree();
  }
  if (act === 'add') {
    db.pages[id].open = true;
    const p = makePage(id);
    // 노션처럼 상위 페이지 본문에도 링크를 남긴다
    db.pages[id].blocks.push({ id: uid(), type: 'page', html: '', page: p.id });
    save();
    return go(p.id);
  }
  if (act === 'del') return removePageWithConfirm(id);
  go(id);
});
$('#search').addEventListener('input', renderTree);
// 검색창은 돋보기를 눌렀을 때만 보인다
function toggleSearch(show) {
  const input = $('#search');
  input.hidden = !show;
  $('#searchBtn').classList.toggle('on', show);
  if (show) return input.focus();
  if (input.value) { input.value = ''; renderTree(); }
}
$('#searchBtn').onclick = () => toggleSearch($('#search').hidden);
$('#search').addEventListener('keydown', e => { if (e.key === 'Escape') toggleSearch(false); });
$('#search').addEventListener('blur', e => { if (!e.target.value) toggleSearch(false); });
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (isMobile && isMobile()) setSide(true);
    toggleSearch(true);
  }
});
$('#newPage').onclick = () => { const p = makePage(null); save(); go(p.id); };

/* ---------- 문서 그리기 ---------- */

function renderPage() {
  const p = page();
  $('.doc').hidden = false;
  $('#all').hidden = true;
  $('#moreBtn').hidden = false;
  $('.doc').classList.toggle('full', !!p.full);
  document.title = `${p.title || '제목 없음'} · Tidy`;
  $('#icon').textContent = p.icon;
  $('#title').textContent = p.title;
  renderCrumbs();
  renderBlocks();
  $('main').scrollTop = 0;
}

function renderCrumbs() {
  $('#crumbs').innerHTML = pathOf(cur).map(p =>
    `<a href="#/p/${p.id}"><span class="emoji">${esc(p.icon)}</span> ${esc(p.title || '제목 없음')}</a>`).join('<span class="sep">/</span>');
}

function blockHtml(b) {
  let pre = '', body;
  if (b.type === 'bullet' || b.type === 'number') pre = '<span class="mk" aria-hidden="true"></span>';
  if (b.type === 'todo') pre = `<input type="checkbox" class="chk" aria-label="완료" ${b.checked ? 'checked' : ''}>`;
  if (b.type === 'callout') pre = '<span class="co" aria-hidden="true">💡</span>';
  if (b.type === 'image') {
    body = `<figure class="media"><img data-src="${esc(b.src || '')}" alt="" onerror="this.parentNode.classList.add('missing')"></figure>`;
  } else if (b.type === 'file') {
    body = `<a class="file-blk" data-src="${esc(b.src || '')}" download="${esc(b.name || '파일')}"><span class="emoji">📎</span><b>${esc(b.name || '파일')}</b><small>${fmtSize(b.size)}</small></a>`;
  } else if (b.type === 'table') {
    const rows = b.rows?.length ? b.rows : [{ c: [''] }];
    body = `<div class="tbl-wrap"><table class="tbl"><tbody>${rows.map((r, ri) => `<tr>${r.c.map((cell, ci) =>
      `<td contenteditable="true" data-r="${ri}" data-c="${ci}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <div class="tbl-tools"><button data-tbl="row">＋ 행</button><button data-tbl="col">＋ 열</button><button data-tbl="delrow">－ 행</button><button data-tbl="delcol">－ 열</button></div></div>`;
  } else if (b.type === 'math') {
    body = `<div class="math-wrap"><div class="c math-src" contenteditable="true" spellcheck="false" data-ph="${PH.math}">${b.html}</div><div class="math-out"></div></div>`;
  } else if (b.type === 'toggle') {
    pre = `<button class="tg" tabindex="-1" aria-label="${b.open ? '접기' : '펼치기'}" aria-expanded="${!!b.open}">▸</button>`;
    body = `<div class="tg-col"><div class="c" contenteditable="true" data-ph="토글">${b.html}</div>` +
      (b.body ? `<div class="tb" contenteditable="true"${b.open ? '' : ' hidden'}>${b.body}</div>` : '') + '</div>';
  } else if (b.type === 'divider') body = '<hr>';
  else if (b.type === 'page') {
    const t = db.pages[b.page];
    body = t ? `<a class="plink" href="#/p/${t.id}"><span class="emoji">${esc(t.icon)}</span><u>${esc(t.title || '제목 없음')}</u></a>`
      : '<span class="plink gone">삭제된 페이지</span>';
  } else {
    body = `<div class="c" contenteditable="true" data-ph="${PH[b.type]}"${b.type === 'code' ? ' spellcheck="false"' : ''}>${b.html}</div>`;
  }
  const solid = ['divider', 'page', 'image', 'file', 'table'].includes(b.type);
  return `<div class="blk t-${b.type}${b.checked ? ' done' : ''}${b.type === 'toggle' && b.open ? ' open' : ''}" data-id="${b.id}"${solid ? ' tabindex="-1"' : ''}${b.indent ? ` style="--ind:${b.indent}"` : ''}${hiddenIds.has(b.id) ? ' hidden' : ''}>
    <div class="hd"><button class="add" tabindex="-1" aria-label="아래에 블록 추가" title="아래에 블록 추가">＋</button><button class="grip" draggable="true" tabindex="-1" aria-label="블록 메뉴" title="끌어서 옮기기 · 눌러서 메뉴">⋮⋮</button></div>
    ${pre}${body}</div>`;
}

// 접힌 토글보다 더 들여쓴 바로 아래 블록들은 숨긴다
let hiddenIds = new Set();
function computeHidden(list) {
  const out = new Set();
  let fold = null;
  for (const b of list) {
    const ind = b.indent || 0;
    if (fold !== null && ind > fold) { out.add(b.id); continue; }
    fold = b.type === 'toggle' && !b.open ? ind : null;
  }
  return out;
}

// i번째 블록과 그 아래 더 들여쓴 블록(자식)들의 마지막 위치
function subtreeEnd(i) {
  const list = page().blocks, ind = list[i].indent || 0;
  let j = i;
  while (list[j + 1] && (list[j + 1].indent || 0) > ind) j++;
  return j;
}

function shiftIndent(b, delta) {
  checkpoint();
  const list = page().blocks, i = idx(b.id), end = subtreeEnd(i);
  const prev = list[i - 1];
  const max = prev ? (prev.indent || 0) + 1 : 0;
  const next = Math.max(0, Math.min(max, (b.indent || 0) + delta));
  const d = next - (b.indent || 0);
  if (!d) return false;
  for (let j = i; j <= end; j++) list[j].indent = Math.max(0, (list[j].indent || 0) + d);
  return true;
}

const visibleRows = () => [...document.querySelectorAll('#blocks .blk:not([hidden])')];
function neighbor(id, dir) {
  const rows = visibleRows(), k = rows.findIndex(r => r.dataset.id === id);
  return rows[k + dir] ? blk(rows[k + dir].dataset.id) : null;
}

function renderBlocks(focusId, at = 0) {
  const p = page();
  if (!p.blocks.length) p.blocks.push({ id: uid(), type: 'text', html: '' });
  hiddenIds = computeHidden(p.blocks);
  $('#blocks').innerHTML = p.blocks.map(blockHtml).join('');
  hydrateMedia();
  document.querySelectorAll('#blocks .t-math').forEach(renderMath);
  if (focusId) place(focusId, at);
}

/* ---------- 이미지 · 파일 저장 (이 기기 IndexedDB + 로그인하면 Firestore) ---------- */

const fmtSize = n => !n ? '' : n < 1024 ? `${n}B` : n < 1048576 ? `${Math.round(n / 1024)}KB` : `${(n / 1048576).toFixed(1)}MB`;
let idbP;
const idb = () => idbP ||= new Promise((ok, fail) => {
  const r = indexedDB.open('memo-files', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('f');
  r.onsuccess = () => ok(r.result);
  r.onerror = () => fail(r.error);
});
async function fileGet(id) {
  try {
    const st = await idb();
    return await new Promise(ok => {
      const q = st.transaction('f').objectStore('f').get(id);
      q.onsuccess = () => ok(q.result || null);
      q.onerror = () => ok(null);
    });
  } catch { return null; }
}
async function filePut(id, data) {
  try {
    const st = await idb();
    await new Promise(ok => {
      const t = st.transaction('f', 'readwrite');
      t.objectStore('f').put(data, id);
      t.oncomplete = t.onerror = () => ok();
    });
  } catch {}
}
const fileCache = new Map();
async function loadFile(id) {
  if (fileCache.has(id)) return fileCache.get(id);
  let data = await fileGet(id);
  if (!data && window.cloud?.user) {
    data = await window.cloud.getFile(id).catch(() => null);
    if (data) filePut(id, data);
  }
  if (data) fileCache.set(id, data);
  return data;
}
async function saveFile(data) {
  const id = uid() + uid();
  fileCache.set(id, data);
  await filePut(id, data);
  window.cloud?.putFile(id, data);
  return id;
}
const readAsDataURL = f => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = fail;
  r.readAsDataURL(f);
});
// DB 한 칸(1MB)에 들어가도록 사진을 줄인다
async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    let max = 1600, q = 0.85, out;
    for (let n = 0; n < 6; n++) {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      out = c.toDataURL('image/jpeg', q);
      if (out.length < 700000) break;
      max *= 0.75;
      q -= 0.08;
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
const loadImg = src => new Promise((ok, fail) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = fail;
  i.src = src;
});

function hydrateMedia() {
  document.querySelectorAll('#blocks [data-src]').forEach(async el => {
    const src = el.dataset.src;
    const url = src.startsWith('file:') ? await loadFile(src.slice(5)) : src;
    if (!url) return el.closest('.media, .file-blk')?.classList.add('missing');
    if (el.tagName === 'IMG') el.src = url; else el.href = url;
  });
}

async function insertFiles(files, b) {
  const made = [];
  flash('올리는 중');
  for (const f of files) {
    if (f.type.startsWith('image/')) {
      const data = await shrinkImage(f).catch(() => null);
      if (!data) { flash('이미지를 읽지 못했어요'); continue; }
      made.push({ id: uid(), type: 'image', html: '', src: `file:${await saveFile(data)}` });
    } else {
      if (f.size > 700 * 1024) { flash('파일은 700KB까지 올릴 수 있어요'); continue; }
      made.push({ id: uid(), type: 'file', html: '', name: f.name, size: f.size, src: `file:${await saveFile(await readAsDataURL(f))}` });
    }
  }
  if (made.length) placeNew(made, b);
}

function pickFiles(accept, b) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  if (accept) input.accept = accept;
  input.onchange = () => input.files.length && insertFiles([...input.files], b);
  input.click();
}

// 새 블록들을 b 아래(빈 줄이면 그 자리)에 넣는다
function placeNew(made, b, focusAt = -1) {
  checkpoint();
  const list = page().blocks;
  if (b && !list.includes(b)) b = null;
  const ind = b?.indent || 0;
  made.forEach(m => { if (ind) m.indent = ind; });
  let at = b ? subtreeEnd(idx(b.id)) + 1 : list.length;
  if (b && b.type === 'text' && !b.html) { list.splice(idx(b.id), 1); at--; }
  list.splice(at, 0, ...made);
  commit(made[made.length - 1].id, focusAt);
}

/* ---------- 공식 (KaTeX) ---------- */

let katexP;
function loadKatex() {
  if (window.katex) return Promise.resolve();
  return katexP ||= new Promise((ok, fail) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    document.head.append(css);
    const js = document.createElement('script');
    js.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
    js.onload = ok;
    js.onerror = fail;
    document.head.append(js);
  });
}
function renderMath(row) {
  const out = row.querySelector('.math-out'), tex = row.querySelector('.math-src').textContent;
  if (!tex) { out.textContent = ''; return; }
  if (!window.katex) { out.textContent = tex; loadKatex().then(() => renderMath(row)).catch(() => {}); return; }
  try { window.katex.render(tex, out, { throwOnError: false, displayMode: true }); } catch { out.textContent = tex; }
}

/* ---------- 표 ---------- */

const newTable = () => ({ id: uid(), type: 'table', html: '', rows: [{ c: ['', '', ''] }, { c: ['', '', ''] }, { c: ['', '', ''] }] });
function focusCell(id, r, c) {
  const td = $(`.blk[data-id="${id}"] td[data-r="${r}"][data-c="${c}"]`);
  if (!td) return;
  td.focus();
  const range = document.createRange();
  range.selectNodeContents(td);
  range.collapse(false);
  getSelection().removeAllRanges();
  getSelection().addRange(range);
}
function tableEdit(b, act, r = b.rows.length - 1, c = 0) {
  checkpoint();
  const cols = b.rows[0].c.length;
  if (act === 'row') b.rows.splice(r + 1, 0, { c: Array(cols).fill('') });
  if (act === 'col') b.rows.forEach(row => row.c.splice(c + 1, 0, ''));
  if (act === 'delrow' && b.rows.length > 1) b.rows.splice(r, 1);
  if (act === 'delcol' && cols > 1) b.rows.forEach(row => row.c.splice(c, 1));
  commit();
}
function tableKey(e, b, td) {
  const r = +td.dataset.r, c = +td.dataset.c, rows = b.rows.length, cols = b.rows[0].c.length;
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Tab') {
    e.preventDefault();
    let n = r * cols + c + (e.shiftKey ? -1 : 1);
    if (n >= rows * cols) { tableEdit(b, 'row', rows - 1); n = rows * cols; }
    if (n < 0) return;
    return focusCell(b.id, Math.floor(n / cols), n % cols);
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (r === rows - 1) tableEdit(b, 'row', r);
    return focusCell(b.id, r + 1, c);
  }
}

function commit(focusId, at) {
  renderBlocks(focusId, at);
  save();
  checkpoint();
}

/* ---------- 커서 ---------- */

const editOf = id => $(`.blk[data-id="${id}"] .c`);
const bodyOf = id => $(`.blk[data-id="${id}"] .tb`);
const textLen = html => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.length; };

function caret(el) {
  const s = getSelection();
  if (!s.rangeCount || !el.contains(s.anchorNode)) return 0;
  const r = s.getRangeAt(0), pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}

// 글자 위치(n)를 DOM 위치로 바꾼다
function pointAt(el, n) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = w.nextNode())) {
    if (n <= node.length) return [node, n];
    n -= node.length;
  }
  return [el, el.childNodes.length];
}

function place(id, at = 0) {
  const el = editOf(id);
  if (!el) return $(`.blk[data-id="${id}"]`)?.focus();
  el.focus();
  const total = el.textContent.length;
  const [node, off] = pointAt(el, at < 0 || at > total ? total : at);
  const r = document.createRange();
  r.setStart(node, off);
  r.collapse(true);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

function removeChars(el, from, to) {
  const r = document.createRange();
  r.setStart(...pointAt(el, from));
  r.setEnd(...pointAt(el, to));
  r.deleteContents();
}

/* ---------- 붙여넣기 정리 ---------- */

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'CODE', 'A', 'BR']);
function clean(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  (function walk(node) {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) continue;
      if (n.nodeType !== 1) { n.remove(); continue; }
      walk(n);
      if (!ALLOWED.has(n.tagName)) {
        // 줄 단위 태그는 풀면서 줄바꿈을 남긴다
        if ((n.tagName === 'DIV' || n.tagName === 'P') && n.previousSibling) n.before(document.createElement('br'));
        n.replaceWith(...n.childNodes);
        continue;
      }
      for (const a of [...n.attributes]) {
        if (!(n.tagName === 'A' && a.name === 'href' && /^(https?|mailto):/i.test(a.value))) n.removeAttribute(a.name);
      }
    }
  })(t.content);
  return t.innerHTML;
}

function sync(b, el) {
  if (!el.textContent && !el.querySelector('br + *')) {
    if (el.innerHTML) el.innerHTML = '';
    b.html = '';
  } else b.html = clean(el.innerHTML);
  save();
}

/* ---------- 블록 조작 ---------- */

function insertAfter(id, type = 'text', html = '', extra) {
  const nb = { id: uid(), type, html, ...extra };
  page().blocks.splice(id ? idx(id) + 1 : page().blocks.length, 0, nb);
  return nb;
}

function placeBody(id, at) {
  const el = bodyOf(id);
  if (!el) return;
  el.focus();
  const [node, off] = pointAt(el, at < 0 ? el.textContent.length : at);
  const r = document.createRange();
  r.setStart(node, off);
  r.collapse(true);
  getSelection().removeAllRanges();
  getSelection().addRange(r);
}

// 토글 안쪽 내용: 엔터는 줄바꿈, 맨 앞에서 지우거나 위로 가면 토글 제목으로
function toggleBodyKey(e, b, el) {
  if (e.isComposing || e.keyCode === 229) return;
  const at = caret(el), collapsed = getSelection().isCollapsed, list = page().blocks, i = idx(b.id);
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    return document.execCommand('insertLineBreak');
  }
  if ((e.key === 'Backspace' && collapsed && at === 0 && !el.textContent) || (e.key === 'ArrowUp' && collapsed && at === 0)) {
    e.preventDefault();
    return place(b.id, -1);
  }
  if (e.key === 'ArrowDown' && collapsed && at === el.textContent.length && list[i + 1]) {
    e.preventDefault();
    return place(list[i + 1].id, 0);
  }
}

function setType(b, type) {
  // 토글을 다른 종류로 바꾸면 안의 내용은 본문 뒤에 붙인다
  if (b.type === 'toggle' && type !== 'toggle') {
    if (b.body) b.html = b.html ? `${b.html}<br>${b.body}` : b.body;
    delete b.body;
    delete b.open;
  }
  if (type === 'toggle' && b.type !== 'toggle') b.open = true;
  b.type = type;
  if (type !== 'todo') delete b.checked;
  if (type === 'divider') b.html = '';
}

function splitBlock(b, el) {
  checkpoint();
  const s = getSelection();
  const r = s.getRangeAt(0);
  r.deleteContents();
  const tail = document.createRange();
  tail.setStart(r.startContainer, r.startOffset);
  tail.setEnd(el, el.childNodes.length);
  const box = document.createElement('div');
  box.append(tail.extractContents());
  const after = box.textContent ? clean(box.innerHTML) : '';
  b.html = el.textContent ? clean(el.innerHTML) : '';
  // 빈 목록에서 엔터를 치면 목록을 끝낸다
  if ((LISTS.includes(b.type) || b.type === 'quote') && !b.html && !after) {
    setType(b, 'text');
    return commit(b.id, 0);
  }
  const type = LISTS.includes(b.type) ? b.type : 'text';
  const extra = b.indent ? { indent: b.indent } : undefined;
  let nb;
  if (b.type === 'toggle' && b.open && !after) nb = insertAfter(b.id, 'text', '', { indent: (b.indent || 0) + 1 });
  else if (b.type === 'toggle' && !b.open) {
    nb = { id: uid(), type, html: after, ...extra };
    page().blocks.splice(subtreeEnd(idx(b.id)) + 1, 0, nb);
  } else nb = insertAfter(b.id, type, after, extra);
  commit(nb.id, 0);
}

function mergeUp(b, el) {
  checkpoint();
  const i = idx(b.id), prev = neighbor(b.id, -1);
  if (!prev) return;
  if (prev.type === 'divider' || prev.type === 'page') {
    page().blocks.splice(idx(prev.id), 1);
    return commit(b.id, 0);
  }
  const at = textLen(prev.html);
  prev.html = clean(prev.html + (el.textContent ? el.innerHTML : ''));
  page().blocks.splice(i, 1);
  commit(prev.id, at);
}

function removeBlock(id) {
  checkpoint();
  const i = idx(id), list = page().blocks;
  list.splice(i, 1);
  const next = list[i - 1] || list[i];
  commit(next?.id, -1);
}

function moveBlock(id, toIndex) {
  checkpoint();
  const list = page().blocks, i = idx(id);
  const [b] = list.splice(i, 1);
  list.splice(Math.max(0, Math.min(list.length, toIndex)), 0, b);
  commit();
}

// 줄 맨 앞에 입력한 마크다운 기호를 블록 종류로 바꾼다
const RULES = [[/^#\s/, 'h1', 2], [/^##\s/, 'h2', 3], [/^###\s/, 'h3', 4], [/^[-*]\s/, 'bullet', 2], [/^1[.)]\s/, 'number', 3],
  [/^\[\]\s/, 'todo', 3], [/^\[ \]\s/, 'todo', 4], [/^>\s/, 'quote', 2], [/^```$/, 'code', 3], [/^---$/, 'divider', 3]];
function shortcut(b, el, e) {
  if (b.type !== 'text' || !e.inputType?.startsWith('insert')) return false;
  const txt = el.textContent.replace(/ /g, ' ');
  for (const [re, type, n] of RULES) {
    const at = caret(el) - n;
    if (!re.test(txt) || at < 0) continue;
    removeChars(el, 0, n);
    if (type === 'divider') {
      setType(b, 'divider');
      const nb = insertAfter(b.id, 'text', el.textContent ? clean(el.innerHTML) : '');
      commit(nb.id, 0);
    } else {
      b.html = el.textContent ? clean(el.innerHTML) : '';
      setType(b, type);
      commit(b.id, at);
    }
    return true;
  }
  return false;
}

/* ---------- 슬래시 메뉴 ---------- */

const slash = { open: false, id: null, start: 0, sel: 0, items: [] };
const slashEl = $('#slash');

function openSlash(id, start) {
  Object.assign(slash, { open: true, id, start, sel: 0 });
  updateSlash();
}

function closeSlash() {
  slash.open = false;
  slashEl.hidden = true;
}

function updateSlash() {
  const el = editOf(slash.id);
  if (!el) return closeSlash();
  const at = caret(el), txt = el.textContent;
  if (at <= slash.start || txt[slash.start] !== '/') return closeSlash();
  const q = txt.slice(slash.start + 1, at).trim().toLowerCase();
  slash.items = Object.entries(TYPES).filter(([k, t]) => !q || t.keys.includes(q) || t.label.includes(q));
  if (!slash.items.length && q.length > 6) return closeSlash();
  slash.sel = Math.min(slash.sel, Math.max(0, slash.items.length - 1));
  slashEl.innerHTML = '<div class="pop-h">블록</div>' + (slash.items.length
    ? slash.items.map(([k, t], i) => `<button class="mi${i === slash.sel ? ' sel' : ''}" data-type="${k}"><span class="mi-ico${k === 'callout' || k === 'page' ? ' emoji' : ''}">${t.ico}</span><span>${t.label}<small>${t.hint}</small></span></button>`).join('')
    : '<p class="pop-none">결과가 없어요</p>');
  slashEl.hidden = false;
  const s = getSelection();
  const rect = s.rangeCount ? s.getRangeAt(0).getBoundingClientRect() : el.getBoundingClientRect();
  const base = rect.height ? rect : el.getBoundingClientRect();
  position(slashEl, base);
  slashEl.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
}

function position(pop, rect) {
  const w = pop.offsetWidth, h = pop.offsetHeight;
  // 화면 가장자리와 16px은 띄운다
  const m = 16;
  let x = Math.min(rect.left, innerWidth - w - m), y = rect.bottom + 8;
  if (y + h > innerHeight - m) y = Math.max(m, rect.top - h - 8);
  pop.style.left = `${Math.max(m, x)}px`;
  pop.style.top = `${y}px`;
}

function chooseSlash(type) {
  const b = blk(slash.id), el = editOf(slash.id);
  removeChars(el, slash.start, caret(el));
  closeSlash();
  b.html = el.textContent ? clean(el.innerHTML) : '';
  applyType(b, type, slash.start);
}

// 블록 종류 바꾸기 (슬래시 메뉴, 블록 메뉴 공용)
function applyType(b, type, at = 0) {
  checkpoint();
  if (type === 'image' || type === 'file') { commit(b.id, -1); return pickFiles(type === 'image' ? 'image/*' : '', b); }
  if (type === 'table') return placeNew([newTable()], b, 0);
  if (type === 'page') {
    const child = makePage(cur);
    if (!b.html && b.type === 'text') { setType(b, 'page'); b.page = child.id; } else insertAfter(b.id, 'page', '', { page: child.id });
    save();
    return go(child.id);
  }
  if (type === 'divider') {
    if (!b.html) setType(b, 'divider'); else insertAfter(b.id, 'divider');
    const nb = insertAfter(page().blocks[idx(b.id) + (b.type === 'divider' ? 0 : 1)].id, 'text');
    return commit(nb.id, 0);
  }
  if (b.type === 'page' || b.type === 'divider') b.html = '';
  delete b.page;
  setType(b, type);
  commit(b.id, at);
}

slashEl.addEventListener('mousedown', e => e.preventDefault());
slashEl.addEventListener('click', e => {
  const t = e.target.closest('[data-type]');
  if (t) chooseSlash(t.dataset.type);
});

function slashKey(e) {
  if (!slash.open) return false;
  const n = slash.items.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!n) return true;
    e.preventDefault();
    slash.sel = (slash.sel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
    updateSlash();
    return true;
  }
  if ((e.key === 'Enter' || e.key === 'Tab') && !e.isComposing) {
    if (!n) { closeSlash(); return false; }
    e.preventDefault();
    chooseSlash(slash.items[slash.sel][0]);
    return true;
  }
  if (e.key === 'Escape') { e.preventDefault(); closeSlash(); return true; }
  return false;
}

/* ---------- 편집 이벤트 ---------- */

const blocksEl = $('#blocks');

/* ---------- 블록 여러 개 선택 (⌘A 두 번) ---------- */

let picked = null; // 선택된 블록 id 묶음
blocksEl.tabIndex = -1;

function pickBlocks(ids) {
  picked = new Set(ids);
  document.querySelectorAll('#blocks .blk').forEach(r => r.classList.toggle('picked', picked.has(r.dataset.id)));
  getSelection().removeAllRanges();
  closeSlash();
  blocksEl.focus();
}
function unpick() {
  if (!picked) return;
  picked = null;
  document.querySelectorAll('.blk.picked').forEach(r => r.classList.remove('picked'));
}
const pickedBlocks = () => page().blocks.filter(b => picked.has(b.id));
const pickedText = () => toMarkdown({ title: '', blocks: pickedBlocks() }).replace(/^# .*\n\n/, '');

function deletePicked() {
  checkpoint();
  const list = page().blocks, first = list.findIndex(b => picked.has(b.id));
  page().blocks = list.filter(b => !picked.has(b.id));
  unpick();
  if (!page().blocks.length) page().blocks.push({ id: uid(), type: 'text', html: '' });
  const next = page().blocks[Math.max(0, first - 1)];
  commit(next.id, first ? -1 : 0);
}

document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  // 편집 중이 아닐 때 ⌘A는 페이지의 블록 전체를 고른다
  if (!picked && mod && k === 'a' && document.activeElement === document.body && cur) {
    e.preventDefault();
    return pickBlocks(page().blocks.map(b => b.id));
  }
  if (!picked) return;
  if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); return deletePicked(); }
  if (mod && (k === 'c' || k === 'x')) {
    e.preventDefault();
    copyText(pickedText()).then(ok => flash(ok ? '복사했어요' : '복사하지 못했어요'));
    if (k === 'x') deletePicked();
    return;
  }
  if (mod && k === 'a') { e.preventDefault(); return; }
  if (e.key === 'Escape') return unpick();
  if (!mod && e.key.length === 1) unpick();
});
document.addEventListener('mousedown', e => { if (picked && !popEl.contains(e.target)) unpick(); });

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.append(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    blocksEl.focus();
    return ok;
  }
}

blocksEl.addEventListener('keydown', e => {
  const row = e.target.closest('.blk');
  if (!row) return;
  // ⌘A: 처음엔 이 블록 글자 전체, 이미 다 골라져 있으면 페이지의 블록 전체
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && e.target.classList.contains('c')) {
    const len = e.target.textContent.length;
    if (!len || getSelection().toString().length >= len) {
      e.preventDefault();
      pickBlocks(page().blocks.map(b => b.id));
    }
    return;
  }
  const b = blk(row.dataset.id);
  if (slashKey(e)) return;
  if (e.target.classList.contains('tb')) return toggleBodyKey(e, b, e.target);
  if (e.target.tagName === 'TD') return tableKey(e, b, e.target);
  const el = e.target.classList.contains('c') ? e.target : null;
  const i = idx(b.id), list = page().blocks;

  if (!el) {
    // 구분선과 페이지 링크 블록이 선택된 상태
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); removeBlock(b.id); }
    else if (e.key === 'Enter') { e.preventDefault(); const nb = insertAfter(b.id); commit(nb.id, 0); }
    else if (e.key === 'ArrowUp' && neighbor(b.id, -1)) { e.preventDefault(); place(neighbor(b.id, -1).id, -1); }
    else if (e.key === 'ArrowDown' && neighbor(b.id, 1)) { e.preventDefault(); place(neighbor(b.id, 1).id, 0); }
    return;
  }
  if (e.isComposing || e.keyCode === 229) return;
  const sel = getSelection(), collapsed = sel.isCollapsed, at = caret(el);

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (b.type === 'code') return document.execCommand('insertLineBreak');
    if (b.type === 'math') { const nb = insertAfter(b.id, 'text', '', b.indent ? { indent: b.indent } : undefined); return commit(nb.id, 0); }
    // 예전 방식 토글(안쪽 글이 있는 것)은 안쪽 글로 들어간다
    if (b.type === 'toggle' && b.open && b.body && caret(el) === el.textContent.length) return placeBody(b.id, 0);
    return splitBlock(b, el);
  }
  if (e.key === 'Backspace' && collapsed && at === 0) {
    e.preventDefault();
    sync(b, el);
    if (b.type !== 'text') { setType(b, 'text'); return commit(b.id, 0); }
    if (!el.textContent && neighbor(b.id, -1)) {
      // 빈 줄은 그냥 지운다. 들여쓴 자식들은 그대로 둬서 토글 밖으로 빠지지 않는다
      const prev = neighbor(b.id, -1);
      page().blocks.splice(idx(b.id), 1);
      return commit(prev.id, -1);
    }
    return mergeUp(b, el);
  }
  if (e.key === 'ArrowUp' && collapsed && at === 0 && neighbor(b.id, -1)) {
    e.preventDefault();
    const prev = neighbor(b.id, -1);
    return prev.type === 'toggle' && prev.open && prev.body ? placeBody(prev.id, -1) : place(prev.id, -1);
  }
  if (e.key === 'ArrowDown' && b.type === 'toggle' && b.open && b.body && collapsed && at === el.textContent.length) { e.preventDefault(); return placeBody(b.id, 0); }
  if (e.key === 'ArrowDown' && collapsed && at === el.textContent.length && neighbor(b.id, 1)) { e.preventDefault(); return place(neighbor(b.id, 1).id, 0); }
  // Tab 들여쓰기, Shift+Tab 내어쓰기 (자식 블록도 함께)
  if (e.key === 'Tab') {
    e.preventDefault();
    sync(b, el);
    if (shiftIndent(b, e.shiftKey ? -1 : 1)) commit(b.id, at);
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
    e.preventDefault();
    wrapCode();
  }
});

// ⌘E: 고른 글자를 인라인 코드로
function wrapCode() {
  const s = getSelection();
  if (!s.rangeCount || s.isCollapsed) return;
  const r = s.getRangeAt(0), code = document.createElement('code');
  code.append(r.extractContents());
  r.insertNode(code);
  const el = code.closest('.c');
  sync(blk(el.closest('.blk').dataset.id), el);
}

blocksEl.addEventListener('input', e => {
  const el = e.target;
  if (el.tagName === 'TD') {
    const b = blk(el.closest('.blk').dataset.id);
    b.rows[+el.dataset.r].c[+el.dataset.c] = el.textContent ? clean(el.innerHTML) : '';
    return save();
  }
  if (el.classList?.contains('math-src')) {
    const b = blk(el.closest('.blk').dataset.id);
    b.html = el.textContent ? clean(el.innerHTML) : '';
    renderMath(el.closest('.blk'));
    return save();
  }
  if (el.classList?.contains('tb')) {
    const b = blk(el.closest('.blk').dataset.id);
    b.body = el.textContent ? clean(el.innerHTML) : '';
    if (!el.textContent && el.innerHTML) el.innerHTML = '';
    return save();
  }
  if (!el.classList?.contains('c')) return;
  const b = blk(el.closest('.blk').dataset.id);
  if (!e.isComposing && shortcut(b, el, e)) return;
  sync(b, el);
  // 붙여넣거나 한 번에 입력된 글자 안의 '/'도 메뉴를 연다
  const cut = e.data ? e.data.lastIndexOf('/') : -1;
  if (cut >= 0 && !slash.open) openSlash(b.id, caret(el) - (e.data.length - cut));
  else if (slash.open) updateSlash();
});

blocksEl.addEventListener('paste', e => {
  checkpoint();
  const imgs = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
  if (imgs.length && !e.clipboardData.getData('text/plain').trim()) {
    e.preventDefault();
    const row = e.target.closest('.blk');
    return insertFiles(imgs, row ? blk(row.dataset.id) : null);
  }
  if (e.target.closest('.tb, td, .math-src')) {
    e.preventDefault();
    return document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\r/g, ''));
  }
  const el = e.target.closest('.c');
  if (!el) return;
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain').replace(/\r/g, '');
  const b = blk(el.closest('.blk').dataset.id);
  if (b.type === 'code' || !text.includes('\n')) return document.execCommand('insertText', false, text);
  const parsed = parseOutline(text, b.indent || 0);
  if (!parsed.length) return;
  sync(b, el);
  const list = page().blocks;
  let at = subtreeEnd(idx(b.id)) + 1;
  // 빈 줄에 붙여넣으면 그 줄을 첫 블록으로 바꾼다
  if (b.type === 'text' && !b.html) { list.splice(idx(b.id), 1); at--; }
  list.splice(at, 0, ...parsed);
  commit(parsed[parsed.length - 1].id, -1);
  flash(`${parsed.length}개 블록을 붙여넣었어요`);
});

// 들여쓴 마크다운(노션·크래프트 내보내기 포함)을 블록 목록으로 바꾼다
function inlineMd(s) {
  const link = (text, url) => `<a href="${esc(/^(https?|mailto):/i.test(url) ? url : `https://${url}`)}">${text}</a>`;
  return esc(s.replace(/\\([-*_\\>#\[\]()!])/g, '$1'))
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => link(`🖼 ${alt || '이미지'}`, url))
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, url) => link(t, url))
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function parseOutline(text, base = 0) {
  const out = [], stack = [];
  let lastTable = null;
  let fence = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\t/g, '    ');
    if (fence) {
      if (/^\s*```/.test(line)) { fence = null; continue; }
      fence.html += (fence.html ? '\n' : '') + esc(line);
      continue;
    }
    if (!line.trim()) continue;
    const spaces = line.match(/^ */)[0].length;
    let body = line.trim();
    if (/^\|?\s*:?-{2,}/.test(body) && /^[|:\-\s]+$/.test(body)) continue; // 표 구분선
    // 크래프트는 이미지·표를 맨 앞에 붙여 내보내므로 바로 위 항목의 자식으로 둔다
    const attach = /^(!\[|\|)/.test(body);
    // 크래프트의 접기(+) 줄은 실제 단계보다 4칸 더 들여써서 나온다
    const eff = body.startsWith('+ ') ? spaces - 4 : spaces;
    if (!attach) while (stack.length && eff <= stack[stack.length - 1]) stack.pop();
    const indent = base + stack.length;
    if (!attach) stack.push(eff);
    let type = 'text', checked;
    const m = [
      [/^\+\s+/, 'toggle'], [/^[-*+]\s+\[([ xX])\]\s*/, 'todo'], [/^[-*]\s+/, 'bullet'], [/^\d+[.)]\s+/, 'number'],
      [/^###\s+/, 'h3'], [/^##\s+/, 'h2'], [/^#\s+/, 'h1'], [/^>\s?/, 'quote'],
    ].find(([re]) => re.test(body));
    if (/^-{3,}$/.test(body)) { out.push({ id: uid(), type: 'divider', html: '', indent }); continue; }
    if (/^```/.test(body)) { fence = { id: uid(), type: 'code', html: '', indent }; out.push(fence); continue; }
    if (m) {
      type = m[1];
      if (type === 'todo') checked = /x/i.test(body.match(m[0])[1]);
      body = body.replace(m[0], '');
    }
    if (type === 'text' && body.startsWith('|')) {
      const cells = body.replace(/^\||\|$/g, '').split('|').map(c => clean(inlineMd(c.trim())));
      const last = out[out.length - 1];
      if (last?.type === 'table' && last.open !== false && lastTable === last) last.rows.push({ c: cells });
      else { lastTable = { id: uid(), type: 'table', html: '', rows: [{ c: cells }], indent }; out.push(lastTable); }
      continue;
    }
    lastTable = null;
    const img = type === 'text' && body.match(/^!\[[^\]]*\]\(([^)\s]+)\)$/);
    if (img) { out.push({ id: uid(), type: 'image', html: '', src: /^https?:/i.test(img[1]) ? img[1] : `https://${img[1]}`, indent }); continue; }
    const b = { id: uid(), type, html: clean(inlineMd(body)), indent };
    if (type === 'todo') b.checked = checked;
    if (type === 'toggle') b.open = true;
    if (!indent) delete b.indent;
    out.push(b);
  }
  // 표 칸 수를 맞추고, 들여쓰기 0은 빼둔다
  for (const b of out) {
    if (b.type === 'table') {
      const n = Math.max(...b.rows.map(r => r.c.length));
      b.rows.forEach(r => { while (r.c.length < n) r.c.push(''); });
    }
    if (!b.indent) delete b.indent;
  }
  return out;
}

function parseLine(line) {
  const m = [[/^###\s+/, 'h3'], [/^##\s+/, 'h2'], [/^#\s+/, 'h1'], [/^[-*]\s+\[[ xX]\]\s+/, 'todo'], [/^[-*]\s+/, 'bullet'],
    [/^\d+[.)]\s+/, 'number'], [/^>\s+/, 'quote']].find(([re]) => re.test(line));
  if (/^-{3,}$/.test(line.trim())) return ['divider', ''];
  return m ? [m[1], line.replace(m[0], '')] : ['text', line];
}

blocksEl.addEventListener('change', e => {
  if (!e.target.classList.contains('chk')) return;
  const row = e.target.closest('.blk'), b = blk(row.dataset.id);
  b.checked = e.target.checked;
  row.classList.toggle('done', b.checked);
  save();
});

blocksEl.addEventListener('click', e => {
  const row = e.target.closest('.blk');
  if (!row) return;
  const b = blk(row.dataset.id);
  if (e.target.closest('.add')) {
    const nb = insertAfter(b.id, 'text', '/');
    renderBlocks(nb.id, 1);
    return openSlash(nb.id, 0);
  }
  if (e.target.closest('.grip')) return blockMenu(b, e.target.closest('.grip'));
  if (e.target.closest('.tg')) {
    b.open = !b.open;
    const y = row.getBoundingClientRect().top;
    commit(b.id, -1);
    // 화면이 튀지 않게 토글 위치를 그대로 둔다
    $('main').scrollTop += $(`.blk[data-id="${b.id}"]`).getBoundingClientRect().top - y;
    return;
  }
  const tbl = e.target.closest('[data-tbl]');
  if (tbl) {
    const td = row.querySelector('td:focus') || null;
    return tableEdit(b, tbl.dataset.tbl, td ? +td.dataset.r : undefined, td ? +td.dataset.c : b.rows[0].c.length - 1);
  }
  if (e.target.closest('.math-out')) return place(b.id, -1);
  if (b.type === 'file' && e.target.closest('.file-blk.missing')) { e.preventDefault(); return flash('파일을 불러오지 못했어요'); }
  if (['divider', 'image'].includes(b.type)) row.focus();
});

document.addEventListener('focusout', e => {
  if (e.target.classList?.contains('c') && slash.open && !slashEl.contains(e.relatedTarget)) setTimeout(closeSlash, 100);
});

$('#pad').addEventListener('click', () => {
  const list = page().blocks, last = list[list.length - 1];
  if (last && last.type === 'text' && !last.html) return place(last.id, 0);
  const nb = insertAfter(null);
  commit(nb.id, 0);
});

/* ---------- 끌어서 옮기기 ---------- */

let dragId = null;
blocksEl.addEventListener('dragstart', e => {
  const row = e.target.closest('.blk');
  if (!row || !e.target.classList?.contains('grip')) return e.preventDefault();
  dragId = row.dataset.id;
  row.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', '');
  e.dataTransfer.setDragImage(row, 20, 14);
});
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
blocksEl.addEventListener('dragover', e => {
  if (!dragId && hasFiles(e)) return e.preventDefault();
  if (!dragId) return;
  e.preventDefault();
  clearDrop();
  const row = e.target.closest('.blk');
  if (!row || row.dataset.id === dragId) return;
  const r = row.getBoundingClientRect();
  row.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
});
blocksEl.addEventListener('drop', e => {
  if (!dragId && e.dataTransfer.files.length) {
    e.preventDefault();
    const row = e.target.closest('.blk');
    return insertFiles([...e.dataTransfer.files], row ? blk(row.dataset.id) : page().blocks[page().blocks.length - 1]);
  }
  if (!dragId) return;
  e.preventDefault();
  const row = $('.drop-before, .drop-after');
  if (row) {
    const list = page().blocks, from = idx(dragId);
    let to = idx(row.dataset.id) + (row.classList.contains('drop-after') ? 1 : 0);
    if (from < to) to--;
    moveBlock(dragId, to);
  }
  endDrag();
});
blocksEl.addEventListener('dragend', endDrag);
function clearDrop() { document.querySelectorAll('.drop-before, .drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after')); }
function endDrag() { clearDrop(); document.querySelector('.dragging')?.classList.remove('dragging'); dragId = null; }

/* ---------- 팝업 메뉴 ---------- */

const popEl = $('#pop');
function openPop(html, anchor, onClick) {
  popEl.innerHTML = html;
  popEl.hidden = false;
  position(popEl, anchor.getBoundingClientRect());
  popEl.onclick = e => {
    const t = e.target.closest('[data-v]');
    if (!t) return;
    closePop();
    onClick(t.dataset.v);
  };
}
function closePop() { popEl.hidden = true; popEl.classList.remove('wide'); }
document.addEventListener('mousedown', e => {
  if (!popEl.hidden && !popEl.contains(e.target)) closePop();
  if (slash.open && !slashEl.contains(e.target) && !e.target.closest('.c')) closeSlash();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });

function blockMenu(b, anchor) {
  const turn = Object.entries(TYPES).filter(([k]) => k !== 'page' && k !== b.type)
    .map(([k, t]) => `<button class="mi compact" data-v="type:${k}"><span class="emoji">${t.ico}</span> ${t.label}</button>`).join('');
  openPop(`<button class="mi compact" data-v="up">위로 옮기기</button>
    <button class="mi compact" data-v="down">아래로 옮기기</button>
    <button class="mi compact" data-v="dup">복제</button>
    <button class="mi compact danger" data-v="del">삭제</button>
    ${b.type === 'page' ? '' : `<hr><div class="pop-h">바꾸기</div>${turn}`}`, anchor, v => {
    const i = idx(b.id);
    if (v === 'up') return moveBlock(b.id, i - 1);
    if (v === 'down') return moveBlock(b.id, i + 1);
    if (v === 'del') return removeBlock(b.id);
    if (v === 'dup') {
      const copy = { ...structuredClone(b), id: uid() };
      page().blocks.splice(i + 1, 0, copy);
      return commit(copy.id, -1);
    }
    if (v.startsWith('type:')) applyType(b, v.slice(5));
  });
}

$('#icon').onclick = e => {
  openPop(`<div class="pop-h">아이콘</div><div class="icons">${ICONS.map(i => `<button data-v="${i}">${i}</button>`).join('')}</div>` +
    (page().icon ? '<hr><button class="mi compact danger" data-v="">아이콘 없애기</button>' : ''), e.currentTarget, v => {
    page().icon = v;
    save();
    renderPage();
    renderTree();
  });
};

// 마지막으로 만진 블록 아래에 넣는다
let lastBlockId = null;
document.addEventListener('focusin', e => { const r = e.target.closest?.('#blocks .blk'); if (r) lastBlockId = r.dataset.id; });
const INSERT_ICON = {"image": "<svg viewBox=\"0 0 20 20\" width=\"17\" height=\"17\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"4\" width=\"14\" height=\"12\" rx=\"2\"/><circle cx=\"7.5\" cy=\"8.3\" r=\"1.3\"/><path d=\"M3.5 14l4-4 3 3 2-2 4 4\"/></svg>", "file": "<svg viewBox=\"0 0 20 20\" width=\"17\" height=\"17\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14.5 9.5l-5 5a3.2 3.2 0 0 1-4.5-4.5l5.6-5.6a2.1 2.1 0 0 1 3 3L8.1 13a1 1 0 0 1-1.5-1.5l4.9-4.9\"/></svg>", "code": "<svg viewBox=\"0 0 20 20\" width=\"17\" height=\"17\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7.5 6L3.5 10l4 4M12.5 6l4 4-4 4\"/></svg>", "todo": "<svg viewBox=\"0 0 20 20\" width=\"17\" height=\"17\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"10\" cy=\"10\" r=\"6.5\"/><path d=\"M7.2 10.2l2 2 3.8-4\"/></svg>", "divider": "<svg viewBox=\"0 0 20 20\" width=\"17\" height=\"17\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 10h14\"/><path d=\"M6 6.5h8M6 13.5h8\" stroke-dasharray=\"1.5 2\"/></svg>"};
const INSERT = [['image', INSERT_ICON.image, '갤러리', '이미지'], ['file', INSERT_ICON.file, '파일', ''], ['-'], ['code', '{ }', '코드 블록', ''], ['math', 'ƒx', '공식', ''],
  ['-'], ['todo', INSERT_ICON.todo, '할 일', ''], ['toggle', '▸', '토글', ''], ['table', '▦', '표', ''], ['-'], ['divider', INSERT_ICON.divider, '페이지 나누기', '']];
$('#insertBtn').onclick = e => {
  openPop(INSERT.map(([v, ico, label]) => v === '-' ? '<hr>' : `<button class="mi compact" data-v="${v}"><span class="ins-ico">${ico}</span>${label}</button>`).join(''), e.currentTarget, v => {
    const list = page().blocks;
    const b = (lastBlockId && list.find(x => x.id === lastBlockId)) || list[list.length - 1];
    if (v === 'image') return pickFiles('image/*', b);
    if (v === 'file') return pickFiles('', b);
    if (v === 'table') return placeNew([newTable()], b, 0);
    if (v === 'divider') return placeNew([{ id: uid(), type: 'divider', html: '' }, { id: uid(), type: 'text', html: '' }], b, 0);
    const nb = { id: uid(), type: v, html: '' };
    if (v === 'toggle') nb.open = true;
    placeNew([nb], b, 0);
  });
};

// 왼쪽 아래 설정: 백업, 테마, 로그인/로그아웃
async function logout() {
  if (!confirm('로그아웃할까요? 이 기기에 있는 노트는 지워지고, 다시 로그인하면 불러와요.')) return;
  await window.cloud.logout();
}
$('#settingsBtn').onclick = e => {
  const user = window.cloud?.user, dark = themeLabel();
  openPop(`${user ? `<div class="pop-h">${esc(user.email || '')}</div>` : ''}
    <button class="mi compact" data-v="export">백업 내보내기</button>
    <button class="mi compact" data-v="import">백업 가져오기</button>
    <button class="mi compact" data-v="theme">${dark ? '라이트 모드' : '다크 모드'}</button>
    ${window.cloud?.enabled ? `<hr>${user ? '<button class="mi compact danger" data-v="logout">로그아웃</button>' : '<button class="mi compact" data-v="login">Google로 로그인</button>'}` : ''}`,
  e.currentTarget, v => {
    if (v === 'export') return $('#exportBtn').click();
    if (v === 'import') return $('#importFile').click();
    if (v === 'theme') return $('#themeBtn').click();
    if (v === 'login') return window.cloud.login().catch(() => flash('로그인하지 못했어요'));
    if (v === 'logout') return logout();
  });
};

/* ---------- 공유 · 내보내기 · 옮기기 ---------- */

const SHARE_ICON = {"pdf": "<svg viewBox=\"0 0 20 20\" width=\"18\" height=\"18\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 2.8h6.5L15 6.3v10.9H5z\"/><path d=\"M11.5 2.8v3.5H15\"/><path d=\"M7.5 11h5M7.5 13.8h3.5\"/></svg>", "print": "<svg viewBox=\"0 0 20 20\" width=\"18\" height=\"18\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 7.5V3.5h8v4\"/><rect x=\"3\" y=\"7.5\" width=\"14\" height=\"6.5\" rx=\"1.5\"/><path d=\"M6 12h8v4.5H6z\"/></svg>", "word": "<svg viewBox=\"0 0 20 20\" width=\"18\" height=\"18\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3.5\" y=\"3.5\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M6.5 7.5l1.3 5 1.7-4 1.7 4 1.3-5\"/></svg>", "md": "<svg viewBox=\"0 0 20 20\" width=\"18\" height=\"18\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 2.8h10v14.4H5z\"/><path d=\"M7.5 7h5M7.5 10h5M7.5 13h3\"/></svg>", "mail": "<svg viewBox=\"0 0 20 20\" width=\"18\" height=\"18\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"14\" height=\"10\" rx=\"1.8\"/><path d=\"M3.5 6l6.5 5 6.5-5\"/></svg>", "dup": "<svg viewBox=\"0 0 20 20\" width=\"18\" height=\"18\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"6.5\" y=\"6.5\" width=\"10\" height=\"10\" rx=\"1.8\"/><path d=\"M13.5 6.5V4.8a1.3 1.3 0 0 0-1.3-1.3H4.8a1.3 1.3 0 0 0-1.3 1.3v7.4a1.3 1.3 0 0 0 1.3 1.3h1.7\"/></svg>", "link": "<svg viewBox=\"0 0 20 20\" width=\"18\" height=\"18\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9\"/><path d=\"M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9\"/></svg>", "share": "<svg viewBox=\"0 0 20 20\" width=\"18\" height=\"18\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 12.5V3.5M6.8 6.5L10 3.3l3.2 3.2\"/><path d=\"M5.5 9.5H4.5v7h11v-7h-1\"/></svg>", "folder": "<svg viewBox=\"0 0 20 20\" width=\"18\" height=\"18\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 6a1.5 1.5 0 0 1 1.5-1.5h3.3l1.6 1.8h6.1A1.5 1.5 0 0 1 17 7.8v7.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15z\"/></svg>"};
function sharePanel(tab, anchor) {
  const tabs = [['export', '내보내기'], ['move', '옮기기']]
    .map(([k, l]) => `<button class="seg-tab${k === tab ? ' on' : ''}" data-v="tab:${k}">${l}</button>`).join('');
  let body;
  if (tab === 'export') {
    body = [['pdf', 'PDF'], ['print', '인쇄'], ['word', 'MS Word'], ['md', 'Markdown'], ['mail', '이메일'], ['dup', '복제'], ['link', '링크 복사']]
      .map(([k, l]) => `<button class="share-row" data-v="${k}">${SHARE_ICON[k]}<span>${l}</span></button>`).join('');
  } else {
    // 자기 자신과 하위 페이지로는 옮길 수 없다
    const banned = new Set([cur]);
    (function mark(id) { db.pages[id].children.forEach(c => { banned.add(c); mark(c); }); })(cur);
    const opts = [];
    (function walk(ids, depth) {
      ids.forEach(id => {
        const p = db.pages[id];
        if (!banned.has(id)) opts.push(`<button class="share-row move" data-v="to:${id}" style="padding-left:${12 + depth * 16}px"><span class="emoji">${esc(p.icon || '📄')}</span><span>${esc(p.title || '제목 없음')}</span>${page().parent === id ? '<em>지금 위치</em>' : ''}</button>`);
        if (!banned.has(id)) walk(p.children, depth + 1);
      });
    })(db.root, 0);
    body = `<button class="share-row move" data-v="to:"><span class="folder">${SHARE_ICON.folder}</span><span>맨 위로</span>${page().parent ? '' : '<em>지금 위치</em>'}</button>` + opts.join('');
  }
  popEl.classList.add('wide');
  openPop(`<div class="share-pop"><div class="seg">${tabs}</div><div class="share-list">${body}</div></div>`, anchor, v => {
    if (v.startsWith('tab:')) return sharePanel(v.slice(4), anchor);
    if (v.startsWith('to:')) return movePage(cur, v.slice(3) || null);
    exportAs(v);
  });
}

function movePage(id, parent) {
  const p = db.pages[id];
  if ((p.parent || null) === parent) return flash('이미 여기에 있어요');
  const from = p.parent ? db.pages[p.parent].children : db.root;
  from.splice(from.indexOf(id), 1);
  p.parent = parent;
  (parent ? db.pages[parent].children : db.root).push(id);
  if (parent) db.pages[parent].open = true;
  save();
  renderTree();
  renderCrumbs();
  flash(parent ? `'${db.pages[parent].title || '제목 없음'}' 안으로 옮겼어요` : '맨 위로 옮겼어요');
}

function duplicatePage(id) {
  const src = db.pages[id];
  const copy = makePage(src.parent, `${src.title || '제목 없음'} (사본)`, src.icon, structuredClone(src.blocks).map(b => ({ ...b, id: uid() })));
  // 원본 바로 아래에 둔다
  const list = src.parent ? db.pages[src.parent].children : db.root;
  list.splice(list.indexOf(copy.id), 1);
  list.splice(list.indexOf(id) + 1, 0, copy.id);
  save();
  go(copy.id);
  flash('복제했어요');
}

// Word가 읽을 수 있는 HTML로 만든다 (이미지는 문서 안에 넣는다)
async function toHTML(p) {
  const tag = { h1: 'h1', h2: 'h2', h3: 'h3', quote: 'blockquote' };
  let html = '';
  for (const b of p.blocks) {
    const pad = `style="margin-left:${(b.indent || 0) * 24}px"`;
    if (b.type === 'divider') html += '<hr>';
    else if (b.type === 'image') {
      const src = b.src?.startsWith('file:') ? await loadFile(b.src.slice(5)) : b.src;
      if (src) html += `<p ${pad}><img src="${src}" style="max-width:600px"></p>`;
    } else if (b.type === 'table') html += `<table border="1" cellpadding="6" style="border-collapse:collapse" ${pad}>${(b.rows || []).map(r => `<tr>${r.c.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
    else if (b.type === 'code') html += `<pre ${pad}>${b.html}</pre>`;
    else if (b.type === 'page') html += `<p ${pad}>📄 ${esc(db.pages[b.page]?.title || '삭제된 페이지')}</p>`;
    else if (b.type === 'file') html += `<p ${pad}>📎 ${esc(b.name || '파일')}</p>`;
    else {
      const mark = b.type === 'todo' ? (b.checked ? '☑ ' : '☐ ') : b.type === 'bullet' ? '• ' : b.type === 'toggle' ? '▸ ' : '';
      const t = tag[b.type] || 'p';
      html += `<${t} ${pad}>${mark}${b.type === 'todo' && b.checked ? `<s>${b.html}</s>` : b.html}${b.body ? `<br>${b.body}` : ''}</${t}>`;
    }
  }
  return `<html><head><meta charset="utf-8"><title>${esc(p.title || '제목 없음')}</title></head>
    <body style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif"><h1>${esc(p.icon || '')} ${esc(p.title || '제목 없음')}</h1>${html}</body></html>`;
}

async function exportAs(kind) {
  const p = page(), name = p.title || '제목 없음';
  if (kind === 'pdf' || kind === 'print') {
    if (kind === 'pdf') flash('인쇄 창에서 "PDF로 저장"을 고르세요');
    return setTimeout(() => window.print(), kind === 'pdf' ? 400 : 0);
  }
  if (kind === 'word') return download(`${name}.doc`, await toHTML(p), 'application/msword');
  if (kind === 'md') return download(`${name}.md`, toMarkdown(p), 'text/markdown');
  if (kind === 'mail') {
    const body = toMarkdown(p).replace(/^# .*\n\n/, '');
    const cut = body.length > 1800 ? `${body.slice(0, 1800)}\n…` : body;
    location.href = `mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(cut)}`;
    return;
  }
  if (kind === 'dup') return duplicatePage(cur);
  if (kind === 'link') {
    const ok = await copyText(`${location.origin}${location.pathname}#/p/${cur}`);
    return flash(ok ? '링크를 복사했어요. 로그인한 본인만 열 수 있어요' : '복사하지 못했어요');
  }
}

$('#shareBtn').onclick = e => sharePanel('export', e.currentTarget);

$('#moreBtn').onclick = e => {
  openPop(`<button class="mi compact" data-v="md">마크다운으로 저장</button>
    <button class="mi compact" data-v="sub">하위 페이지 추가</button>
    <button class="mi compact" data-v="full">${page().full ? '기본 너비로 보기' : '전체 너비로 보기'}</button>
    <button class="mi compact danger" data-v="del">페이지 삭제</button>`, e.currentTarget, v => {
    if (v === 'md') return download(`${page().title || '제목 없음'}.md`, toMarkdown(page()), 'text/markdown');
    if (v === 'sub') { const p = makePage(cur); insertAfter(null, 'page', '', { page: p.id }); save(); return go(p.id); }
    if (v === 'full') { page().full = !page().full; save(); return $('.doc').classList.toggle('full', page().full); }
    if (v === 'del') removePageWithConfirm(cur);
  });
};

/* ---------- 제목 ---------- */

const titleEl = $('#title');
titleEl.addEventListener('input', () => {
  page().title = titleEl.textContent.replace(/\n/g, '');
  if (!page().title) titleEl.innerHTML = '';
  document.title = `${page().title || '제목 없음'} · Tidy`;
  save();
  renderTree();
  renderCrumbs();
});
titleEl.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
  e.preventDefault();
  const first = page().blocks[0];
  if (first && first.type === 'text' && !first.html) return place(first.id, 0);
  const nb = { id: uid(), type: 'text', html: '' };
  page().blocks.unshift(nb);
  commit(nb.id, 0);
});
titleEl.addEventListener('paste', e => {
  e.preventDefault();
  document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' '));
});

/* ---------- 백업 ---------- */

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function toMarkdown(p) {
  const tmp = document.createElement('div');
  const md = html => {
    tmp.innerHTML = html.replace(/<br>/g, '\n');
    tmp.querySelectorAll('b, strong').forEach(x => x.replaceWith(`**${x.textContent}**`));
    tmp.querySelectorAll('i, em').forEach(x => x.replaceWith(`*${x.textContent}*`));
    tmp.querySelectorAll('code').forEach(x => x.replaceWith(`\`${x.textContent}\``));
    tmp.querySelectorAll('a').forEach(x => x.replaceWith(`[${x.textContent}](${x.getAttribute('href')})`));
    return tmp.textContent;
  };
  let n = 0;
  const lines = p.blocks.map(b => {
    n = b.type === 'number' ? n + 1 : 0;
    const t = md(b.html), pad = '  '.repeat(b.indent || 0);
    return pad + line(b, t).split('\n').join(`\n${pad}`);
  });
  function line(b, t) {
    switch (b.type) {
      case 'h1': return `# ${t}`;
      case 'h2': return `## ${t}`;
      case 'h3': return `### ${t}`;
      case 'bullet': return `- ${t}`;
      case 'number': return `${n}. ${t}`;
      case 'todo': return `- [${b.checked ? 'x' : ' '}] ${t}`;
      case 'quote': return `> ${t}`;
      case 'callout': return `> 💡 ${t}`;
      case 'toggle': return [`- ▸ ${t}`, ...md(b.body || '').split('\n').filter(Boolean).map(l => `  ${l}`)].join('\n');
      case 'code': return `\`\`\`\n${t}\n\`\`\``;
      case 'divider': return '---';
      case 'image': return b.src?.startsWith('file:') ? '🖼 (이미지)' : `![](${b.src})`;
      case 'file': return `📎 ${b.name || '파일'}`;
      case 'math': return `$$ ${t} $$`;
      case 'table': return (b.rows || []).map((r, i) => `| ${r.c.map(md).join(' | ')} |` + (i ? '' : `\n|${r.c.map(() => ' --- ').join('|')}|`)).join('\n');
      case 'page': return `- 📄 ${db.pages[b.page]?.title || '삭제된 페이지'}`;
      default: return t;
    }
  }
  return `# ${p.title || '제목 없음'}\n\n${lines.join('\n')}\n`;
}

$('#exportBtn').onclick = () => {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  download(`Tidy-백업-${stamp}.json`, JSON.stringify(db, null, 2), 'application/json');
};

$('#importFile').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!d.pages || !Array.isArray(d.root)) throw new Error('bad');
    if (!confirm('지금 노트를 백업 파일 내용으로 바꿀까요? 지금 내용은 사라져요.')) return;
    // 가져온 글도 허용한 태그만 남긴다
    Object.values(d.pages).forEach(p => p.blocks.forEach(b => { b.html = clean(b.html || ''); }));
    db = d;
    save();
    go(db.root[0]);
    renderTree();
  } catch {
    alert('백업 파일을 읽지 못했어요.');
  }
};

/* ---------- 테마 · 모바일 ---------- */

function themeLabel() {
  const dark = document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#themeBtn').textContent = dark ? '라이트 모드' : '다크 모드';
  return dark;
}
$('#themeBtn').onclick = () => {
  const next = themeLabel() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('note.theme', next); } catch {}
  themeLabel();
};
themeLabel();

// 모바일은 서랍처럼 열고, PC는 접은 상태를 기억한다
const isMobile = () => matchMedia('(max-width: 760px)').matches;
const setSide = open => document.body.classList.toggle('side-open', open);
function toggleSide(open) {
  if (isMobile()) return setSide(open);
  document.body.classList.toggle('side-collapsed', !open);
  try { localStorage.setItem('note.side', open ? 'open' : 'closed'); } catch {}
}
const sideShown = () => isMobile() ? document.body.classList.contains('side-open') : !document.body.classList.contains('side-collapsed');
try { if (localStorage.getItem('note.side') === 'closed') document.body.classList.add('side-collapsed'); } catch {}
$('#menuBtn').onclick = () => toggleSide(!sideShown());
$('#closeSide').onclick = () => toggleSide(false);
$('#scrim').onclick = () => setSide(false);
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); toggleSide(!sideShown()); }
});

/* ---------- 전체 페이지 ---------- */

const allState = { q: '', sort: 'updated' };

function ago(t) {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  if (h < 48) return '어제';
  const d = new Date(t);
  return `${d.getFullYear() === new Date().getFullYear() ? '' : `${d.getFullYear()}년 `}${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function renderAll() {
  document.title = '전체 페이지 · Tidy';
  $('.doc').hidden = true;
  $('#all').hidden = false;
  $('#moreBtn').hidden = true;
  $('#crumbs').innerHTML = '<a href="#/all">전체 페이지</a>';
  $('#allSearch').value = allState.q;
  $('#allSort').value = allState.sort;
  renderAllList();
  $('main').scrollTop = 0;
}

// 전체 페이지 카드에 들어갈 작은 미리보기
function miniPreview(p) {
  const rows = p.blocks.filter(b => b.html || ['divider', 'image', 'file', 'table'].includes(b.type)).slice(0, 16).map(b => {
    const mark = b.type === 'todo' ? `<i class="mk-todo${b.checked ? ' on' : ''}"></i>` : b.type === 'toggle' ? '<i>▾</i>'
      : b.type === 'bullet' ? '<i>•</i>' : '';
    const text = esc(b.html.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    if (b.type === 'divider') return '<span class="ml hr"></span>';
    if (['image', 'file', 'table', 'math'].includes(b.type)) return `<span class="ml" style="padding-left:${(b.indent || 0) * 9}px">${{ image: '🖼 이미지', file: `📎 ${esc(b.name || '파일')}`, table: '▦ 표', math: 'ƒx 공식' }[b.type]}</span>`;
    return `<span class="ml t-${b.type}${b.checked ? ' done' : ''}" style="padding-left:${(b.indent || 0) * 9}px">${mark}${text}</span>`;
  }).join('');
  return rows || '<span class="ml empty">빈 페이지</span>';
}

function renderAllList() {
  const q = allState.q.trim().toLowerCase();
  let list = Object.values(db.pages).filter(p => !q || (p.title || '제목 없음').toLowerCase().includes(q) ||
    p.blocks.some(b => b.html && b.html.replace(/<[^>]+>/g, '').toLowerCase().includes(q)));
  list.sort(allState.sort === 'title' ? (a, b) => (a.title || '제목 없음').localeCompare(b.title || '제목 없음', 'ko')
    : (a, b) => (b.updated || 0) - (a.updated || 0));
  $('#allCount').textContent = `${list.length}개`;
  $('#allList').innerHTML = list.length ? list.map(p => {
    const where = pathOf(p.id).slice(0, -1).map(x => x.title || '제목 없음').join(' / ');
    return `<a class="doc-card" href="#/p/${p.id}">
      <span class="dc-head"><span class="emoji">${esc(p.icon)}</span><b>${esc(p.title || '제목 없음')}</b></span>
      <span class="dc-mini">${miniPreview(p)}</span>
      <span class="dc-foot">${esc(where || '최상위')} · ${ago(p.updated)}</span></a>`;
  }).join('') : '<p class="empty-tree">찾는 페이지가 없어요</p>';
}

$('#allSearch').addEventListener('input', e => { allState.q = e.target.value; renderAllList(); });
$('#allSort').addEventListener('change', e => { allState.sort = e.target.value; renderAllList(); });

/* ---------- 로그인 · 동기화 (cloud.js와 연결) ---------- */

const OWNER = 'note.owner';
function renderAccount(user) {
  const el = $('#account');
  if (!window.cloud?.enabled) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = user
    ? `<div class="acct" title="${esc(user.email || '')}">${user.photoURL
        ? `<img class="avatar" src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'avatar',textContent:'${esc((user.displayName || user.email || '?')[0])}'}))">`
        : `<span class="avatar">${esc((user.displayName || user.email || '?')[0])}</span>`}<span class="acct-name">${esc(user.displayName || user.email)}</span></div>`
    : '<button id="loginBtn" class="login"><svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg><span>구글로 로그인하기</span></button>';
  $('#loginBtn')?.addEventListener('click', () => window.cloud.login().catch(() => flash('로그인하지 못했어요')));

}

function rerender() {
  if (location.hash === '#/all') return route();
  if (!db.pages[cur]) return go(db.root[0]);
  renderTree();
  renderPage();
}

window.memoApp = {
  data: () => db,
  fileIds: () => Object.values(db.pages).flatMap(p => p.blocks).filter(b => b.src?.startsWith('file:')).map(b => b.src.slice(5)),
  fileData: fileGet,
  status: flash,
  // 다른 계정이 쓰던 기기라면 이 기기의 노트를 비우고 시작한다
  claim(uid) {
    const owner = localStorage.getItem(OWNER);
    if (owner && owner !== uid) { seed(); rerender(); }
    localStorage.setItem(OWNER, uid);
  },
  replace(d) {
    Object.values(d.pages).forEach(p => p.blocks.forEach(b => { b.html = clean(b.html || ''); }));
    db = d;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
    rerender();
  },
  signedIn: renderAccount,
  signedOut() {
    // 로그인 확인이 잠깐 실패한 경우에는 노트를 지우지 않는다. 직접 로그아웃했을 때만 비운다
    if (localStorage.getItem('note.logout')) {
      localStorage.removeItem('note.logout');
      localStorage.removeItem(OWNER);
      seed();
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
      rerender();
    }
    renderAccount(null);
  },
};
renderAccount(null);

/* ---------- 라우팅 ---------- */

function route() {
  unpick();
  closeSlash();
  closePop();
  setSide(false);
  if (location.hash === '#/all') {
    cur = null;
    renderTree();
    return renderAll();
  }
  const id = location.hash.match(/^#\/p\/(\w+)/)?.[1];
  if (!db.pages[id]) return go(db.root[0]);
  cur = id;
  if (hist.page !== cur) histReset();
  // 열린 페이지의 상위 페이지는 펼쳐 둔다
  pathOf(id).slice(0, -1).forEach(p => { p.open = true; });
  renderTree();
  renderPage();
}
window.addEventListener('hashchange', route);
route();
try { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(db)); } catch {}

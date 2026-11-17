// Memo: 페이지 트리 + 블록 편집기. 이 브라우저의 localStorage에 저장하고, 로그인하면 cloud.js가 Firestore와 동기화한다.
const KEY = 'note.v1';
const $ = (s, el = document) => el.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
  callout: { label: '콜아웃', hint: '눈에 띄게 강조해요', ico: '💡', keys: 'callout 콜아웃 강조' },
  code: { label: '코드', hint: '코드를 적어요', ico: '</>', keys: 'code 코드' },
  divider: { label: '구분선', hint: '구역을 나눠요', ico: '—', keys: 'divider hr line 구분선 선' },
  page: { label: '페이지', hint: '안에 새 페이지를 만들어요', ico: '📄', keys: 'page 페이지 하위' },
};
const PH = { text: "'/'를 입력해 명령어 사용", h1: '제목 1', h2: '제목 2', h3: '제목 3', bullet: '목록', number: '목록', todo: '할 일', quote: '인용', callout: '내용을 입력하세요', code: '코드' };
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
  const home = makePage(null, '시작하기', '👋', [
    b('callout', 'Memo에 오신 걸 환영해요. 쓴 내용은 자동으로 저장돼요.'),
    b('h2', '이렇게 써보세요'),
    b('todo', '빈 줄에서 <b>/</b> 를 입력해 블록 종류 고르기'),
    b('todo', '<code># </code> 제목, <code>- </code> 목록, <code>1. </code> 번호, <code>[] </code> 할 일, <code>&gt; </code> 인용'),
    b('todo', '글자를 고르고 <b>⌘B</b> 굵게, <b>⌘I</b> 기울임, <b>⌘U</b> 밑줄'),
    b('todo', '블록 왼쪽 ⋮⋮ 를 끌어서 순서 바꾸기, 눌러서 메뉴 열기'),
    b('divider', ''),
    b('h2', '알아두기'),
    b('bullet', '왼쪽 목록의 <b>+</b> 로 페이지 안에 페이지를 만들 수 있어요.'),
    b('bullet', '왼쪽 위 <b>Google로 로그인</b>하면 다른 기기에서도 이어서 쓸 수 있어요.'),
  ]);
  makePage(home.id, '할 일', '✅', [
    b('todo', '장보기', { checked: true }),
    b('todo', '운동 30분'),
    b('todo', ''),
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

let saveTimer;
function save() {
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
  const tw = flat ? '' : kids ? (p.open ? '▾' : '▸') : '';
  return `<div class="ti${id === cur ? ' on' : ''}" data-id="${id}" role="treeitem" style="padding-left:${4 + depth * 14}px">
      <button class="tw" data-act="toggle" aria-label="${p.open ? '접기' : '펼치기'}" ${kids && !flat ? '' : 'tabindex="-1"'}>${tw}</button>
      <span class="ti-ico emoji">${esc(p.icon)}</span>
      <span class="ti-title">${esc(p.title || '제목 없음')}</span>
      <button class="ti-btn" data-act="add" aria-label="하위 페이지 추가" title="하위 페이지 추가">＋</button>
      <button class="ti-btn" data-act="del" aria-label="페이지 삭제" title="삭제">✕</button>
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
$('#newPage').onclick = () => { const p = makePage(null); save(); go(p.id); };

/* ---------- 문서 그리기 ---------- */

function renderPage() {
  const p = page();
  $('.doc').hidden = false;
  $('#all').hidden = true;
  $('#moreBtn').hidden = false;
  $('.doc').classList.toggle('full', !!p.full);
  document.title = `${p.title || '제목 없음'} · Memo`;
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
  if (b.type === 'divider') body = '<hr>';
  else if (b.type === 'page') {
    const t = db.pages[b.page];
    body = t ? `<a class="plink" href="#/p/${t.id}"><span class="emoji">${esc(t.icon)}</span><u>${esc(t.title || '제목 없음')}</u></a>`
      : '<span class="plink gone">삭제된 페이지</span>';
  } else {
    body = `<div class="c" contenteditable="true" data-ph="${PH[b.type]}"${b.type === 'code' ? ' spellcheck="false"' : ''}>${b.html}</div>`;
  }
  const solid = b.type === 'divider' || b.type === 'page';
  return `<div class="blk t-${b.type}${b.checked ? ' done' : ''}" data-id="${b.id}"${solid ? ' tabindex="-1"' : ''}>
    <div class="hd"><button class="add" tabindex="-1" aria-label="아래에 블록 추가" title="아래에 블록 추가">＋</button><button class="grip" draggable="true" tabindex="-1" aria-label="블록 메뉴" title="끌어서 옮기기 · 눌러서 메뉴">⋮⋮</button></div>
    ${pre}${body}</div>`;
}

function renderBlocks(focusId, at = 0) {
  const p = page();
  if (!p.blocks.length) p.blocks.push({ id: uid(), type: 'text', html: '' });
  $('#blocks').innerHTML = p.blocks.map(blockHtml).join('');
  if (focusId) place(focusId, at);
}

function commit(focusId, at) {
  renderBlocks(focusId, at);
  save();
}

/* ---------- 커서 ---------- */

const editOf = id => $(`.blk[data-id="${id}"] > .c`);
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
      if (!ALLOWED.has(n.tagName)) { n.replaceWith(...n.childNodes); continue; }
      for (const a of [...n.attributes]) {
        if (!(n.tagName === 'A' && a.name === 'href' && /^https?:/i.test(a.value))) n.removeAttribute(a.name);
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

function setType(b, type) {
  b.type = type;
  if (type !== 'todo') delete b.checked;
  if (type === 'divider') b.html = '';
}

function splitBlock(b, el) {
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
  const nb = insertAfter(b.id, LISTS.includes(b.type) ? b.type : 'text', after);
  commit(nb.id, 0);
}

function mergeUp(b, el) {
  const i = idx(b.id), prev = page().blocks[i - 1];
  if (!prev) return;
  if (prev.type === 'divider' || prev.type === 'page') {
    page().blocks.splice(i - 1, 1);
    return commit(b.id, 0);
  }
  const at = textLen(prev.html);
  prev.html = clean(prev.html + (el.textContent ? el.innerHTML : ''));
  page().blocks.splice(i, 1);
  commit(prev.id, at);
}

function removeBlock(id) {
  const i = idx(id), list = page().blocks;
  list.splice(i, 1);
  const next = list[i - 1] || list[i];
  commit(next?.id, -1);
}

function moveBlock(id, toIndex) {
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
  let x = Math.min(rect.left, innerWidth - w - 8), y = rect.bottom + 6;
  if (y + h > innerHeight - 8) y = Math.max(8, rect.top - h - 6);
  pop.style.left = `${Math.max(8, x)}px`;
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

blocksEl.addEventListener('keydown', e => {
  const row = e.target.closest('.blk');
  if (!row) return;
  const b = blk(row.dataset.id);
  if (slashKey(e)) return;
  const el = e.target.classList.contains('c') ? e.target : null;
  const i = idx(b.id), list = page().blocks;

  if (!el) {
    // 구분선과 페이지 링크 블록이 선택된 상태
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); removeBlock(b.id); }
    else if (e.key === 'Enter') { e.preventDefault(); const nb = insertAfter(b.id); commit(nb.id, 0); }
    else if (e.key === 'ArrowUp' && list[i - 1]) { e.preventDefault(); place(list[i - 1].id, -1); }
    else if (e.key === 'ArrowDown' && list[i + 1]) { e.preventDefault(); place(list[i + 1].id, 0); }
    return;
  }
  if (e.isComposing || e.keyCode === 229) return;
  const sel = getSelection(), collapsed = sel.isCollapsed, at = caret(el);

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (b.type === 'code') return document.execCommand('insertText', false, '\n');
    return splitBlock(b, el);
  }
  if (e.key === 'Backspace' && collapsed && at === 0) {
    e.preventDefault();
    sync(b, el);
    if (b.type !== 'text') { setType(b, 'text'); return commit(b.id, 0); }
    return mergeUp(b, el);
  }
  if (e.key === 'ArrowUp' && collapsed && at === 0 && list[i - 1]) { e.preventDefault(); return place(list[i - 1].id, -1); }
  if (e.key === 'ArrowDown' && collapsed && at === el.textContent.length && list[i + 1]) { e.preventDefault(); return place(list[i + 1].id, 0); }
  if (e.key === 'Tab') e.preventDefault();
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
  const el = e.target.closest('.c');
  if (!el) return;
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain').replace(/\r/g, '');
  const b = blk(el.closest('.blk').dataset.id);
  if (b.type === 'code' || !text.includes('\n')) return document.execCommand('insertText', false, text);
  const [first, ...rest] = text.split('\n');
  document.execCommand('insertText', false, first);
  sync(b, el);
  let last = b;
  for (const line of rest) {
    const [type, body] = parseLine(line);
    last = insertAfter(last.id, type, esc(body), type === 'todo' ? { checked: /^\[x\]/i.test(line.trim().slice(2)) } : undefined);
  }
  commit(last.id, -1);
});

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
  if (b.type === 'divider') row.focus();
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
blocksEl.addEventListener('dragover', e => {
  if (!dragId) return;
  e.preventDefault();
  clearDrop();
  const row = e.target.closest('.blk');
  if (!row || row.dataset.id === dragId) return;
  const r = row.getBoundingClientRect();
  row.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
});
blocksEl.addEventListener('drop', e => {
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
function closePop() { popEl.hidden = true; }
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
  openPop(`<div class="pop-h">아이콘</div><div class="icons">${ICONS.map(i => `<button data-v="${i}">${i}</button>`).join('')}</div>`, e.currentTarget, v => {
    page().icon = v;
    save();
    renderPage();
    renderTree();
  });
};

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
  document.title = `${page().title || '제목 없음'} · Memo`;
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
    const t = md(b.html);
    switch (b.type) {
      case 'h1': return `# ${t}`;
      case 'h2': return `## ${t}`;
      case 'h3': return `### ${t}`;
      case 'bullet': return `- ${t}`;
      case 'number': return `${n}. ${t}`;
      case 'todo': return `- [${b.checked ? 'x' : ' '}] ${t}`;
      case 'quote': return `> ${t}`;
      case 'callout': return `> 💡 ${t}`;
      case 'code': return `\`\`\`\n${t}\n\`\`\``;
      case 'divider': return '---';
      case 'page': return `- 📄 ${db.pages[b.page]?.title || '삭제된 페이지'}`;
      default: return t;
    }
  });
  return `# ${p.title || '제목 없음'}\n\n${lines.join('\n')}\n`;
}

$('#exportBtn').onclick = () => {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  download(`Memo-백업-${stamp}.json`, JSON.stringify(db, null, 2), 'application/json');
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

const setSide = open => document.body.classList.toggle('side-open', open);
$('#menuBtn').onclick = () => setSide(true);
$('#closeSide').onclick = () => setSide(false);
$('#scrim').onclick = () => setSide(false);

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
  document.title = '전체 페이지 · Memo';
  $('.doc').hidden = true;
  $('#all').hidden = false;
  $('#moreBtn').hidden = true;
  $('#crumbs').innerHTML = '<a href="#/all">전체 페이지</a>';
  $('#allSearch').value = allState.q;
  $('#allSort').value = allState.sort;
  renderAllList();
  $('main').scrollTop = 0;
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
    const text = p.blocks.map(b => b.html.replace(/<[^>]+>/g, '')).filter(Boolean).join(' ').slice(0, 80);
    return `<a class="all-row" href="#/p/${p.id}">
      <span class="all-ico emoji">${esc(p.icon)}</span>
      <span class="all-txt"><b>${esc(p.title || '제목 없음')}</b><small>${esc(where ? `${where} · ${text}` : text) || '빈 페이지'}</small></span>
      <time>${ago(p.updated)}</time></a>`;
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
    ? `<div class="acct"><span class="avatar">${esc((user.displayName || user.email || '?')[0])}</span><span class="acct-name">${esc(user.displayName || user.email)}</span><button id="logoutBtn" class="ti-btn" title="로그아웃" aria-label="로그아웃">⎋</button></div>`
    : '<button id="loginBtn" class="login"><span class="g">G</span> Google로 로그인</button><p class="login-note">로그인하면 여러 기기에서 이어서 써요</p>';
  $('#loginBtn')?.addEventListener('click', () => window.cloud.login().catch(() => flash('로그인하지 못했어요')));
  $('#logoutBtn')?.addEventListener('click', async () => {
    if (!confirm('로그아웃할까요? 이 기기에 있는 노트는 지워지고, 다시 로그인하면 불러와요.')) return;
    await window.cloud.logout();
  });
}

function rerender() {
  if (location.hash === '#/all') return route();
  if (!db.pages[cur]) return go(db.root[0]);
  renderTree();
  renderPage();
}

window.memoApp = {
  data: () => db,
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
    if (localStorage.getItem(OWNER)) {
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
  // 열린 페이지의 상위 페이지는 펼쳐 둔다
  pathOf(id).slice(0, -1).forEach(p => { p.open = true; });
  renderTree();
  renderPage();
}
window.addEventListener('hashchange', route);
route();
try { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(db)); } catch {}

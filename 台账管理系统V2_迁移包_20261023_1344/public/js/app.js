/* 信息中心设备及备件台账管理系统 V2 - 前端逻辑 */
'use strict';

/* ===== 版本自检：服务端代码更新后自动重载页面（无需手动强刷） =====
   每 60 秒拉取首页比对 app.js 版本号，不一致说明有新版本，自动刷新加载新代码；
   页面切换回可见时立即检测一次，确保后台停留的页面也能及时更新。
   火狐适配：① 拉取一律 cache:'reload' 强制绕过本地缓存（部分火狐对 no-store
   fetch 仍可能命中启发式缓存）；② 版本变化时不再用 location.reload()（火狐可能
   回退旧缓存），改用带随机时间戳的整页替换导航，配合后端 no-store 响应头必定
   加载最新 HTML；③ 连续多次检测仍不同步时用 location.replace 兜底。 */
(function () {
  var CUR = '20261023m07';            // 必须与 index.html 中 app.js?v= 一致
  var KEY = 'tz_app_ver';
  try { localStorage.setItem(KEY, CUR); } catch (e) {}
  var staleCount = 0;
  function check() {
    fetch('/?__v=' + Date.now() + '&_r=' + Math.random(), { cache: 'reload', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var m = html.match(/app\.js\?v=([\w\d]+)/);
        if (!m || !m[1] || m[1] === CUR) { staleCount = 0; return; }
        staleCount++;
        if (staleCount >= 3) location.replace(location.pathname + '?_t=' + Date.now());
        else location.replace('/?_t=' + Date.now());
      })
      .catch(function () {});
  }
  setInterval(check, 5000);
  if (document.visibilityState !== 'hidden') check();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') check();
  });
})();

/* 侧边栏折叠 */
(function(){
  const sb = document.getElementById('sidebar');
  const btn = document.getElementById('sidebarToggle');
  if (!sb || !btn) return;
  if (localStorage.getItem('sb_collapsed') === '1') sb.classList.add('collapsed');
  const toggle = () => {
    sb.classList.toggle('collapsed');
    localStorage.setItem('sb_collapsed', sb.classList.contains('collapsed') ? '1' : '0');
  };
  btn.addEventListener('click', toggle);
  // 折叠后点击图标也能展开
  sb.querySelector('.brand-icon').addEventListener('click', () => {
    if (sb.classList.contains('collapsed')) toggle();
  });
})();

/* 通用：tab 拖拽排序已还原（不再启用），并清除之前保存的排序数据 */
function initTabSortable() {
  // 清除之前保存的 tab 排序
  Object.keys(localStorage).filter(k => k.startsWith('tab_order_')).forEach(k => localStorage.removeItem(k));
}

/* 启动屏：资源加载完成后淡出移除 */
window.addEventListener('load', () => {
  const b = document.getElementById('bootScreen');
  if (b) { b.style.opacity = '0'; setTimeout(() => b.remove(), 380); }
});

/* ============ 工具函数 ============ */
const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function api(path, method = 'GET', body) {
  const opt = { method, headers: {} };
  if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  let res;
  try {
    res = await fetch('/api' + path, opt);
  } catch (e) {
    toast('网络连接失败，请检查服务是否运行', 'err');
    throw e;
  }
  if (res.status === 401) { showLogin(); throw new Error('未登录'); }
  const data = await res.json();
  if (!data.ok) { throw new Error(data.error || '请求失败'); }
  return data;
}

function toast(msg, type = '') {
  const w = $('#toastWrap');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 2600);
}

/* ============ 移动端兼容搜索下拉组件（替代 datalist，兼容手机/平板/电脑） ============ */
function _dlStyle() {
  if (document.getElementById('dlS')) return;
  const s = document.createElement('style'); s.id = 'dlS';
  s.textContent = `
.dl-wrap{ position:relative; display:block; }
.dl-panel{ position:fixed; z-index:99999; background:#fff; border:1px solid #e5e7eb; border-radius:10px;
  box-shadow:0 10px 30px rgba(0,0,0,.18); max-height:38vh; overflow-y:auto; display:none; padding:4px;
  overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
.dl-item{ padding:10px 12px; font-size:14px; color:#1f2937; border-radius:8px; cursor:pointer;
  -webkit-tap-highlight-color:transparent; word-break:break-all; }
.dl-item:active,.dl-item:hover{ background:#f3f4f6; }
.dl-empty{ padding:10px 12px; font-size:13px; color:#9ca3af; }
@media (max-width:640px){ .dl-item{ padding:12px; font-size:15px; } }
`;
  document.head.appendChild(s);
}
function upgradeDatalists(scope) {
  _dlStyle();
  scope.querySelectorAll('input[list]').forEach(inp => {
    if (inp.dataset.dlUp) return;
    inp.dataset.dlUp = '1';
    const listId = inp.getAttribute('list');
    if (!listId) return;
    inp.removeAttribute('list');                       // 禁用原生 datalist 弹出，统一走自定义面板
    const dl = document.getElementById(listId);
    if (!dl) return;
    const wrap = document.createElement('div');
    wrap.className = 'dl-wrap';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);
    const panel = document.createElement('div');
    panel.className = 'dl-panel';
    wrap.appendChild(panel);
    const hide = () => { panel.style.display = 'none'; };
    const place = () => {
      const r = inp.getBoundingClientRect();
      if (!r.width && !r.height) { hide(); return; }
      panel.style.left = r.left + 'px';
      panel.style.top = (r.bottom + 3) + 'px';
      panel.style.width = Math.max(r.width, 180) + 'px';
      const ph = panel.offsetHeight;
      if (r.bottom + ph > window.innerHeight - 8 && r.top > ph + 8) panel.style.top = (r.top - ph - 3) + 'px';
    };
    const render = () => {
      const opts = Array.from(dl.options).map(o => o.value).filter(Boolean);
      if (!opts.length) { hide(); return; }
      const q = inp.value.trim();
      const hits = q ? opts.filter(v => v.toLowerCase().includes(q.toLowerCase())) : opts;
      panel.innerHTML = hits.length
        ? hits.map(v => '<div class="dl-item" data-v="' + esc(v) + '">' + esc(v) + '</div>').join('')
        : '<div class="dl-empty">无匹配项（可直接手写）</div>';
      if (!hits.length) { panel.style.display = 'block'; place(); return; }
      panel.querySelectorAll('.dl-item').forEach(it => {
        const pick = () => { inp.value = it.dataset.v; hide(); inp.dispatchEvent(new Event('input', { bubbles: true })); };
        it.addEventListener('click', pick);
        it.addEventListener('touchstart', e => { e.preventDefault(); pick(); }, { passive: false });
      });
      panel.style.display = 'block';
      place();
    };
    inp.addEventListener('focus', render);
    inp.addEventListener('click', render);
    inp.addEventListener('input', () => { if (panel.style.display !== 'none') render(); });
    inp.addEventListener('blur', () => setTimeout(hide, 160));
    const scroller = inp.closest('.modal-body');
    inp.addEventListener('focus', () => {
      const once = () => hide();
      if (scroller) scroller.addEventListener('scroll', once, { once: true });
      window.addEventListener('scroll', once, { once: true });
      window.addEventListener('resize', once, { once: true });
    });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) hide(); });
  });
}

let _modalOkFn = null;
function openModal(title, bodyHtml, footHtml, okFn, wide) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHtml;
  upgradeDatalists($('#modalBody'));
  $('#modalFoot').innerHTML = footHtml || '';
  _modalOkFn = okFn || null;
  const box = $('#modalBox');
  box.className = 'modal' + (wide ? ' wide' : '');
  $('#modalMask').classList.remove('hidden');
}
function closeModal() { $('#modalMask').classList.add('hidden'); _modalOkFn = null; }
$('#modalClose').addEventListener('click', closeModal);
$('#modalMask').addEventListener('click', (e) => { if (e.target === $('#modalMask')) closeModal(); });

function confirmModal(title, message, onOk) {
  openModal(title,
    '<p style="font-size:14px;color:#374151">' + esc(message) + '</p>',
    '<button class="btn" data-act="cancel">取消</button><button class="btn btn-danger" data-act="ok">确认删除</button>',
    null);
  $('#modalFoot').querySelector('[data-act=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-act=ok]').onclick = () => { closeModal(); onOk(); };
}

/* ============ 登录 ============ */
const loginPage = $('#loginPage'), appEl = $('#app');

function showLogin() {
  appEl.classList.add('hidden');
  loginPage.classList.remove('hidden');
  $('#loginMsg').textContent = '';
}
async function showApp() {
  try {
    const r = await api('/me');
    const u = r.user;
    curUser = u;
    $('#sideUserName').textContent = u.real_name || u.username;
    $('#topUserName').textContent = (u.real_name || u.username) + (u.role === 'admin' ? '' : '');
    appEl.classList.remove('hidden');
    loginPage.classList.add('hidden');
    syncUserSettings();   // 拉取当前账号的后端个性化设置（含旧列配置，供 admin 迁移为全局）
    loadGlobalCols();     // 拉取全局列配置（admin 保存后全员同步）
    navigate('dashboard');
  } catch (e) {
    showLogin();
  }
}

$('#loginBtn').addEventListener('click', async () => {
  const username = $('#loginUser').value.trim();
  const password = $('#loginPass').value;
  if (!username || !password) { $('#loginMsg').textContent = '请输入用户名和密码'; return; }
  $('#loginBtn').disabled = true;
  try {
    const r = await api('/login', 'POST', { username, password });
    $('#loginMsg').textContent = '';
    await showApp();
  } catch (e) {
    $('#loginMsg').textContent = e.message;
  }
  $('#loginBtn').disabled = false;
});
$('#loginPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#loginBtn').click(); });

$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/logout', 'POST'); } catch (e) {}
  showLogin();
});


/* ============ 账号权限 + 通用表格增强（排序/筛选/列设置） ============ */
let curUser = null;
const MODULES = ['printers', 'computers', 'consumables', 'stats', 'spares', 'pcopt', 'pcReplace', 'notes', 'ai', 'system'];
const MODULE_NAMES = { printers: '打印机管理', computers: '办公电脑', consumables: '耗材管理', stats: '费用统计', spares: '备品备件', pcopt: '电脑优化', pcReplace: '配件更换', notes: '记事本', ai: 'AI 工作台', system: '系统管理' };
const NAV_DEF = {
  dashboard: { t: '工作台', i: '🏠' }, printers: { t: '打印机管理', i: '🖨️' },
  consumables: { t: '耗材管理', i: '🧴' }, stats: { t: '费用统计', i: '💰' },
  spares: { t: '备品备件', i: '📦' }, computers: { t: '办公电脑', i: '💻' },
  pcopt: { t: '电脑优化', i: '🛠️' }, pcReplace: { t: '配件更换', i: '🧰' }, notes: { t: '记事本', i: '📝' },
  ai: { t: 'AI 工作台', i: '🐉' }, system: { t: '系统管理', i: '⚙️' }
};
const NAV_ORDER_DEF = ['dashboard', 'printers', 'consumables', 'stats', 'spares', 'computers', 'pcReplace', 'pcopt', 'notes', 'ai', 'system'];

function canView(mod) {
  if (!curUser) return false;
  const p = curUser.perms || {};
  if (p['*'] === 'edit' || p['*'] === 'view') return true;
  return !!p[mod];
}
function canEdit(mod) {
  if (!curUser) return false;
  const p = curUser.perms || {};
  if (p['*'] === 'edit') return true;
  return p[mod] === 'edit';
}
function navCfgKey() {
  return curUser && curUser.username ? 'tz_nav_' + curUser.username : 'tz_nav';
}
function getNavCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(navCfgKey()) || '{}');
    if (c.order || c.hide) return c;
    // 兼容旧全局配置：仅迁移排序，忽略历史隐藏项，避免其他账号在某台电脑上设置的隐藏残留影响当前账号
    const old = JSON.parse(localStorage.getItem('tz_nav') || '{}');
    if (old.order || old.hide) return { order: Array.isArray(old.order) ? old.order : undefined, hide: [] };
    return {};
  } catch (e) { return {}; }
}
function setNavCfg(cfg) {
  try { localStorage.setItem(navCfgKey(), JSON.stringify(cfg)); } catch (e) {}
}
function renderNav() {
  const nav = $('#navList');
  if (!nav) return;
  const cfg = getNavCfg();
  const order = (Array.isArray(cfg.order) && cfg.order.length ? cfg.order : NAV_ORDER_DEF).filter(p => NAV_DEF[p]);
  const hide = cfg.hide || [];
  const html = order.map(p => {
    if (hide.includes(p)) return '';
    if (p !== 'dashboard' && !canView(p)) return '';
    return '<a class="nav-item ' + (p === currentPage ? 'active' : '') + '" data-page="' + p + '"><span class="nav-ico">' + NAV_DEF[p].i + '</span><span class="nav-text">' + NAV_DEF[p].t + '</span></a>';
  }).join('');
  nav.innerHTML = html;
  $$('.nav-item', nav).forEach(n => n.addEventListener('click', () => navigate(n.dataset.page)));
}

/* 表格→模块映射（按 tbody id 自动识别，全模块统一接入） */
const TBL_MODULES = {
  pBody: 'printers', cpBody: 'computers', biRows: 'computers', pcOptBody: 'pcopt', pcPartsBody: 'pcopt', pcFlowsBody: 'pcopt', pcAdjustsBody: 'pcopt',
  csBody: 'consumables', mrBody: 'consumables', ajBody: 'consumables', irBody: 'consumables', sinBody: 'consumables',
  ssBody: 'spares', frBody: 'spares', saBody: 'spares', stkBody: 'spares',
  arBody: 'ai', rqBody: 'ai',
  uBody: 'system', bkFiles: 'system', bkLogs: 'system', lgBody: 'system',
  stDept: 'stats', stTop: 'stats', stBudgetBody: 'stats',
  prBody: 'pcReplace', pmBody: 'pcReplace', phBody: 'pcReplace',
  psBody: 'pcReplace', psiBody: 'pcReplace'
};

/* ===== 表格多选（批量删除 / 导出选中） ===== */
/* TZ_SEL: enhId -> Set(记录id)，跨页保留勾选 */
const TZ_SEL = {};
/* TZ_MULTI: tbody id -> { del: 单条删除路由前缀, exp: 导出选中路由 } */
const TZ_MULTI = {
  pBody: { del: '/api/printers/', exp: '/api/printers/export' },
  csBody: { del: '/api/consumables/', exp: '' },
  ajBody: { del: '/api/consumables/adjusts/', exp: '' },
  sinBody: { del: '/api/consumable-stock-in/', exp: '/api/consumable-stock-in/export' },
  mrBody: { del: '/api/maintenance/', exp: '' },
  irBody: { del: '/api/issues/', exp: '/api/issues/export' },
  ssBody: { del: '/api/items/', exp: '' },
  frBody: { del: '/api/flows/', exp: '/api/flows/export' },
  saBody: { del: '/api/spare/adjusts/', exp: '' },
  stkBody: { del: '/api/stocktakes/', exp: '' },
  cpBody: { del: '/api/computers/', exp: '' },
  pcOptBody: { del: '/api/pc-upgrades/', exp: '/api/pc-upgrades/export' },
  pcPartsBody: { del: '/api/pc-parts/', exp: '' },
  pcFlowsBody: { del: '/api/pc-flows/', exp: '' },
  pcAdjustsBody: { del: '/api/pc-adjusts/', exp: '' },
  arBody: { del: '/api/ai/records/', exp: '' },
  rqBody: { del: '/api/ai/knowledge/', exp: '' },
  uBody: { del: '/api/users/', exp: '' },
  prBody: { del: '/api/pc-replace/', exp: '/api/pc-replace/export' },
  pmBody: { del: '/api/pc-monitors/', exp: '/api/pc-monitors/export' },
  phBody: { del: '/api/pc-hall-computers/', exp: '/api/pc-hall-computers/export' },
  psBody: { del: '/api/pc-part-stock/', exp: '/api/pc-part-stock/export' },
  psiBody: { del: '/api/pc-part-stock-in/', exp: '/api/pc-part-stock-in/export' }
};
function tzSelSet(enhId) { return TZ_SEL[enhId] || (TZ_SEL[enhId] = new Set()); }
function tzRowId(tr) {
  const el = tr.querySelector('[data-id]');
  return el ? String(el.dataset.id) : '';
}
/* 批量操作条查找：表格父容器内 */
function findTzBar(tbl, enhId) {
  return tbl.parentElement ? tbl.parentElement.querySelector(':scope > .tz-batch') : null;
}
function tzUpdateBar(tbl, enhId, multiDef) {
  const bar = findTzBar(tbl, enhId);
  if (!bar) return;
  const set = tzSelSet(enhId);
  const n = set.size;
  bar.querySelector('.tz-batch-n').textContent = n;
  bar.querySelector('.tz-batch-del').disabled = n === 0;
  bar.querySelector('.tz-batch-clr').disabled = n === 0;
  const exp = bar.querySelector('.tz-batch-exp');
  exp.disabled = n === 0 || !multiDef.exp;
  exp.title = multiDef.exp ? '' : '该表暂不支持导出选中';
  const thCb = tbl.querySelector('thead .th-cb');
  if (thCb) {
    const cbs = [...tbl.querySelectorAll('tbody .row-cb')];
    const on = cbs.filter(c => c.checked).length;
    thCb.checked = cbs.length > 0 && on === cbs.length;
    thCb.indeterminate = on > 0 && on < cbs.length;
  }
}
function tzApplyMulti(tbl, enhId, multiDef) {
  const set = tzSelSet(enhId);
  const tbody = tbl.querySelector('tbody');
  if (!tbody) return;
  [...tbody.rows].forEach(tr => {
    let td = tr.querySelector(':scope > .cb-col');
    const id = tzRowId(tr);
    if (!td) {
      td = document.createElement('td');
      td.className = 'cb-col';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'row-cb';
      if (id) { cb.dataset.id = id; cb.checked = set.has(id); }
      td.appendChild(cb);
      tr.insertBefore(td, tr.firstChild);
    } else {
      const cb = td.querySelector('.row-cb');
      if (cb && id) { cb.dataset.id = id; cb.checked = set.has(id); }
    }
  });
  tzUpdateBar(tbl, enhId, multiDef);
}
function tzSetupMulti(tbl, enhId, multiDef) {
  const thead = tbl.querySelector('thead tr');
  const tbody = tbl.querySelector('tbody');
  if (!thead || !tbody) return;
  // 表头全选列（幂等）
  let th = thead.querySelector(':scope > .cb-col');
  if (!th) {
    th = document.createElement('th');
    th.className = 'cb-col';
    th.style.width = '36px';
    const thCb0 = document.createElement('input');
    thCb0.type = 'checkbox'; thCb0.className = 'th-cb'; thCb0.title = '全选本页';
    th.appendChild(thCb0);
    thead.insertBefore(th, thead.firstChild);
  }
  const thCb = th.querySelector('.th-cb');
  // 批量操作条（幂等：优先复用父容器内或吸顶容器内同 enhId 的）
  let bar = findTzBar(tbl, enhId);
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'tz-batch';
    bar.dataset.enh = enhId;
    bar.innerHTML = '<span>已选 <b class="tz-batch-n">0</b> 项</span>' +
      '<button class="btn btn-sm btn-danger tz-batch-del" disabled>🗑 批量删除</button>' +
      '<button class="btn btn-sm btn-primary tz-batch-exp" disabled>📤 导出选中</button>' +
      '<button class="btn btn-sm tz-batch-clr" disabled>清除</button>';
    tbl.parentElement.insertBefore(bar, tbl);
    bar.querySelector('.tz-batch-del').onclick = () => tzBatchDel(tbl, enhId, multiDef);
    bar.querySelector('.tz-batch-exp').onclick = () => tzBatchExp(tbl, enhId, multiDef);
    bar.querySelector('.tz-batch-clr').onclick = () => { tzSelSet(enhId).clear(); tzApplyMulti(tbl, enhId, multiDef); toast('已清除选择'); };
  }
  // 事件委托（幂等绑定一次；tbody 重建不失效）
  if (!thCb.dataset.bound) {
    thCb.dataset.bound = '1';
    thCb.addEventListener('change', () => {
      const set = tzSelSet(enhId);
      tbody.querySelectorAll('.row-cb').forEach(cb => {
        if (!cb.dataset.id) return;
        if (thCb.checked) set.add(cb.dataset.id); else set.delete(cb.dataset.id);
      });
      tzApplyMulti(tbl, enhId, multiDef);
    });
  }
  if (!tbody.dataset.multiBound) {
    tbody.dataset.multiBound = '1';
    tbody.addEventListener('change', e => {
      const cb = e.target;
      if (!cb || !cb.classList || !cb.classList.contains('row-cb')) return;
      const set = tzSelSet(enhId);
      if (cb.checked) set.add(String(cb.dataset.id)); else set.delete(String(cb.dataset.id));
      tzUpdateBar(tbl, enhId, multiDef);
    });
  }
  tzApplyMulti(tbl, enhId, multiDef);
}
async function tzBatchDel(tbl, enhId, multiDef) {
  const ids = [...tzSelSet(enhId)];
  if (!ids.length) return;
  if (!confirm('确定删除选中的 ' + ids.length + ' 条记录？此操作不可恢复。')) return;
  let ok = 0, fail = 0;
  for (const id of ids) {
    try {
      const r = await fetch(multiDef.del + id, { method: 'DELETE' });
      const d = await r.json();
      if (d && d.ok) ok++; else fail++;
    } catch (e) { fail++; }
  }
  toast('批量删除：成功 ' + ok + ' 条' + (fail ? '，失败 ' + fail + ' 条' : ''), fail ? 'err' : 'ok');
  tzSelSet(enhId).clear();
  if (tbl._renderPage) { tbl._renderPage(); return; }
  const tb = tbl.querySelector('tbody');
  const mod = tb ? TBL_MODULES[tb.id] : null;
  if (mod && renderers[mod]) renderers[mod]();
}
function tzBatchExp(tbl, enhId, multiDef) {
  const ids = [...tzSelSet(enhId)];
  if (!ids.length || !multiDef.exp) return;
  window.open(multiDef.exp + '?ids=' + ids.join(',') + '&_t=' + Date.now(), '_blank');
}

function enhanceTable(tbl, opts) {
  const id = opts.id || (tbl.id || 'tbl');
  let skipCols = opts.skipCols || [];
  const multiDef = opts.multiKey ? (TZ_MULTI[opts.multiKey] || null) : null;
  const thead = tbl.querySelector('thead tr');
  if (!thead) return;
  // 多选初始化独立于增强防重：旧会话已增强的表格也补齐多选
  if (multiDef) {
    skipCols = [0].concat(skipCols);
    tzSetupMulti(tbl, id, multiDef);
  }
  if (tbl.dataset.enh) { if (multiDef) tzApplyMulti(tbl, id, multiDef); return; }
  tbl.dataset.enh = '1';
  tbl.dataset.enhId = id;   // 记录增强 ID，供置顶列名条代理排序/筛选
  // 记录渲染模板列序：数据行 td 按此顺序生成，后续重排用 label 精确定位（表头重排后 ths 索引会错位）
  if (!tbl.dataset.tplOrder) {
    tbl.dataset.tplOrder = [...thead.children].map(th => th.textContent.replace(/[▾▲▼⚙\s]/g, '').trim()).join('|');
  }
  const colCount = thead.children.length;
  const lastCol = colCount - 1;
  // ① 表头：点击排序 + 列头筛选图标（Excel 式）
  [...thead.children].forEach((th, ci) => {
    if (skipCols.includes(ci) || ci === lastCol) return;
    th.style.cursor = 'pointer';
    th.title = '点击排序';
    th.addEventListener('click', () => {
      const cur = th.dataset.dir || '';
      const next = cur === '' ? 'asc' : (cur === 'asc' ? 'desc' : '');
      [...thead.children].forEach(h => {
        delete h.dataset.dir;
        const s = h.querySelector('.th-sort');
        if (s) s.remove();
      });
      th.dataset.dir = next;
      if (next) {
        const a = document.createElement('span');
        a.className = 'th-sort';
        a.textContent = next === 'asc' ? ' ▲' : ' ▼';
        th.appendChild(a);
      }
      if (tbl._renderPage) { tbl._renderPage(); return; } // 前端分页表格：全量重排重渲染
      sortTbody(tbl, ci, next);
    });
    // 列头筛选图标（点击弹出该列筛选菜单，不触发排序）
    const ic = document.createElement('span');
    ic.className = 'th-filter';
    ic.textContent = '▾';
    ic.title = '筛选此列';
    ic.addEventListener('click', e => { e.stopPropagation(); colFilter(tbl, id, ci); });
    th.appendChild(ic);
  });
  // ② 列设置按钮（表头末尾）
  const lastTh = thead.children[lastCol];
  if (lastTh) {
    const btn = document.createElement('button');
    btn.textContent = '⚙';
    btn.className = 'btn btn-sm';
    btn.title = '列显示设置';
    btn.style.cssText = 'margin-left:6px;padding:0 9px;line-height:22px;font-size:13px';
    btn.addEventListener('click', e => { e.stopPropagation(); colSettings(tbl, id, skipCols.concat(lastCol)); });
    lastTh.appendChild(btn);
  }
  // ③ 列显隐持久化 + 重绘后自动恢复
  applyCols(tbl, id, skipCols);
  const tbody = tbl.querySelector('tbody');
  if (tbody && !tbody.dataset.mo) {
    tbody.dataset.mo = '1';
    const mo = new MutationObserver((records) => {
      // 仅当 tbody 数据行被「重建」（innerHTML 替换产生新 TR 节点）时强制重排：
      // 重排自身的 td 移动（removedNodes 含同一节点 / 非 TR 节点）不会再次触发 force，
      // 因此不存在「重排 → MO → 再重排」的死循环。
      let rebuilt = false;
      records.forEach(m => {
        [...m.addedNodes].forEach(n => {
          if (n.nodeType === 1 && (n.tagName === 'TR' || n.querySelector('tr'))) {
            if (![...m.removedNodes].includes(n)) rebuilt = true;
          }
        });
      });
      // 渲染函数已显式对齐（justAligned 标记）：消费标记跳过，避免重复重排导致乱序
      if (rebuilt) {
        if (tbody.dataset.justAligned) { delete tbody.dataset.justAligned; }
        else applyCols(tbl, id, skipCols, true);
      }
      if (multiDef) tzApplyMulti(tbl, id, multiDef);
    });
    mo.observe(tbody, { childList: true, subtree: true });
  }
  refreshFilterIcons(tbl);
  if (multiDef) tzApplyMulti(tbl, id, multiDef);
}
function sortTbody(tbl, ci, dir) {
  const tbody = tbl.querySelector('tbody'); if (!tbody || dir === '') return;
  const rows = [...tbody.rows];
  rows.sort((a, b) => {
    const va = a.children[ci] ? a.children[ci].textContent.trim() : '';
    const vb = b.children[ci] ? b.children[ci].textContent.trim() : '';
    const na = parseFloat(va.replace(/[^\d.-]/g, '')), nb = parseFloat(vb.replace(/[^\d.-]/g, ''));
    const isNum = !isNaN(na) && !isNaN(nb) && /\d/.test(va);
    const c = isNum ? (na - nb) : String(va).localeCompare(String(vb), 'zh');
    return dir === 'desc' ? -c : c;
  });
  rows.forEach(r => tbody.appendChild(r));
}
/* ===== Excel 式列头筛选：条件存取 / 匹配 / 唯一值 / 单列筛选菜单 ===== */
function loadColConds(tbl) {
  try { return JSON.parse(tbl.dataset.tzFilter || '{}') || {}; } catch (e) { return {}; }
}
function saveColConds(tbl, conds) {
  tbl.dataset.tzFilter = JSON.stringify(conds);
}
function condActive(c) {
  return !!(c && ((c.kw && String(c.kw).trim()) || (Array.isArray(c.vals) && c.vals.length)));
}
/* 行某列原始值是否满足条件（关键字包含 + 勾选值） */
function colCondMatch(raw, c) {
  if (!condActive(c)) return true;
  const v = String(raw ?? '').trim();
  if (c.kw && String(c.kw).trim() && !v.toLowerCase().includes(String(c.kw).trim().toLowerCase())) return false;
  if (Array.isArray(c.vals) && c.vals.length && !c.vals.includes(v)) return false;
  return true;
}
/* 表头筛选图标高亮刷新（按列名判断，表头重排后跟随列移动） */
function refreshFilterIcons(tbl) {
  const conds = loadColConds(tbl);
  [...tbl.querySelectorAll('thead th')].forEach(th => {
    const ic = th.querySelector('.th-filter');
    if (ic) {
      const label = th.textContent.replace(/[▾▲▼⚙\s]/g, '').trim();
      ic.classList.toggle('on', condActive(conds[label]));
    }
  });
}
/* 表头列标识（名称）→ 当前列号：表头被全局列配置重排后，筛选/排序一律按列名定位，不再依赖列号 */
function colIndexByLabel(tbl, label) {
  const thead = tbl.querySelector('thead tr'); if (!thead) return -1;
  return [...thead.children].findIndex(th => th.textContent.replace(/[▾▲▼⚙\s]/g, '').trim() === label);
}
/* 筛选条件键规范化：旧版本按「列号」存储的键在表头重排后语义已失效，一律清除（列名键不受重排影响） */
function normalizeConds(tbl) {
  const conds = loadColConds(tbl);
  let changed = false;
  Object.keys(conds).forEach(k => { if (/^\d+$/.test(k)) { delete conds[k]; changed = true; } });
  if (changed) saveColConds(tbl, conds);
  return conds;
}
/* 分页表格按列名筛选（列名 → 当前列号 → _cols 字段），表头重排后依然取对列 */
function filterRowsByConds(rows, tbl, conds, condKeys) {
  return rows.filter(x => condKeys.every(k => {
    if (/^\d+$/.test(k)) return true;              // 旧列号键忽略
    const ci = colIndexByLabel(tbl, k);            // 列名 → 当前表头位置
    const f = ci >= 0 ? (tbl._cols || [])[ci] : null;  // 该位置字段（_cols 已随表头重排 resync）
    return f && colCondMatch(x[f], conds[k]);
  }));
}
/* 该列可选值（分页表格从全量数组+列映射取；全量表格从 DOM 行取） */
function colUniqueValues(tbl, ci) {
  const set = new Set();
  if (Array.isArray(tbl._data) && tbl._data.length && typeof tbl._data[0] === 'object' && tbl._cols && tbl._cols[ci]) {
    tbl._data.forEach(x => { const v = String(x[tbl._cols[ci]] ?? '').trim(); if (v) set.add(v); });
  } else {
    const tbody = tbl.querySelector('tbody');
    if (tbody) [...tbody.rows].forEach(r => { const td = r.children[ci]; if (td) { const v = td.textContent.trim(); if (v) set.add(v); } });
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh'));
}
/* 应用筛选：分页表格全量重渲染；全量表格 DOM 过滤 */
function applyColFilter(tbl) {
  if (tbl._renderPage) { tbl._renderPage(); return; }
  filterTbodyConds(tbl);
}
/* Excel 式单列筛选菜单（关键字 + 值勾选）；条件按「列名」存储，表头重排后条件跟随列移动 */
function colFilter(tbl, id, ci) {
  const thead = tbl.querySelector('thead tr'); if (!thead) return;
  const label = (thead.children[ci] ? thead.children[ci].textContent.replace(/[▾▲▼⚙\s]/g, '').trim() : '') || ('第' + (ci + 1) + '列');
  normalizeConds(tbl);                 // 清除旧「列号」键（表头重排后已失效）
  const conds = loadColConds(tbl);
  const cur = conds[label] || { kw: '', vals: [] };
  const allVals = colUniqueValues(tbl, ci);
  const curVals = Array.isArray(cur.vals) ? cur.vals : [];
  openModal('按「' + esc(label) + '」筛选（对全部数据生效）', `
    <div class="form-field" style="margin-bottom:8px"><input id="cfKw" placeholder="输入包含的关键字过滤值列表…" value="${esc(cur.kw || '')}"></div>
    <div style="max-height:300px;overflow:auto;border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:6px 10px">
      <label style="display:block;padding:4px 0;border-bottom:1px dashed #eef1f4;font-weight:600"><input type="checkbox" id="cfAll" ${allVals.length && curVals.length === allVals.length ? 'checked' : ''}> 全选（${allVals.length} 个值）</label>
      ${allVals.length ? allVals.map(v => `<label class="cf-item" style="display:block;padding:4px 0;border-bottom:1px dashed #f0f2f5"><input type="checkbox" data-v="${esc(v)}" value="${esc(v)}" ${curVals.includes(v) ? 'checked' : ''}> <span>${esc(v)}</span></label>`).join('') : '<div class="small" style="padding:6px 0">暂无可选值（可在上方输入关键字筛选）</div>'}
    </div>`,
    '<button class="btn" data-a="clear">清除</button><button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">确定</button>', null, true);
  const setAll = ck => document.querySelectorAll('#modalBody .cf-item input[data-v]').forEach(cb => { cb.checked = ck; });
  $('#cfAll').onchange = () => setAll($('#cfAll').checked);
  $('#cfKw').oninput = () => {
    const kw = $('#cfKw').value.trim().toLowerCase();
    document.querySelectorAll('#modalBody .cf-item').forEach(l => {
      l.style.display = (!kw || l.textContent.toLowerCase().includes(kw)) ? '' : 'none';
    });
  };
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=clear]').onclick = () => {
    delete conds[label];
    saveColConds(tbl, conds);
    applyColFilter(tbl); refreshFilterIcons(tbl); closeModal(); toast('已清除筛选');
  };
  $('#modalFoot').querySelector('[data-a=ok]').onclick = () => {
    const kw = $('#cfKw').value.trim();
    const vals = [...document.querySelectorAll('#modalBody .cf-item input[data-v]:checked')].map(cb => cb.value);
    if (!kw && !vals.length) delete conds[label];
    else conds[label] = { kw, vals };
    saveColConds(tbl, conds);
    applyColFilter(tbl); refreshFilterIcons(tbl); closeModal();
    toast(kw || vals.length ? '筛选已应用' : '已清除筛选');
  };
}
/* 全量表格：按列名条件隐藏行（列名 → 当前列号，表头重排后依然取对列） */
function filterTbodyConds(tbl) {
  const tbody = tbl.querySelector('tbody'); if (!tbody) return;
  const conds = loadColConds(tbl);
  const keys = Object.keys(conds).filter(k => !/^\d+$/.test(k) && condActive(conds[k]));
  [...tbody.rows].forEach(r => {
    if (!keys.length) { r.style.display = ''; return; }
    const ok = keys.every(k => {
      const ci = colIndexByLabel(tbl, k);
      const td = ci >= 0 ? r.children[ci] : null;
      return td && colCondMatch(td.textContent, conds[k]);
    });
    r.style.display = ok ? '' : 'none';
  });
}
function cmpVal(a, b) {
  const sa = String(a ?? ''), sb = String(b ?? '');
  const na = parseFloat(sa.replace(/[^\d.-]/g, '')), nb = parseFloat(sb.replace(/[^\d.-]/g, ''));
  if (!isNaN(na) && !isNaN(nb) && /\d/.test(sa)) return na - nb;
  return sa.localeCompare(sb, 'zh');
}
function sortRowsBy(rows, field, dir) {
  const d = dir === 'desc' ? -1 : 1;
  return rows.slice().sort((a, b) => d * cmpVal(a[field], b[field]));
}
/* 读取表格表头的排序状态（列索引 + 方向） */
function tblSortState(tbl) {
  const ths = tbl.querySelectorAll('thead th');
  for (let ci = 0; ci < ths.length; ci++) {
    if (ths[ci].dataset.dir) return { ci, dir: ths[ci].dataset.dir };
  }
  return { ci: -1, dir: '' };
}
/* 保存表格增强状态（列排序 + 列筛选），页面重建后恢复——修改/删除后排序与筛选条件不动 */
function snapEnh(scopeSel) {
  const tbl = document.querySelector(scopeSel + ' table');
  if (!tbl) return null;
  return { sort: tblSortState(tbl), conds: loadColConds(tbl) };
}
function restoreEnh(scopeSel, st) {
  if (!st) return;
  requestAnimationFrame(() => {
    const tbl = document.querySelector(scopeSel + ' table');
    if (!tbl) return;
    if (st.sort && st.sort.ci >= 0 && st.sort.dir) {
      const th = tbl.querySelectorAll('thead th')[st.sort.ci];
      if (th && !th.dataset.dir) {
        th.dataset.dir = st.sort.dir;
        const s = document.createElement('span');
        s.className = 'th-sort';
        s.textContent = st.sort.dir === 'asc' ? ' ▲' : ' ▼';
        th.appendChild(s);
        if (!tbl._renderPage) sortTbody(tbl, st.sort.ci, st.sort.dir);
      }
    }
    if (st.conds && Object.keys(st.conds).length) tbl.dataset.tzFilter = JSON.stringify(st.conds);
    if (tbl._renderPage) { tbl._renderPage(); refreshFilterIcons(tbl); return; }
    filterTbodyConds(tbl);
    refreshFilterIcons(tbl);
  });
}
/* 统一分页器已并入表格分页模块（paginateTable），旧 renderPager/tz-pager 已移除 */
/* 全局列配置键：所有用户共享同一份（admin 保存后全员同步），不再按账号隔离 */
function colKey(id) { return 'tz_cols_' + id; }
/* 全局列配置（列顺序/列显隐）：后端为权威源，admin 可写，所有用户只读同步 */
let TZ_COLS_GLOBAL = null;
const TZ_COLS_CACHE_KEY = 'tz_cols_global_v1';
async function loadGlobalCols() {
  try {
    const d = await api('/col-settings');
    if (d.ok && d.settings) {
      TZ_COLS_GLOBAL = d.settings || {};
      try { localStorage.setItem(TZ_COLS_CACHE_KEY, JSON.stringify(TZ_COLS_GLOBAL)); } catch (e) {}
      migrateLocalCols();
    }
  } catch (e) {
    // 后端不可用时用本地缓存兜底
    if (!TZ_COLS_GLOBAL) {
      try { TZ_COLS_GLOBAL = JSON.parse(localStorage.getItem(TZ_COLS_CACHE_KEY) || '{}'); } catch (e2) { TZ_COLS_GLOBAL = {}; }
    }
  }
}
function getColCfg(id) {
  if (TZ_COLS_GLOBAL) {
    // 统一键为 colKey(id)（带 tz_cols_ 前缀）；兼容历史裸键（printers_pBody 等）
    if (TZ_COLS_GLOBAL[colKey(id)]) return TZ_COLS_GLOBAL[colKey(id)];
    if (TZ_COLS_GLOBAL[id]) return TZ_COLS_GLOBAL[id];
  }
  return {};
}
async function saveGlobalCol(id, cfg) {
  // 本地先生效，再同步后端（所有用户刷新/进模块即同步）
  if (!TZ_COLS_GLOBAL) TZ_COLS_GLOBAL = {};
  TZ_COLS_GLOBAL[id] = cfg;
  try { localStorage.setItem(TZ_COLS_CACHE_KEY, JSON.stringify(TZ_COLS_GLOBAL)); } catch (e) {}
  await api('/col-settings', 'PUT', { id, value: cfg });
}
async function delGlobalCol(id) {
  // 本地先删除（立即恢复默认），后端删除异步兜底
  if (TZ_COLS_GLOBAL) delete TZ_COLS_GLOBAL[id];
  try { localStorage.setItem(TZ_COLS_CACHE_KEY, JSON.stringify(TZ_COLS_GLOBAL)); } catch (e) {}
  try { await api('/col-settings/' + encodeURIComponent(id), 'DELETE'); } catch (e) {}
}
/* 兼容迁移：admin 首次登录把本机旧账号列配置（tz_cols_<账号>_<id>）提升为全局，之后以全局为准 */
function migrateLocalCols() {
  if (!curUser || curUser.role !== 'admin' || !TZ_COLS_GLOBAL) return;
  const prefix = 'tz_cols_' + curUser.username + '_';
  Object.keys(localStorage).forEach(k => {
    if (k.indexOf(prefix) !== 0) return;
    const cid = k.slice(prefix.length);
    const gk = colKey(cid);   // 全局键统一带 tz_cols_ 前缀
    if (!(gk in TZ_COLS_GLOBAL) && !(cid in TZ_COLS_GLOBAL)) {
      try {
        const v = JSON.parse(localStorage.getItem(k) || '{}');
        if (v && typeof v === 'object') {
          TZ_COLS_GLOBAL[gk] = v;
          api('/col-settings', 'PUT', { id: gk, value: v }).catch(() => {});
        }
      } catch (e) {}
    }
    try { localStorage.removeItem(k); } catch (e) {}
  });
}
/* 登录后从后端拉取当前账号的个性化设置（含旧列配置，供 admin 迁移为全局） */
async function syncUserSettings() {
  try {
    const d = await api('/user-settings');
    if (d.ok && d.settings) {
      Object.keys(d.settings).forEach(k => {
        if (k.indexOf('tz_cols_') === 0) {
          try { localStorage.setItem(k, JSON.stringify(d.settings[k])); } catch (e) {}
        }
      });
    }
  } catch (e) { /* 离线/后端不可用时继续用本地缓存 */ }
}
/* 列位置排序：按 cfg.order（列标题顺序）重排表头与数据行，固定列（多选/操作）保持原位 */
function applyColOrder(tbl, cfg, skipCols, force) {
  const thead = tbl.querySelector('thead tr'); if (!thead) return;
  const ths = [...thead.children];
  const colCount = ths.length; if (!colCount) return;
  const lastCol = colCount - 1;
  const firstFix = skipCols.includes(0) ? [ths[0]] : [];
  const lastFix = skipCols.includes(lastCol) ? [ths[lastCol]] : [];
  const movable = ths.filter((th, ci) => !skipCols.includes(ci));
  const byLabel = {};
  movable.forEach(th => { byLabel[th.textContent.replace(/[▾▲▼⚙\s]/g, '').trim()] = th; });
  const ordered = [];
  (cfg.order || []).forEach(label => { if (byLabel[label]) { ordered.push(byLabel[label]); delete byLabel[label]; } });
  // 新出现/未配置的列追加到末尾
  Object.keys(byLabel).forEach(k => ordered.push(byLabel[k]));
  const target = firstFix.concat(ordered, lastFix);
  if (target.length !== ths.length) return;
  const same = target.every((th, i) => ths[i] === th);
  if (same && !force) return;
  // force（tbody 重建后数据行回模板顺序）：即使表头已是目标顺序也要重排数据行；
  // 循环控制由 enhanceTable 的 MutationObserver「reordered 标记消费」方案负责，此处不做 DOM 对齐判断
  const tbody = tbl.querySelector('tbody');
  target.forEach(th => thead.appendChild(th));
  resyncCols(tbl);   // 表头重排后同步字段映射：_cols[ci] 恒等于当前表头第 ci 列的字段
  if (tbody) [...tbody.rows].forEach(r => {
    // 数据行按渲染模板列序（tplOrder）生成；用 label 在 tplOrder 中的位置定位 td，
    // 避免「表头已重排而 ths.indexOf 索引错位」导致数据行乱序
    const tds = [...r.children];
    const tplLabels = (tbl.dataset.tplOrder || '').split('|').filter(Boolean);
    if (tplLabels.length === tds.length) {
      target.forEach(th => {
        const label = th.textContent.replace(/[▾▲▼⚙\s]/g, '').trim();
        const src = tds[tplLabels.indexOf(label)];
        if (src) r.appendChild(src);
      });
    } else {
      // 兜底：无 tplOrder 时按当前表头索引（旧行为）
      target.forEach(th => { const src = tds[ths.indexOf(th)]; if (src) r.appendChild(src); });
    }
  });
}
function resyncCols(tbl) {
  // 表头列序被全局配置重排后，把 tbl._cols（模板列→字段映射）按「当前表头位置→模板位置→字段」重建，
  // 使 _cols[ci] 恒等于表头第 ci 列的字段；列头筛选/分页筛选据此取值不再错列。
  if (!tbl._cols || !tbl.dataset.tplOrder) return;
  const thead = tbl.querySelector('thead tr'); if (!thead) return;
  const tplLabels = tbl.dataset.tplOrder.split('|');
  tbl._cols = [...thead.children].map(th => {
    const label = th.textContent.replace(/[▾▲▼⚙\s]/g, '').trim();
    const ti = tplLabels.indexOf(label);
    return ti >= 0 ? tbl._cols[ti] : null;
  });
}
/* 渲染后强制对齐：数据行按模板列序（tplOrder）生成；若表头已被全局列配置重排，
   按表头当前列序把每行 td 重排，保证表头与数据行永不错位（已对齐则跳过，无循环）。 */
function alignTbody(tbl) {
  const tbody = tbl.querySelector('tbody');
  if (!tbody || !tbody.rows.length) return;
  const thead = tbl.querySelector('thead tr'); if (!thead) return;
  const tplLabels = (tbl.dataset.tplOrder || '').split('|');
  if (!tplLabels.length) return;
  const want = [...thead.children].map(th => th.textContent.replace(/[▾▲▼⚙\s]/g, '').trim());
  const first = tbody.rows[0];
  const tds = [...first.children];
  if (tds.length !== want.length) return;
  // 数据行按模板列序渲染：若表头顺序 == 模板顺序则已对齐
  if (want.every((l, i) => l === tplLabels[i])) return;
  [...tbody.rows].forEach(r => {
    const cells = [...r.children];
    want.forEach(th => {
      const label = th.textContent.replace(/[▾▲▼⚙\s]/g, '').trim();
      const src = cells[tplLabels.indexOf(label)];
      if (src) r.appendChild(src);
    });
  });
}
function applyCols(tbl, id, skipCols, force) {
  let cfg = getColCfg(id);
  if (!cfg || typeof cfg !== 'object') cfg = {};
  const thead = tbl.querySelector('thead tr'); if (!thead) return;
  const ths = [...thead.children];
  const colCount = ths.length; if (!colCount) return;
  const lastCol = colCount - 1;
  // 解析显隐：新格式 hide={label:bool}（false=隐藏）；兼容旧格式 {ci:false} 与数组 [ci,...]
  const hideLabels = new Set();
  const hideCis = new Set();
  const rawHide = cfg.hide;
  if (rawHide && typeof rawHide === 'object' && !Array.isArray(rawHide)) {
    Object.keys(rawHide).forEach(k => {
      if (rawHide[k] === false) { if (!isNaN(+k)) hideCis.add(+k); else hideLabels.add(k); }
    });
  } else if (Array.isArray(rawHide)) {
    rawHide.forEach(ci => hideCis.add(+ci));
  }
  Object.keys(cfg).forEach(k => { if (!isNaN(+k) && cfg[k] === false) hideCis.add(+k); });
  // 列位置排序（数据行按 ths 快照重排，避免索引错位）
  applyColOrder(tbl, cfg, skipCols, force);
  // 显隐按当前列位置应用：新格式用列标题匹配，旧格式用列号匹配（列号在排序后即为新位置）
  [...thead.children].forEach((th, ci) => {
    if (skipCols.includes(ci)) return;
    const label = th.textContent.replace(/[▾▲▼⚙\s]/g, '').trim();
    const hidden = hideCis.has(ci) || (label && hideLabels.has(label));
    th.style.display = hidden ? 'none' : '';
    [...tbl.querySelectorAll('tbody tr')].forEach(r => { if (r.children[ci]) r.children[ci].style.display = hidden ? 'none' : ''; });
  });
}
function colSettings(tbl, id, skipCols) {
  const thead = tbl.querySelector('thead tr');
  const labels = [...thead.children].map((th, ci) => ({ ci, label: th.textContent.replace(/[▾▲▼⚙\s]/g, '').trim() })).filter(l => l.label && !skipCols.includes(l.ci));
  const cfg = getColCfg(id);
  // 兼容新旧格式：hide 可能是数组 [ci,...]（旧旧版）、对象 {ci:bool}（旧版）或 {label:bool}（当前版）
  let hide = [];
  const rawHide = cfg.hide;
  if (Array.isArray(rawHide)) hide = rawHide.slice();
  else if (rawHide && typeof rawHide === 'object') {
    Object.keys(rawHide).forEach(k => { if (rawHide[k] === false) hide.push(isNaN(+k) ? k : +k); });
  }
  Object.keys(cfg).forEach(k => { if (!isNaN(+k) && cfg[k] === false) hide.push(+k); });
  // 列顺序：优先保存的 order，否则按当前 DOM 顺序
  const order = (Array.isArray(cfg.order) && cfg.order.length) ? cfg.order : labels.map(l => l.label);
  const items = order.map(label => {
    const l = labels.find(x => x.label === label);
    if (!l) return '';
    const hidden = hide.includes(l.ci) || hide.includes(l.label);
    return '<div class="col-sort-item" draggable="true" data-label="' + esc(label) + '">' +
      '<span class="col-grip" title="拖动排序">☰</span>' +
      '<button type="button" class="btn btn-xs col-mv" data-dir="up" title="上移">↑</button>' +
      '<button type="button" class="btn btn-xs col-mv" data-dir="down" title="下移">↓</button>' +
      '<label style="flex:1;padding:2px 4px;cursor:pointer"><input type="checkbox" data-ci="' + l.ci + '" data-label="' + esc(label) + '" ' + (!hidden ? 'checked' : '') + '> ' + esc(label) + '</label></div>';
  }).join('');
  // 列配置全局共享（admin 为准）：仅 admin 可保存/恢复默认，普通用户只读
  const isAdmin = canEdit('*');
  const footBtns = (isAdmin ? '<button class="btn" data-a="reset">恢复默认</button>' : '') +
    '<button class="btn" data-a="cancel">取消</button>' +
    (isAdmin ? '<button class="btn btn-primary" data-a="ok">保存</button>' : '');
  openModal('列设置（拖动 ☰ 或点 ↑↓ 调整顺序，勾选控制显示' + (isAdmin ? '' : '；列配置由管理员统一管理，当前为只读）') + '）', '<div id="colSortList" style="max-height:340px;overflow:auto">' + items + '</div>', footBtns);
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  if (isAdmin) $('#modalFoot').querySelector('[data-a=reset]').onclick = () => {
    closeModal();
    delGlobalCol(colKey(id));  // 本地先删，后端异步删除
    // 清配置后需重渲染表格才能回到模板原始列顺序（applyCols 空配置只会保持当前 DOM 顺序）
    if (tbl._renderPage) tbl._renderPage(); else applyCols(tbl, id, skipCols);
    toast('已恢复默认列设置（已同步所有用户）');
  };
  // 上移/下移按钮（与拖拽并存，精确定位）
  const list = $('#colSortList');
  if (!isAdmin) {
    // 普通用户只读：禁用手柄/按钮/勾选，仅可查看当前配置
    list.querySelectorAll('.col-mv, .col-grip, [data-ci]').forEach(el => { el.disabled = true; el.style.opacity = 0.5; });
  }
  let dragEl = null;
  function getAfter(y) {
    const els = [...list.querySelectorAll('.col-sort-item:not(.dragging)')];
    return els.reduce((closest, el) => {
      const box = el.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, el };
      return closest;
    }, { offset: -Infinity, el: null }).el;
  }
  list.addEventListener('click', e => {
    const btn = e.target.closest('.col-mv');
    if (!btn) return;
    const item = btn.closest('.col-sort-item');
    if (!item) return;
    if (btn.dataset.dir === 'up' && item.previousElementSibling) list.insertBefore(item, item.previousElementSibling);
    else if (btn.dataset.dir === 'down' && item.nextElementSibling) list.insertBefore(item.nextElementSibling, item);
  });
  list.addEventListener('dragstart', e => {
    dragEl = e.target.closest('.col-sort-item'); if (!dragEl) return;
    dragEl.classList.add('dragging');
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragEl.dataset.label || ''); } catch (err) {}
  });
  list.addEventListener('dragend', () => { if (dragEl) dragEl.classList.remove('dragging'); dragEl = null; });
  list.addEventListener('dragover', e => {
    e.preventDefault();
    const cur = dragEl; if (!cur) return;
    const after = getAfter(e.clientY);
    if (!after) list.appendChild(cur); else if (after !== cur) list.insertBefore(cur, after);
  });
  list.addEventListener('drop', e => e.preventDefault());
  $('#modalFoot').querySelector('[data-a=ok]').onclick = () => {
    // 显隐按列标题保存（label→bool），列顺序调整后仍能正确对应；旧 {ci:bool} 数据自动兼容
    const hideMap = {};
    document.querySelectorAll('#modalBody [data-ci]').forEach(cb => {
      const item = cb.closest('.col-sort-item');
      if (item && item.dataset.label) hideMap[item.dataset.label] = cb.checked;
    });
    const orderArr = [...list.querySelectorAll('.col-sort-item')].map(d => d.dataset.label).filter(Boolean);
    const payload = { order: orderArr, hide: hideMap };
    // 保存为全局配置：本地立即生效 + 后端同步（所有用户刷新/进模块即与 admin 一致）
    saveGlobalCol(colKey(id), payload).then(() => {
      closeModal(); applyCols(tbl, id, skipCols); toast('列设置已保存，已同步到所有用户');
    }).catch(() => { toast('保存失败，请重试', 'err'); });
  };
}
/* 渲染完成后：自动增强表格 + 按权限隐藏写操作 */
function autoEnhance(root) {
  (root || document).querySelectorAll('tbody[id]').forEach(tb => {
    if (tb.closest('table[data-tz]')) return;      // TZTable 引擎表格由自身管理，跳过旧增强
    const mod = TBL_MODULES[tb.id];
    if (!mod) return;
    enhanceTable(tb.closest('table'), { id: mod + '_' + tb.id, multiKey: tb.id });
  });
}
/* 全局守护：模块内 tab 切换 / 数据刷新 / 重绘渲染出的新表格自动增强（dataset.enh 幂等防重复）。
   观察 #content 任何 DOM 变化（含 tbody 重建），防抖后统一 autoEnhance，覆盖所有渲染时序。 */
function watchTableEnhance() {
  const root = $('#content');
  if (!root || root._enhWatcher) return;
  root._enhWatcher = new MutationObserver(() => {
    clearTimeout(root._enhTimer);
    root._enhTimer = setTimeout(() => autoEnhance(root), 60);
  });
  root._enhWatcher.observe(root, { childList: true, subtree: true });
}
/* ============ 表格分页：每页默认10条，可自定义每页条数 ============
   通过观察器在表格重绘（搜索/筛选/排序/删除）后自动重新分页；
   分页条只创建一次，更新仅改文本/属性，避免触发观察器造成循环 */
const PAGE_SIZE_KEY = 'tz_page_size_v1';
function getPageSize() {
  const v = parseInt(localStorage.getItem(PAGE_SIZE_KEY), 10);
  return [10, 20, 50, 100].indexOf(v) >= 0 ? v : 10;
}
function paginateTable(tbl, targetPage) {
  if (tbl.hasAttribute('data-tz')) return;   // TZTable 自带分页器
  const tbody = tbl.querySelector('tbody');
  if (!tbody) return;
  const rows = [].slice.call(tbody.querySelectorAll(':scope > tr'));
  if (!rows.length) return;
  const size = getPageSize();
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  let cur = tbl._pgCur = Math.min(Math.max(1, targetPage || tbl._pgCur || 1), pages);
  tbl._pgPages = pages;
  rows.forEach((r, i) => {
    r.style.display = (i >= (cur - 1) * size && i < cur * size) ? '' : 'none';
  });
  let bar = tbl._pager;
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'table-pager';
    const host = tbl.closest('.table-wrap') || tbl.parentNode;
    const hp = host && host.parentNode;
    if (hp) hp.insertBefore(bar, host.nextSibling);
    else tbl.parentNode.insertBefore(bar, tbl.nextSibling);
    bar.innerHTML = '<button type="button" class="pager-btn" data-a="prev">上一页</button>' +
      '<span class="pager-info">第<b class="pg-cur">1</b>/<b class="pg-total">1</b>页 共<b class="pg-count">0</b>条</span>' +
      '<input type="number" class="pager-jump" min="1" value="1" title="输入页码，回车或点跳转">' +
      '<button type="button" class="pager-btn" data-a="go">跳转</button>' +
      '<button type="button" class="pager-btn" data-a="next">下一页</button>' +
      '<select class="pager-size" title="每页条数">' +
      '<option value="10">10条/页</option><option value="20">20条/页</option>' +
      '<option value="50">50条/页</option><option value="100">100条/页</option></select>';
    bar.querySelector('.pager-size').value = String(size);
    const go = () => {
      const v = parseInt(bar.querySelector('.pager-jump').value, 10);
      if (!isNaN(v) && v >= 1 && v <= (tbl._pgPages || 1)) paginateTable(tbl, v);
      else bar.querySelector('.pager-jump').value = String(tbl._pgCur || 1);
    };
    bar.querySelector('.pager-jump').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    bar.querySelector('[data-a="go"]').addEventListener('click', go);
    bar.querySelector('[data-a="prev"]').addEventListener('click', () => paginateTable(tbl, (tbl._pgCur || 1) - 1));
    bar.querySelector('[data-a="next"]').addEventListener('click', () => paginateTable(tbl, (tbl._pgCur || 1) + 1));
    bar.querySelector('.pager-size').addEventListener('change', function () {
      localStorage.setItem(PAGE_SIZE_KEY, this.value);
      paginateTable(tbl, 1);
    });
    tbl._pager = bar;
  }
  const cuEl = bar.querySelector('.pg-cur'), toEl = bar.querySelector('.pg-total'), coEl = bar.querySelector('.pg-count');
  if (cuEl.textContent !== String(cur)) cuEl.textContent = String(cur);
  if (toEl.textContent !== String(pages)) toEl.textContent = String(pages);
  if (coEl.textContent !== String(total)) coEl.textContent = String(total);
  const jp = bar.querySelector('.pager-jump');
  if (jp && jp.value !== String(cur)) jp.value = String(cur);
  const sel = bar.querySelector('.pager-size');
  if (sel.value !== String(size)) sel.value = String(size);
  const pv = bar.querySelector('[data-a="prev"]'), nx = bar.querySelector('[data-a="next"]');
  pv.classList.toggle('disabled', cur <= 1);
  nx.classList.toggle('disabled', cur >= pages);
  bar.style.display = total <= size ? 'none' : '';
}
function initTablePaging() {
  const root = $('#content');
  if (!root || root._pgWatcher) return;
  root._pgWatcher = new MutationObserver((muts) => {
    if (root._pgBusy) return;
    root._pgBusy = true;
    try {
      const rebuilt = new Set();
      muts.forEach(m => {
        if (m.type === 'childList' && m.target && m.target.tagName === 'TBODY') {
          // 整表重渲染（筛选/搜索/排序）回到第 1 页；单行局部删除保留当前页
          if (m.removedNodes.length > 1 || m.addedNodes.length > 1) {
            const t = m.target.closest('table');
            if (t) rebuilt.add(t);
          }
        }
      });
      root.querySelectorAll('table:not([data-tz])').forEach(t => {
        if (rebuilt.has(t)) t._pgCur = 1;   // 数据重新渲染后回到第 1 页
        paginateTable(t);
      });
    } finally { root._pgBusy = false; }
  });
  root._pgWatcher.observe(root, { childList: true, subtree: true });
  root.querySelectorAll('table:not([data-tz])').forEach(paginateTable);
}
/* 统计卡片渲染与点击绑定：items=[{ico,cls,n,t}]，actions 为每张卡片的点击回调 */
function statCardsHTML(items) {
  return '<div class="stat-grid" style="margin-bottom:14px">' + items.map(it =>
    '<div class="stat-card"><div class="stat-ico ' + (it.cls || 'blue') + '">' + (it.ico || '📊') + '</div>' +
    '<div><div class="stat-num">' + it.n + '</div><div class="stat-label">' + it.t + '</div></div></div>'
  ).join('') + '</div>';
}
function bindStatClick(el, actions) {
  if (!el) return;
  const cards = el.querySelectorAll('.stat-card');
  cards.forEach((cd, i) => { if (actions && actions[i]) cd.onclick = actions[i]; });
}
function applyBtnPerms(root) {
  (root || document).querySelectorAll('[data-perm]').forEach(el => {
    const parts = (el.dataset.perm || '').split(':');
    const ok = parts[1] === 'edit' ? canEdit(parts[0]) : canView(parts[0]);
    if (!ok) el.style.display = 'none';
  });
  (root || document).querySelectorAll('tbody[id]').forEach(tb => {
    if (tb.closest('table[data-tz]')) return;      // TZTable 引擎自身处理权限
    const mod = TBL_MODULES[tb.id];
    if (!mod) return;
    if (!canEdit(mod)) {
      tb.querySelectorAll('.ops').forEach(o => { o.style.display = 'none'; });
      const tbl = tb.closest('table');
      if (tbl) {
        const ths = tbl.querySelectorAll('thead th');
        if (ths.length) ths[ths.length - 1].style.display = 'none';
      }
    }
  });
}

/* ============ 导航 ============ */
const PAGE_TITLES = {
  dashboard: '工作台', printers: '打印机管理', consumables: '耗材管理',
  stats: '费用统计', spares: '备品备件', computers: '办公电脑', pcopt: '电脑优化', pcReplace: '配件更换记录', ai: 'AI 工作台', system: '系统管理'
};
let currentPage = 'dashboard';

function navigate(page) {
  currentPage = page;
  renderNav();
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  $('#pageTitle').textContent = PAGE_TITLES[page];
  $('#sidebar').classList.remove('open');
  const renderers = { dashboard: renderDashboard, printers: renderPrinters, consumables: renderConsumables, stats: renderStats, spares: renderSpares, computers: renderComputers, pcopt: renderOpt, pcReplace: renderPcReplace, notes: renderNotes, ai: renderAi, system: renderSystem };
  Promise.resolve((renderers[page] || renderDashboard)()).then(async () => {
    await loadGlobalCols();   // 每次进入模块拉取最新全局列配置（admin 修改后全员同步）
    autoEnhance($('#content'));
    applyBtnPerms($('#content'));
    initTabSortable();
  });
  watchTableEnhance();
  initTablePaging();
}
$('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

/* ============ 工作台 ============ */
async function renderDashboard() {
  const c = $('#content');
  c.innerHTML = '<div class="empty">加载中…</div>';
  const r = await api('/dashboard');
  const d = r.data;
  const badge = (n) => n > 0 ? '<span class="badge badge-red">' + n + '</span>' : '<span class="badge badge-green">0</span>';
  c.innerHTML = statCardsHTML([
    { ico: '🖨️', cls: 'blue', n: d.printers_total, t: '打印机总数（在用 ' + d.printers_active + '）' },
    { ico: '💻', cls: 'green', n: d.computers_total, t: '办公电脑台账' },
    { ico: '🧴', cls: 'warn', n: d.issues_month.c, t: '本月发放 ' + d.issues_month.q + ' 件' },
    { ico: '🔧', cls: 'red', n: d.repairs_pending, t: '待处理报修' },
  ]) + `
    <div class="dash-grid" style="margin-top:14px">
      <div class="col">
        <div class="card">
          <div class="card-title">⚠️ 库存预警 <span class="spacer"></span>${badge(d.low_consumables.length + d.low_stocks.length)}</div>
          <div class="panel-body" id="dashWarn"></div>
        </div>
        <div class="card">
          <div class="card-title">📤 最近耗材发放</div>
          <div class="panel-body" id="dashIssues"></div>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-title">📦 最近备件出入库</div>
          <div class="panel-body" id="dashFlows"></div>
        </div>
      </div>
    </div>`;

  bindStatClick(c.querySelector('.stat-grid'), [
    () => navigate('printers'),
    () => navigate('computers'),
    () => navigate('consumables'),
    () => navigate('printers'),
  ]);
  const warnEl = $('#dashWarn');
  if (d.low_consumables.length === 0 && d.low_stocks.length === 0) {
    warnEl.innerHTML = '<div class="empty">暂无库存预警 🎉</div>';
  } else {
    let html = '';
    d.low_consumables.forEach(x => {
      html += `<div class="detail-row"><div class="detail-main"><div class="detail-title">${esc(x.model)} · ${esc(x.category)}</div><div class="detail-sub">物料编码 ${esc(x.material_code)}</div></div><span class="detail-tag badge badge-red">合计库存 ${x.stock}</span></div>`;
    });
    d.low_stocks.forEach(x => {
      html += `<div class="detail-row"><div class="detail-main"><div class="detail-title">${esc(x.brand)} ${esc(x.name)} ${esc(x.spec)}</div><div class="detail-sub">${esc(x.warehouse)} / ${esc(x.location)}</div></div><span class="detail-tag badge badge-red">库存 ${x.qty}</span></div>`;
    });
    warnEl.innerHTML = html;
  }

  const issueEl = $('#dashIssues');
  issueEl.innerHTML = d.recent_issues.length ? d.recent_issues.map(x => `
    <div class="detail-row"><div class="detail-main"><div class="detail-title">${esc(x.department)} · ${esc(x.consumable)} ×${x.qty}</div>
    <div class="detail-sub">${esc(x.oa_no)} · ${esc(x.location)} · 领用人 ${esc(x.applicant)}</div></div>
    <span class="detail-tag badge badge-gray">${esc(x.issue_time)}</span></div>`).join('') : '<div class="empty">暂无发放记录</div>';

  const flowEl = $('#dashFlows');
  flowEl.innerHTML = d.recent_flows.length ? d.recent_flows.map(x => `
    <div class="detail-row"><div class="detail-main"><div class="detail-title">${x.type === 'in' ? '入库' : '出库'} · ${esc(x.name)}${x.spec ? ' ' + esc(x.spec) : ''} ×${x.qty}</div>
    <div class="detail-sub">${esc(x.warehouse)} / ${esc(x.location)}${x.applicant ? ' · ' + esc(x.applicant) : ''}</div></div>
    <span class="detail-tag badge ${x.type === 'in' ? 'badge-green' : 'badge-warn'}">${esc(x.record_time)}</span></div>`).join('') : '<div class="empty">暂无出入库记录</div>';
}

/* ============ 打印机管理 ============ */
let printerList = [];
async function renderPrinters() {
  // 保留当前筛选状态：刷新/保存后不重置搜索与筛选
  const prevSearch = $('#pSearch') ? $('#pSearch').value : '';
  const prevDept = $('#pDept') ? $('#pDept').value : '';
  const prevStatus = $('#pStatus') ? $('#pStatus').value : '';
  const c = $('#content');
  c.innerHTML = `
    <div class="stat-grid" id="pStats" style="margin-bottom:14px"></div>
    <div class="toolbar">
      <input type="text" id="pSearch" placeholder="搜索编号/部门/型号/位置/IP" class="grow">
      <select id="pDept"><option value="">全部部门</option></select>
      <select id="pStatus"><option value="">全部状态</option><option>在用</option><option>停用</option><option>报废</option></select>
      <button class="btn" id="pTemplate">📋 下载模板</button>
      <button class="btn" id="pImport" data-perm="printers:edit">📥 模板导入</button>
      <input type="file" id="pFile" accept=".xlsx,.xls" style="display:none">
      <button class="btn" id="pExport">📤 导出Excel</button>
      <button class="btn btn-primary" id="pAdd" data-perm="printers:edit">＋ 新增打印机</button>
    </div>
    <div class="tz-batch" id="pBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="pBody"></tbody></table></div>
      <div class="empty" id="pEmpty" style="display:none">未找到匹配的打印机</div>
      <div class="tz-pager" id="pPager"></div>
    </div>`;
  const list = await api('/printers');
  printerList = list.data;
  const depts = [...new Set(printerList.map(p => p.department).filter(Boolean))].sort();
  $('#pDept').innerHTML = '<option value="">全部部门</option>' + depts.map(d => `<option>${esc(d)}</option>`).join('');
  // 恢复筛选状态
  if ($('#pSearch')) $('#pSearch').value = prevSearch;
  if ($('#pDept')) $('#pDept').value = prevDept;
  if ($('#pStatus')) $('#pStatus').value = prevStatus;
  // 统计卡片（可点击）
  const pIn = printerList.filter(p => p.status === '在用').length;
  const pStop = printerList.filter(p => p.status === '停用').length;
  const pScrap = printerList.filter(p => p.status === '报废').length;
  $('#pStats').innerHTML = statCardsHTML([
    { ico: '🖨️', cls: 'blue', n: printerList.length, t: '打印机总数' },
    { ico: '✅', cls: 'green', n: pIn, t: '在用' },
    { ico: '⏸️', cls: 'warn', n: pStop, t: '停用' },
    { ico: '🚫', cls: 'red', n: pScrap, t: '报废' },
  ]);
  const mkFilter = () => { const dept = $('#pDept').value, status = $('#pStatus').value; return row => (!dept || row.department === dept) && (!status || row.status === status); };
  const csvSafe = v => { const s = String(v ?? ''); return /^[=+\-@]/.test(s) ? "'" + s : s; };
  const tz = new TZTable($('#pBody').closest('.table-wrap'), {
    id: 'printers_pBody',
    perm: 'printers',
    columns: [
      { key: 'printer_no', label: '编号' },
      { key: 'department', label: '使用部门' },
      { key: 'contact', label: '联系人及电话' },
      { key: 'location', label: '部署位置' },
      { key: 'model', label: '型号' },
      { key: 'ip', label: 'IP地址' },
      { key: 'status', label: '状态', render: v => statusBadge(v) },
    ],
    ops: [
      { label: '详情', act: 'view' },
      { label: '编辑', cls: 'btn-primary', act: 'edit' },
      { label: '删除', cls: 'btn-danger', act: 'del' },
    ],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['printer_no', 'department', 'model', 'location', 'ip'],
    searchBox: '#pSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#pBatch', pagerEl: '#pPager', emptyEl: '#pEmpty',
    data: printerList,
    extraFilter: mkFilter(),
    onRowOps: (act, p) => {
      if (act === 'view') printerDetail(p);
      if (act === 'edit') printerForm(p);
      if (act === 'del') confirmModal('删除打印机', `确定删除打印机「${p.printer_no} · ${p.model}」吗？`, async () => {
        try {
          await api('/printers/' + p.id, 'DELETE'); toast('已删除');
          printerList = printerList.filter(x => x.id !== p.id);   // 局部移除，保留筛选/滚动位置
          tz.setData(printerList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 台打印机吗？`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/printers/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        printerList = printerList.filter(x => !rows.some(r => r.id === x.id));
        tz.selected.clear();
        tz.setData(printerList);
        toast('已删除 ' + ok + ' 台');
      });
      if (act === 'export') {
        const heads = ['编号', '使用部门', '联系人及电话', '部署位置', '型号', 'IP地址', '状态'];
        const lines = rows.map(r => [r.printer_no, r.department, r.contact, r.location, r.model, r.ip, r.status].map(v => '"' + csvSafe(v).replace(/"/g, '""') + '"').join(','));
        const blob = new Blob(['\ufeff' + heads.join(',') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '打印机_选中导出.csv'; a.click(); URL.revokeObjectURL(a.href);
      }
    },
  });
  $('#pDept').onchange = () => { tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); };
  $('#pStatus').onchange = () => { tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); };
  const pReset = () => { $('#pSearch').value = ''; $('#pDept').value = ''; $('#pStatus').value = ''; tz.search = ''; };
  bindStatClick($('#pStats'), [
    () => { pReset(); tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); },
    () => { pReset(); $('#pStatus').value = '在用'; tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); },
    () => { pReset(); $('#pStatus').value = '停用'; tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); },
    () => { pReset(); $('#pStatus').value = '报废'; tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); },
  ]);
  $('#pTemplate').onclick = () => { window.location.href = '/api/printers/template'; };
  $('#pImport').onclick = () => $('#pFile').click();
  $('#pFile').onchange = async () => {
    const f = $('#pFile').files[0]; if (!f) { $('#pFile').value = ''; return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/printers/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        toast(d.error || '导入失败', 'err');
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
      } else { toast('模板导入成功 ' + d.added + ' 台'); renderPrinters(); }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    $('#pFile').value = '';
  };
  $('#pExport').onclick = () => downloadExport(expUrl('/api/printers/export', { q: $('#pSearch').value.trim(), department: $('#pDept').value, status: $('#pStatus').value }));
  $('#pAdd').onclick = () => printerForm(null);
}

function statusBadge(s) {
  if (s === '在用') return '<span class="badge badge-green">在用</span>';
  if (s === '停用') return '<span class="badge badge-gray">停用</span>';
  if (s === '报废') return '<span class="badge badge-red">报废</span>';
  return '<span class="badge badge-gray">' + esc(s || '') + '</span>';
}

function printerForm(p) {
  const d = p || {};
  openModal(p ? '编辑打印机' : '新增打印机', `
    <div class="form-grid">
      <div class="form-field"><label>打印机编号</label><input id="f_no" value="${esc(d.printer_no || '')}" placeholder="如 303"></div>
      <div class="form-field"><label>使用部门</label><input id="f_dept" value="${esc(d.department || '')}" list="deptList"><datalist id="deptList"></datalist></div>
      <div class="form-field full"><label>联系人及电话</label><input id="f_contact" value="${esc(d.contact || '')}" placeholder="姓名+电话"></div>
      <div class="form-field full"><label>部署具体位置</label><input id="f_loc" value="${esc(d.location || '')}"></div>
      <div class="form-field"><label>打印机型号</label><input id="f_model" value="${esc(d.model || '')}" list="modelList"><datalist id="modelList"></datalist></div>
      <div class="form-field"><label>打印机IP地址</label><input id="f_ip" value="${esc(d.ip || '')}"></div>
      <div class="form-field"><label>状态</label><select id="f_status"><option ${(d.status || '在用') === '在用' ? 'selected' : ''}>在用</option><option ${d.status === '停用' ? 'selected' : ''}>停用</option><option ${d.status === '报废' ? 'selected' : ''}>报废</option></select></div>
      <div class="form-field full"><label>备注</label><input id="f_remark" value="${esc(d.remark || '')}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>');
  const mkList = (id, vals) => {
    const el = $(id); el.innerHTML = vals.map(v => '<option value="' + esc(v) + '">').join('');
  };
  mkList('#deptList', [...new Set(printerList.map(x => x.department).filter(Boolean))]);
  mkList('#modelList', [...new Set(printerList.map(x => x.model).filter(Boolean))]);
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = {
      printer_no: $('#f_no').value.trim(), department: $('#f_dept').value.trim(),
      contact: $('#f_contact').value.trim(), location: $('#f_loc').value.trim(),
      model: $('#f_model').value.trim(), ip: $('#f_ip').value.trim(),
      status: $('#f_status').value, remark: $('#f_remark').value.trim()
    };
    try {
      if (p) { await api('/printers/' + p.id, 'PUT', body); toast('已保存'); }
      else { await api('/printers', 'POST', body); toast('已新增'); }
      closeModal(); renderPrinters();
    } catch (e) { toast(e.message, 'err'); }
  };
}

async function printerDetail(p) {
  const r = await api('/printers/' + p.id);
  const pr = r.data, repairs = r.repairs || [];
  openModal(`打印机详情 #${esc(pr.printer_no)}`, `
    <div class="form-grid" style="margin-bottom:12px">
      <div class="form-field"><label>使用部门</label><div>${esc(pr.department || '—')}</div></div>
      <div class="form-field"><label>联系人</label><div>${esc(pr.contact || '—')}</div></div>
      <div class="form-field"><label>型号</label><div>${esc(pr.model || '—')}</div></div>
      <div class="form-field"><label>IP</label><div>${esc(pr.ip || '—')}</div></div>
      <div class="form-field full"><label>位置</label><div>${esc(pr.location || '—')}</div></div>
      <div class="form-field full"><label>备注</label><div>${esc(pr.remark || '—')}</div></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <b style="font-size:14px">🔧 报修 / 维修记录（${repairs.length}）</b>
      <button class="btn btn-primary btn-sm" id="addRepair">＋ 新增报修</button>
    </div>
    <div id="repairList">${repairs.length ? repairs.map(x => `
      <div class="detail-row">
        <div class="detail-main"><div class="detail-title">${esc(x.fault_desc)} · ${repairStatusBadge(x.status)}</div>
        <div class="detail-sub">报修 ${esc(x.report_time)}${x.reported_by ? ' · ' + esc(x.reported_by) : ''}${x.repair_result ? ' · 处理：' + esc(x.repair_result) : ''}${x.repair_time ? ' · 完成 ' + esc(x.repair_time) : ''}${x.repair_company ? ' · ' + esc(x.repair_company) : ''}${x.cost ? ' · 费用 ' + x.cost : ''}</div></div>
        <div class="ops"><button class="btn btn-sm" data-a="edit" data-id="${x.id}">编辑</button>
        <button class="btn btn-sm btn-danger" data-a="del" data-id="${x.id}">删</button></div>
      </div>`).join('') : '<div class="empty" style="padding:16px">暂无报修记录</div>'}</div>`,
    '<button class="btn btn-primary" data-a="close">关闭</button>', null, true);
  $('#modalFoot').querySelector('[data-a=close]').onclick = closeModal;
  $('#addRepair').onclick = () => repairForm(pr.id, null, () => printerDetail(p));
  $('#repairList').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = +b.dataset.id, rep = repairs.find(x => x.id === id);
    if (b.dataset.a === 'edit') repairForm(pr.id, rep, () => printerDetail(p));
    if (b.dataset.a === 'del') confirmModal('删除报修记录', '确定删除该报修记录吗？', async () => {
      try { await api('/repairs/' + id, 'DELETE'); toast('已删除'); printerDetail(p); } catch (e) { toast(e.message, 'err'); }
    });
  };
}
function repairStatusBadge(s) {
  const m = { '待维修': 'badge-red', '维修中': 'badge-warn', '已完成': 'badge-green' };
  return '<span class="badge ' + (m[s] || 'badge-gray') + '">' + esc(s || '') + '</span>';
}

function repairForm(printerId, rep, refresh) {
  const d = rep || {};
  openModal(rep ? '编辑报修/维修' : '新增报修', `
    <div class="form-grid">
      <div class="form-field full"><label>故障描述 *</label><textarea id="r_fault">${esc(d.fault_desc || '')}</textarea></div>
      <div class="form-field"><label>报修时间</label><input type="date" id="r_time" value="${esc(d.report_time || today())}"></div>
      <div class="form-field"><label>报修人</label><input id="r_by" value="${esc(d.reported_by || '')}"></div>
      <div class="form-field"><label>状态</label><select id="r_status"><option ${(d.status || '待维修') === '待维修' ? 'selected' : ''}>待维修</option><option ${d.status === '维修中' ? 'selected' : ''}>维修中</option><option ${d.status === '已完成' ? 'selected' : ''}>已完成</option></select></div>
      <div class="form-field full"><label>维修结果 / 处理情况</label><textarea id="r_result">${esc(d.repair_result || '')}</textarea></div>
      <div class="form-field"><label>维修完成时间</label><input type="date" id="r_done" value="${esc(d.repair_time || '')}"></div>
      <div class="form-field"><label>维修单位/人员</label><input id="r_comp" value="${esc(d.repair_company || '')}"></div>
      <div class="form-field"><label>费用（元）</label><input id="r_cost" type="number" value="${esc(d.cost || '')}"></div>
      <div class="form-field full"><label>备注</label><input id="r_remark" value="${esc(d.remark || '')}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = {
      printer_id: printerId,
      fault_desc: $('#r_fault').value.trim(), report_time: $('#r_time').value,
      reported_by: $('#r_by').value.trim(), status: $('#r_status').value,
      repair_result: $('#r_result').value.trim(), repair_time: $('#r_done').value,
      repair_company: $('#r_comp').value.trim(), cost: $('#r_cost').value || 0,
      remark: $('#r_remark').value.trim()
    };
    if (!body.fault_desc) { toast('请填写故障描述', 'err'); return; }
    try {
      if (rep) await api('/repairs/' + rep.id, 'PUT', body); else await api('/repairs', 'POST', body);
      toast('已保存'); closeModal(); refresh();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 耗材管理 ============ */
let conList = [];
// 把 /api/consumables 返回的展平行（种类×区域）聚合成主表行：每种类一行，stocks=区域×库位明细
function makeConKindRows(rows) {
  const byId = new Map();
  for (const v of rows || []) {
    const k = String(v.id);
    if (!byId.has(k)) {
      byId.set(k, { id: v.id, model: v.model, category: v.category, material_code: v.material_code,
                    price: v.price, low_threshold: v.low_threshold, remark: v.remark, printer_models: v.printer_models,
                    total_stock: 0, stock: 0, stocks: [] });
    }
    const g = byId.get(k);
    g.stocks.push({ stock_id: v.stock_id, region: v.region || '办公楼', storage: v.storage || '',
                    stock: v.region_stock ?? v.stock ?? 0 });
    g.total_stock += v.region_stock ?? v.stock ?? 0;
    g.stock = g.total_stock;
  }
  return [...byId.values()];
}
async function renderConsumables(tab) {
  const cur = tab || 'stock';
  const c = $('#content');
  c.innerHTML = `
    <div class="tabs" data-mod="consumables">
      <div class="tab ${cur === 'stock' ? 'active' : ''}" data-t="stock">耗材库存</div>
      <div class="tab ${cur === 'issue' ? 'active' : ''}" data-t="issue">发放登记</div>
      <div class="tab ${cur === 'stockin' ? 'active' : ''}" data-t="stockin">入库记录</div>
      <div class="tab ${cur === 'records' ? 'active' : ''}" data-t="records">发放记录</div>
      <div class="tab ${cur === 'maintain' ? 'active' : ''}" data-t="maintain">维护记录</div>
      <div class="tab ${cur === 'adjust' ? 'active' : ''}" data-t="adjust">调整记录</div>
    </div>
    <div id="conPage"></div>`;
  $$('.tab', c).forEach(t => t.onclick = () => renderConsumables(t.dataset.t));
  if (cur === 'stock') renderConStock();
  if (cur === 'issue') renderConIssue();
  if (cur === 'stockin') renderConStockIn();
  if (cur === 'records') renderConRecords();
  if (cur === 'maintain') renderConMaintain();
  if (cur === 'adjust') renderConAdjust();
}

async function renderConStock() {
  // 保留当前筛选状态：刷新/保存后不重置搜索词
  const prevSearch = $('#csSearch') ? $('#csSearch').value : '';
  const page = $('#conPage');
  page.innerHTML = `
    <div class="stat-grid" id="csSummary" style="margin-bottom:14px"></div>
    <div class="toolbar">
      <input type="text" id="csSearch" placeholder="搜索型号/品类/物料编码" class="grow">
      <div id="csRegionSeg" style="display:flex;gap:6px;align-items:center">
        <button class="btn csr active" data-r="">全部</button>
        <button class="btn csr" data-r="中控">中控</button>
        <button class="btn csr" data-r="办公楼">办公楼</button>
      </div>
      <button class="btn" id="csTemplate">📋 下载导入模板</button>
      <button class="btn" id="csImport" data-perm="consumables:edit">📥 批量导入</button>
      <button class="btn btn-primary" id="csBatch" data-perm="consumables:edit">＋ 批量发放</button>
      <button class="btn btn-primary" id="csAdd" data-perm="consumables:edit">＋ 新增耗材</button>
    </div>
    <div class="tz-batch" id="csBatchBar"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="csBody"></tbody></table></div>
      <div class="empty" id="csEmpty" style="display:none">暂无耗材，可点「📥 批量导入」从模板一键导入</div>
      <div class="tz-pager" id="csPager"></div>
    </div>`;
  const [r, dash] = await Promise.all([api('/consumables'), api('/dashboard')]);
  conList = r.data;
  // 主表按种类聚合一行（stocks 为该种类 区域×库位 明细），统计按种类计
  const kindRows = makeConKindRows(conList);
  // isLow(byTotal)：低库存判定用种类合计库存；必须先声明后使用（const 有暂时性死区）
  const isLow = (x, byTotal) => {
    const s = byTotal ? (x.total_stock ?? x.stock) : (x.region_stock ?? x.stock);
    return (x.low_threshold > 0 && s <= x.low_threshold) || s <= 0;
  };
  const totalValue = kindRows.reduce((sum, g) => sum + (g.total_stock || 0) * (g.price || 0), 0);
  const lowCount = kindRows.filter(g => isLow(g, true)).length;
  $('#csSummary').innerHTML = statCardsHTML([
    { ico: '🧴', cls: 'blue', n: kindRows.length, t: '耗材种类' },
    { ico: '💰', cls: 'green', n: '¥' + totalValue.toLocaleString(), t: '库存金额（按单价估算）' },
    { ico: '⚠️', cls: 'red', n: lowCount, t: '低库存/需补货' },
    { ico: '📤', cls: 'warn', n: dash.data.issues_month.q, t: '本月已发放（件）' },
  ]);
  if ($('#csSearch')) $('#csSearch').value = prevSearch;
  let lowOnly = false, regionOnly = '';
  const tz = new TZTable($('#csBody').closest('.table-wrap'), {
    id: 'consumables_csBody',
    perm: 'consumables',
    columns: [
      { key: 'model', label: '打印机型号' },
      { key: 'category', label: '耗材品类' },
      { key: 'material_code', label: '物料编码' },
      { key: 'price', label: '单价(元)', render: v => v ? Number(v).toFixed(2) : '—' },
      { key: 'total_stock', label: '合计库存', render: (v, r) => `<b ${isLow(r, true) ? 'style="color:var(--danger)"' : ''}>${v ?? 0}</b>` },
      { key: 'low_threshold', label: '预警阈值', render: v => v || '—' },
      { key: 'status', label: '状态', render: (v, r) => isLow(r, true) ? '<span class="badge badge-red">需补货</span>' : '<span class="badge badge-green">正常</span>' },
    ],
    ops: [
      { label: '▶ 区域库存', act: 'stocks', cls: 'btn-outline' },
      { label: '调整', act: 'adj' },
      { label: '编辑', cls: 'btn-primary', act: 'edit' },
      { label: '删除', cls: 'btn-danger', act: 'del' },
    ],
    batchOps: [{ label: '批量删除', cls: 'btn-danger', act: 'del' }],
    search: ['model', 'category', 'material_code'],
    searchBox: '#csSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#csBatchBar', pagerEl: '#csPager', emptyEl: '#csEmpty',
    data: kindRows,
    extraFilter: row => (!lowOnly || isLow(row, true)) && (!regionOnly || (row.stocks || []).some(s => (s.region || '办公楼') === regionOnly)),
    onRowOps: (act, x) => {
      if (act === 'stocks') openConRegion(x);
      if (act === 'adj') conAdjust(x);
      if (act === 'edit') conForm(x);
      if (act === 'del') confirmModal('删除耗材', `确定删除「${x.model} · ${x.category}」吗？`, async () => {
        try {
          await api('/consumables/' + x.id, 'DELETE'); toast('已删除');
          conList = conList.filter(v => v.id !== x.id);   // 局部移除，保留搜索/滚动位置
          tz.setData(makeConKindRows(conList));
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条耗材吗？`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/consumables/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        conList = conList.filter(x => !rows.some(r => r.id === x.id));
        tz.selected.clear(); tz.setData(makeConKindRows(conList)); toast('已删除 ' + ok + ' 条');
      });
    },
  });
  bindStatClick($('#csSummary'), [
    () => { lowOnly = false; $('#csSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { kindRows.sort((a, b) => ((b.total_stock ?? b.stock) || 0) * (b.price || 0) - ((a.total_stock ?? a.stock) || 0) * (a.price || 0)); lowOnly = false; tz.setData(kindRows); },
    () => { lowOnly = true; tz.page = 1; tz.render(); },
    () => renderConsumables('records'),
  ]);
  $('#csAdd').onclick = () => conForm(null);
  $('#csBatch').onclick = () => openBatchIssue();
  $('#csTemplate').onclick = () => { window.location.href = '/api/consumables/template'; };
  $('#csImport').onclick = () => openImportModal();
  // 区域筛选：中控 / 办公楼 / 全部
  const segBtns = document.querySelectorAll('#csRegionSeg .csr');
  const mark = (b) => { segBtns.forEach(x => { x.style.borderColor = ''; x.style.color = ''; }); b.style.borderColor = 'var(--primary,#2563eb)'; b.style.color = 'var(--primary,#2563eb)'; };
  mark(segBtns[0]);
  segBtns.forEach(b => b.onclick = () => { mark(b); regionOnly = b.dataset.r; tz.page = 1; tz.render(); });
}

/* 批量导入耗材 */
function openImportModal() {
  openModal('批量导入耗材', `
    <p style="font-size:13px;color:#6b7280;margin-bottom:12px">
      ① 点击「下载导入模板」：模板已预填全部现有耗材种类与区域库存行（<b>种类唯一不重复</b>），只需在「当前库存」列填写实际数量；<br>
      ② 区域（中控/办公楼）与库位可在模板中修改；同一型号如需在中控、办公楼各备货，<b>复制该行改「区域」即可，系统自动按 种类+区域 分库存、不新增种类</b>；留空的行不改变该区域库存；<br>
      ③ 导入结果会显示 新增 / 更新 / 失败 数量，失败行列出原因可修改后重传。
    </p>
    <div class="form-field"><label>选择 Excel 文件（.xlsx / .xls）</label><input type="file" id="imFile" accept=".xlsx,.xls"></div>
    <div id="imResult" style="font-size:13px;line-height:1.8"></div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">开始导入</button>');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const f = $('#imFile').files[0];
    if (!f) { toast('请选择文件', 'err'); return; }
    const fd = new FormData();
    fd.append('file', f);
    const btn = $('#modalFoot').querySelector('[data-a=ok]');
    btn.disabled = true; btn.textContent = '导入中…';
    try {
      const res = await fetch('/api/consumables/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) { toast(d.error || '导入失败', 'err'); $('#imResult').innerHTML = '<span style="color:var(--danger)">' + esc(d.error || '') + '</span>'; }
      else {
        toast('导入完成：新增 ' + d.added + '，更新 ' + d.updated + '，失败 ' + d.failed);
        let html = '<div style="color:var(--ok,#16a34a)">✅ 新增 <b>' + d.added + '</b> 条，更新 <b>' + d.updated + '</b> 条，失败 <b>' + d.failed + '</b> 条</div>';
        if (d.errors && d.errors.length) html += '<div style="color:var(--danger);margin-top:6px">' + d.errors.map(e => esc(e)).join('<br>') + '</div>';
        $('#imResult').innerHTML = html;
        if (d.failed === 0) { setTimeout(() => { closeModal(); renderConStock(); }, 600); }
      }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    btn.disabled = false; btn.textContent = '开始导入';
  };
}

/* 耗材维护记录 */
let maintainList = [];
function mkMaintFilter() {
  const q = ($('#mrSearch') ? $('#mrSearch').value : '').trim(), start = $('#mrStart') ? $('#mrStart').value : '', end = $('#mrEnd') ? $('#mrEnd').value : '';
  return row => {
    if (q && ![row.model, row.category, row.content, row.maintainer, row.remark].some(v => String(v || '').includes(q))) return false;
    if (start && row.maintain_time < start) return false;
    if (end && row.maintain_time > end) return false;
    return true;
  };
}
async function loadMaintainPage() {
  try { const r = await api('/maintenance'); maintainList = r.data; } catch (e) { maintainList = []; }
  if (window.__maintTz) { window.__maintTz.setData(maintainList); window.__maintTz.extraFilter = mkMaintFilter(); window.__maintTz.render(); }
}
async function renderConMaintain() {
  const page = $('#conPage');
  page.innerHTML = `
    <div class="card">
      <div class="card-title">🛠️ 耗材维护登记（加粉 / 清洁 / 更换 / 保养 / 维修等）</div>
      <div class="form-grid">
        <div class="form-field"><label>维护时间 *</label><input type="date" id="m_time" value="${today()}"></div>
        <div class="form-field"><label>打印机型号 *（联动打印机管理）</label>
          <input id="m_model" list="mPrinterList" placeholder="选择或输入型号"><datalist id="mPrinterList"></datalist></div>
        <div class="form-field"><label>耗材品类</label><input id="m_cat" list="mCatList"><datalist id="mCatList"></datalist></div>
        <div class="form-field"><label>维护内容 *</label>
          <select id="m_content"><option>加粉</option><option>清洁</option><option>更换硒鼓</option><option>更换墨盒</option><option>保养</option><option>维修</option><option>其他</option></select></div>
        <div class="form-field"><label>费用（元）</label><input id="m_cost" type="number" step="0.01" value="0"></div>
        <div class="form-field"><label>维护人</label><input id="m_maintainer"></div>
        <div class="form-field full"><label>备注</label><input id="m_remark" placeholder="如 加粉量、更换原因等"></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-primary" id="mSubmit">提交维护记录</button>
      </div>
    </div>
    <div class="toolbar" style="margin-top:14px">
      <input type="text" id="mrSearch" placeholder="搜索型号/耗材/内容/维护人" class="grow">
      <input type="date" id="mrStart" title="开始日期">
      <span style="color:#9ca3af">至</span>
      <input type="date" id="mrEnd" title="结束日期">
      <button class="btn" id="mrFilter">查询</button>
    </div>
    <div class="tz-batch" id="mrBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="mrBody"></tbody></table></div>
      <div class="empty" id="mrEmpty" style="display:none">暂无维护记录</div>
      <div class="tz-pager" id="mrPager"></div>
    </div>`;
  const [conR, prs] = await Promise.all([api('/consumables'), loadPrinters()]);
  const models = [...new Set(prs.map(p => p.model).filter(Boolean))];
  $('#mPrinterList').innerHTML = models.map(v => '<option value="' + esc(v) + '">').join('');
  const cats = [...new Set(conR.data.map(x => x.category).filter(Boolean))];
  $('#mCatList').innerHTML = cats.map(v => '<option value="' + esc(v) + '">').join('');
  $('#mSubmit').onclick = async () => {
    const model = $('#m_model').value.trim(), content = $('#m_content').value;
    if (!model) { toast('请填写打印机型号', 'err'); return; }
    if (!content) { toast('请选择维护内容', 'err'); return; }
    try {
      await api('/maintenance', 'POST', {
        maintain_time: $('#m_time').value, model, category: $('#m_cat').value.trim(),
        content, cost: $('#m_cost').value || 0, maintainer: $('#m_maintainer').value.trim(),
        remark: $('#m_remark').value.trim()
      });
      toast('维护记录已登记'); $('#m_model').value = ''; $('#m_cat').value = ''; $('#m_cost').value = '0'; $('#m_remark').value = '';
      loadMaintainPage();
    } catch (e) { toast(e.message, 'err'); }
  };
  const tz = new TZTable($('#mrBody').closest('.table-wrap'), {
    id: 'consumables_mrBody',
    perm: 'consumables',
    columns: [
      { key: 'maintain_time', label: '维护时间' },
      { key: 'model', label: '打印机型号' },
      { key: 'category', label: '耗材品类', render: v => esc(v || '—') },
      { key: 'content', label: '维护内容', render: v => `<span class="badge badge-blue">${esc(v)}</span>` },
      { key: 'cost', label: '费用(元)', render: v => v ? '¥' + Number(v).toFixed(2) : '—' },
      { key: 'maintainer', label: '维护人', render: v => esc(v || '—') },
      { key: 'remark', label: '备注', render: v => `<span style="max-width:180px">${esc(v || '—')}</span>` },
    ],
    ops: [{ label: '删除', cls: 'btn-danger', act: 'del' }],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: [],
    searchBox: '',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#mrBatch', pagerEl: '#mrPager', emptyEl: '#mrEmpty',
    data: maintainList,
    extraFilter: mkMaintFilter(),
    onRowOps: (act, x) => {
      if (act === 'del') confirmModal('删除维护记录', '确定删除该维护记录吗？', async () => {
        try { await api('/maintenance/' + x.id, 'DELETE'); toast('已删除'); maintainList = maintainList.filter(v => v.id !== x.id); tz.setData(maintainList); } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条维护记录吗？`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/maintenance/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        maintainList = maintainList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(maintainList); toast('已删除 ' + ok + ' 条');
      });
      if (act === 'export') exportRowsCSV('耗材维护_选中导出.csv', ['维护时间', '打印机型号', '耗材品类', '维护内容', '费用(元)', '维护人', '备注'], rows, ['maintain_time', 'model', 'category', 'content', 'cost', 'maintainer', 'remark']);
    },
  });
  window.__maintTz = tz;
  const refilter = () => { tz.extraFilter = mkMaintFilter(); tz.page = 1; tz.render(); };
  $('#mrFilter').onclick = refilter;
  $('#mrSearch').oninput = refilter;
  $('#mrStart').onchange = refilter;
  $('#mrEnd').onchange = refilter;
  await loadMaintainPage();
}

function conForm(x) {
  const d = x || {};
  const isEdit = !!x;
  const storageSet = [...new Set(conList.map(v => (v.storage || '').trim()).filter(Boolean))];
  const regionFields = isEdit ? '' : `
      <div class="form-field"><label>区域 *</label><select id="c_region"><option value="办公楼" selected>办公楼</option><option value="中控">中控</option></select></div>
      <div class="form-field"><label>库位</label><input id="c_storage" value="" list="conStorageList" placeholder="下拉选择或输入，如 文件柜4-1"><datalist id="conStorageList">${storageSet.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div class="form-field"><label>初始库存（该区域）</label><input id="c_stock" type="number" value="0" placeholder="可在保存后用「调整」再入库"></div>`;
  const stockTip = isEdit ? '<p style="grid-column:1/-1;font-size:13px;color:#6b7280">库存按 区域 分记：请到列表中选中对应区域行点「调整」做入库/盘盈盘亏。</p>' : '';
  openModal(x ? '编辑耗材' : '新增耗材', `
    <div class="form-grid">
      ${regionFields}
      <div class="form-field"><label>打印机型号 *</label><input id="c_model" value="${esc(d.model || '')}" list="conModelList" placeholder="如 HP LaserJet 1020（发放时按此型号自动索引本耗材）"><datalist id="conModelList"></datalist></div>
      <div class="form-field"><label>耗材品类 *</label><input id="c_cat" value="${esc(d.category || '')}"></div>
      <div class="form-field"><label>物料编码</label><input id="c_code" value="${esc(d.material_code || '')}"></div>
      <div class="form-field"><label>低库存预警阈值</label><input id="c_th" type="number" value="${esc(d.low_threshold || 0)}" placeholder="0=不预警"></div>
      <div class="form-field"><label>单价（元）</label><input id="c_price" type="number" step="0.01" value="${esc(d.price ?? 0)}" placeholder="用于费用统计"></div>
      <div class="form-field full"><label>兼容打印机型号（选填）</label>
        <input id="c_pmodels" value="${esc(d.printer_models || '')}" list="conPModelList" placeholder="下拉追加选择，多个用逗号分隔（发放时这些型号也会自动索引本耗材）"><datalist id="conPModelList"></datalist></div>
      <div class="form-field full"><label>备注</label><input id="c_remark" value="${esc(d.remark || '')}"></div>
      ${stockTip}
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>');
  const models = [...new Set(conList.map(v => v.model).filter(Boolean))];
  $('#conModelList').innerHTML = models.map(v => '<option value="' + esc(v) + '">').join('');
  (async () => {
    try { const r = await api('/printers'); $('#conPModelList').innerHTML = [...new Set(r.data.map(p => p.model).filter(Boolean))].map(v => '<option value="' + esc(v) + '">').join(''); } catch (e) {}
  })();
  $('#c_pmodels').addEventListener('input', () => {
    const v = $('#c_pmodels').value.trim();
    if (!v || v.includes(',')) { $('#c_pmodels').setAttribute('data-prev', v); return; }
    const opts = $('#conPModelList').querySelectorAll('option');
    const hit = [...opts].some(o => o.value === v);
    if (hit && $('#c_pmodels').getAttribute('data-prev') !== v) {
      const prev = $('#c_pmodels').getAttribute('data-prev') || '';
      const parts = [prev, v].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
      $('#c_pmodels').value = parts.join('，');
    }
    $('#c_pmodels').setAttribute('data-prev', $('#c_pmodels').value);
  });
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = {
      model: $('#c_model').value.trim(), category: $('#c_cat').value.trim(),
      material_code: $('#c_code').value.trim(),
      low_threshold: $('#c_th').value || 0, remark: $('#c_remark').value.trim(), price: $('#c_price').value || 0,
      printer_models: $('#c_pmodels').value.trim()
    };
    if (!isEdit) {
      body.region = $('#c_region').value;
      body.storage = $('#c_storage').value.trim();
      body.stock = $('#c_stock').value || 0;
    }
    if (!body.model || !body.category) { toast('型号和品类必填', 'err'); return; }
    try {
      if (x) await api('/consumables/' + x.id, 'PUT', body); else await api('/consumables', 'POST', body);
      toast('已保存'); closeModal(); renderConStock();
    } catch (e) { toast(e.message, 'err'); }
  };
}

function conAdjust(x) {
  // x 可为聚合主行（含 stocks 明细）或旧展平行
  const stocks = (x.stocks && x.stocks.length) ? x.stocks : conList.filter(v => v.id === x.id);
  const regions = [...new Set(stocks.map(v => v.region || '办公楼'))];
  const defR = regions[0] || '办公楼';
  const curByR = r => { const s = stocks.find(v => (v.region || '办公楼') === r); return s ? (s.stock ?? 0) : 0; };
  const opts = ['中控', '办公楼'].map(r => `<option value="${r}" ${r === defR ? 'selected' : ''}>${r}${regions.includes(r) ? '（已有库存）' : '（新区域）'}</option>`).join('');
  openModal(`调整库存 · ${esc(x.model)} ${esc(x.category)}`, `
    <div class="form-grid">
      <div class="form-field"><label>区域</label><select id="ad_region">${opts}</select></div>
      <div class="form-field"><label>库位</label><input id="ad_storage" value="${esc((stocks.find(s => (s.region || '办公楼') === defR) || {}).storage || '')}" placeholder="如 文件柜4-1 / 中控柜1-2"></div>
      <div class="form-field full"><label>当前库存（该区域）</label><b style="font-size:16px" id="ad_cur">${curByR(defR)}</b></div>
      <div class="form-field"><label>调整类型</label>
        <select id="ad_type">
          <option value="手工调整">手工调整</option>
          <option value="入库">入库</option>
          <option value="出库">出库</option>
          <option value="盘盈">盘盈</option>
          <option value="盘亏">盘亏</option>
          <option value="报废">报废</option>
          <option value="纠错">纠错</option>
          <option value="期初">期初建账</option>
        </select></div>
      <div class="form-field"><label>调整数量（入库/盘盈填正数，出库/盘亏/报废填负数）</label><input id="ad_delta" type="number" placeholder="如 5 或 -2"></div>
      <div class="form-field full"><label>原因</label><input id="ad_reason" placeholder="如 新到货入库 / 盘点盘亏"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">确认调整</button>');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#ad_region').onchange = () => {
    $('#ad_cur').textContent = curByR($('#ad_region').value);
    const cur = stocks.find(s => (s.region || '办公楼') === $('#ad_region').value);
    $('#ad_storage').value = (cur || {}).storage || '';
  };
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const delta = parseFloat($('#ad_delta').value);
    if (!delta) { toast('请输入调整数量', 'err'); return; }
    try {
      const r = await api('/consumables/' + x.id + '/adjust', 'POST', {
        delta, type: $('#ad_type').value, reason: $('#ad_reason').value.trim(),
        region: $('#ad_region').value, storage: $('#ad_storage').value.trim()
      });
      toast('调整成功，' + r.region + '区域当前库存 ' + r.stock + '，合计 ' + r.total_stock);
      closeModal(); renderConStock();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* 展开某耗材种类的 区域×库位 库存明细，每行支持移库 */
function openConRegion(x) {
  const stocks = (x.stocks && x.stocks.length) ? x.stocks
    : conList.filter(v => v.id === x.id).map(v => ({ stock_id: v.stock_id, region: v.region || '办公楼', storage: v.storage || '', stock: v.region_stock ?? v.stock ?? 0 }));
  const rowsHtml = stocks.length ? stocks.map(s => `
      <tr>
        <td><span class="badge ${s.region === '中控' ? 'badge-blue' : 'badge-green'}">${esc(s.region)}</span></td>
        <td>${esc(s.storage || '—')}</td>
        <td><b>${s.stock}</b></td>
        <td><button class="btn mini" onclick="openConTransfer(${x.id},'${esc(s.region)}','${esc(s.storage)}',${s.stock},${s.stock_id})">↔ 移库</button></td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:#9ca3af">该耗材暂无区域库存，可在主列表点「调整」按区域入库</td></tr>';
  openModal(`区域库存 · ${esc(x.model)} ${esc(x.category)}（合计 ${x.total_stock ?? x.stock ?? 0}）`, `
    <p style="font-size:13px;color:#6b7280;margin-bottom:10px">点击「↔ 移库」把该区域库位的库存转移到另一区域/库位（如 办公楼→中控），系统自动生成移库流水。</p>
    <div class="table-wrap"><table>
      <thead><tr><th>区域</th><th>库位</th><th>库存</th><th>操作</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>`,
    '<button class="btn btn-primary" data-a="ok">关闭</button>');
  $('#modalFoot').querySelector('[data-a=ok]').onclick = closeModal;
}

/* 移库弹窗：源 区域+库位 → 目标 区域+库位 */
function openConTransfer(cid, fromRegion, fromStorage, fromStock, fromStockId) {
  const sameAsSrc = r => r === fromRegion && !fromStorage;
  const opts = ['中控', '办公楼'].map(r => `<option value="${r}">${r}</option>`).join('');
  openModal('移库 · ' + esc(cid ? '' : ''), `
    <div class="form-grid">
      <div class="form-field full"><label>源 区域/库位</label><b style="font-size:15px">${esc(fromRegion)} / ${esc(fromStorage || '(未设库位)')}　当前库存 ${fromStock}</b></div>
      <div class="form-field"><label>目标区域 *</label><select id="tf_region">${opts}</select></div>
      <div class="form-field"><label>目标库位 *</label><input id="tf_storage" placeholder="如 中控柜1-2 / 文件柜4-1"></div>
      <div class="form-field full"><label>转移数量 *（不超过当前库存 ${fromStock}）</label><input id="tf_qty" type="number" min="1" max="${fromStock}" placeholder="如 3"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">确认移库</button>');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const qty = parseInt($('#tf_qty').value, 10);
    const toRegion = $('#tf_region').value, toStorage = $('#tf_storage').value.trim();
    if (!qty || qty <= 0) { toast('请输入转移数量', 'err'); return; }
    if (qty > fromStock) { toast('转移数量不能超过当前库存 ' + fromStock, 'err'); return; }
    if (!toStorage) { toast('目标库位必填', 'err'); return; }
    if (toRegion === fromRegion && toStorage === fromStorage) { toast('目标与源相同，无需移库', 'err'); return; }
    try {
      const r = await api('/consumables/' + cid + '/transfer', 'POST', {
        from_stock_id: fromStockId, qty, to_region: toRegion, to_storage: toStorage
      });
      toast('移库成功：' + toRegion + '/' + toStorage + ' 当前库存 ' + r.to_stock + '，合计 ' + r.total_stock);
      closeModal(); renderConStock();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ====== 耗材调整记录查询 ====== */
async function renderConAdjust() {
  const page = $('#conPage');
  page.innerHTML = `
    <div class="card">
      <div class="card-title">📝 耗材调整记录（库存手工调整流水，含类型/数量/原因/操作人）</div>
      <div class="toolbar" style="flex-wrap:wrap;gap:8px">
        <input type="text" id="ajQ" placeholder="型号/品类关键词" class="grow">
        <select id="ajType">
          <option value="">全部类型</option>
          <option>手工调整</option><option>入库</option><option>出库</option>
          <option>盘盈</option><option>盘亏</option><option>报废</option><option>纠错</option><option>期初</option>
          <option>移库(转出)</option><option>移库(转入)</option>
        </select>
        <input type="date" id="ajStart" title="开始日期">
        <span class="small">至</span>
        <input type="date" id="ajEnd" title="结束日期">
        <input type="text" id="ajOp" placeholder="操作人" style="width:110px">
        <button class="btn btn-primary" id="ajSearch">🔍 查询</button>
        <button class="btn" id="ajReset">重置</button>
      </div>
      <div class="tz-batch" id="ajBatch"></div>
      <div class="table-wrap"><table>
        <thead></thead><tbody id="ajBody"></tbody></table></div>
      <div class="empty" id="ajEmpty" style="display:none">没有符合条件的调整记录</div>
      <div class="tz-pager" id="ajPager"></div>
    </div>`;
  let ajAll = [];
  const tz = new TZTable($('#ajBody').closest('.table-wrap'), {
    id: 'consumables_ajBody',
    perm: 'consumables',
    columns: [
      { key: 'adjust_time', label: '时间' },
      { key: 'model', label: '打印机型号' },
      { key: 'category', label: '耗材品类' },
      { key: 'region', label: '区域', render: v => v || '—' },
      { key: 'storage', label: '库位', render: v => v || '—' },
      { key: 'type', label: '类型' },
      { key: 'delta', label: '调整数量', render: v => `<span class="num" style="color:${v >= 0 ? 'var(--ok,#16a34a)' : 'var(--danger,#dc2626)'};font-weight:bold">${v > 0 ? '+' : ''}${v}</span>` },
      { key: 'before_stock', label: '调整前 → 调整后', render: (v, r) => `<span class="num">${v} → ${r.after_stock}</span>` },
      { key: 'reason', label: '原因', render: v => esc(v || '—') },
      { key: 'operator', label: '操作人' },
    ],
    ops: [{ label: '删除', cls: 'btn-danger', act: 'del' }],
    batchOps: [{ label: '批量删除', cls: 'btn-danger', act: 'del' }],
    multi: { key: 'id' },
    batchEl: '#ajBatch', pagerEl: '#ajPager', emptyEl: '#ajEmpty',
    data: ajAll,
    onRowOps: (act, x) => {
      if (act === 'del') confirmModal('删除调整记录', '确定删除这条调整记录吗？仅删除记录、不影响当前库存；如需修正库存请用「调整」反向调整。', async () => {
        try { await api('/consumables/adjusts/' + x.id, 'DELETE'); toast('已删除'); ajAll = ajAll.filter(v => v.id !== x.id); tz.setData(ajAll); } catch (err) { toast(err.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条调整记录吗？`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/consumables/adjusts/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        ajAll = ajAll.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(ajAll); toast('已删除 ' + ok + ' 条');
      });
    },
  });
  const load = async () => {
    const q = $('#ajQ').value.trim(), type = $('#ajType').value,
          start = $('#ajStart').value, end = $('#ajEnd').value, op = $('#ajOp').value.trim();
    const qs = new URLSearchParams({ q, type, start, end, operator: op, page: 1, size: 100000 });
    const r = await api('/consumables/adjusts?' + qs.toString());
    ajAll = r.data || [];
    tz.setData(ajAll);
  };
  $('#ajSearch').onclick = load;
  $('#ajReset').onclick = () => {
    $('#ajQ').value = ''; $('#ajType').value = ''; $('#ajStart').value = ''; $('#ajEnd').value = ''; $('#ajOp').value = '';
    load();
  };
  $('#ajQ').onkeydown = (e) => { if (e.key === 'Enter') load(); };
  load();
}

/* ====== 耗材入库记录（采购入库/补录，自动加库存） ====== */
async function renderConStockIn() {
  const page = $('#conPage');
  page.innerHTML = `
    <div class="card">
      <div class="card-title">📥 耗材入库记录（采购/补录入库，提交后自动增加库存）
        <span class="spacer"></span>
        <button class="btn" id="sinExport">⬇️ 导出Excel</button>
        <button class="btn" id="sinTemplate">📋 下载模板</button>
        <button class="btn" id="sinImport" data-perm="consumables:edit">📥 模板导入</button>
        <input type="file" id="sinFile" accept=".xlsx,.xls" style="display:none">
        <button class="btn btn-primary" id="sinAdd" data-perm="consumables:edit">＋ 登记入库</button>
      </div>
      <div class="toolbar" style="flex-wrap:wrap;gap:8px">
        <input type="text" id="sinQ" placeholder="型号/品类/备注关键词" class="grow">
        <input type="date" id="sinStart" title="开始日期">
        <span class="small">至</span>
        <input type="date" id="sinEnd" title="结束日期">
        <button class="btn btn-primary" id="sinSearch">🔍 查询</button>
        <button class="btn" id="sinReset">重置</button>
      </div>
      <div class="tz-batch" id="sinBatch"></div>
      <div class="table-wrap"><table>
        <thead></thead><tbody id="sinBody"></tbody></table></div>
      <div class="empty" id="sinEmpty" style="display:none">暂无入库记录，点「＋ 登记入库」登记采购/补录入库</div>
      <div class="tz-pager" id="sinPager"></div>
    </div>`;
  let sinAll = [];
  const tz = new TZTable($('#sinBody').closest('.table-wrap'), {
    id: 'consumables_sinBody',
    perm: 'consumables',
    columns: [
      { key: 'stock_in_time', label: '入库时间' },
      { key: 'region', label: '区域', render: v => v || '—' },
      { key: 'storage', label: '库位', render: v => v || '—' },
      { key: 'model', label: '打印机型号' },
      { key: 'category', label: '耗材品类' },
      { key: 'qty', label: '数量', render: v => `<span class="num"><b style="color:var(--ok,#16a34a)">+${v}</b></span>` },
      { key: 'price', label: '单价(元)', render: v => v ? Number(v).toFixed(2) : '—' },
      { key: 'amount', label: '金额(元)', render: v => v ? Number(v).toFixed(2) : '—' },
      { key: 'operator', label: '经办人', render: v => esc(v || '') },
      { key: 'note', label: '备注', render: v => esc(v || '—') },
    ],
    ops: [{ label: '删除', cls: 'btn-danger', act: 'del' }],
    batchOps: [{ label: '批量删除', cls: 'btn-danger', act: 'del' }],
    multi: { key: 'id' },
    batchEl: '#sinBatch', pagerEl: '#sinPager', emptyEl: '#sinEmpty',
    data: sinAll,
    onRowOps: (act, x) => {
      if (act === 'del') confirmModal('删除入库记录', '删除后会自动从库存扣减本次入库数量（库存不足则禁止删除）。确定删除？', async () => {
        try { await api('/consumable-stock-in/' + x.id, 'DELETE'); toast('已删除并扣减库存'); sinAll = sinAll.filter(v => v.id !== x.id); tz.setData(sinAll); }
        catch (err) { toast(err.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条入库记录吗？删除后自动扣减库存。`, async () => {
        let ok = 0, fail = 0;
        for (const r of rows) { try { await api('/consumable-stock-in/' + r.id, 'DELETE'); ok++; } catch (e) { fail++; } }
        sinAll = sinAll.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(sinAll); toast('已删除 ' + ok + ' 条' + (fail ? '，失败 ' + fail + ' 条' : ''));
      });
    },
  });
  const load = async () => {
    const q = $('#sinQ').value.trim(), start = $('#sinStart').value, end = $('#sinEnd').value;
    const qs = new URLSearchParams({ q, start, end, page: 1, size: 100000 });
    const r = await api('/consumable-stock-in?' + qs.toString());
    sinAll = r.data || [];
    tz.setData(sinAll);
  };
  $('#sinSearch').onclick = load;
  $('#sinReset').onclick = () => { $('#sinQ').value=''; $('#sinStart').value=''; $('#sinEnd').value=''; load(); };
  $('#sinQ').onkeydown = (e) => { if (e.key === 'Enter') { load(); } };
  $('#sinExport').onclick = () => {
    downloadExport('/api/consumable-stock-in/export?' + new URLSearchParams({ q: $('#sinQ').value.trim(), start: $('#sinStart').value, end: $('#sinEnd').value }).toString());
  };
  $('#sinTemplate').onclick = () => downloadExport('/api/consumable-stock-in/template');
  $('#sinImport').onclick = () => $('#sinFile').click();
  $('#sinFile').onchange = async () => {
    const f = $('#sinFile').files[0]; if (!f) { $('#sinFile').value = ''; return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/consumable-stock-in/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        toast(d.error || '导入失败', 'err');
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
      } else {
        toast('模板导入成功 ' + d.added + ' 条，库存已累加' + (d.failed ? '，失败 ' + d.failed + ' 条' : ''));
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
        load();
      }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    $('#sinFile').value = '';
  };
  $('#sinAdd').onclick = () => openStockInModal(load);
  load();
}

function openStockInModal(onDone) {
  const today = new Date().toISOString().slice(0, 10);
  const regionOpts = ['中控', '办公楼'].map(r => `<option value="${r}">${r}</option>`).join('');
  const storageSet = [...new Set(conList.map(v => (v.storage || '').trim()).filter(Boolean))];
  openModal('登记耗材入库', `
    <p style="margin-bottom:10px;font-size:13px;color:#6b7280">提交后自动在对应耗材的该区域库存上 +入库数量；删除入库记录时自动扣减回补。</p>
    <div class="form-grid">
      <div class="form-field full"><label>耗材（可搜索）*</label>
        <input list="sinConDl" id="sinConInput" placeholder="输入耗材型号或类别关键字搜索…">
        <datalist id="sinConDl">${conList.map(x => `<option value="${esc(conSelText(x))}">`).join('')}</datalist>
      </div>
      <div class="form-field"><label>区域 *</label><select id="sinRegion">${regionOpts}</select></div>
      <div class="form-field"><label>库位</label><input id="sinStorage" list="sinStorageDl" placeholder="如 文件柜4-1 / 中控柜1-2"><datalist id="sinStorageDl">${storageSet.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div class="form-field"><label>入库数量 *</label><input type="number" id="sinQty" min="1" step="1" value="1"></div>
      <div class="form-field"><label>单价(元，选填)</label><input type="number" id="sinPrice" min="0" step="0.01" placeholder="0=不更新库存单价"></div>
      <div class="form-field"><label>经办人</label><input id="sinOp" list="sinOpDl" placeholder="选择或输入">${opOpts('sinOpDl')}</div>
      <div class="form-field"><label>入库日期</label><input type="date" id="sinTime" value="${today}"></div>
      <div class="form-field full"><label>备注（采购单号/供应商等）</label><input id="sinNote" placeholder="选填"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存入库</button>');
  // 选耗材后自动带出区域（该种类该区域行）
  $('#sinConInput').addEventListener('change', () => {
    const con = conSelFind($('#sinConInput').value);
    if (con && con.region) { $('#sinRegion').value = con.region; $('#sinStorage').value = con.storage || ''; }
  });
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const con = conSelFind($('#sinConInput').value);
    if (!con) { toast('请从下拉列表选择正确的耗材', 'err'); return; }
    const qty = +$('#sinQty').value;
    if (!qty || qty <= 0) { toast('入库数量必须大于 0', 'err'); return; }
    try {
      await api('/consumable-stock-in', 'POST', {
        consumable_id: con.id, qty,
        region: $('#sinRegion').value, storage: $('#sinStorage').value.trim(),
        price: +$('#sinPrice').value || 0,
        operator: $('#sinOp').value.trim(),
        stock_in_time: $('#sinTime').value,
        note: $('#sinNote').value.trim()
      });
      toast('入库成功，' + $('#sinRegion').value + '区域库存已 +' + qty);
      closeModal();
      if (onDone) onDone();
    } catch (e) { toast(e.message, 'err'); }
  };
}

const CON_OPERATORS = ['李龙帅', '李涛', '杨凯麟', '程派', '赵华伟', '齐鑫', '郭云峰', '张晨晖', '刁鹏飞', '刘中浩', '祝栋元', '尹延斌', '马鹏飞'];
const opOpts = (id) => `<datalist id="${id}">${CON_OPERATORS.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
/* 耗材选择（搜索）辅助：统一显示文本 + 按文本精确匹配 */
const conSelText = (x) => `${x.model || ''} · ${x.category || ''}（${x.region || '办公楼'}${x.storage ? '/' + x.storage : ''}｜库存 ${x.region_stock ?? x.stock}）`;
const conSelFind = (v) => conList.find(x => conSelText(x) === ((v || '').trim()));
/* 打印机型号 ↔ 耗材型号 关联匹配：相同或互相包含即命中；任一为空则不过滤 */
/* 品牌归一化：中文/英文/常见别名统一为同一标识 */
const conBrandNorm = (s) => {
  const t = String(s || '').toLowerCase();
  if (/hp|惠普|hewlett|laserjet/.test(t)) return 'hp';
  if (/canon|佳能/.test(t)) return 'canon';
  if (/epson|爱普生/.test(t)) return 'epson';
  if (/xerox|施乐|富士/.test(t)) return 'xerox';
  if (/brother|兄弟/.test(t)) return 'brother';
  if (/lenovo|联想/.test(t)) return 'lenovo';
  if (/dell|戴尔/.test(t)) return 'dell';
  if (/samsung|三星/.test(t)) return 'samsung';
  if (/kyocera|京瓷/.test(t)) return 'kyocera';
  if (/sharp|夏普/.test(t)) return 'sharp';
  if (/ricoh|理光/.test(t)) return 'ricoh';
  if (/panasonic|松下/.test(t)) return 'panasonic';
  return '';
};
/* 型号中的数字序列（≥3位，避免 2 位数字误报） */
const conNumsOf = (s) => (String(s || '').match(/\d+/g) || []).filter(v => v.length >= 3);
/* 型号关键词停用词（品牌/类型/通用词，不参与匹配） */
const CON_STOP = new Set('hp canon epson brother samsung dell lenovo ricoh sharp xerox fuji kyocera okidata lexmark konica minolta ibm acer asus benq panasonic sony toshiba nec star citizen laserjet laser jet printer mfp multifunction deskjet officejet photosmart color pro series plus led toner drum ink inkjet a4 a3 一体 打印机 硒鼓 粉盒 墨盒 鼓架 原装 兼容 型号 黑白 彩色 针式 喷墨 激光 速印 复印 打印 系列 型 号'.split(' '));
/* 型号关键词拆分：保留有意义的字母数字片段（如 1020 / m136 / 630k） */
const conTok = (s) => {
  const t = String(s || '').trim().toLowerCase().replace(/[（(）):：/\\\-_·.、,，\s]+/g, ' ');
  const out = [];
  for (const w of t.split(' ')) {
    const w2 = w.trim();
    if (!w2 || CON_STOP.has(w2)) continue;
    if (/^\d+$/.test(w2) && w2.length < 3) continue;
    if (/^[a-z]+$/.test(w2) && w2.length < 2) continue;
    out.push(w2);
  }
  return out;
};
/* 关键词大概匹配（型号不规范也能命中，宁可漏配不乱配）：
   1) 完整文本相同/包含；2) ≥3位数字交集；3) 字母数字关键词互含；4) 同品牌且双方无数字 → 同族兜底 */
const conMatchModel = (conModel, pModel, extraModels) => {
  const pText = String(pModel || '').trim().toLowerCase();
  if (!pText) return true;
  const cands = [conModel, ...String(extraModels || '').split(',').map(v => v.trim())].filter(Boolean);
  if (!cands.length) return true;
  const pb = conBrandNorm(pText), pn = conNumsOf(pText), pt = conTok(pText);
  return cands.some(cm => {
    const a = String(cm).trim().toLowerCase();
    if (!a) return true;
    if (a === pText || a.includes(pText) || pText.includes(a)) return true;
    const cb = conBrandNorm(a), cn = conNumsOf(a), ct = conTok(a);
    if (pn.some(n => cn.includes(n))) return true;
    if (cn.some(n => pn.includes(n))) return true;
    for (const x of ct) for (const y of pt) {
      if (x.length >= 3 && y.length >= 3 && (x === y || x.includes(y) || y.includes(x))) return true;
    }
    if (cb && pb && cb === pb && !pn.length && !cn.length) return true; // 同品牌且无数字 → 同族
    return false;
  });
};
const fillConDatalist = (elId, cands, placeholderId, tip) => {
  const el = $(elId);
  el.innerHTML = cands.map(x => `<option value="${esc(conSelText(x))}">`).join('');
  if (placeholderId) {
    const inp = $(placeholderId);
    if (cands.length) inp.placeholder = tip || '输入耗材型号或类别关键字搜索…';
    else inp.placeholder = '该打印机暂无登记耗材，清空打印机选择后可搜索全部';
  }
};

async function renderConIssue() {
  const page = $('#conPage');
  page.innerHTML = `
    <div class="card">
      <div class="card-title">🧴 耗材发放登记（提交后自动扣减库存）
        <span class="spacer"></span>
        <button class="btn btn-primary" id="iBatch" data-perm="consumables:edit">＋ 批量领取多种耗材</button>
      </div>
      <div class="form-grid">
        <div class="form-field"><label>耗材 *（输入型号/类别搜索选择，自动带出名称）</label>
          <input id="i_con" list="iConList" placeholder="输入耗材型号或类别关键字搜索…"><datalist id="iConList"></datalist></div>
        <div class="form-field"><label>发放数量 *</label><input id="i_qty" type="number" min="1" value="1"></div>
        <div class="form-field"><label>OA流程号 *</label><input id="i_oa" placeholder="必填，如 IT02202609001"></div>
        <div class="form-field"><label>发放时间</label><input type="date" id="i_time" value="${today()}"></div>
        <div class="form-field full"><label>选择打印机（按型号/部署位置/编号搜索，自动填充所在地）</label>
          <input id="i_printer" placeholder="如输入 中控室 或 施乐 或 编号…" list="printerList"><datalist id="printerList"></datalist></div>
        <div class="form-field full"><label>打印机所处地（联动自动填充，可微调）</label><input id="i_loc" list="locList"><datalist id="locList"></datalist></div>
        <div class="form-field"><label>打印机型号</label><input id="i_model" readonly style="background:#f8fafc"></div>
        <div class="form-field"><label>耗材名称</label><input id="i_consumable" readonly style="background:#f8fafc"></div>
        <div class="form-field"><label>领用部门 *</label><input id="i_dept" list="deptList2"><datalist id="deptList2"></datalist></div>
        <div class="form-field"><label>领用人 *</label><input id="i_applicant"></div>
        <div class="form-field"><label>登记人/经办人</label><input id="i_operator" list="i_opList" placeholder="下拉选择或手写">${opOpts('i_opList')}</div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-primary" id="iSubmit">提交发放</button>
      </div>
    </div>`;
  const r = await api('/consumables');
  conList = r.data;
  $('#iBatch').onclick = () => openBatchIssue();
  $('#iConList').innerHTML = conList.map(x => `<option value="${esc(conSelText(x))}">`).join('');
  const [prs, locs, depts] = await Promise.all([loadPrinters(), api('/issues?per=1000'), api('/issues?per=1000')]);
  const locSet = [...new Set(locs.data.map(x => x.location).filter(Boolean))];
  $('#locList').innerHTML = locSet.map(v => '<option value="' + esc(v) + '">').join('');
  const deptSet = [...new Set(depts.data.map(x => x.department).filter(Boolean))].sort();
  $('#deptList2').innerHTML = deptSet.map(v => '<option value="' + esc(v) + '">').join('');
  $('#printerList').innerHTML = prs.map(p => '<option value="' + esc(printerOption(p)) + '">').join('');
  $('#i_printer').addEventListener('input', () => {
    const v = $('#i_printer').value;
    const p = prs.find(x => printerOption(x) === v);
    if (p) {
      $('#i_model').value = p.model || '';
      $('#i_loc').value = p.location || '';
      if (!$('#i_dept').value.trim() && p.department) $('#i_dept').value = p.department;
      const cands = conList.filter(x => conMatchModel(x.model, p.model, x.printer_models));
      fillConDatalist('#iConList', cands, '#i_con', '已按打印机「' + p.model + '」索引 ' + cands.length + ' 种耗材，输入搜索…');
      $('#i_con').value = '';
      $('#i_consumable').value = '';
    } else if (!v.trim()) {
      fillConDatalist('#iConList', conList, '#i_con', '输入耗材型号或类别关键字搜索…');
    }
  });
  $('#i_con').addEventListener('input', () => {
    const x = conSelFind($('#i_con').value);
    if (x) {
      if (!$('#i_model').value.trim()) $('#i_model').value = x.model;
      $('#i_consumable').value = x.category;
    }
  });
  $('#iSubmit').onclick = async () => {
    const conSel = conSelFind($('#i_con').value), qty = parseFloat($('#i_qty').value);
    if (!conSel) { toast('请从列表中选择耗材', 'err'); return; }
    const cid = conSel.id;
    if (!qty || qty <= 0) { toast('请填写正确的发放数量', 'err'); return; }
    if (!$('#i_oa').value.trim()) { toast('请填写OA流程号', 'err'); return; }
    if (!$('#i_dept').value.trim()) { toast('领用部门必填', 'err'); return; }
    if (!$('#i_applicant').value.trim()) { toast('请填写领用人', 'err'); return; }
    const x = conList.find(v => v.id === cid);
    try {
      const r = await api('/issues', 'POST', {
        consumable_id: cid, qty, oa_no: $('#i_oa').value.trim(),
        region: conSel.region || '办公楼',
        location: $('#i_loc').value.trim(), model: $('#i_model').value,
        consumable: $('#i_consumable').value, department: $('#i_dept').value.trim(),
        applicant: $('#i_applicant').value.trim(), issue_time: $('#i_time').value,
        operator: $('#i_operator').value.trim()
      });
      toast('发放成功（' + (conSel.region || '办公楼') + '区域），OA流程号：' + r.oa_no);
      renderConsumables('records');
    } catch (e) { toast(e.message, 'err'); }
  };
}

async function renderConRecords() {
  const page = $('#conPage');
  page.innerHTML = `
    <div class="toolbar">
      <input type="text" id="irSearch" placeholder="搜索OA号/部门/领用人/型号" class="grow">
      <input type="date" id="irStart" title="开始日期">
      <span style="color:#9ca3af">至</span>
      <input type="date" id="irEnd" title="结束日期">
      <button class="btn" id="irFilter">查询</button>
      <button class="btn" id="irTemplate">📋 导入模板</button>
      <button class="btn" id="irImport" data-perm="consumables:edit">📥 批量导入</button>
      <button class="btn" id="irExport">⬇ 导出Excel</button>
    </div>
    <div class="tz-batch" id="irBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="irBody"></tbody></table></div>
      <div class="tz-pager" id="irPager"></div>
    </div>`;
  let issueAll = [];
  const tz = new TZTable($('#irBody').closest('.table-wrap'), {
    id: 'consumables_irBody',
    perm: 'consumables',
    columns: [
      { key: 'oa_no', label: 'OA流程号' },
      { key: 'issue_time', label: '发放时间' },
      { key: 'region', label: '区域', render: v => v || '—' },
      { key: 'location', label: '打印机所处地' },
      { key: 'model', label: '型号' },
      { key: 'consumable', label: '耗材' },
      { key: 'qty', label: '数量', render: v => `<span class="num">${v}</span>` },
      { key: 'price', label: '单价(元)', render: v => v ? Number(v).toFixed(2) : '—' },
      { key: 'amount', label: '金额(元)', render: (v, r) => r.price ? (r.qty * r.price).toFixed(2) : '—' },
      { key: 'department', label: '领用部门' },
      { key: 'applicant', label: '领用人' },
      { key: 'operator', label: '经办人' },
    ],
    ops: [{ label: '编辑', act: 'edit' }, { label: '删', cls: 'btn-danger', act: 'del' }],
    batchOps: [{ label: '批量删除', cls: 'btn-danger', act: 'del' }],
    multi: { key: 'id' },
    batchEl: '#irBatch', pagerEl: '#irPager',
    data: issueAll,
    onRowOps: (act, x) => {
      if (act === 'edit') openIssueEditModal(x, async () => { await loadIssuePage(); });
      if (act === 'del') confirmModal('删除发放记录', '确定删除该发放记录吗？（仅删除记录，不影响历史库存快照）', async () => {
        try { await api('/issues/' + x.id, 'DELETE'); toast('已删除'); issueAll = issueAll.filter(v => v.id !== x.id); tz.setData(issueAll); } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条发放记录吗？`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/issues/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        issueAll = issueAll.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(issueAll); toast('已删除 ' + ok + ' 条');
      });
    },
  });
  const loadIssuePage = async () => {
    const q = $('#irSearch').value.trim(), start = $('#irStart').value, end = $('#irEnd').value;
    const params = new URLSearchParams({ page: 1, per: '100000' });
    if (q) params.set('q', q);
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const r = await api('/issues?' + params.toString());
    issueAll = r.data || [];
    tz.setData(issueAll);
  };
  await loadIssuePage();
  $('#irFilter').onclick = loadIssuePage;
  $('#irExport').onclick = () => {
    downloadExport('/api/issues/export?' + new URLSearchParams({ q: $('#irSearch').value.trim(), start: $('#irStart').value, end: $('#irEnd').value }).toString());
  };
  $('#irTemplate').onclick = () => { window.location.href = '/api/issues/template'; };
  $('#irImport').onclick = () => openIssueImport();
  $('#irSearch').onkeydown = (e) => { if (e.key === 'Enter') { loadIssuePage(); } };
}

/* 编辑发放记录弹窗：修改数量/耗材自动联动库存 */
async function openIssueEditModal(x, onDone) {
  if (!conList.length) { try { const r = await api('/consumables'); conList = r.data; } catch (e) {} }
  const cur = conList.find(c => String(c.id) === String(x.consumable_id)) || conList.find(c => c.model === x.model && c.category === x.consumable);
  const conTxt = cur ? conSelText(cur) : (x.model + ' ' + x.consumable).trim();
  const curRegion = x.region || (cur && cur.region) || '办公楼';
  openModal('编辑发放记录', `
    <p style="margin-bottom:10px;font-size:13px;color:#6b7280">修改数量、耗材或区域会自动联动调整对应区域库存（金额=数量×单价自动重算）。</p>
    <div class="form-grid">
      <div class="form-field full"><label>耗材 *</label>
        <input list="ieConDl" id="ie_con" value="${esc(conTxt)}" placeholder="输入型号/类别搜索选择…">
        <datalist id="ieConDl">${conList.map(c => `<option value="${esc(conSelText(c))}">`).join('')}</datalist></div>
      <div class="form-field"><label>区域 *</label><select id="ie_region"><option value="中控" ${curRegion === '中控' ? 'selected' : ''}>中控</option><option value="办公楼" ${curRegion === '办公楼' ? 'selected' : ''}>办公楼</option></select></div>
      <div class="form-field"><label>发放数量 *</label><input type="number" id="ie_qty" min="1" value="${x.qty}"></div>
      <div class="form-field"><label>OA流程号 *</label><input id="ie_oa" value="${esc(x.oa_no || '')}"></div>
      <div class="form-field"><label>发放时间</label><input type="date" id="ie_time" value="${(x.issue_time || '').slice(0, 10)}"></div>
      <div class="form-field full"><label>打印机所处地</label><input id="ie_loc" value="${esc(x.location || '')}"></div>
      <div class="form-field"><label>打印机型号</label><input id="ie_model" value="${esc(x.model || '')}"></div>
      <div class="form-field"><label>耗材名称</label><input id="ie_consumable" value="${esc(x.consumable || '')}"></div>
      <div class="form-field"><label>领用部门 *</label><input id="ie_dept" value="${esc(x.department || '')}"></div>
      <div class="form-field"><label>领用人 *</label><input id="ie_applicant" value="${esc(x.applicant || '')}"></div>
      <div class="form-field"><label>经办人</label><input id="ie_operator" list="ieOpDl">${opOpts('ieOpDl')}</div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存修改</button>');
  $('#ie_operator').value = x.operator || '';
  $('#ie_con').addEventListener('input', () => {
    const c = conSelFind($('#ie_con').value);
    if (c) { $('#ie_model').value = c.model; $('#ie_consumable').value = c.category; $('#ie_region').value = c.region || '办公楼'; }
  });
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const c = conSelFind($('#ie_con').value);
    if (!c) { toast('请从列表中选择耗材', 'err'); return; }
    const qty = parseFloat($('#ie_qty').value);
    if (!qty || qty <= 0) { toast('请填写正确的数量', 'err'); return; }
    if (!$('#ie_oa').value.trim()) { toast('请填写OA流程号', 'err'); return; }
    if (!$('#ie_dept').value.trim()) { toast('领用部门必填', 'err'); return; }
    if (!$('#ie_applicant').value.trim()) { toast('请填写领用人', 'err'); return; }
    try {
      await api('/issues/' + x.id, 'PUT', {
        consumable_id: c.id, qty, oa_no: $('#ie_oa').value.trim(),
        region: $('#ie_region').value,
        location: $('#ie_loc').value.trim(), model: $('#ie_model').value,
        consumable: $('#ie_consumable').value, department: $('#ie_dept').value.trim(),
        applicant: $('#ie_applicant').value.trim(), issue_time: $('#ie_time').value,
        operator: $('#ie_operator').value.trim()
      });
      toast('已保存修改，区域库存已联动调整');
      closeModal();
      onDone && onDone();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 备品备件 ============ */
async function renderSpares(tab) {
  const cur = tab || 'stock';
  const c = $('#content');
  c.innerHTML = `
    <div class="tabs" data-mod="spares">
      <div class="tab ${cur === 'stock' ? 'active' : ''}" data-t="stock">库存总览</div>
      <div class="tab ${cur === 'flow' ? 'active' : ''}" data-t="flow">出入库登记</div>
      <div class="tab ${cur === 'records' ? 'active' : ''}" data-t="records">出入库流水</div>
      <div class="tab ${cur === 'stocktake' ? 'active' : ''}" data-t="stocktake">盘库</div>
      <div class="tab ${cur === 'adjust' ? 'active' : ''}" data-t="adjust">调整记录</div>
    </div>
    <div id="spPage"></div>`;
  $$('.tab', c).forEach(t => t.onclick = () => renderSpares(t.dataset.t));
  if (cur === 'stock') renderSpStock();
  if (cur === 'flow') renderSpFlow();
  if (cur === 'records') renderSpRecords();
  if (cur === 'stocktake') renderSpStocktake();
  if (cur === 'adjust') renderSpAdjusts();
}

let stockList = [], stockWares = [], stockRegions = [];
async function renderSpStock() {
  // 保留当前筛选状态：刷新/关闭弹窗时不重置已输入的搜索与筛选
  const prevQ = $('#ssSearch') ? $('#ssSearch').value : '';
  const prevWare = $('#ssWare') ? $('#ssWare').value : '';
  const prevReg = $('#ssRegion') ? $('#ssRegion').value : '';
  const prevLow = $('#ssLow') ? $('#ssLow').checked : false;
  const page = $('#spPage');
  page.innerHTML = `
    <div class="stat-grid" id="ssStats" style="margin-bottom:14px"></div>
    <div class="toolbar">
      <input type="text" id="ssSearch" placeholder="搜索品牌/名称/型号/库位" class="grow">
      <select id="ssWare"><option value="">全部库房</option></select>
      <select id="ssRegion"><option value="">全部区域</option></select>
      <label style="display:flex;align-items:center;gap:5px;font-size:13px"><input type="checkbox" id="ssLow"> 仅看预警</label>
      <button class="btn" id="ssAddItem">＋ 新增物资</button>
      <button class="btn btn-primary" id="ssAddStock">＋ 新增库存位</button>
      <button class="btn" id="ssTemplate">📋 库存模板</button>
      <button class="btn" id="ssImport" data-perm="spares:edit">📥 库存导入</button>
      <input type="file" id="ssFile" accept=".xlsx,.xls" style="display:none">
      <button class="btn btn-warn" id="ssBatch" data-perm="spares:edit">⇅ 批量出入库</button>
    </div>
    <div class="tz-batch" id="ssBatchBar"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="ssBody"></tbody></table></div>
      <div class="empty" id="ssEmpty" style="display:none">暂无库存数据</div>
      <div class="tz-pager" id="ssPager"></div>
    </div>`;
  const r = await api('/stocks');
  stockList = r.data; stockWares = r.warehouses; stockRegions = r.regions;
  $('#ssWare').innerHTML = '<option value="">全部库房</option>' + stockWares.map(v => `<option>${esc(v)}</option>`).join('');
  $('#ssRegion').innerHTML = '<option value="">全部区域</option>' + stockRegions.map(v => `<option>${esc(v)}</option>`).join('');
  // 恢复筛选状态
  if ($('#ssSearch')) $('#ssSearch').value = prevQ;
  if ($('#ssWare')) $('#ssWare').value = prevWare;
  if ($('#ssRegion')) $('#ssRegion').value = prevReg;
  $('#ssLow').checked = prevLow;
  // 统计卡片（可点击）
  const ssKinds = new Set(stockList.map(x => [x.brand, x.name, x.spec].filter(Boolean).join('|')).filter(Boolean)).size;
  const ssQty = stockList.reduce((s, x) => s + (x.qty || 0), 0);
  const ssLowAll = stockList.filter(x => (x.low_threshold > 0 && x.qty <= x.low_threshold) || x.qty <= 0).length;
  const ssWares = new Set(stockList.map(x => x.warehouse).filter(Boolean)).size;
  $('#ssStats').innerHTML = statCardsHTML([
    { ico: '📦', cls: 'blue', n: ssKinds, t: '物资种类' },
    { ico: '🧮', cls: 'green', n: ssQty.toLocaleString(), t: '库存总量' },
    { ico: '⚠️', cls: 'red', n: ssLowAll, t: '需补货' },
    { ico: '🏠', cls: 'purple', n: ssWares, t: '库房数' },
  ]);
  const isLowS = x => (x.low_threshold > 0 && x.qty <= x.low_threshold) || x.qty <= 0;
  const mkFilter = () => {
    const ware = $('#ssWare').value, reg = $('#ssRegion').value, low = $('#ssLow').checked;
    return row => (!ware || row.warehouse === ware) && (!reg || row.region === reg) && (!low || isLowS(row));
  };
  const tz = new TZTable($('#ssBody').closest('.table-wrap'), {
    id: 'spares_ssBody',
    perm: 'spares',
    columns: [
      { key: 'brand', label: '品牌' },
      { key: 'name', label: '物资名称' },
      { key: 'spec', label: '规格型号' },
      { key: 'qty', label: '数量', render: (v, r) => `<span class="num"><b ${isLowS(r) ? 'style="color:var(--danger)"' : ''}>${v}</b></span>` },
      { key: 'unit', label: '单位' },
      { key: 'region', label: '区域' },
      { key: 'warehouse', label: '库房' },
      { key: 'location', label: '库位' },
      { key: 'owner', label: '物资所有人' },
      { key: 'status', label: '状态', render: (v, r) => isLowS(r) ? '<span class="badge badge-red">需补货</span>' : '<span class="badge badge-green">正常</span>' },
    ],
    ops: [
      { label: '移库', act: 'move' },
      { label: '编辑', cls: 'btn-primary', act: 'edit' },
      { label: '删除', cls: 'btn-danger', act: 'del' },
    ],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['brand', 'name', 'spec', 'location'],
    searchBox: '#ssSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#ssBatchBar', pagerEl: '#ssPager', emptyEl: '#ssEmpty',
    data: stockList,
    extraFilter: mkFilter(),
    onRowOps: (act, x) => {
      if (act === 'edit') stockForm(x);
      if (act === 'move') openStockMove(x);
      if (act === 'del') confirmModal('删除库存位', `确定删除「${x.name} @ ${x.warehouse}/${x.location}」这个库存位吗？`, async () => {
        try {
          await api('/stocks/' + x.id, 'DELETE'); toast('已删除');
          stockList = stockList.filter(v => v.id !== x.id);   // 局部移除该行，不重建页面，保留筛选/滚动位置
          tz.setData(stockList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 个库存位吗？`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/stocks/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        stockList = stockList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(stockList); toast('已删除 ' + ok + ' 个');
      });
      if (act === 'export') exportRowsCSV('备件库存_选中导出.csv', ['品牌', '物资名称', '规格型号', '单位', '区域', '库房', '库位', '数量', '物资所有人', '状态'], rows, ['brand', 'name', 'spec', 'unit', 'region', 'warehouse', 'location', 'qty', 'owner', 'status']);
    },
  });
  $('#ssWare').onchange = () => { tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); };
  $('#ssRegion').onchange = () => { tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); };
  $('#ssLow').onchange = () => { tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); };
  const ssReset = () => { $('#ssSearch').value = ''; $('#ssWare').value = ''; $('#ssRegion').value = ''; $('#ssLow').checked = false; tz.search = ''; };
  bindStatClick($('#ssStats'), [
    () => { ssReset(); tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); },
    () => { ssReset(); tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); },
    () => { ssReset(); $('#ssLow').checked = true; tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); },
    () => { ssReset(); tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); },
  ]);
  $('#ssAddItem').onclick = () => itemForm(null);
  $('#ssAddStock').onclick = () => stockForm(null);
  $('#ssTemplate').onclick = () => { window.location.href = '/api/stocks/template'; };
  $('#ssImport').onclick = () => $('#ssFile').click();
  $('#ssFile').onchange = async () => {
    const f = $('#ssFile').files[0]; if (!f) { $('#ssFile').value = ''; return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/stocks/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        toast(d.error || '导入失败', 'err');
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
      } else { toast('库存导入成功 ' + d.added + ' 条（已覆盖对应库位库存）'); renderSpStock(); }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    $('#ssFile').value = '';
  };
  $('#ssBatch').onclick = () => openBatchStock();
}

let itemList = [];
async function loadItems() {
  const r = await api('/items?per=10000');
  itemList = r.data;
  return itemList;
}

function itemForm(x) {
  const d = x || {};
  openModal(x ? '编辑物资' : '新增物资', `
    <div class="form-grid">
      <div class="form-field"><label>品牌</label><input id="it_brand" value="${esc(d.brand || '')}"></div>
      <div class="form-field"><label>物资名称 *</label><input id="it_name" value="${esc(d.name || '')}"></div>
      <div class="form-field"><label>规格型号</label><input id="it_spec" value="${esc(d.spec || '')}"></div>
      <div class="form-field"><label>单位</label><input id="it_unit" value="${esc(d.unit || '')}"></div>
      <div class="form-field full"><label>备注</label><input id="it_remark" value="${esc(d.remark || '')}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = { brand: $('#it_brand').value.trim(), name: $('#it_name').value.trim(), spec: $('#it_spec').value.trim(), unit: $('#it_unit').value.trim(), remark: $('#it_remark').value.trim() };
    if (!body.name) { toast('物资名称必填', 'err'); return; }
    try {
      if (x) await api('/items/' + x.id, 'PUT', body); else await api('/items', 'POST', body);
      toast('已保存'); closeModal(); renderSpStock();
    } catch (e) { toast(e.message, 'err'); }
  };
}

function stockForm(x) {
  const d = x || {};
  openModal(x ? '编辑库存位' : '新增库存位', `
    <div class="form-grid">
      <div class="form-field full"><label>选择物资 *</label><select id="st_item"><option value="">— 请选择 —</option></select></div>
      <div class="form-field"><label>库房区域</label><input id="st_region" value="${esc(d.region || '')}" list="stRegions"><datalist id="stRegions"></datalist></div>
      <div class="form-field"><label>库房</label><input id="st_ware" value="${esc(d.warehouse || '')}" list="stWares"><datalist id="stWares"></datalist></div>
      <div class="form-field"><label>库位</label><input id="st_loc" value="${esc(d.location || '')}"></div>
      <div class="form-field"><label>数量</label><input id="st_qty" type="number" value="${esc(d.qty ?? 0)}"></div>
      <div class="form-field"><label>物资所有人</label><input id="st_owner" value="${esc(d.owner || '')}"></div>
      <div class="form-field"><label>预警阈值</label><input id="st_th" type="number" value="${esc(d.low_threshold || 0)}"></div>
      <div class="form-field full"><label>备注</label><input id="st_remark" value="${esc(d.remark || '')}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>', null, true);
  loadItems().then(() => {
    $('#st_item').innerHTML = '<option value="">— 请选择 —</option>' + itemList.map(v =>
      `<option value="${v.id}" ${d.item_id === v.id ? 'selected' : ''}>${esc(v.brand + ' ' + v.name + ' ' + v.spec + ' ' + v.unit)}</option>`).join('');
  });
  $('#stRegions').innerHTML = stockRegions.map(v => '<option value="' + esc(v) + '">').join('');
  $('#stWares').innerHTML = stockWares.map(v => '<option value="' + esc(v) + '">').join('');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = {
      item_id: +$('#st_item').value, region: $('#st_region').value.trim(),
      warehouse: $('#st_ware').value.trim(), location: $('#st_loc').value.trim(),
      qty: $('#st_qty').value || 0, owner: $('#st_owner').value.trim(),
      low_threshold: $('#st_th').value || 0, remark: $('#st_remark').value.trim()
    };
    if (!body.item_id) { toast('请选择物资', 'err'); return; }
    try {
      if (x) await api('/stocks/' + x.id, 'PUT', body); else await api('/stocks', 'POST', body);
      toast('已保存'); closeModal(); renderSpStock();
    } catch (e) { toast(e.message, 'err'); }
  };
}

async function renderSpFlow() {
  const page = $('#spPage');
  await loadItems();
  try { const r = await api('/stocks'); stockList = r.data; stockWares = r.warehouses; stockRegions = r.regions; } catch (e) {}
  page.innerHTML = `
    <div class="card">
      <div class="card-title">📦 备件出入库登记（提交后自动更新库存）</div>
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <button id="flowTypeOut" style="flex:1;padding:14px;font-size:16px;font-weight:700;border-radius:10px;border:2px solid #fca5a5;background:#fef2f2;color:#b91c1c;cursor:pointer">📤 出 库</button>
        <button id="flowTypeIn" style="flex:1;padding:14px;font-size:16px;font-weight:700;border-radius:10px;border:2px solid #86efac;background:#f0fdf4;color:#15803d;cursor:pointer">📥 入 库</button>
      </div>
      <div class="form-grid">
        <div class="form-field full"><label>物资 *</label>
          <input id="fl_itemSearch" placeholder="输入品牌/名称/规格搜索物资…">
          <div id="fl_itemList" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-top:6px;display:none"></div>
          <input type="hidden" id="fl_itemId">
        </div>
        <div class="form-field"><label>数量 *</label><input id="fl_qty" type="number" min="1" value="1"></div>
        <div class="form-field"><label>库房区域</label><input id="fl_region" list="flRegions"><datalist id="flRegions"></datalist></div>
        <div class="form-field"><label>库房 *</label><select id="fl_ware"><option value="">— 请选择库房 —</option></select></div>
        <div class="form-field"><label>库位 *</label><select id="fl_loc"><option value="">— 请选择库位 —</option></select></div>
        <div class="form-field"><label>领用人（出库时填写）</label><input id="fl_applicant"></div>
        <div class="form-field"><label>审核人</label><input id="fl_reviewer"></div>
        <div class="form-field"><label>出入库时间</label><input type="date" id="fl_time" value="${today()}"></div>
        <div class="form-field"><label>物资所有人（入库新库位时填写）</label><input id="fl_owner"></div>
        <div class="form-field full"><label>备注</label><input id="fl_remark" placeholder="如 用途说明 / OA流程号"></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-primary" id="flSubmit">提交</button>
      </div>
    </div>`;
  let flowType = 'out';
  const paintType = () => {
    $('#flowTypeIn').style.background = flowType === 'in' ? '#16a34a' : '#f0fdf4';
    $('#flowTypeIn').style.color = flowType === 'in' ? '#fff' : '#15803d';
    $('#flowTypeIn').style.borderColor = flowType === 'in' ? '#16a34a' : '#86efac';
    $('#flowTypeOut').style.background = flowType === 'out' ? '#dc2626' : '#fef2f2';
    $('#flowTypeOut').style.color = flowType === 'out' ? '#fff' : '#b91c1c';
    $('#flowTypeOut').style.borderColor = flowType === 'out' ? '#dc2626' : '#fca5a5';
  };
  paintType();
  $('#flowTypeIn').onclick = () => { flowType = 'in'; paintType(); };
  $('#flowTypeOut').onclick = () => { flowType = 'out'; paintType(); };
  $('#flRegions').innerHTML = stockRegions.map(v => '<option value="' + esc(v) + '">').join('');
  $('#fl_ware').innerHTML = '<option value="">— 请选择库房 —</option>' + stockWares.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  const paintLoc = () => {
    const wh = $('#fl_ware').value;
    const locs = [...new Set(stockList.filter(x => x.warehouse === wh).map(x => x.location).filter(Boolean))];
    $('#fl_loc').innerHTML = '<option value="">— 请选择库位 —</option>' + locs.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  };
  $('#fl_ware').onchange = paintLoc;
  paintLoc();
  const itemSearch = $('#fl_itemSearch'), itemListEl = $('#fl_itemList');
  itemSearch.oninput = () => {
    const q = itemSearch.value.trim();
    if (!q) { itemListEl.style.display = 'none'; return; }
    const hits = itemList.filter(v => [v.brand, v.name, v.spec].some(s => String(s || '').includes(q))).slice(0, 30);
    if (!hits.length) { itemListEl.style.display = 'block'; itemListEl.innerHTML = '<div class="empty" style="padding:10px">无匹配物资</div>'; return; }
    itemListEl.style.display = 'block';
    itemListEl.innerHTML = hits.map(v => `
      <div style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border)" data-id="${v.id}" data-name="${esc(v.name)}">
        ${esc(v.brand + ' ' + v.name)} <span style="color:var(--text2);font-size:12px">${esc(v.spec + ' ' + v.unit)} · 总库存 ${v.total_qty}</span>
      </div>`).join('');
    itemListEl.querySelectorAll('div[data-id]').forEach(el => el.onclick = () => {
      $('#fl_itemId').value = el.dataset.id;
      itemSearch.value = el.textContent.trim().replace(/·.*$/, '').trim();
      itemListEl.style.display = 'none';
      const iid = +el.dataset.id;
      const stocks = stockList.filter(x => x.item_id === iid && x.qty > 0).sort((a,b) => (b.qty||0)-(a.qty||0));
      if (stocks.length) {
        const s = stocks[0];
        if (s.warehouse) { $('#fl_ware').value = s.warehouse; }
        paintLoc();
        if (s.location) {
          const locSel = $('#fl_loc');
          if (![...locSel.options].some(o => o.value === s.location)) {
            const opt = document.createElement('option'); opt.value = s.location; opt.textContent = s.location;
            locSel.appendChild(opt);
          }
          locSel.value = s.location;
        }
        if (s.region) $('#fl_region').value = s.region;
        toast('已自动带出库存位置：' + (s.warehouse||'-') + ' / ' + (s.location||'-'), 'ok');
      } else {
        $('#fl_ware').value = ''; paintLoc(); $('#fl_loc').value = '';
        toast('该物资暂无库存记录，请手动选择库房库位', '');
      }
    });
  };
  $('#flSubmit').onclick = async () => {
    const body = {
      type: flowType, item_id: +$('#fl_itemId').value || null,
      name: itemSearch.value.trim(), qty: parseFloat($('#fl_qty').value),
      region: $('#fl_region').value.trim(), warehouse: $('#fl_ware').value.trim(),
      location: $('#fl_loc').value.trim(), applicant: $('#fl_applicant').value.trim(),
      reviewer: $('#fl_reviewer').value.trim(), owner: $('#fl_owner').value.trim(),
      record_time: $('#fl_time').value, remark: $('#fl_remark').value.trim()
    };
    if (!body.item_id && !body.name) { toast('请选择物资', 'err'); return; }
    if (!body.qty || body.qty <= 0) { toast('请填写正确数量', 'err'); return; }
    try {
      const r = await api('/flows', 'POST', body);
      toast((flowType === 'in' ? '入库' : '出库') + '成功，库存已更新');
      if (r && r.id) {
        if (confirm('提交成功！是否立即生成打印' + (flowType === 'in' ? '入库' : '出库') + '单（纸质单）？')) {
          window.location.href = '/api/flows/' + r.id + '/slip';
        }
      }
      renderSpFlow();
    } catch (e) { toast(e.message, 'err'); }
  };
}

async function renderSpRecords() {
  const page = $('#spPage');
  page.innerHTML = `
    <div class="toolbar">
      <input type="text" id="frSearch" placeholder="搜索物资/领用人/备注" class="grow">
      <select id="frType"><option value="">全部类型</option><option value="in">入库</option><option value="out">出库</option><option value="move">移库</option></select>
      <input type="date" id="frStart"><span style="color:#9ca3af">至</span><input type="date" id="frEnd">
      <button class="btn" id="frFilter">查询</button>
      <button class="btn" id="frTemplate">📋 下载模板</button>
      <button class="btn" id="frImport" data-perm="spares:edit">📥 模板导入</button>
      <input type="file" id="frFile" accept=".xlsx,.xls" style="display:none">
      <button class="btn" id="frExport">⬇ 导出Excel</button>
    </div>
    <div class="tz-batch" id="frBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="frBody"></tbody></table></div>
      <div class="tz-pager" id="frPager"></div>
    </div>`;
  let flowAll = [];
  const tz = new TZTable($('#frBody').closest('.table-wrap'), {
    id: 'spares_frBody',
    perm: 'spares',
    columns: [
      { key: 'type', label: '类型', render: v => v === 'in' ? '<span class="badge badge-green">入库</span>' : (v === 'move' ? '<span class="badge" style="background:#e3d5ff;color:#6b21a8">移库</span>' : '<span class="badge badge-warn">出库</span>') },
      { key: 'record_time', label: '时间' },
      { key: 'brand', label: '品牌' },
      { key: 'name', label: '物资名称' },
      { key: 'spec', label: '规格型号' },
      { key: 'qty', label: '数量', render: v => `<span class="num">${v}</span>` },
      { key: 'warehouse', label: '库房' },
      { key: 'location', label: '库位' },
      { key: 'applicant', label: '领用人' },
      { key: 'reviewer', label: '审核人' },
      { key: 'operator', label: '经办人' },
      { key: 'remark', label: '备注' },
    ],
    ops: [{ label: '打印单', show: x => x.type === 'in' || x.type === 'out', act: 'slip' }, { label: '删除', cls: 'btn-danger', act: 'del' }],
    batchOps: [{ label: '🖨 打印选中', cls: 'btn-primary', act: 'slip' }, { label: '批量删除', cls: 'btn-danger', act: 'del' }],
    multi: { key: 'id' },
    batchEl: '#frBatch', pagerEl: '#frPager',
    data: flowAll,
    onRowOps: (act, x) => {
      if (act === 'slip') window.location.href = '/api/flows/' + x.id + '/slip';
      if (act === 'del') confirmModal('删除流水', '删除后会自动反向回补库存（入库→扣减 / 出库→回补 / 移库→双向还原），确定删除？', async () => {
        try {
          const r = await api('/flows/' + x.id, 'DELETE');
          toast('已删除流水，库存已回补' + (r.restored ? '' : '（未回补）'));
          flowAll = flowAll.filter(v => v.id !== x.id); tz.setData(flowAll);
        } catch (err) { toast(err.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'slip') {
        const sel = rows.filter(x => x.type === 'in' || x.type === 'out');
        if (!sel.length) { toast('选中的记录仅支持入库/出库流水合成打印单', 'err'); return; }
        const ins = sel.filter(x => x.type === 'in').map(x => x.id);
        const outs = sel.filter(x => x.type === 'out').map(x => x.id);
        toast('正在生成打印单（' + sel.length + ' 条）…');
        if (outs.length) downloadExport('/api/flows/slip-batch?type=out&ids=' + outs.join(','));
        if (ins.length) downloadExport('/api/flows/slip-batch?type=in&ids=' + ins.join(','));
        return;
      }
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条流水吗？删除后自动反向回补库存。`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/flows/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        flowAll = flowAll.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(flowAll); toast('已删除 ' + ok + ' 条');
      });
    },
  });
  const loadFlowPage = async () => {
    const q = $('#frSearch').value.trim(), t = $('#frType').value, start = $('#frStart').value, end = $('#frEnd').value;
    const params = new URLSearchParams({ page: 1, per: '100000' });
    if (q) params.set('q', q); if (t) params.set('type', t);
    if (start) params.set('start', start); if (end) params.set('end', end);
    const r = await api('/flows?' + params.toString());
    flowAll = r.data || [];
    tz.setData(flowAll);
  };
  await loadFlowPage();
  $('#frFilter').onclick = loadFlowPage;
  $('#frSearch').onkeydown = (e) => { if (e.key === 'Enter') { loadFlowPage(); } };
  $('#frExport').onclick = () => {
    downloadExport('/api/flows/export?' + new URLSearchParams({ q: $('#frSearch').value.trim(), type: $('#frType').value, start: $('#frStart').value, end: $('#frEnd').value }).toString());
  };
  $('#frTemplate').onclick = () => { window.location.href = '/api/stocks/flow-template'; };
  $('#frImport').onclick = () => $('#frFile').click();
  $('#frFile').onchange = async () => {
    const f = $('#frFile').files[0]; if (!f) { $('#frFile').value = ''; return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/stocks/flow-import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        toast(d.error || '导入失败', 'err');
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
      } else {
        toast('模板导入成功 ' + d.added + ' 行，库存与流水已更新');
        renderSpRecords();
      }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    $('#frFile').value = '';
  };
}

/* ============ 备件 v6：批量出入库 / 移库 / 盘库 ============ */
async function openBatchStock() {
  await loadItems();
  try { const r = await api('/stocks'); stockList = r.data; stockWares = r.warehouses; stockRegions = r.regions; } catch (e) {}
  const batchRows = () => {
    const box = $('#bsBody');
    const rows = [...box.querySelectorAll('.bs-row')];
    if (!rows.length) return [];
    return rows.map(tr => {
      const id = tr.dataset.id, wh = tr.querySelector('.bs-ware').value, loc = tr.querySelector('.bs-loc').value;
      const qty = parseFloat(tr.querySelector('.bs-qty').value);
      return { item_id: +id || null, name: '', warehouse: wh, location: loc, qty };
    }).filter(r => r.item_id && r.warehouse && r.location && r.qty > 0);
  };
  const addRow = () => {
    const box = $('#bsBody');
    const tr = document.createElement('tr');
    tr.className = 'bs-row';
    tr.innerHTML = `
      <td style="width:125px"><select class="bs-ware" style="width:100%"><option value="">库房</option></select></td>
      <td style="width:125px"><select class="bs-loc" style="width:100%"><option value="">库位</option></select></td>
      <td style="min-width:300px">
        <input class="bs-search" placeholder="先选库房库位，自动列出该库位物资" style="width:100%;font-size:13px;padding:7px">
        <div class="bs-hits" style="display:none;max-height:230px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-top:4px;background:#fff;min-width:360px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.08)"></div>
        <div class="bs-picked" style="display:none;font-size:13px;color:#16a34a;margin-top:4px;padding:5px 8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;word-break:break-all"></div>
        <input type="hidden" class="bs-id">
      </td>
      <td style="width:90px"><input type="number" class="bs-qty" min="1" value="1" style="width:80px"></td>
      <td><button class="btn btn-sm btn-danger bs-del">删</button></td>`;
    const sel = tr.querySelector('.bs-ware'), selLoc = tr.querySelector('.bs-loc');
    sel.innerHTML = '<option value="">库房</option>' + stockWares.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
    const paintLoc = () => {
      const wh = sel.value;
      const locs = [...new Set(stockList.filter(x => x.warehouse === wh).map(x => x.location).filter(Boolean))];
      selLoc.innerHTML = '<option value="">库位</option>' + locs.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
    };
    const search = tr.querySelector('.bs-search'), hits = tr.querySelector('.bs-hits');
    const stOf = (iid) => stockList.filter(x => String(x.item_id) === String(iid));
    // 所选库房/库位下的库存映射 item_id -> 数量
    const locQtyOf = () => {
      const wh = sel.value, loc = selLoc.value;
      const m = {};
      stockList.forEach(x => {
        if (x.qty > 0 && (!wh || x.warehouse === wh) && (!loc || x.location === loc)) {
          m[String(x.item_id)] = (m[String(x.item_id)] || 0) + (x.qty || 0);
        }
      });
      return m;
    };
    const renderHits = () => {
      const q = search.value.trim().toLowerCase();
      // 未选库房库位且未输入 → 不弹列表
      if (!q && !sel.value && !selLoc.value) { hits.style.display = 'none'; return; }
      const locQty = locQtyOf();
      const arr = itemList
        .map(v => {
          const st = stOf(v.id);
          const qty = st.reduce((a, b) => a + (b.qty || 0), 0);
          const lq = locQty[String(v.id)] || 0;
          let score = lq > 0 ? 30 : 0;            // 所选库位有库存的排最前
          if (q) {
            const hay = [v.brand, v.name, v.spec, v.unit].map(x => String(x || '').toLowerCase()).join('|');
            if (!hay.includes(q)) return null;
            score += 6;
            if (String(v.name || '').toLowerCase().includes(q)) score += 5;
            if (String(v.spec || '').toLowerCase().includes(q)) score += 3;
            if (String(v.brand || '').toLowerCase().includes(q)) score += 2;
          } else if (!lq) {
            return null;                          // 选了库位但未输入 → 只列该库位有库存的物资
          }
          const locs = [...new Set(st.map(x => (x.warehouse ? x.warehouse + '/' + x.location : x.location)).filter(Boolean))].slice(0, 3);
          return { v, score, qty, locs, lq };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || String(a.v.name).localeCompare(String(b.v.name), 'zh') || String(a.v.spec || '').localeCompare(String(b.v.spec || ''), 'zh'))
        .slice(0, 30);
      if (!arr.length) { hits.style.display = 'block'; hits.innerHTML = '<div class="empty" style="padding:10px">' + (q ? '无匹配物资' : '该库位暂无库存物资') + '</div>'; return; }
      hits.style.display = 'block';
      hits.innerHTML = arr.map(x => {
        const v = x.v;
        const qtyTxt = x.lq > 0 ? ('本库位 <b style="color:#16a34a">' + x.lq + '</b>') : (x.qty > 0 ? ('总库存 <b style="color:#16a34a">' + x.qty + '</b>') : '<span style="color:var(--danger)">无库存</span>');
        const locTxt = x.locs.length ? ' ｜ 库位:' + x.locs.join('，') : '';
        return `<div style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border)" data-id="${v.id}">
          <div><b>${esc(v.brand ? v.brand + ' ' : '')}${esc(v.name)}</b>${esc(v.spec ? ' ｜ ' + v.spec : '')}${esc(v.unit ? '（' + v.unit + '）' : '')}</div>
          <div style="color:var(--text2);font-size:12px;margin-top:2px">${qtyTxt}${locTxt}</div>
        </div>`;
      }).join('');
      hits.querySelectorAll('div[data-id]').forEach(el => el.onclick = () => {
        const iid = el.dataset.id;
        const it = itemList.find(v => String(v.id) === String(iid));
        tr.querySelector('.bs-id').value = iid;
        tr.dataset.id = iid;
        search.value = (it.brand ? it.brand + ' ' : '') + it.name + (it.spec ? ' ' + it.spec : '') + (it.unit ? ' ' + it.unit : '');
        hits.style.display = 'none';
        const stocks = stOf(iid).filter(x => x.qty > 0).sort((a, b) => (b.qty || 0) - (a.qty || 0));
        // 用户已手动选库房/库位 → 不覆盖；否则自动带出默认位置
        if (tr.dataset.manuallySet === '1') {
          const inSel = stocks.find(s => (!sel.value || s.warehouse === sel.value) && (!selLoc.value || s.location === selLoc.value));
          if (!inSel) toast('该物资在所选库房库位无库存（总库存 ' + (stocks.reduce((a, b) => a + (b.qty || 0), 0)) + '），请确认库位', '');
        } else if (stocks.length) {
          const s = stocks[0];
          if (s.warehouse) { sel.value = s.warehouse; paintLoc(); }
          if (s.location) {
            if (![...selLoc.options].some(o => o.value === s.location)) {
              const opt = document.createElement('option'); opt.value = s.location; opt.textContent = s.location;
              selLoc.appendChild(opt);
            }
            selLoc.value = s.location;
          }
        } else {
          toast('该物资无库存记录，请手动选择库房库位', '');
        }
        // 行内已选详情
        const info = tr.querySelector('.bs-picked');
        const st = stOf(iid);
        const qty = st.reduce((a, b) => a + (b.qty || 0), 0);
        const lq = locQty[String(iid)] || 0;
        info.innerHTML = '✔ 已选：<b>' + esc(search.value) + '</b>' + (lq > 0 ? ' ｜ 本库位 <b>' + lq + '</b>' : (qty > 0 ? ' ｜ 总库存 <b>' + qty + '</b>' : ' ｜ <span style="color:var(--danger)">无库存</span>'));
        info.style.display = 'block';
      });
    };
    sel.onchange = () => { paintLoc(); tr.dataset.manuallySet = '1'; renderHits(); };
    selLoc.onchange = () => { tr.dataset.manuallySet = '1'; renderHits(); };
    search.oninput = renderHits;
    search.onfocus = renderHits;
    paintLoc();
    tr.querySelector('.bs-del').onclick = () => tr.remove();
    box.appendChild(tr);
  };
  openModal('批量出入库（一次登记多种物资，自动更新库存）', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="display:flex;gap:10px">
        <button id="bsTypeOut" style="padding:10px 20px;font-size:15px;font-weight:700;border-radius:8px;border:2px solid #fca5a5;background:#fef2f2;color:#b91c1c;cursor:pointer">📤 批量出库</button>
        <button id="bsTypeIn" style="padding:10px 20px;font-size:15px;font-weight:700;border-radius:8px;border:2px solid #86efac;background:#f0fdf4;color:#15803d;cursor:pointer">📥 批量入库</button>
      </div>
      <div>
        <button class="btn btn-sm" id="bsTemplate">📋 下载模板</button>
        <button class="btn btn-sm btn-primary" id="bsImport" data-perm="spares:edit">📥 导入模板</button>
        <input type="file" id="bsFile" accept=".xlsx,.xls" style="display:none">
      </div>
    </div>
    <div id="bsResult" style="font-size:13px;line-height:1.8;margin-bottom:8px"></div>
    <div class="form-grid">
      <div class="form-field"><label>领用人（出库填写）</label><input id="bs_applicant"></div>
      <div class="form-field"><label>审核人</label><input id="bs_reviewer"></div>
      <div class="form-field"><label>出入库时间</label><input type="date" id="bs_time" value="${today()}"></div>
      <div class="form-field full"><label>备注</label><input id="bs_remark" placeholder="如 用途/OA流程号"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0">
      <b>物资明细（库房→库位联动）</b><button class="btn btn-sm" id="bsAdd" data-perm="spares:edit">＋ 添加一行</button>
    </div>
    <div class="table-wrap" style="max-height:320px;overflow-y:auto"><table>
      <thead><tr><th>库房 *</th><th>库位 *</th><th>物资 *</th><th>数量 *</th><th></th></tr></thead>
      <tbody id="bsBody"></tbody></table></div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">提交</button>', null, true);
  let bsType = 'out';
  const paintBs = () => {
    $('#bsTypeIn').style.background = bsType === 'in' ? '#16a34a' : '#f0fdf4';
    $('#bsTypeIn').style.color = bsType === 'in' ? '#fff' : '#15803d';
    $('#bsTypeIn').style.borderColor = bsType === 'in' ? '#16a34a' : '#86efac';
    $('#bsTypeOut').style.background = bsType === 'out' ? '#dc2626' : '#fef2f2';
    $('#bsTypeOut').style.color = bsType === 'out' ? '#fff' : '#b91c1c';
    $('#bsTypeOut').style.borderColor = bsType === 'out' ? '#dc2626' : '#fca5a5';
  };
  paintBs();
  $('#bsTypeIn').onclick = () => { bsType = 'in'; paintBs(); };
  $('#bsTypeOut').onclick = () => { bsType = 'out'; paintBs(); };
  $('#bsAdd').onclick = addRow;
  $('#bsTemplate').onclick = () => { window.location.href = '/api/stocks/flow-template'; };
  $('#bsImport').onclick = () => $('#bsFile').click();
  $('#bsFile').onchange = async () => {
    const f = $('#bsFile').files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    const box = $('#bsResult');
    box.innerHTML = '<span style="color:var(--text2)">导入中…</span>';
    try {
      const res = await fetch('/api/stocks/flow-import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        box.innerHTML = '<span style="color:var(--danger)">' + esc(d.error || '导入失败') + '</span>';
        if (d.errors && d.errors.length) box.innerHTML += '<div style="color:var(--danger);margin-top:4px">' + d.errors.slice(0, 20).map(e => esc(e)).join('<br>') + '</div>';
        toast(d.error || '导入失败', 'err');
      } else {
        box.innerHTML = '<span style="color:#16a34a">✅ 模板导入成功 <b>' + d.added + '</b> 行，库存与流水已更新</span>';
        toast('模板导入成功 ' + d.added + ' 行');
        setTimeout(() => { closeModal(); renderSpStock(); }, 600);
      }
    } catch (e) { box.innerHTML = '<span style="color:var(--danger)">上传失败：' + esc(e.message) + '</span>'; }
    $('#bsFile').value = '';
  };
  addRow(); addRow();
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const rows = batchRows();
    if (!rows.length) { toast('请至少填写一项：物资/库房/库位/数量', 'err'); return; }
    try {
      const r = await api('/stocks/batch', 'POST', {
        type: bsType, items: rows,
        applicant: $('#bs_applicant').value.trim(), reviewer: $('#bs_reviewer').value.trim(),
        record_time: $('#bs_time').value, remark: $('#bs_remark').value.trim()
      });
      toast((bsType === 'in' ? '批量入库' : '批量出库') + '成功，共 ' + r.count + ' 项，库存已更新');
      closeModal(); renderSpStock();
    } catch (e) { toast(e.message, 'err'); }
  };
}

function openStockMove(x) {
  openModal('物资移库', `
    <div class="form-grid">
      <div class="form-field full"><label>源库存位</label><input value="${esc(x.name + ' @ ' + x.warehouse + '/' + x.location + '（当前库存 ' + x.qty + '）')}" disabled></div>
      <div class="form-field"><label>移库数量 *</label><input type="number" id="mv_qty" min="1" value="${x.qty}"></div>
      <div class="form-field"><label>目标库房区域</label><input id="mv_region" value="${esc(x.region || '')}" list="mvRegions"><datalist id="mvRegions"></datalist></div>
      <div class="form-field"><label>目标库房 *</label><select id="mv_ware"></select></div>
      <div class="form-field"><label>目标库位 *</label><select id="mv_loc"></select></div>
      <div class="form-field"><label>领用人</label><input id="mv_applicant"></div>
      <div class="form-field"><label>出入库时间</label><input type="date" id="mv_time" value="${today()}"></div>
      <div class="form-field full"><label>备注</label><input id="mv_remark" placeholder="移库原因"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">确认移库</button>', null, true);
  $('#mvRegions').innerHTML = stockRegions.map(v => '<option value="' + esc(v) + '">').join('');
  $('#mv_ware').innerHTML = '<option value="">— 请选择库房 —</option>' + stockWares.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  const paintMvLoc = () => {
    const wh = $('#mv_ware').value;
    const locs = [...new Set(stockList.filter(v => v.warehouse === wh).map(v => v.location).filter(Boolean))];
    $('#mv_loc').innerHTML = '<option value="">— 请选择库位 —</option>' + locs.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  };
  $('#mv_ware').onchange = paintMvLoc;
  paintMvLoc();
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const qty = parseFloat($('#mv_qty').value), toWare = $('#mv_ware').value, toLoc = $('#mv_loc').value;
    if (!qty || qty <= 0) { toast('请填写正确数量', 'err'); return; }
    if (qty > x.qty) { toast('移库数量不能超过当前库存 ' + x.qty, 'err'); return; }
    if (!toWare || !toLoc) { toast('请选择目标库房与库位', 'err'); return; }
    if (toWare === x.warehouse && toLoc === x.location) { toast('目标库位与源库位相同', 'err'); return; }
    try {
      await api('/stocks/move', 'POST', {
        stock_id: x.id, qty, to_warehouse: toWare, to_location: toLoc,
        to_region: $('#mv_region').value.trim(), applicant: $('#mv_applicant').value.trim(),
        record_time: $('#mv_time').value, remark: $('#mv_remark').value.trim()
      });
      toast('移库成功，库存与流水已更新');
      closeModal(); renderSpStock();
    } catch (e) { toast(e.message, 'err'); }
  };
}

let stList = [];
async function renderSpAdjusts() {
  const page = $('#spPage');
  page.innerHTML = `
    <div class="toolbar">
      <input type="text" id="saSearch" placeholder="搜索物资/原因/操作人" class="grow">
      <button class="btn" id="saFilter">查询</button>
      <button class="btn btn-primary" id="saAdd" data-perm="spares:edit">＋ 新增调整</button>
    </div>
    <div class="tz-batch" id="saBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="saBody"></tbody></table></div>
      <div class="tz-pager" id="saPager"></div>
    </div>`;
  let saAll = [];
  const tz = new TZTable($('#saBody').closest('.table-wrap'), {
    id: 'spares_saBody',
    perm: 'spares',
    columns: [
      { key: 'type', label: '类型', render: v => v === 'in' ? '<span class="badge badge-green">手动增加</span>' : v === 'out' ? '<span class="badge badge-warn">手动减少</span>' : v === 'manual' ? '<span class="badge badge-blue">库存修改</span>' : `<span class="badge">${esc(v)}</span>` },
      { key: 'adjust_time', label: '时间' },
      { key: 'brand', label: '品牌' },
      { key: 'name', label: '物资名称' },
      { key: 'spec', label: '规格型号' },
      { key: 'qty', label: '数量变动', render: (v, r) => {
        const show = (r.type === 'manual' || r.type === 'out' || (r.type === 'in' && (r.reason || '').includes('删除'))) ? (v > 0 ? '+' + v : v) : v;
        return `<span class="num"><b style="color:${v < 0 ? '#dc2626' : '#16a34a'}">${show}</b></span>`;
      } },
      { key: 'warehouse', label: '库房' },
      { key: 'location', label: '库位' },
      { key: 'reason', label: '变更原因' },
      { key: 'operator', label: '操作人' },
    ],
    ops: [{ label: '删除', cls: 'btn-danger', act: 'del' }],
    batchOps: [{ label: '批量删除', cls: 'btn-danger', act: 'del' }],
    multi: { key: 'id' },
    batchEl: '#saBatch', pagerEl: '#saPager',
    data: saAll,
    onRowOps: (act, x) => {
      if (act === 'del') confirmModal('删除调整记录', '删除后会自动反向调整库存（增加→扣减 / 减少→回补），确定删除？', async () => {
        try { await api('/spare/adjusts/' + x.id, 'DELETE'); toast('已删除并回补库存'); saAll = saAll.filter(v => v.id !== x.id); tz.setData(saAll); } catch (err) { toast(err.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条调整记录吗？删除后自动反向回补库存。`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/spare/adjusts/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        saAll = saAll.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(saAll); toast('已删除 ' + ok + ' 条');
      });
    },
  });
  const load = async () => {
    const q = $('#saSearch').value.trim();
    const params = new URLSearchParams({ page: 1, per: '100000' });
    if (q) params.set('q', q);
    const r = await api('/spare/adjusts?' + params.toString());
    saAll = r.data || [];
    tz.setData(saAll);
  };
  $('#saFilter').onclick = load;
  $('#saSearch').onkeydown = (e) => { if (e.key === 'Enter') { load(); } };
  $('#saAdd').onclick = openSpareAdjust;
  if (!stockWares.length) {
    try { const r = await api('/stocks'); stockList = r.data; stockWares = r.warehouses; stockRegions = r.regions; } catch (e) {}
  }
  await load();
}

async function openSpareAdjust() {
  if (!itemList.length) { try { await loadItems(); } catch (e) { toast(e.message, 'err'); return; } }
  if (!stockWares.length) {
    try { const r = await api('/stocks'); stockList = r.data; stockWares = r.warehouses; stockRegions = r.regions; } catch (e) {}
  }
  openModal('新增库存调整', `
    <p style="font-size:13px;color:#6b7280;margin-bottom:10px">调整会直接增减对应库位的库存并留痕；删除调整记录时会自动反向回补。</p>
    <div class="form-grid">
      <div class="form-field full"><label>物资 *</label>
        <input id="sa_itemSearch" placeholder="输入品牌/名称/规格搜索物资…">
        <div id="sa_itemList" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-top:6px;display:none"></div>
        <input type="hidden" id="sa_itemId"></div>
      <div class="form-field"><label>调整类型 *</label><select id="sa_type"><option value="in">增加</option><option value="out">减少</option></select></div>
      <div class="form-field"><label>数量 *</label><input type="number" id="sa_qty" min="1" value="1"></div>
      <div class="form-field full"><label>库房 *</label><select id="sa_ware"></select></div>
      <div class="form-field full"><label>库位 *</label><select id="sa_loc"></select></div>
      <div class="form-field full"><label>调整时间</label><input type="date" id="sa_time" value="${today()}"></div>
      <div class="form-field full"><label>调整原因 *</label><input id="sa_reason" placeholder="如 盘点差异/破损报废/台账纠错"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">提交调整</button>', null, true);
  const wsel = $('#sa_ware');
  wsel.innerHTML = '<option value="">— 请选择库房 —</option>' + stockWares.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  const paintLoc = () => {
    const wh = wsel.value;
    const locs = [...new Set(stockList.filter(x => x.warehouse === wh).map(x => x.location).filter(Boolean))];
    $('#sa_loc').innerHTML = '<option value="">— 请选择库位 —</option>' + locs.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  };
  wsel.onchange = paintLoc;
  const search = $('#sa_itemSearch'), hits = $('#sa_itemList');
  search.oninput = () => {
    const q = search.value.trim();
    if (!q) { hits.style.display = 'none'; return; }
    const arr = itemList.filter(v => [v.brand, v.name, v.spec].some(s => String(s || '').includes(q))).slice(0, 20);
    if (!arr.length) { hits.style.display = 'block'; hits.innerHTML = '<div class="empty" style="padding:10px">无匹配物资</div>'; return; }
    hits.style.display = 'block';
    hits.innerHTML = arr.map(v => `<div style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border)" data-id="${v.id}">${esc(v.brand + ' ' + v.name)} <span style="color:var(--text2);font-size:12px">${esc(v.spec + ' ' + v.unit)}</span></div>`).join('');
    hits.querySelectorAll('div[data-id]').forEach(el => el.onclick = () => {
      $('#sa_itemId').value = el.dataset.id;
      search.value = el.textContent.trim().replace(/\s*<.*$/, '');
      hits.style.display = 'none';
    });
  };
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const item_id = +$('#sa_itemId').value || null;
    const qty = parseFloat($('#sa_qty').value);
    const wh = wsel.value.trim(), loc = $('#sa_loc').value.trim();
    const reason = $('#sa_reason').value.trim();
    if (!item_id) { toast('请选择物资', 'err'); return; }
    if (!qty || qty <= 0) { toast('请填写正确数量', 'err'); return; }
    if (!wh || !loc) { toast('请选择库房与库位', 'err'); return; }
    if (!reason) { toast('请填写调整原因', 'err'); return; }
    try {
      await api('/spare/adjusts', 'POST', { type: $('#sa_type').value, item_id, qty, warehouse: wh, location: loc, reason, adjust_time: $('#sa_time').value });
      toast('调整成功，库存已更新');
      closeModal(); renderSpAdjusts(); renderSpStock();
    } catch (e) { toast(e.message, 'err'); }
  };
}

async function renderSpStocktake() {
  // 保留当前库房筛选：刷新/保存后不重置
  const prevWare = $('#stkWare') ? $('#stkWare').value : '';
  const page = $('#spPage');
  page.innerHTML = `
    <div class="toolbar">
      <select id="stkWare"><option value="">全部库房</option></select>
      <button class="btn btn-primary" id="stkNew">＋ 新建盘点</button>
    </div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="stkBody"></tbody></table></div>
      <div class="empty" id="stkEmpty" style="display:none">暂无盘点记录</div>
      <div class="tz-pager" id="stkPager"></div>
    </div>
    <p class="small">盘点流程：新建盘点 → 录入实盘数 → 保存 → 确认调整（自动按盘盈/盘亏更新库存并生成调整流水，即"平库"）。</p>`;
  const r = await api('/stocks');
  stockWares = r.warehouses;
  $('#stkWare').innerHTML = '<option value="">全部库房</option>' + stockWares.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  if ($('#stkWare')) $('#stkWare').value = prevWare;   // 恢复库房筛选
  const mkFilter = () => { const wh = $('#stkWare').value; return row => !wh || row.warehouse === wh; };
  const tz = new TZTable($('#stkBody').closest('.table-wrap'), {
    id: 'spares_stkBody',
    perm: 'spares',
    columns: [
      { key: 'batch_no', label: '盘点批次号', render: v => `<b>${esc(v)}</b>` },
      { key: 'take_time', label: '盘点时间' },
      { key: 'warehouse', label: '库房', render: v => esc(v || '全部') },
      { key: 'operator', label: '经办人' },
      { key: 'status', label: '状态', render: v => v === '已完成' ? '<span class="badge badge-green">已完成</span>' : '<span class="badge badge-warn">进行中</span>' },
      { key: 'remark', label: '备注' },
    ],
    ops: [
      { label: '查看/录入', cls: 'btn-primary', act: 'open' },
      { label: '删除', cls: 'btn-danger', act: 'del', show: x => x.status !== '已完成' },
    ],
    multi: { key: 'id' },
    batchEl: '', pagerEl: '#stkPager', emptyEl: '#stkEmpty',
    data: stList,
    extraFilter: mkFilter(),
    onRowOps: (act, x) => {
      if (act === 'open') openStocktakeDetail(x.id);
      if (act === 'del') confirmModal('删除盘点批次', `确定删除「${x.batch_no}」吗？未确认调整的盘点可删除。`, async () => {
        try { await api('/stocktakes/' + x.id, 'DELETE'); toast('已删除'); stList = stList.filter(v => v.id !== x.id); tz.setData(stList); } catch (e) { toast(e.message, 'err'); }
      });
    },
  });
  const loadStocktakeList = async () => {
    const rr = await api('/stocktakes');
    stList = rr.data;
    tz.setData(stList);
  };
  $('#stkWare').onchange = () => { tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); };
  $('#stkNew').onclick = () => openStocktakeNew();
  await loadStocktakeList();
}
function openStocktakeNew() {
  openModal('新建盘点批次', `
    <div class="form-grid">
      <div class="form-field"><label>盘点库房</label>
        <select id="stnWare"><option value="">全部库房</option>${stockWares.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('')}</select></div>
      <div class="form-field"><label>盘点时间</label><input type="date" id="stnTime" value="${today()}"></div>
      <div class="form-field full"><label>备注</label><input id="stnRemark" placeholder="如 月度盘点"></div>
    </div>
    <p class="small">确认后将自动生成该库房（或全部）所有库存位的账面数量清单。</p>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">生成盘点单</button>', null, true);
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    try {
      const r = await api('/stocktakes', 'POST', {
        warehouse: $('#stnWare').value, take_time: $('#stnTime').value, remark: $('#stnRemark').value.trim()
      });
      toast('盘点单 ' + r.batch_no + ' 已生成，共 ' + r.count + ' 项');
      closeModal(); renderSpStocktake();
    } catch (e) { toast(e.message, 'err'); }
  };
}
async function openStocktakeDetail(id) {
  const r = await api('/stocktakes/' + id);
  const b = r.batch, items = r.items;
  const table = items.map(x => `
    <tr>
      <td>${esc(x.warehouse)}</td><td>${esc(x.location)}</td>
      <td>${esc(x.brand + ' ' + x.name)}</td><td>${esc(x.spec + ' ' + x.unit)}</td>
      <td class="num">${x.book_qty}</td>
      <td>${b.status === '进行中' ? `<input type="number" class="stk-act" data-id="${x.id}" value="${x.actual_qty ?? x.book_qty}" min="0" style="width:70px">` : `<span class="num">${x.actual_qty ?? '—'}</span>`}</td>
      <td class="num">${x.diff_qty ? (x.diff_qty > 0 ? '<span style="color:var(--danger)">+' + x.diff_qty + '</span>' : '<span style="color:#1a73e8">' + x.diff_qty + '</span>') : '—'}</td>
      <td>${x.status}</td>
    </tr>`).join('');
  openModal(`盘点批次 ${esc(b.batch_no)}（${b.status}）`, `
    <div class="table-wrap" style="max-height:360px;overflow-y:auto"><table>
      <thead><tr><th>库房</th><th>库位</th><th>物资</th><th>规格/单位</th><th>账面数</th><th>实盘数</th><th>盈亏</th><th>状态</th></tr></thead>
      <tbody>${table || '<tr><td colspan="8"><div class="empty">无明细</div></td></tr>'}</tbody></table></div>
    <p class="small">盈亏 = 实盘数 − 账面数；确认调整后按盈亏自动更新库存并生成盘盈/盘亏流水（已完成批次不可再调整）。</p>`,
    b.status === '进行中'
      ? '<button class="btn" data-a="save">保存实盘</button><button class="btn btn-primary" data-a="apply">确认调整</button><button class="btn" data-a="close">关闭</button>'
      : '<button class="btn" data-a="close">关闭</button>', null, true);
  if (b.status === '进行中') {
    $('#modalFoot').querySelector('[data-a=save]').onclick = async () => {
      const ups = [...document.querySelectorAll('.stk-act')].map(i => ({ id: +i.dataset.id, actual_qty: parseFloat(i.value) || 0 }));
      try {
        await api('/stocktakes/' + id, 'PUT', { items: ups });
        toast('实盘数已保存，盈亏已计算'); closeModal(); openStocktakeDetail(id);
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#modalFoot').querySelector('[data-a=apply]').onclick = () => confirmModal('确认盘库调整（平库）', '将按盈亏差异自动更新库存并生成盘盈/盘亏流水，此操作不可撤销，确认？', async () => {
      try {
        const r2 = await api('/stocktakes/' + id + '/apply', 'POST', {});
        toast('调整完成，共处理 ' + r2.adjusted + ' 项差异');
        closeModal(); renderSpStocktake();
      } catch (e) { toast(e.message, 'err'); }
    });
  }
  $('#modalFoot').querySelector('[data-a=close]').onclick = closeModal;
}

/* ============ 办公电脑 ============ */
let computerList = [];
async function renderComputers() {
  // 保留当前筛选状态：刷新/保存后不重置搜索与状态筛选
  const prevSearch = $('#cpSearch') ? $('#cpSearch').value : '';
  const prevStatus = $('#cpStatus') ? $('#cpStatus').value : '';
  const c = $('#content');
  c.innerHTML = `
    <div class="stat-grid" id="cpStats" style="margin-bottom:14px"></div>
    <div class="toolbar">
      <input type="text" id="cpSearch" placeholder="搜索资产编号/主机名/使用者/部门/IP" class="grow">
      <select id="cpStatus"><option value="">全部状态</option><option>在用</option><option>闲置</option><option>报废</option></select>
      <button class="btn btn-primary" id="cpAdd" data-perm="computers:edit">＋ 新增电脑</button>
    </div>
    <div class="tz-batch" id="cpBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="cpBody"></tbody></table></div>
      <div class="empty" id="cpEmpty" style="display:none">暂无电脑台账数据</div>
      <div class="tz-pager" id="cpPager"></div>
    </div>`;
  const r = await api('/computers');
  computerList = r.data;
  // 恢复筛选状态
  if ($('#cpSearch')) $('#cpSearch').value = prevSearch;
  if ($('#cpStatus')) $('#cpStatus').value = prevStatus;
  // 统计卡片（可点击）
  const cpIn = computerList.filter(x => x.status === '在用').length;
  const cpIdle = computerList.filter(x => x.status === '闲置').length;
  const cpScrap = computerList.filter(x => x.status === '报废').length;
  $('#cpStats').innerHTML = statCardsHTML([
    { ico: '🖥️', cls: 'blue', n: computerList.length, t: '电脑总数' },
    { ico: '✅', cls: 'green', n: cpIn, t: '在用' },
    { ico: '💤', cls: 'warn', n: cpIdle, t: '闲置' },
    { ico: '🚫', cls: 'red', n: cpScrap, t: '报废' },
  ]);
  const mkStatus = () => { const s = $('#cpStatus').value; return row => !s || row.status === s; };
  const tz = new TZTable($('#cpBody').closest('.table-wrap'), {
    id: 'computers_cpBody',
    perm: 'computers',
    columns: [
      { key: 'asset_no', label: '资产编号' },
      { key: 'hostname', label: '主机名', render: v => esc(v || '—') },
      { key: 'model', label: '品牌型号', render: (v, r) => esc(r.brand) + ' ' + esc(r.model) },
      { key: 'user_name', label: '使用者', render: v => esc(v || '—') },
      { key: 'department', label: '部门', render: v => esc(v || '—') },
      { key: 'location', label: '位置', render: v => esc(v || '—') },
      { key: 'ip', label: 'IP', render: v => esc(v || '—') },
      { key: 'status', label: '状态', render: v => statusBadge(v) },
    ],
    ops: [
      { label: '详情', act: 'view' },
      { label: '编辑', cls: 'btn-primary', act: 'edit' },
      { label: '删除', cls: 'btn-danger', act: 'del' },
    ],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['asset_no', 'hostname', 'user_name', 'department', 'ip', 'model'],
    searchBox: '#cpSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#cpBatch', pagerEl: '#cpPager', emptyEl: '#cpEmpty',
    data: computerList,
    extraFilter: mkStatus(),
    onRowOps: (act, x) => {
      if (act === 'view') computerDetail(x);
      if (act === 'edit') computerForm(x);
      if (act === 'del') confirmModal('删除电脑', `确定删除电脑「${x.asset_no || x.hostname || x.model}」吗？（其维修记录一并删除）`, async () => {
        try {
          await api('/computers/' + x.id, 'DELETE'); toast('已删除');
          computerList = computerList.filter(v => v.id !== x.id);   // 局部移除，保留筛选/滚动位置
          tz.setData(computerList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 台电脑吗？（其维修记录一并删除）`, async () => {
        let ok = 0, fail = 0;
        for (const r of rows) { try { await api('/computers/' + r.id, 'DELETE'); ok++; } catch (e) { fail++; } }
        computerList = computerList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(computerList); toast('已删除 ' + ok + ' 台' + (fail ? '，失败 ' + fail + ' 台' : ''));
      });
      if (act === 'export') exportRowsCSV('办公电脑_选中导出.csv', ['资产编号', '主机名', '品牌', '型号', '使用者', '部门', '位置', 'IP', '状态'], rows, ['asset_no', 'hostname', 'brand', 'model', 'user_name', 'department', 'location', 'ip', 'status']);
    },
  });
  $('#cpStatus').onchange = () => { tz.extraFilter = mkStatus(); tz.page = 1; tz.render(); };
  bindStatClick($('#cpStats'), [
    () => { $('#cpSearch').value = ''; $('#cpStatus').value = ''; tz.search = ''; tz.extraFilter = mkStatus(); tz.page = 1; tz.render(); },
    () => { $('#cpSearch').value = ''; $('#cpStatus').value = '在用'; tz.search = ''; tz.extraFilter = mkStatus(); tz.page = 1; tz.render(); },
    () => { $('#cpSearch').value = ''; $('#cpStatus').value = '闲置'; tz.search = ''; tz.extraFilter = mkStatus(); tz.page = 1; tz.render(); },
    () => { $('#cpSearch').value = ''; $('#cpStatus').value = '报废'; tz.search = ''; tz.extraFilter = mkStatus(); tz.page = 1; tz.render(); },
  ]);
  $('#cpAdd').onclick = () => computerForm(null);
}

function computerForm(x) {
  const d = x || {};
  openModal(x ? '编辑电脑' : '新增电脑', `
    <div class="form-grid">
      <div class="form-field"><label>资产编号</label><input id="cp_no" value="${esc(d.asset_no || '')}"></div>
      <div class="form-field"><label>主机名</label><input id="cp_host" value="${esc(d.hostname || '')}"></div>
      <div class="form-field"><label>品牌</label><input id="cp_brand" value="${esc(d.brand || '')}"></div>
      <div class="form-field"><label>型号</label><input id="cp_model" value="${esc(d.model || '')}"></div>
      <div class="form-field"><label>序列号 SN</label><input id="cp_sn" value="${esc(d.sn || '')}"></div>
      <div class="form-field"><label>配置（CPU/内存/硬盘）</label><input id="cp_cfg" value="${esc(d.config || '')}"></div>
      <div class="form-field"><label>使用者</label><input id="cp_user" value="${esc(d.user_name || '')}"></div>
      <div class="form-field"><label>使用部门</label><input id="cp_dept" value="${esc(d.department || '')}"></div>
      <div class="form-field full"><label>存放位置</label><input id="cp_loc" value="${esc(d.location || '')}"></div>
      <div class="form-field"><label>IP地址</label><input id="cp_ip" value="${esc(d.ip || '')}"></div>
      <div class="form-field"><label>MAC地址</label><input id="cp_mac" value="${esc(d.mac || '')}"></div>
      <div class="form-field"><label>采购日期</label><input type="date" id="cp_buy" value="${esc(d.purchase_date || '')}"></div>
      <div class="form-field"><label>保修期至</label><input type="date" id="cp_warr" value="${esc(d.warranty_until || '')}"></div>
      <div class="form-field"><label>状态</label><select id="cp_status"><option ${(d.status || '在用') === '在用' ? 'selected' : ''}>在用</option><option ${d.status === '闲置' ? 'selected' : ''}>闲置</option><option ${d.status === '报废' ? 'selected' : ''}>报废</option></select></div>
      <div class="form-field full"><label>备注</label><input id="cp_remark" value="${esc(d.remark || '')}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>', null, true);
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = {
      asset_no: $('#cp_no').value.trim(), hostname: $('#cp_host').value.trim(),
      brand: $('#cp_brand').value.trim(), model: $('#cp_model').value.trim(),
      sn: $('#cp_sn').value.trim(), config: $('#cp_cfg').value.trim(),
      user_name: $('#cp_user').value.trim(), department: $('#cp_dept').value.trim(),
      location: $('#cp_loc').value.trim(), ip: $('#cp_ip').value.trim(),
      mac: $('#cp_mac').value.trim(), purchase_date: $('#cp_buy').value,
      warranty_until: $('#cp_warr').value, status: $('#cp_status').value,
      remark: $('#cp_remark').value.trim()
    };
    try {
      if (x) await api('/computers/' + x.id, 'PUT', body); else await api('/computers', 'POST', body);
      toast('已保存'); closeModal(); renderComputers();
    } catch (e) { toast(e.message, 'err'); }
  };
}

async function computerDetail(x) {
  const r = await api('/computers/' + x.id);
  const c = r.data, repairs = r.repairs || [];
  openModal(`电脑详情${c.asset_no ? ' · ' + esc(c.asset_no) : ''}`, `
    <div class="form-grid" style="margin-bottom:12px">
      <div class="form-field"><label>主机名</label><div>${esc(c.hostname || '—')}</div></div>
      <div class="form-field"><label>品牌型号</label><div>${esc(c.brand)} ${esc(c.model)}</div></div>
      <div class="form-field"><label>序列号</label><div>${esc(c.sn || '—')}</div></div>
      <div class="form-field"><label>配置</label><div>${esc(c.config || '—')}</div></div>
      <div class="form-field"><label>使用者</label><div>${esc(c.user_name || '—')}</div></div>
      <div class="form-field"><label>部门</label><div>${esc(c.department || '—')}</div></div>
      <div class="form-field"><label>位置</label><div>${esc(c.location || '—')}</div></div>
      <div class="form-field"><label>IP / MAC</label><div>${esc(c.ip || '—')} / ${esc(c.mac || '—')}</div></div>
      <div class="form-field"><label>采购 / 保修至</label><div>${esc(c.purchase_date || '—')} / ${esc(c.warranty_until || '—')}</div></div>
      <div class="form-field"><label>状态</label><div>${statusBadge(c.status)}</div></div>
      <div class="form-field full"><label>备注</label><div>${esc(c.remark || '—')}</div></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <b style="font-size:14px">🛠️ 维修 / 变更记录（${repairs.length}）</b>
      <button class="btn btn-primary btn-sm" id="addCpRepair">＋ 新增记录</button>
    </div>
    <div id="cpRepairList">${repairs.length ? repairs.map(x => `
      <div class="detail-row">
        <div class="detail-main"><div class="detail-title">${x.type === '变更' ? '🔄' : '🔧'} ${esc(x.type)} · ${esc(x.detail)}</div>
        <div class="detail-sub">${esc(x.record_time)}${x.operator ? ' · ' + esc(x.operator) : ''}${x.cost ? ' · 费用 ' + x.cost : ''}${x.remark ? ' · ' + esc(x.remark) : ''}</div></div>
        <div class="ops"><button class="btn btn-sm" data-a="edit" data-id="${x.id}">编辑</button>
        <button class="btn btn-sm btn-danger" data-a="del" data-id="${x.id}">删</button></div>
      </div>`).join('') : '<div class="empty" style="padding:16px">暂无维修/变更记录</div>'}</div>`,
    '<button class="btn btn-primary" data-a="close">关闭</button>', null, true);
  $('#modalFoot').querySelector('[data-a=close]').onclick = closeModal;
  $('#addCpRepair').onclick = () => cpRepairForm(c.id, null, () => computerDetail(x));
  $('#cpRepairList').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = +b.dataset.id, rep = repairs.find(v => v.id === id);
    if (b.dataset.a === 'edit') cpRepairForm(c.id, rep, () => computerDetail(x));
    if (b.dataset.a === 'del') confirmModal('删除记录', '确定删除该维修/变更记录吗？', async () => {
      try { await api('/computer-repairs/' + id, 'DELETE'); toast('已删除'); computerDetail(x); } catch (e) { toast(e.message, 'err'); }
    });
  };
}

function cpRepairForm(cid, rep, refresh) {
  const d = rep || {};
  openModal(rep ? '编辑记录' : '新增维修/变更记录', `
    <div class="form-grid">
      <div class="form-field"><label>类型</label><select id="cr_type"><option ${(d.type || '维修') === '维修' ? 'selected' : ''}>维修</option><option ${d.type === '变更' ? 'selected' : ''}>变更</option></select></div>
      <div class="form-field"><label>时间</label><input type="date" id="cr_time" value="${esc(d.record_time || today())}"></div>
      <div class="form-field full"><label>内容描述 *</label><textarea id="cr_detail">${esc(d.detail || '')}</textarea></div>
      <div class="form-field"><label>经办人</label><input id="cr_op" value="${esc(d.operator || '')}"></div>
      <div class="form-field"><label>费用（元）</label><input id="cr_cost" type="number" value="${esc(d.cost || '')}"></div>
      <div class="form-field full"><label>备注</label><input id="cr_remark" value="${esc(d.remark || '')}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = { computer_id: cid, type: $('#cr_type').value, detail: $('#cr_detail').value.trim(), record_time: $('#cr_time').value, operator: $('#cr_op').value.trim(), cost: $('#cr_cost').value || 0, remark: $('#cr_remark').value.trim() };
    if (!body.detail) { toast('请填写内容描述', 'err'); return; }
    try {
      if (rep) await api('/computer-repairs/' + rep.id, 'PUT', body); else await api('/computer-repairs', 'POST', body);
      toast('已保存'); closeModal(); refresh();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 办公电脑优化记录（内存/硬盘升级） ============ */
/* ============ 行政办公电脑配件更换记录 ============ */
let pcReplaceList = [];
async function renderPcReplace(tab) {
  const cur = tab || 'records';
  const c = $('#content');
  c.innerHTML = `
    <div class="tabs" data-mod="pcReplace">
      <div class="tab ${cur === 'records' ? 'active' : ''}" data-t="records">🧰 更换记录</div>
      <div class="tab ${cur === 'monitors' ? 'active' : ''}" data-t="monitors">🖥️ 显示器统计</div>
      <div class="tab ${cur === 'computers' ? 'active' : ''}" data-t="computers">💻 大厅电脑</div>
      <div class="tab ${cur === 'stock' ? 'active' : ''}" data-t="stock">📦 配件库存</div>
      <div class="tab ${cur === 'stockin' ? 'active' : ''}" data-t="stockin">📥 入库记录</div>
    </div>
    <div id="prPage"></div>`;
  $$('.tab', c).forEach(t => t.onclick = () => renderPcReplace(t.dataset.t));
  const page = $('#prPage');
  if (cur === 'records') await renderPcReplaceRecords(page);
  if (cur === 'monitors') await renderPcMonitors(page);
  if (cur === 'computers') await renderPcHallComputers(page);
  if (cur === 'stock') await renderPcStock(page);
  if (cur === 'stockin') await renderPcStockIn(page);
}

async function renderPcReplaceRecords(page) {
  // 保留当前筛选状态：刷新/保存后不重置搜索词
  const prevQ = $('#prSearch') ? $('#prSearch').value : '';
  const c = page;
  c.innerHTML = `
    <div class="stat-grid" id="prStats" style="margin-bottom:14px"></div>
    <div class="toolbar">
      <input type="text" id="prSearch" placeholder="搜索姓名/部门/位置/配件/序列号/备注" class="grow">
      <button class="btn" id="prImport" data-perm="pcReplace:edit">📥 模板导入</button>
      <input type="file" id="prFile" accept=".xlsx,.xls" style="display:none">
      <button class="btn" id="prExport">📤 导出</button>
      <button class="btn btn-primary" id="prAdd" data-perm="pcReplace:edit">＋ 新增记录</button>
    </div>
    <div class="tz-batch" id="prBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="prBody"></tbody></table></div>
      <div class="empty" id="prEmpty" style="display:none">暂无配件更换记录，可点右上角「＋ 新增记录」或「📥 模板导入」</div>
      <div class="tz-pager" id="prPager"></div>
    </div>`;
  const r = await api('/pc-replace');
  pcReplaceList = r.data;
  if ($('#prSearch')) $('#prSearch').value = prevQ;
  // 统计卡片（可点击）
  const upNow = new Date();
  const upYm = upNow.getFullYear() + '-' + String(upNow.getMonth() + 1).padStart(2, '0');
  const prMonth = pcReplaceList.filter(x => (x.record_time || '').slice(0, 7) === upYm).length;
  const prRep = pcReplaceList.filter(x => x.replaced === '是').length;
  const prRet = pcReplaceList.filter(x => x.returned === '是').length;
  $('#prStats').innerHTML = statCardsHTML([
    { ico: '🧰', cls: 'blue', n: pcReplaceList.length, t: '更换记录' },
    { ico: '🗓️', cls: 'green', n: prMonth, t: '本月更换' },
    { ico: '🔧', cls: 'cyan', n: prRep, t: '已更换' },
    { ico: '📦', cls: 'warn', n: prRet, t: '已返厂' },
  ]);
  const tz = new TZTable($('#prBody').closest('.table-wrap'), {
    id: 'pcreplace_prBody',
    perm: 'pcReplace',
    columns: [
      { key: 'user_name', label: '姓名' },
      { key: 'department', label: '部门' },
      { key: 'location', label: '位置' },
      { key: 'part_name', label: '配件' },
      { key: 'replaced', label: '是否更换', render: v => v === '是' ? '<span class="badge badge-green">是</span>' : '<span class="badge badge-gray">否</span>' },
      { key: 'returned', label: '是否返厂', render: v => v === '是' ? '<span class="badge badge-orange">是</span>' : '<span class="badge badge-gray">否</span>' },
      { key: 'monitor_sn', label: '显示器序列号', render: v => esc(v || '—') },
      { key: 'part_qty', label: '备件数量', render: v => esc(v || '—') },
      { key: 'remark', label: '备注', render: v => `<span style="max-width:160px">${esc(v || '—')}</span>` },
      { key: 'record_time', label: '记录时间' },
    ],
    ops: [
      { label: '编辑', cls: 'btn-primary', act: 'edit' },
      { label: '删除', cls: 'btn-danger', act: 'del' },
    ],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['user_name', 'department', 'location', 'part_name', 'monitor_sn', 'remark'],
    searchBox: '#prSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#prBatch', pagerEl: '#prPager', emptyEl: '#prEmpty',
    data: pcReplaceList,
    onRowOps: (act, x) => {
      if (act === 'edit') pcReplaceForm(x);
      if (act === 'del') confirmModal('删除记录', `确定删除「${x.user_name} · ${x.part_name}」的更换记录吗？`, async () => {
        try {
          const r = await api('/pc-replace/' + x.id, 'DELETE'); toast(r && r.warn ? ('已删除。' + r.warn) : '已删除');
          pcReplaceList = pcReplaceList.filter(v => v.id !== x.id);   // 局部移除，保留筛选/滚动位置
          tz.setData(pcReplaceList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条更换记录吗？`, async () => {
        let ok = 0, warns = [];
        for (const r of rows) { try { const res = await api('/pc-replace/' + r.id, 'DELETE'); ok++; if (res && res.warn) warns.push(res.warn); } catch (e) {} }
        pcReplaceList = pcReplaceList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(pcReplaceList);
        toast(warns.length ? ('已删除 ' + ok + ' 条。' + warns.join('；')) : ('已删除 ' + ok + ' 条'));
      });
      if (act === 'export') exportRowsCSV('配件更换_选中导出.csv', ['姓名', '部门', '位置', '配件', '是否更换', '是否返厂', '显示器序列号', '备件数量', '备注', '记录时间'], rows, ['user_name', 'department', 'location', 'part_name', 'replaced', 'returned', 'monitor_sn', 'part_qty', 'remark', 'record_time']);
    },
  });
  bindStatClick($('#prStats'), [
    () => { $('#prSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#prSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#prSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#prSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
  ]);
  $('#prImport').onclick = () => $('#prFile').click();
  $('#prFile').onchange = async () => {
    const f = $('#prFile').files[0]; if (!f) { $('#prFile').value = ''; return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/pc-replace/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        toast(d.error || '导入失败', 'err');
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
      } else { toast('模板导入成功 ' + d.added + ' 条'); renderPcReplace(); }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    $('#prFile').value = '';
  };
  $('#prExport').onclick = () => downloadExport(expUrl('/api/pc-replace/export', { q: $('#prSearch').value.trim() }));
  $('#prAdd').onclick = () => pcReplaceForm(null);
}

async function pcReplaceForm(x) {
  if (!pcReplaceList.length) { try { const r = await api('/pc-replace'); pcReplaceList = r.data || []; } catch (e) {} }
  if (!pcStockList.length) { try { const r = await api('/pc-part-stock'); pcStockList = r.data || []; } catch (e) {} }
  const d = x || {};
  // 下拉候选：历史更换记录去重 + 配件库存建档（名称/存放位置）并入
  const uni = (arr) => [...new Set(arr.map(v => (v || '').trim()).filter(Boolean))];
  const snSet = uni((pcReplaceList || []).map(v => v.monitor_sn));
  const deptSet = uni((pcReplaceList || []).map(v => v.department));
  const locSet = uni((pcReplaceList || []).map(v => v.location));
  const partSet = uni([...(pcReplaceList || []).map(v => v.part_name), ...(pcStockList || []).map(v => v.name)]);
  const storageSet = uni([...(pcReplaceList || []).map(v => v.storage), ...(pcStockList || []).map(v => v.storage_location)]);
  openModal(x ? '编辑更换记录' : '新增更换记录', `
    <div class="form-grid">
      <div class="form-field"><label>姓名</label><input id="pr_name" value="${esc(d.user_name || '')}"></div>
      <div class="form-field"><label>部门</label><input id="pr_dept" value="${esc(d.department || '')}" list="prDeptList" placeholder="下拉选择或输入"><datalist id="prDeptList">${deptSet.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div class="form-field"><label>位置</label><input id="pr_loc" value="${esc(d.location || '')}" list="prLocList" placeholder="下拉选择或输入"><datalist id="prLocList">${locSet.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div class="form-field"><label>配件（类型）</label><input id="pr_part" value="${esc(d.part_name || '')}" list="prPartList" placeholder="下拉选择或输入"><datalist id="prPartList">${partSet.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div class="form-field"><label>是否更换</label><select id="pr_rep"><option ${(d.replaced || '是') === '是' ? 'selected' : ''}>是</option><option ${d.replaced === '否' ? 'selected' : ''}>否</option></select></div>
      <div class="form-field"><label>是否返厂</label><select id="pr_ret"><option ${d.returned === '是' ? 'selected' : ''}>是</option><option ${(d.returned || '否') === '否' ? 'selected' : ''}>否</option></select></div>
      <div class="form-field"><label>显示器序列号</label><input id="pr_sn" list="prSnList" value="${esc(d.monitor_sn || '')}" placeholder="输入或下拉选择，自动带出历史信息"><datalist id="prSnList">${snSet.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div class="form-field"><label>备件数量</label><input id="pr_qty" value="${esc(d.part_qty || '')}" placeholder="如 电源:2"></div>
      <div class="form-field"><label>存放位置</label><input id="pr_storage" value="${esc(d.storage || '')}" list="prStorageList" placeholder="下拉选择或输入"><datalist id="prStorageList">${storageSet.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
      <div class="form-field"><label>记录时间</label><input type="date" id="pr_time" value="${esc(d.record_time || '')}"></div>
      <div class="form-field full"><label>备注</label><input id="pr_remark" value="${esc(d.remark || '')}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>', null, true);
  // 显示器序列号 → 自动带出该显示器最近一次更换记录中的信息
  const snInput = $('#pr_sn');
  snInput.addEventListener('input', () => {
    const vv = snInput.value.trim();
    if (!vv) return;
    let hit = null;
    for (const r of pcReplaceList) {
      if (r.monitor_sn && r.monitor_sn.trim() === vv) hit = r;   // 保留最后一条（id 递增 = 最新）
    }
    if (!hit) return;
    const set = (id, v) => { const el = $(id); if (el && el !== snInput) el.value = v; };
    set('#pr_name', hit.user_name || '');
    set('#pr_dept', hit.department || '');
    set('#pr_loc', hit.location || '');
    set('#pr_part', hit.part_name || '');
    set('#pr_rep', hit.replaced || '是');
    set('#pr_ret', hit.returned || '否');
    set('#pr_qty', hit.part_qty || '');
    set('#pr_storage', hit.storage || '');
    set('#pr_remark', hit.remark || '');
    toast('已自动带出该显示器历史信息，可修改');
  });
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = {
      user_name: $('#pr_name').value.trim(), department: $('#pr_dept').value.trim(),
      location: $('#pr_loc').value.trim(), part_name: $('#pr_part').value.trim(),
      replaced: $('#pr_rep').value, returned: $('#pr_ret').value,
      monitor_sn: $('#pr_sn').value.trim(), part_qty: $('#pr_qty').value.trim(),
      storage: $('#pr_storage').value.trim(), remark: $('#pr_remark').value.trim(),
      record_time: $('#pr_time').value
    };
    try {
      const r = x ? await api('/pc-replace/' + x.id, 'PUT', body) : await api('/pc-replace', 'POST', body);
      toast(r && r.warn ? ('已保存。' + r.warn) : '已保存');
      closeModal(); renderPcReplace('records');
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ---- 配件更换 Tab2：显示器统计 ---- */
let pcMonitorList = [];
async function renderPcMonitors(page) {
  const prevQ = $('#pmSearch') ? $('#pmSearch').value : '';
  const c = page;
  c.innerHTML = `
    <div class="stat-grid" id="pmStats" style="margin-bottom:14px"></div>
    <div class="toolbar">
      <input type="text" id="pmSearch" placeholder="搜索区域/部门/位置" class="grow">
      <button class="btn" id="pmImport" data-perm="pcReplace:edit">📥 模板导入</button>
      <input type="file" id="pmFile" accept=".xlsx,.xls" style="display:none">
      <button class="btn" id="pmExport">📤 导出</button>
      <button class="btn btn-primary" id="pmAdd" data-perm="pcReplace:edit">＋ 新增记录</button>
    </div>
    <div class="tz-batch" id="pmBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="pmBody"></tbody></table></div>
      <div class="empty" id="pmEmpty" style="display:none">暂无显示器统计，可点右上角「＋ 新增记录」或「📥 模板导入」</div>
      <div class="tz-pager" id="pmPager"></div>
    </div>`;
  const r = await api('/pc-monitors');
  pcMonitorList = r.data;
  if ($('#pmSearch')) $('#pmSearch').value = prevQ;
  // 统计卡片（可点击）
  const pmTotal = pcMonitorList.reduce((s, x) => s + (x.monitor_count || 0), 0);
  const pmArea = new Set(pcMonitorList.map(x => x.area).filter(Boolean)).size;
  const pmDept = new Set(pcMonitorList.map(x => x.department).filter(Boolean)).size;
  $('#pmStats').innerHTML = statCardsHTML([
    { ico: '🖥️', cls: 'blue', n: pcMonitorList.length, t: '统计位置' },
    { ico: '📺', cls: 'green', n: pmTotal, t: '显示器总数' },
    { ico: '🗺️', cls: 'cyan', n: pmArea, t: '覆盖区域' },
    { ico: '🏢', cls: 'warn', n: pmDept, t: '覆盖部门' },
  ]);
  const tz = new TZTable($('#pmBody').closest('.table-wrap'), {
    id: 'pcreplace_pmBody',
    perm: 'pcReplace',
    columns: [
      { key: 'area', label: '区域', render: v => esc(v || '—') },
      { key: 'department', label: '部门', render: v => esc(v || '—') },
      { key: 'location', label: '位置' },
      { key: 'monitor_count', label: '显示器数量', render: v => `<span class="badge badge-blue">${v || 0}</span>` },
    ],
    ops: [
      { label: '编辑', cls: 'btn-primary', act: 'edit' },
      { label: '删除', cls: 'btn-danger', act: 'del' },
    ],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['area', 'department', 'location'],
    searchBox: '#pmSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#pmBatch', pagerEl: '#pmPager', emptyEl: '#pmEmpty',
    data: pcMonitorList,
    onRowOps: (act, x) => {
      if (act === 'edit') pcMonitorForm(x);
      if (act === 'del') confirmModal('删除记录', `确定删除「${x.location}」的显示器统计吗？`, async () => {
        try {
          await api('/pc-monitors/' + x.id, 'DELETE'); toast('已删除');
          pcMonitorList = pcMonitorList.filter(v => v.id !== x.id);   // 局部移除，保留筛选/滚动位置
          tz.setData(pcMonitorList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条显示器统计吗？`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/pc-monitors/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        pcMonitorList = pcMonitorList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(pcMonitorList); toast('已删除 ' + ok + ' 条');
      });
      if (act === 'export') exportRowsCSV('显示器统计_选中导出.csv', ['区域', '部门', '位置', '显示器数量'], rows, ['area', 'department', 'location', 'monitor_count']);
    },
  });
  bindStatClick($('#pmStats'), [
    () => { $('#pmSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#pmSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#pmSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#pmSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
  ]);
  $('#pmImport').onclick = () => $('#pmFile').click();
  $('#pmFile').onchange = async () => {
    const f = $('#pmFile').files[0]; if (!f) { $('#pmFile').value = ''; return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/pc-monitors/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        toast(d.error || '导入失败', 'err');
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
      } else { toast('模板导入成功 ' + d.added + ' 条'); renderPcReplace('monitors'); }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    $('#pmFile').value = '';
  };
  $('#pmExport').onclick = () => downloadExport(expUrl('/api/pc-monitors/export', { q: $('#pmSearch').value.trim() }));
  $('#pmAdd').onclick = () => pcMonitorForm(null);
}

function pcMonitorForm(x) {
  const d = x || {};
  openModal(x ? '编辑显示器统计' : '新增显示器统计', `
    <div class="form-grid">
      <div class="form-field"><label>区域</label><input id="pm_area" value="${esc(d.area || '')}"></div>
      <div class="form-field"><label>部门</label><input id="pm_dept" value="${esc(d.department || '')}"></div>
      <div class="form-field"><label>位置</label><input id="pm_loc" value="${esc(d.location || '')}"></div>
      <div class="form-field"><label>显示器数量</label><input id="pm_cnt" type="number" min="0" value="${d.monitor_count || 1}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>', null, true);
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = {
      area: $('#pm_area').value.trim(), department: $('#pm_dept').value.trim(),
      location: $('#pm_loc').value.trim(), monitor_count: $('#pm_cnt').value || 0
    };
    try {
      if (x) await api('/pc-monitors/' + x.id, 'PUT', body); else await api('/pc-monitors', 'POST', body);
      toast('已保存'); closeModal(); renderPcReplace('monitors');
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ---- 配件更换 Tab3：大厅电脑信息 ---- */
let pcHallList = [];
async function renderPcHallComputers(page) {
  const prevQ = $('#phSearch') ? $('#phSearch').value : '';
  const c = page;
  c.innerHTML = `
    <div class="stat-grid" id="phStats" style="margin-bottom:14px"></div>
    <div class="toolbar">
      <input type="text" id="phSearch" placeholder="搜索区域/部门/位置/IP/使用人" class="grow">
      <button class="btn" id="phImport" data-perm="pcReplace:edit">📥 模板导入</button>
      <input type="file" id="phFile" accept=".xlsx,.xls" style="display:none">
      <button class="btn" id="phExport">📤 导出</button>
      <button class="btn btn-primary" id="phAdd" data-perm="pcReplace:edit">＋ 新增记录</button>
    </div>
    <div class="tz-batch" id="phBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="phBody"></tbody></table></div>
      <div class="empty" id="phEmpty" style="display:none">暂无大厅电脑信息，可点右上角「＋ 新增记录」或「📥 模板导入」</div>
      <div class="tz-pager" id="phPager"></div>
    </div>`;
  const r = await api('/pc-hall-computers');
  pcHallList = r.data;
  if ($('#phSearch')) $('#phSearch').value = prevQ;
  // 统计卡片（可点击）
  const phIp = pcHallList.filter(x => x.ip).length;
  const phArea = new Set(pcHallList.map(x => x.area).filter(Boolean)).size;
  const phDept = new Set(pcHallList.map(x => x.department).filter(Boolean)).size;
  $('#phStats').innerHTML = statCardsHTML([
    { ico: '💻', cls: 'blue', n: pcHallList.length, t: '电脑总数' },
    { ico: '🌐', cls: 'green', n: phIp, t: '已配置IP' },
    { ico: '🗺️', cls: 'cyan', n: phArea, t: '覆盖区域' },
    { ico: '🏢', cls: 'warn', n: phDept, t: '覆盖部门' },
  ]);
  const tz = new TZTable($('#phBody').closest('.table-wrap'), {
    id: 'pcreplace_phBody',
    perm: 'pcReplace',
    columns: [
      { key: 'area', label: '区域', render: v => esc(v || '—') },
      { key: 'department', label: '部门', render: v => esc(v || '—') },
      { key: 'location', label: '位置' },
      { key: 'ip', label: 'IP地址', render: v => esc(v || '—') },
      { key: 'user_name', label: '使用人', render: v => esc(v || '—') },
    ],
    ops: [
      { label: '编辑', cls: 'btn-primary', act: 'edit' },
      { label: '删除', cls: 'btn-danger', act: 'del' },
    ],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['area', 'department', 'location', 'ip', 'user_name'],
    searchBox: '#phSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#phBatch', pagerEl: '#phPager', emptyEl: '#phEmpty',
    data: pcHallList,
    onRowOps: (act, x) => {
      if (act === 'edit') pcHallForm(x);
      if (act === 'del') confirmModal('删除记录', `确定删除「${x.location} · ${x.user_name || ''}」的电脑信息吗？`, async () => {
        try {
          await api('/pc-hall-computers/' + x.id, 'DELETE'); toast('已删除');
          pcHallList = pcHallList.filter(v => v.id !== x.id);   // 局部移除，保留筛选/滚动位置
          tz.setData(pcHallList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条电脑信息吗？`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/pc-hall-computers/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        pcHallList = pcHallList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(pcHallList); toast('已删除 ' + ok + ' 条');
      });
      if (act === 'export') exportRowsCSV('大厅电脑_选中导出.csv', ['区域', '部门', '位置', 'IP地址', '使用人'], rows, ['area', 'department', 'location', 'ip', 'user_name']);
    },
  });
  bindStatClick($('#phStats'), [
    () => { $('#phSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#phSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#phSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#phSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
  ]);
  $('#phImport').onclick = () => $('#phFile').click();
  $('#phFile').onchange = async () => {
    const f = $('#phFile').files[0]; if (!f) { $('#phFile').value = ''; return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/pc-hall-computers/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        toast(d.error || '导入失败', 'err');
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
      } else { toast('模板导入成功 ' + d.added + ' 条'); renderPcReplace('computers'); }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    $('#phFile').value = '';
  };
  $('#phExport').onclick = () => downloadExport(expUrl('/api/pc-hall-computers/export', { q: $('#phSearch').value.trim() }));
  $('#phAdd').onclick = () => pcHallForm(null);
}

function pcHallForm(x) {
  const d = x || {};
  openModal(x ? '编辑大厅电脑' : '新增大厅电脑', `
    <div class="form-grid">
      <div class="form-field"><label>区域</label><input id="ph_area" value="${esc(d.area || '')}"></div>
      <div class="form-field"><label>部门</label><input id="ph_dept" value="${esc(d.department || '')}"></div>
      <div class="form-field"><label>位置</label><input id="ph_loc" value="${esc(d.location || '')}"></div>
      <div class="form-field"><label>IP地址</label><input id="ph_ip" value="${esc(d.ip || '')}" placeholder="如 10.132.3.2"></div>
      <div class="form-field full"><label>使用人</label><input id="ph_user" value="${esc(d.user_name || '')}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>', null, true);
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = {
      area: $('#ph_area').value.trim(), department: $('#ph_dept').value.trim(),
      location: $('#ph_loc').value.trim(), ip: $('#ph_ip').value.trim(),
      user_name: $('#ph_user').value.trim()
    };
    try {
      if (x) await api('/pc-hall-computers/' + x.id, 'PUT', body); else await api('/pc-hall-computers', 'POST', body);
      toast('已保存'); closeModal(); renderPcReplace('computers');
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ---- 配件更换 Tab4：配件库存 ---- */
let pcStockList = [];
async function renderPcStock(page) {
  const prevQ = $('#psSearch') ? $('#psSearch').value : '';
  const c = page;
  c.innerHTML = `
    <div class="stat-grid" id="psStats" style="margin-bottom:14px"></div>
    <div class="toolbar">
      <input type="text" id="psSearch" placeholder="搜索配件名称/规格/存放位置" class="grow">
      <button class="btn" id="psImport" data-perm="pcReplace:edit">📥 模板导入</button>
      <input type="file" id="psFile" accept=".xlsx,.xls" style="display:none">
      <button class="btn" id="psExport">📤 导出</button>
      <button class="btn btn-primary" id="psAdd" data-perm="pcReplace:edit">＋ 新增配件</button>
    </div>
    <div class="tz-batch" id="psBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="psBody"></tbody></table></div>
      <div class="empty" id="psEmpty" style="display:none">暂无配件库存，可点「＋ 新增配件」或在「📥 入库记录」登记入库自动建档</div>
      <div class="tz-pager" id="psPager"></div>
    </div>`;
  const r = await api('/pc-part-stock');
  pcStockList = r.data;
  if ($('#psSearch')) $('#psSearch').value = prevQ;
  // 统计卡片（可点击）
  const psTotal = pcStockList.reduce((s, x) => s + (x.stock || 0), 0);
  const psLow = pcStockList.filter(x => x.low_threshold > 0 && x.stock <= x.low_threshold).length;
  const psLoc = new Set(pcStockList.map(x => x.storage_location).filter(Boolean)).size;
  $('#psStats').innerHTML = statCardsHTML([
    { ico: '📦', cls: 'blue', n: pcStockList.length, t: '配件种类' },
    { ico: '🔢', cls: 'green', n: psTotal, t: '库存总量' },
    { ico: '⚠️', cls: 'warn', n: psLow, t: '低库存预警' },
    { ico: '🗄️', cls: 'cyan', n: psLoc, t: '存放位置' },
  ]);
  const tz = new TZTable($('#psBody').closest('.table-wrap'), {
    id: 'pcreplace_psBody',
    perm: 'pcReplace',
    columns: [
      { key: 'name', label: '配件名称' },
      { key: 'spec', label: '规格', render: v => esc(v || '—') },
      { key: 'unit', label: '单位' },
      { key: 'storage_location', label: '存放位置', render: v => v ? `<span class="badge badge-blue">${esc(v)}</span>` : '—' },
      { key: 'stock', label: '当前库存', render: (v, r) => `<span class="${r.low_threshold > 0 && v <= r.low_threshold ? 'badge badge-red' : ''}">${v}</span>` },
      { key: 'low_threshold', label: '低库存阈值', render: v => v || '—' },
      { key: 'remark', label: '备注', render: v => `<span style="max-width:160px">${esc(v || '—')}</span>` },
    ],
    ops: [
      { label: '📥 入库', cls: 'btn-success', act: 'in' },
      { label: '编辑', cls: 'btn-primary', act: 'edit' },
      { label: '删除', cls: 'btn-danger', act: 'del' },
    ],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['name', 'spec', 'storage_location', 'remark'],
    searchBox: '#psSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#psBatch', pagerEl: '#psPager', emptyEl: '#psEmpty',
    data: pcStockList,
    onRowOps: (act, x) => {
      if (act === 'in') pcStockInForm(null, x);
      if (act === 'edit') pcStockForm(x);
      if (act === 'del') confirmModal('删除配件', `确定删除配件「${x.name}」吗？（库存必须为 0）`, async () => {
        try {
          await api('/pc-part-stock/' + x.id, 'DELETE'); toast('已删除');
          pcStockList = pcStockList.filter(v => v.id !== x.id);
          tz.setData(pcStockList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 个配件吗？（库存必须为 0）`, async () => {
        let ok = 0, fail = 0;
        for (const r of rows) { try { await api('/pc-part-stock/' + r.id, 'DELETE'); ok++; } catch (e) { fail++; } }
        pcStockList = pcStockList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(pcStockList); toast('已删除 ' + ok + ' 个' + (fail ? '，失败 ' + fail + ' 个' : ''));
      });
      if (act === 'export') exportRowsCSV('配件库存_选中导出.csv', ['配件名称', '规格', '单位', '存放位置', '当前库存', '低库存阈值', '备注'], rows, ['name', 'spec', 'unit', 'storage_location', 'stock', 'low_threshold', 'remark']);
    },
  });
  bindStatClick($('#psStats'), [
    () => { $('#psSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#psSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#psSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#psSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
  ]);
  $('#psImport').onclick = () => $('#psFile').click();
  $('#psFile').onchange = async () => {
    const f = $('#psFile').files[0]; if (!f) { $('#psFile').value = ''; return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/pc-part-stock/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        toast(d.error || '导入失败', 'err');
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
      } else { toast('模板导入成功 ' + d.added + ' 条'); renderPcReplace('stock'); }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    $('#psFile').value = '';
  };
  $('#psExport').onclick = () => downloadExport(expUrl('/api/pc-part-stock/export', { q: $('#psSearch').value.trim() }));
  $('#psAdd').onclick = () => pcStockForm(null);
}

function pcStockForm(x) {
  const d = x || {};
  openModal(x ? '编辑配件' : '新增配件', `
    <div class="form-grid">
      <div class="form-field"><label>配件名称 *</label><input id="ps_name" value="${esc(d.name || '')}" placeholder="如 显示器电源"></div>
      <div class="form-field"><label>规格</label><input id="ps_spec" value="${esc(d.spec || '')}"></div>
      <div class="form-field"><label>单位</label><input id="ps_unit" value="${esc(d.unit || '个')}"></div>
      <div class="form-field"><label>存放位置</label><input id="ps_loc" value="${esc(d.storage_location || '')}" placeholder="如 文件柜8-2 / 办公楼"></div>
      ${x ? '<div class="form-field"><label>当前库存</label><input value="' + esc(d.stock || 0) + '" disabled style="background:#f8fafc"></div>' : ''}
      <div class="form-field"><label>低库存预警阈值</label><input id="ps_th" type="number" min="0" value="${esc(d.low_threshold || '')}" placeholder="0=不预警"></div>
      <div class="form-field full"><label>备注</label><input id="ps_remark" value="${esc(d.remark || '')}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>', null, true);
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = {
      name: $('#ps_name').value.trim(), spec: $('#ps_spec').value.trim(),
      unit: $('#ps_unit').value.trim() || '个', storage_location: $('#ps_loc').value.trim(),
      low_threshold: $('#ps_th').value || 0, remark: $('#ps_remark').value.trim()
    };
    if (!body.name) { toast('请填写配件名称', 'err'); return; }
    try {
      if (x) await api('/pc-part-stock/' + x.id, 'PUT', body); else await api('/pc-part-stock', 'POST', body);
      toast('已保存'); closeModal(); renderPcReplace('stock');
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ---- 配件更换 Tab5：入库记录 ---- */
let pcStockInList = [];
async function renderPcStockIn(page) {
  const prevQ = $('#psiSearch') ? $('#psiSearch').value : '';
  const c = page;
  c.innerHTML = `
    <div class="stat-grid" id="psiStats" style="margin-bottom:14px"></div>
    <div class="toolbar">
      <input type="text" id="psiSearch" placeholder="搜索配件/经手人/存放位置/备注" class="grow">
      <button class="btn" id="psiImport" data-perm="pcReplace:edit">📥 模板导入</button>
      <input type="file" id="psiFile" accept=".xlsx,.xls" style="display:none">
      <button class="btn" id="psiExport">📤 导出</button>
      <button class="btn btn-primary" id="psiAdd" data-perm="pcReplace:edit">＋ 登记入库</button>
    </div>
    <div class="tz-batch" id="psiBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="psiBody"></tbody></table></div>
      <div class="empty" id="psiEmpty" style="display:none">暂无入库记录，「＋ 登记入库」记录采购入库并自动增加配件库存</div>
      <div class="tz-pager" id="psiPager"></div>
    </div>`;
  const r = await api('/pc-part-stock-in');
  pcStockInList = r.data;
  if ($('#psiSearch')) $('#psiSearch').value = prevQ;
  // 统计卡片（可点击）
  const upNow = new Date();
  const upYm = upNow.getFullYear() + '-' + String(upNow.getMonth() + 1).padStart(2, '0');
  const psiQty = pcStockInList.reduce((s, x) => s + (x.qty || 0), 0);
  const psiMonth = pcStockInList.filter(x => (x.record_time || '').slice(0, 7) === upYm).reduce((s, x) => s + (x.qty || 0), 0);
  const psiPart = new Set(pcStockInList.map(x => x.part_name).filter(Boolean)).size;
  $('#psiStats').innerHTML = statCardsHTML([
    { ico: '📥', cls: 'blue', n: pcStockInList.length, t: '入库次数' },
    { ico: '🔢', cls: 'green', n: psiQty, t: '入库总量' },
    { ico: '🗓️', cls: 'cyan', n: psiMonth, t: '本月入库' },
    { ico: '📦', cls: 'warn', n: psiPart, t: '涉及配件' },
  ]);
  const tz = new TZTable($('#psiBody').closest('.table-wrap'), {
    id: 'pcreplace_psiBody',
    perm: 'pcReplace',
    columns: [
      { key: 'part_name', label: '配件名称' },
      { key: 'spec', label: '规格', render: v => esc(v || '—') },
      { key: 'qty', label: '入库数量', render: v => `<span class="badge badge-green">+${v}</span>` },
      { key: 'after_stock', label: '入库后库存' },
      { key: 'storage_location', label: '存放位置', render: v => v ? `<span class="badge badge-blue">${esc(v)}</span>` : '—' },
      { key: 'operator', label: '经手人', render: v => esc(v || '—') },
      { key: 'record_time', label: '入库时间' },
      { key: 'remark', label: '备注', render: v => `<span style="max-width:160px">${esc(v || '—')}</span>` },
    ],
    ops: [{ label: '删除', cls: 'btn-danger', act: 'del' }],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['part_name', 'spec', 'operator', 'storage_location', 'remark'],
    searchBox: '#psiSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#psiBatch', pagerEl: '#psiPager', emptyEl: '#psiEmpty',
    data: pcStockInList,
    onRowOps: (act, x) => {
      if (act === 'del') confirmModal('删除入库记录', `确定删除「${x.part_name}」的入库记录吗？\n（对应配件库存将自动扣减 ${x.qty}）`, async () => {
        try {
          await api('/pc-part-stock-in/' + x.id, 'DELETE'); toast('已删除');
          pcStockInList = pcStockInList.filter(v => v.id !== x.id);
          tz.setData(pcStockInList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条入库记录吗？对应配件库存将自动扣减。`, async () => {
        let ok = 0, fail = 0;
        for (const r of rows) { try { await api('/pc-part-stock-in/' + r.id, 'DELETE'); ok++; } catch (e) { fail++; } }
        pcStockInList = pcStockInList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(pcStockInList); toast('已删除 ' + ok + ' 条' + (fail ? '，失败 ' + fail + ' 条' : ''));
      });
      if (act === 'export') exportRowsCSV('配件入库_选中导出.csv', ['配件名称', '规格', '入库数量', '入库后库存', '存放位置', '经手人', '入库时间', '备注'], rows, ['part_name', 'spec', 'qty', 'after_stock', 'storage_location', 'operator', 'record_time', 'remark']);
    },
  });
  bindStatClick($('#psiStats'), [
    () => { $('#psiSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#psiSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#psiSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { $('#psiSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
  ]);
  $('#psiImport').onclick = () => $('#psiFile').click();
  $('#psiFile').onchange = async () => {
    const f = $('#psiFile').files[0]; if (!f) { $('#psiFile').value = ''; return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/pc-part-stock-in/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        toast(d.error || '导入失败', 'err');
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
      } else { toast('模板导入成功 ' + d.added + ' 条'); renderPcReplace('stockin'); }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    $('#psiFile').value = '';
  };
  $('#psiExport').onclick = () => downloadExport(expUrl('/api/pc-part-stock-in/export', { q: $('#psiSearch').value.trim() }));
  $('#psiAdd').onclick = () => pcStockInForm(null);
}

function pcStockInForm(x, part) {
  const d = x || {};
  openModal('登记配件入库', `
    <div class="form-grid">
      <div class="form-field"><label>配件名称 *</label><input id="psi_name" value="${esc(part ? part.name : d.part_name || '')}" placeholder="不存在将自动创建库存条目"></div>
      <div class="form-field"><label>规格</label><input id="psi_spec" value="${esc(part ? part.spec : d.spec || '')}"></div>
      <div class="form-field"><label>入库数量 *</label><input id="psi_qty" type="number" min="1" value="${d.qty || ''}" placeholder="如 5"></div>
      <div class="form-field"><label>存放位置</label><input id="psi_loc" value="${esc(part ? part.storage_location : d.storage_location || '')}" placeholder="如 文件柜8-2"></div>
      <div class="form-field"><label>入库时间</label><input type="date" id="psi_time" value="${esc(d.record_time || '')}"></div>
      <div class="form-field"><label>经手人</label><input id="psi_op" value="${esc(d.operator || '')}" placeholder="空=当前用户"></div>
      <div class="form-field full"><label>备注</label><input id="psi_remark" value="${esc(d.remark || '')}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">确认入库</button>', null, true);
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = {
      part_name: $('#psi_name').value.trim(), spec: $('#psi_spec').value.trim(),
      qty: $('#psi_qty').value || 0, storage_location: $('#psi_loc').value.trim(),
      record_time: $('#psi_time').value, operator: $('#psi_op').value.trim(),
      remark: $('#psi_remark').value.trim()
    };
    if (!body.part_name) { toast('请填写配件名称', 'err'); return; }
    if (body.qty <= 0) { toast('入库数量必须大于 0', 'err'); return; }
    try {
      const r = await api('/pc-part-stock-in', 'POST', body);
      toast('入库成功，当前库存 ' + r.after_stock); closeModal(); renderPcReplace('stockin');
    } catch (e) { toast(e.message, 'err'); }
  };
}

async function renderOpt(tab) {
  const cur = tab || 'upgrades';
  const c = $('#content');
  c.innerHTML = `
    <div class="tabs" data-mod="pcopt">
      <div class="tab ${cur === 'upgrades' ? 'active' : ''}" data-t="upgrades">📋 优化记录</div>
      <div class="tab ${cur === 'parts' ? 'active' : ''}" data-t="parts">📦 备件库存</div>
      <div class="tab ${cur === 'flows' ? 'active' : ''}" data-t="flows">⇅ 出入库流水</div>
      <div class="tab ${cur === 'adjusts' ? 'active' : ''}" data-t="adjusts">⚖️ 调整记录</div>
    </div>
    <div id="optPage"></div>`;
  $$('.tab', c).forEach(t => t.onclick = () => renderOpt(t.dataset.t));
  const page = $('#optPage');
  if (cur === 'upgrades') await renderOptUpgrades(page);
  if (cur === 'parts') await renderOptParts(page);
  if (cur === 'flows') await renderOptFlows(page);
  if (cur === 'adjusts') await renderOptAdjusts(page);
}

let pcUpgradeList = [], pcPartList = [], pcFlowList = [], pcAdjustList = [], computerList4up = [];
function upItemText(it) {
  const nm = [it.brand, it.name, it.spec].filter(Boolean).join('/');
  return (nm || '未命名配件') + '×' + it.qty;
}
function upBrief(x) {
  if (x.items && x.items.length) return x.items.map(upItemText).join('、');
  // 旧数据兜底
  const parts = [];
  if (x.ram_8) parts.push('8G内存×' + x.ram_8);
  if (x.ram_16) parts.push('16G内存×' + x.ram_16);
  if (x.sata_ssd) parts.push('SATA固态×' + x.sata_ssd);
  if (x.m2_ssd) parts.push('M2固态×' + x.m2_ssd);
  if (x.hdd) parts.push('机械硬盘×' + x.hdd);
  return parts.length ? parts.join('、') : '—';
}
function upDeductedQty(x) {
  if (!x.items || !x.items.length) return x.part_id ? 1 : 0;
  return x.items.reduce((s, it) => s + (it.part_id ? (it.qty || 1) : 0), 0);
}

/* ---- Tab 1：优化记录 ---- */
async function renderOptUpgrades(page) {
  // 保留当前筛选状态：刷新/保存后不重置搜索词
  const prevQ = $('#upSearch') ? $('#upSearch').value : '';
  page.innerHTML = `
    <div class="stat-grid" id="upStats" style="margin-bottom:14px"></div>
    <div class="toolbar">
      <input type="text" id="upSearch" placeholder="搜索申请人/流程单号/资产编号/配件" class="grow">
      <button class="btn" id="upTemplate">⬇ 下载模板</button>
      <button class="btn" id="upImport" data-perm="pcopt:edit">📥 模板导入</button>
      <input type="file" id="upFile" accept=".xlsx,.xls" style="display:none">
      <button class="btn" id="upExport">📤 导出</button>
      <button class="btn btn-primary" id="upAdd" data-perm="pcopt:edit">＋ 新增记录</button>
    </div>
    <div class="tz-batch" id="upBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="pcOptBody"></tbody></table></div>
      <div class="empty" id="upEmpty" style="display:none">暂无优化记录，可点击右上角「＋ 新增记录」或「📥 模板导入」</div>
      <div class="tz-pager" id="upPager"></div>
    </div>`;
  const [r, rp] = await Promise.all([api('/pc-upgrades'), api('/pc-parts')]);
  pcUpgradeList = r.data;
  pcPartList = rp.data;
  // 恢复筛选状态（await 期间页面可能被并发渲染重建，DOM 需容错）
  if ($('#upSearch')) $('#upSearch').value = prevQ;
  // 统计卡片（可点击）
  const upNow = new Date();
  const upYm = upNow.getFullYear() + '-' + String(upNow.getMonth() + 1).padStart(2, '0');
  const upMonth = pcUpgradeList.filter(x => (x.upgrade_date || '').slice(0, 7) === upYm).length;
  const upDed = pcUpgradeList.filter(x => upDeductedQty(x) > 0).length;
  const upNoPart = pcUpgradeList.filter(x => !(x.items && x.items.length)).length;
  $('#upStats').innerHTML = statCardsHTML([
    { ico: '📋', cls: 'blue', n: pcUpgradeList.length, t: '优化记录' },
    { ico: '🗓️', cls: 'green', n: upMonth, t: '本月记录' },
    { ico: '🔗', cls: 'cyan', n: upDed, t: '已关联库存' },
    { ico: '🛠️', cls: 'warn', n: upNoPart, t: '待补全' },
  ]);
  let noPartOnly = false;
  const tz = new TZTable($('#pcOptBody').closest('.table-wrap'), {
    id: 'pcopt_upBody',
    perm: 'pcopt',
    columns: [
      { key: 'applicant', label: '申请人' },
      { key: 'flow_no', label: '流程单号' },
      { key: 'asset_no', label: '资产编号', render: v => esc(v || '—') },
      { key: 'items', label: '升级配件明细', render: (v, r) => (v && v.length) ? esc(upBrief(r)) : '<span class="badge badge-orange">待补充品牌</span> ' + esc(upBrief(r)) },
      { key: 'upgrade_date', label: '升级日期' },
      { key: '_ded', label: '库存扣减', render: (v, r) => upDeductedQty(r) > 0 ? '<span class="badge badge-blue">已扣 ' + upDeductedQty(r) + '</span>' : '<span class="badge badge-gray">未关联库存</span>' },
      { key: 'remark', label: '备注', render: v => `<span style="max-width:180px">${esc(v || '—')}</span>` },
    ],
    ops: [
      { label: r => (r.items && r.items.length) ? '编辑' : '补全', cls: 'btn-primary', act: 'edit' },
      { label: '删除', cls: 'btn-danger', act: 'del' },
    ],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['applicant', 'flow_no', 'asset_no', r => (r.items || []).map(i => [i.brand, i.name, i.spec].join('/')).join(' ')],
    searchBox: '#upSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#upBatch', pagerEl: '#upPager', emptyEl: '#upEmpty',
    data: pcUpgradeList,
    extraFilter: row => !noPartOnly || !(row.items && row.items.length),
    onRowOps: (act, x) => {
      if (act === 'edit') upForm(x);
      if (act === 'del') confirmModal('删除记录', `确定删除「${x.applicant} · ${x.flow_no}」的优化记录吗？${upDeductedQty(x) > 0 ? '\n（已扣减的备件库存将自动回补）' : ''}`, async () => {
        try {
          await api('/pc-upgrades/' + x.id, 'DELETE'); toast('已删除');
          pcUpgradeList = pcUpgradeList.filter(v => v.id !== x.id);   // 局部移除，保留筛选/滚动位置
          tz.setData(pcUpgradeList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条优化记录吗？已扣减的备件库存将自动回补。`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/pc-upgrades/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        pcUpgradeList = pcUpgradeList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(pcUpgradeList); toast('已删除 ' + ok + ' 条');
      });
      if (act === 'export') exportRowsCSV('优化记录_选中导出.csv', ['申请人', '流程单号', '资产编号', '升级配件明细', '升级日期', '备注'], rows, ['applicant', 'flow_no', 'asset_no', 'items', 'upgrade_date', 'remark']);
    },
  });
  bindStatClick($('#upStats'), [
    () => { noPartOnly = false; $('#upSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { noPartOnly = false; $('#upSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { noPartOnly = false; $('#upSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
    () => { noPartOnly = true; $('#upSearch').value = ''; tz.search = ''; tz.page = 1; tz.render(); },
  ]);
  $('#upTemplate').onclick = () => { window.location.href = '/api/pc-upgrades/template'; };
  $('#upExport').onclick = () => downloadExport(expUrl('/api/pc-upgrades/export', { q: $('#upSearch').value.trim() }));
  $('#upImport').onclick = () => $('#upFile').click();
  $('#upFile').onchange = async () => {
    const f = $('#upFile').files[0]; if (!f) { $('#upFile').value = ''; return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/pc-upgrades/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        toast(d.error || '导入失败', 'err');
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
      } else { toast('模板导入成功 ' + d.added + ' 条'); renderOpt('upgrades'); }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    $('#upFile').value = '';
  };
  $('#upAdd').onclick = () => upForm(null);
}

/* ---- Tab 2：备件库存 ---- */
async function renderOptParts(page) {
  // 保留当前筛选状态：刷新/保存后不重置搜索词
  const prevQ = $('#ppSearch') ? $('#ppSearch').value : '';
  page.innerHTML = `
    <div class="toolbar">
      <input type="text" id="ppSearch" placeholder="搜索名称/品牌/规格" class="grow">
      <button class="btn btn-primary" id="ppAdd" data-perm="pcopt:edit">＋ 新增备件</button>
    </div>
    <div class="tz-batch" id="ppBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="pcPartsBody"></tbody></table></div>
      <div class="empty" id="ppEmpty" style="display:none">暂无备件，请先「＋ 新增备件」或在「⇅ 出入库流水」登记采购入库</div>
      <div class="tz-pager" id="ppPager"></div>
    </div>`;
  const r = await api('/pc-parts');
  pcPartList = r.data;
  // 恢复筛选状态
  if ($('#ppSearch')) $('#ppSearch').value = prevQ;
  const tz = new TZTable($('#pcPartsBody').closest('.table-wrap'), {
    id: 'pcopt_ppBody',
    perm: 'pcopt',
    columns: [
      { key: 'brand', label: '品牌', render: v => esc(v || '—') },
      { key: 'name', label: '物资名称' },
      { key: 'spec', label: '规格', render: v => esc(v || '—') },
      { key: 'unit', label: '单位' },
      { key: 'storage_location', label: '存储位置', render: v => v ? `<span class="badge badge-blue">${esc(v)}</span>` : '—' },
      { key: 'stock', label: '当前库存', render: (v, r) => `<span class="${r.low_threshold > 0 && v <= r.low_threshold ? 'badge badge-red' : ''}">${v}</span>` },
      { key: 'low_threshold', label: '低库存阈值', render: v => v || '—' },
      { key: 'remark', label: '备注', render: v => `<span style="max-width:180px">${esc(v || '—')}</span>` },
    ],
    ops: [
      { label: '编辑', cls: 'btn-primary', act: 'edit' },
      { label: '删除', cls: 'btn-danger', act: 'del' },
    ],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['name', 'brand', 'spec', 'storage_location'],
    searchBox: '#ppSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#ppBatch', pagerEl: '#ppPager', emptyEl: '#ppEmpty',
    data: pcPartList,
    onRowOps: (act, x) => {
      if (act === 'edit') partForm(x);
      if (act === 'del') confirmModal('删除备件', `确定删除备件「${x.name}」吗？（库存必须为 0）`, async () => {
        try {
          await api('/pc-parts/' + x.id, 'DELETE'); toast('已删除');
          pcPartList = pcPartList.filter(v => v.id !== x.id);   // 局部移除，保留筛选/滚动位置
          tz.setData(pcPartList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 个备件吗？（库存必须为 0）`, async () => {
        let ok = 0, fail = 0;
        for (const r of rows) { try { await api('/pc-parts/' + r.id, 'DELETE'); ok++; } catch (e) { fail++; } }
        pcPartList = pcPartList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(pcPartList); toast('已删除 ' + ok + ' 个' + (fail ? '，失败 ' + fail + ' 个' : ''));
      });
      if (act === 'export') exportRowsCSV('优化备件_选中导出.csv', ['品牌', '物资名称', '规格', '单位', '存储位置', '当前库存', '低库存阈值', '备注'], rows, ['brand', 'name', 'spec', 'unit', 'storage_location', 'stock', 'low_threshold', 'remark']);
    },
  });
  $('#ppAdd').onclick = () => partForm(null);
}
function partForm(x) {
  const d = x || {};
  openModal(x ? '编辑备件' : '新增备件', `
    <div class="form-grid">
      <div class="form-field"><label>物资名称 *</label><input id="pp_name" value="${esc(d.name || '')}"></div>
      <div class="form-field"><label>品牌</label><input id="pp_brand" value="${esc(d.brand || '')}"></div>
      <div class="form-field"><label>规格</label><input id="pp_spec" value="${esc(d.spec || '')}"></div>
      <div class="form-field"><label>单位</label><input id="pp_unit" value="${esc(d.unit || '个')}"></div>
      <div class="form-field"><label>存储位置</label><input id="pp_loc" value="${esc(d.storage_location || '')}" placeholder="如：A柜-3层 / 信息中心仓库"></div>
      ${x ? '<div class="form-field"><label>当前库存</label><input value="' + esc(d.stock || 0) + '" disabled style="background:#f8fafc"></div>' : ''}
      <div class="form-field"><label>低库存预警阈值</label><input id="pp_th" type="number" min="0" value="${esc(d.low_threshold || '')}" placeholder="0=不预警"></div>
      <div class="form-field full"><label>备注</label><input id="pp_remark" value="${esc(d.remark || '')}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = { name: $('#pp_name').value.trim(), brand: $('#pp_brand').value.trim(), spec: $('#pp_spec').value.trim(), unit: $('#pp_unit').value.trim() || '个', storage_location: $('#pp_loc').value.trim(), low_threshold: $('#pp_th').value || 0, remark: $('#pp_remark').value.trim() };
    if (!body.name) { toast('请填写物资名称', 'err'); return; }
    try {
      if (x) await api('/pc-parts/' + x.id, 'PUT', body); else await api('/pc-parts', 'POST', body);
      toast('已保存'); closeModal(); renderOpt('parts');
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ---- Tab 3：出入库流水 ---- */
async function renderOptFlows(page) {
  // 保留当前筛选状态：刷新/保存后不重置搜索与类型筛选
  const prevQ = $('#pfSearch') ? $('#pfSearch').value : '';
  const prevType = $('#pfType') ? $('#pfType').value : '';
  page.innerHTML = `
    <div class="toolbar">
      <input type="text" id="pfSearch" placeholder="搜索物资/经办人/关联" class="grow">
      <select id="pfType"><option value="">全部类型</option><option value="in">入库</option><option value="out">出库</option></select>
      <button class="btn" id="pfTemplate">⬇ 下载模板</button>
      <button class="btn" id="pfImport" data-perm="pcopt:edit">📥 模板导入</button>
      <input type="file" id="pfFile" accept=".xlsx,.xls" style="display:none">
      <button class="btn" id="pfExport">📤 导出</button>
      <button class="btn" id="pfIn" data-perm="pcopt:edit">📥 采购入库</button>
      <button class="btn btn-primary" id="pfOut" data-perm="pcopt:edit">📤 出库登记</button>
    </div>
    <div class="tz-batch" id="pfBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="pcFlowsBody"></tbody></table></div>
      <div class="empty" id="pfEmpty" style="display:none">暂无流水记录，「📥 采购入库」登记备件采购；优化记录发放时自动生成出库流水</div>
      <div class="tz-pager" id="pfPager"></div>
    </div>`;
  const r = await api('/pc-flows');
  pcFlowList = r.data;
  const rp = await api('/pc-parts');
  pcPartList = rp.data;
  // 恢复筛选状态
  if ($('#pfSearch')) $('#pfSearch').value = prevQ;
  if ($('#pfType')) $('#pfType').value = prevType;
  const mkFilter = () => { const t = $('#pfType').value; return row => !t || row.type === t; };
  const tz = new TZTable($('#pcFlowsBody').closest('.table-wrap'), {
    id: 'pcopt_pfBody',
    perm: 'pcopt',
    columns: [
      { key: 'type', label: '类型', render: v => v === 'in' ? '<span class="badge badge-green">入库</span>' : '<span class="badge badge-blue">出库</span>' },
      { key: 'part_name', label: '物资名称' },
      { key: 'qty', label: '数量', render: v => `<span class="num">${v}</span>` },
      { key: 'record_time', label: '日期' },
      { key: 'operator', label: '经办人', render: v => esc(v || '—') },
      { key: 'ref', label: '关联', render: v => esc(v || '—') },
      { key: 'remark', label: '备注', render: v => `<span style="max-width:180px">${esc(v || '—')}</span>` },
    ],
    ops: [{ label: '删除', cls: 'btn-danger', act: 'del' }],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['part_name', 'operator', 'ref', 'remark'],
    searchBox: '#pfSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#pfBatch', pagerEl: '#pfPager', emptyEl: '#pfEmpty',
    data: pcFlowList,
    extraFilter: mkFilter(),
    onRowOps: (act, x) => {
      if (act === 'del') confirmModal('删除流水', '删除该流水将自动回补/扣回库存，确定删除吗？', async () => {
        try {
          await api('/pc-flows/' + x.id, 'DELETE'); toast('已删除');
          pcFlowList = pcFlowList.filter(v => v.id !== x.id);   // 局部移除，保留筛选/滚动位置
          tz.setData(pcFlowList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条流水吗？删除后自动回补/扣回库存。`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/pc-flows/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        pcFlowList = pcFlowList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(pcFlowList); toast('已删除 ' + ok + ' 条');
      });
      if (act === 'export') exportRowsCSV('优化流水_选中导出.csv', ['类型', '物资名称', '数量', '日期', '经办人', '关联', '备注'], rows, ['type', 'part_name', 'qty', 'record_time', 'operator', 'ref', 'remark']);
    },
  });
  $('#pfType').onchange = () => { tz.extraFilter = mkFilter(); tz.page = 1; tz.render(); };
  $('#pfTemplate').onclick = () => { window.location.href = '/api/pc-flows/template'; };
  $('#pfExport').onclick = () => downloadExport(expUrl('/api/pc-flows/export', { q: $('#pfSearch').value.trim(), type: $('#pfType').value }));
  $('#pfImport').onclick = () => $('#pfFile').click();
  $('#pfFile').onchange = async () => {
    const f = $('#pfFile').files[0]; if (!f) { $('#pfFile').value = ''; return; }
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await fetch('/api/pc-flows/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) {
        toast(d.error || '导入失败', 'err');
        if (d.errors && d.errors.length) alert('导入失败明细：\n' + d.errors.slice(0, 20).join('\n'));
      } else { toast('模板导入成功 ' + d.added + ' 条'); renderOpt('flows'); }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    $('#pfFile').value = '';
  };
  $('#pfIn').onclick = () => flowForm('in');
  $('#pfOut').onclick = () => flowForm('out');
}
function flowForm(ftype) {
  const isIn = ftype === 'in';
  const opts = '<option value="">— 请选择备件 —</option>' + pcPartList.map(p => `<option value="${p.id}">${esc(p.name)}${p.spec ? ' ' + esc(p.spec) : ''}（库存 ${p.stock}）</option>`).join('');
  openModal(isIn ? '采购入库登记' : '出库登记', `
    <div class="form-grid">
      <div class="form-field full"><label>备件物资 *</label><select id="pf_part">${opts}</select></div>
      <div class="form-field"><label>数量 *</label><input id="pf_qty" type="number" min="1" value="1"></div>
      <div class="form-field"><label>日期</label><input type="date" id="pf_time" value="${today()}"></div>
      <div class="form-field"><label>备注</label><input id="pf_remark" placeholder="${isIn ? '如 采购到货' : '如 用于某台电脑升级'}"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = { type: ftype, part_id: $('#pf_part').value, qty: $('#pf_qty').value, record_time: $('#pf_time').value, remark: $('#pf_remark').value.trim() };
    if (!body.part_id) { toast('请选择备件', 'err'); return; }
    try {
      await api('/pc-flows', 'POST', body);
      toast('已保存'); closeModal(); renderOpt('flows');
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ---- Tab 4：调整记录 ---- */
async function renderOptAdjusts(page) {
  // 保留当前筛选状态：刷新/保存后不重置搜索词
  const prevQ = $('#paSearch') ? $('#paSearch').value : '';
  page.innerHTML = `
    <div class="toolbar">
      <input type="text" id="paSearch" placeholder="搜索物资/原因/经办人" class="grow">
      <button class="btn btn-primary" id="paAdd" data-perm="pcopt:edit">＋ 新增调整</button>
    </div>
    <div class="tz-batch" id="paBatch"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead></thead><tbody id="pcAdjustsBody"></tbody></table></div>
      <div class="empty" id="paEmpty" style="display:none">暂无调整记录（用于盘盈盘亏等库存修正，保存后自动更新库存）</div>
      <div class="tz-pager" id="paPager"></div>
    </div>`;
  const [r, rp] = await Promise.all([api('/pc-adjusts'), api('/pc-parts')]);
  pcAdjustList = r.data;
  pcPartList = rp.data;
  // 恢复筛选状态
  if ($('#paSearch')) $('#paSearch').value = prevQ;
  const tz = new TZTable($('#pcAdjustsBody').closest('.table-wrap'), {
    id: 'pcopt_paBody',
    perm: 'pcopt',
    columns: [
      { key: 'type', label: '类型', render: v => v === 'in' ? '<span class="badge badge-green">增加</span>' : '<span class="badge badge-red">减少</span>' },
      { key: 'part_name', label: '物资名称' },
      { key: 'qty', label: '数量', render: v => `<span class="num">${v}</span>` },
      { key: 'reason', label: '原因', render: v => esc(v || '—') },
      { key: 'operator', label: '经办人', render: v => esc(v || '—') },
      { key: 'adjust_time', label: '调整日期' },
    ],
    ops: [{ label: '删除', cls: 'btn-danger', act: 'del' }],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: ['part_name', 'reason', 'operator'],
    searchBox: '#paSearch',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#paBatch', pagerEl: '#paPager', emptyEl: '#paEmpty',
    data: pcAdjustList,
    onRowOps: (act, x) => {
      if (act === 'del') confirmModal('删除调整', '删除该调整将自动回补/扣回库存，确定删除吗？', async () => {
        try {
          await api('/pc-adjusts/' + x.id, 'DELETE'); toast('已删除');
          pcAdjustList = pcAdjustList.filter(v => v.id !== x.id);   // 局部移除，保留筛选/滚动位置
          tz.setData(pcAdjustList);
        } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条调整记录吗？删除后自动回补/扣回库存。`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/pc-adjusts/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        pcAdjustList = pcAdjustList.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(pcAdjustList); toast('已删除 ' + ok + ' 条');
      });
      if (act === 'export') exportRowsCSV('优化调整_选中导出.csv', ['类型', '物资名称', '数量', '原因', '经办人', '调整日期'], rows, ['type', 'part_name', 'qty', 'reason', 'operator', 'adjust_time']);
    },
  });
  $('#paAdd').onclick = () => adjustForm();
}
function adjustForm() {
  const opts = '<option value="">— 请选择备件 —</option>' + pcPartList.map(p => `<option value="${p.id}">${esc(p.name)}${p.spec ? ' ' + esc(p.spec) : ''}（库存 ${p.stock}）</option>`).join('');
  openModal('新增库存调整', `
    <div class="form-grid">
      <div class="form-field"><label>调整类型 *</label><select id="pa_type"><option value="in">增加（盘盈等）</option><option value="out">减少（盘亏等）</option></select></div>
      <div class="form-field"><label>备件物资 *</label><select id="pa_part">${opts}</select></div>
      <div class="form-field"><label>数量 *</label><input id="pa_qty" type="number" min="1" value="1"></div>
      <div class="form-field"><label>调整日期</label><input type="date" id="pa_time" value="${today()}"></div>
      <div class="form-field full"><label>原因 *</label><input id="pa_reason" placeholder="如 盘点差异/损坏报废"></div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const body = { type: $('#pa_type').value, part_id: $('#pa_part').value, qty: $('#pa_qty').value, adjust_time: $('#pa_time').value, reason: $('#pa_reason').value.trim() };
    if (!body.part_id) { toast('请选择备件', 'err'); return; }
    if (!body.reason) { toast('请填写调整原因', 'err'); return; }
    try {
      await api('/pc-adjusts', 'POST', body);
      toast('已保存'); closeModal(); renderOpt('adjusts');
    } catch (e) { toast(e.message, 'err'); }
  };
}

function upLegacyItems(x) {
  // 旧数据（5 类升级项）转明细行，品牌待补
  const out = [];
  const map = [['ram_8', '8G内存'], ['ram_16', '16G内存'], ['sata_ssd', 'SATA固态'], ['m2_ssd', 'M2固态'], ['hdd', '机械硬盘']];
  map.forEach(([k, nm]) => { if (x[k]) out.push({ part_id: null, brand: '', name: nm, spec: '', qty: x[k] }); });
  return out;
}
function upForm(x) {
  const d = x || {};
  const initItems = (x && x.items && x.items.length) ? x.items.map(i => ({ part_id: i.part_id, brand: i.brand || '', name: i.name || '', spec: i.spec || '', qty: i.qty || 1 })) : upLegacyItems(d);
  const partOpts = '<option value="">— 选库存备件 —</option>' + pcPartList.map(p => `<option value="${p.id}">${esc(p.name)}${p.spec ? ' ' + esc(p.spec) : ''}（库存 ${p.stock}）</option>`).join('');
  const rowHtml = (it) => `
    <div class="up-item-row" style="display:grid;grid-template-columns:1.6fr 1fr 1.2fr 1fr 56px 34px;gap:8px;margin-bottom:8px;align-items:center">
      <select class="ui-part">${partOpts}</select>
      <input class="ui-brand" placeholder="品牌" value="${esc(it.brand || '')}">
      <input class="ui-name" placeholder="名称(必填)" value="${esc(it.name || '')}">
      <input class="ui-spec" placeholder="规格" value="${esc(it.spec || '')}">
      <input class="ui-qty" type="number" min="1" value="${it.qty || 1}">
      <button class="btn btn-sm btn-danger ui-del" title="删除该行">✕</button>
    </div>`;
  openModal(x ? '编辑优化记录' : '新增优化记录', `
    <div class="form-grid">
      <div class="form-field"><label>申请人 *</label><input id="up_app" value="${esc(d.applicant || '')}"></div>
      <div class="form-field"><label>流程单号</label><input id="up_flow" value="${esc(d.flow_no || '')}"></div>
      <div class="form-field"><label>资产编号（联动电脑台账）</label><input id="up_asset" list="upAssetList" value="${esc(d.asset_no || '')}" placeholder="选择或输入资产编号">
        <datalist id="upAssetList"></datalist><div id="upAssetInfo" class="small" style="color:var(--text2)"></div></div>
      <div class="form-field"><label>升级日期</label><input type="date" id="up_date" value="${esc(d.upgrade_date || today())}"></div>
      <div class="form-field"><label>ZK</label><input id="up_zk" type="number" min="0" value="${esc(d.zk || '')}"></div>
      <div class="form-field"><label>BG</label><input id="up_bg" type="number" min="0" value="${esc(d.bg || '')}"></div>
      <div class="form-field"><label>采购时间</label><input type="date" id="up_pur" value="${esc(d.purchase_date || '')}"></div>
      <div class="form-field full"><label>备注</label><input id="up_remark" value="${esc(d.remark || '')}"></div>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="card-title">🔧 升级配件明细（每台电脑可加多行，品牌/名称/规格逐项记录）
        <span class="spacer"></span>
        <button class="btn btn-sm btn-primary" id="upItemAdd">＋ 添加配件</button>
      </div>
      <div id="upItems">${(initItems.length ? initItems : [{}]).map(rowHtml).join('')}</div>
      <div class="small" style="color:var(--text2);margin-top:4px">提示：选择库存备件后自动带出品牌/名称/规格并扣减库存；不选库存可手填，后续再补品牌等信息。</div>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>', null, true);
  // 动态行：选中库存备件自动带出品牌/名称/规格
  const bindRow = (row) => {
    row.querySelector('.ui-part').onchange = () => {
      const pid = +row.querySelector('.ui-part').value;
      const p = pcPartList.find(v => v.id === pid);
      if (p) {
        row.querySelector('.ui-brand').value = p.brand || '';
        row.querySelector('.ui-name').value = p.name || '';
        row.querySelector('.ui-spec').value = p.spec || '';
      }
    };
    row.querySelector('.ui-del').onclick = () => row.remove();
  };
  $$('#upItems .up-item-row').forEach(bindRow);
  $('#upItemAdd').onclick = () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = rowHtml({});
    const row = wrap.firstElementChild;
    bindRow(row);
    $('#upItems').appendChild(row);
  };
  // 资产编号联动办公电脑台账
  api('/computers').then(r => {
    const list = r.data || [];
    computerList4up = list;
    $('#upAssetList').innerHTML = list.map(c => `<option value="${esc(c.asset_no || '')}">${esc(c.hostname || '')} ${esc(c.brand || '')} ${esc(c.model || '')}</option>`).join('');
    const showInfo = () => {
      const c = list.find(v => (v.asset_no || '') === $('#up_asset').value.trim());
      $('#upAssetInfo').textContent = c ? '✔ ' + [c.brand, c.model, c.user_name, c.department].filter(Boolean).join(' · ') : '';
    };
    showInfo();
    $('#up_asset').oninput = showInfo;
  });
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const items = [];
    $$('#upItems .up-item-row').forEach(row => {
      const pid = row.querySelector('.ui-part').value || null;
      const brand = row.querySelector('.ui-brand').value.trim();
      const name = row.querySelector('.ui-name').value.trim();
      const spec = row.querySelector('.ui-spec').value.trim();
      const qty = +row.querySelector('.ui-qty').value || 1;
      if (!pid && !name) return; // 空行跳过
      items.push({ part_id: pid, brand, name, spec, qty });
    });
    if (!items.length) { toast('请至少添加一行配件明细', 'err'); return; }
    const body = {
      applicant: $('#up_app').value.trim(), flow_no: $('#up_flow').value.trim(),
      asset_no: $('#up_asset').value.trim(), upgrade_date: $('#up_date').value,
      zk: $('#up_zk').value || 0, bg: $('#up_bg').value || 0,
      purchase_date: $('#up_pur').value, remark: $('#up_remark').value.trim(),
      items
    };
    if (!body.applicant && !body.flow_no) { toast('请至少填写申请人或流程单号', 'err'); return; }
    try {
      if (x) await api('/pc-upgrades/' + x.id, 'PUT', body); else await api('/pc-upgrades', 'POST', body);
      toast('已保存'); closeModal(); renderOpt('upgrades');
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ AI 助手模块 ============ */
let aiImages = [];
async function renderAi(tab) {
  const cur = tab || 'chat';
  const c = $('#content');
  c.innerHTML = `
    <div class="tabs" data-mod="ai">
      <div class="tab ${cur === 'chat' ? 'active' : ''}" data-t="chat">💬 AI 对话</div>
      <div class="tab ${cur === 'gen' ? 'active' : ''}" data-t="gen">🤖 生成工作记录</div>
      <div class="tab ${cur === 'records' ? 'active' : ''}" data-t="records">工作记录库</div>
      <div class="tab ${cur === 'kb' ? 'active' : ''}" data-t="kb">知识库</div>
      <div class="tab ${cur === 'stats' ? 'active' : ''}" data-t="stats">📊 统计分析</div>
      <div class="tab ${cur === 'reqs' ? 'active' : ''}" data-t="reqs">🛠 功能修改</div>
      <span class="spacer"></span>
      <button class="btn" id="aiCfg">⚙️ AI 设置</button>
    </div>
    <div id="aiPage"></div>`;
  $$('.tab', c).forEach(t => t.onclick = () => renderAi(t.dataset.t));
  $('#aiCfg').onclick = openAiSettings;
  if (cur === 'chat') renderAiChat();
  if (cur === 'gen') renderAiGen();
  if (cur === 'records') renderAiRecords();
  if (cur === 'kb') renderAiKb();
  if (cur === 'stats') renderAiStats();
  if (cur === 'reqs') renderAiReqs();
}


async function renderAiChat() {
  const page = $('#aiPage');
  page.innerHTML = `
    <div class="doubao-wrap">
      <div class="doubao-side">
        <button class="btn btn-primary" id="acNewSide" style="width:100%;margin-bottom:10px">＋ 新对话</button>
        <input id="acConvSearch" placeholder="🔍 搜索对话" style="width:100%;padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:10px;outline:none">
        <div id="acConvList" class="doubao-convlist"></div>
      </div>
      <div class="doubao-main">
        <div class="doubao-header">
          <div class="doubao-title">
            <span class="doubao-logo">龙</span>
            <div>
              <div style="font-weight:600;font-size:15px" id="acTitle">AI 工作台</div>
              <div class="small" style="color:#9ca3af;font-size:11px">Qwen3.5-122B · 局域网私有部署 · 历史已云端保存</div>
            </div>
          </div>
          <span class="spacer"></span>
          <select id="acModelSel" title="切换 AI 模型" style="padding:4px 8px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;background:#fff;max-width:180px"></select>
          <button class="btn btn-sm" id="acRename">✏️ 重命名</button>
          <button class="btn btn-sm" id="acDel">🗑 删除此对话</button>
        </div>
        <div id="acBody" class="doubao-body"></div>
        <div class="doubao-input-wrap">
          <div id="acPending" style="max-width:880px;margin:0 auto 6px;display:none"></div>
          <div class="doubao-input-box" id="acDrop">
            <button class="btn-icon" id="acAttach" title="上传图片/文件">📎</button>
            <input type="file" id="acFile" multiple style="display:none">
            <textarea id="acInput" rows="1" placeholder="给 AI 发送消息…（Enter 发送，Shift+Enter 换行，可拖拽文件到此处）"></textarea>
            <button class="btn-send" id="acSend" title="发送">➤</button>
          </div>
          <div class="small" style="text-align:center;color:#c0c4cc;margin-top:6px;font-size:11px">内容由 AI 生成，请核对关键信息</div>
        </div>
      </div>
    </div>`;
  const body = $('#acBody');
  let convs = [];
  let curId = null;
  let cur = null;
  let msgs = [];
  let pendingFiles = [];
  const nowTs = () => new Date().toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});

  const escMd = (t) => esc(t)
    .replace(/```([\s\S]*?)```/g, (m,c) => `<pre class="md-pre">${c}</pre>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/^\- (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul style="margin:4px 0;padding-left:20px">$1</ul>')
    .replace(/\n/g, '<br>');

  const attHtml = (atts) => {
    if (!atts || !atts.length) return '';
    return '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">' + atts.map(a => {
      if (a.is_image) return `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(a.url)}" style="max-width:140px;max-height:100px;border-radius:8px;border:1px solid #e5e7eb;cursor:pointer"></a>`;
      const sz = a.size > 1048576 ? (a.size/1048576).toFixed(1)+' MB' : Math.max(1,Math.round(a.size/1024))+' KB';
      return `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:#f3f4f6;border-radius:8px;font-size:12px;color:#374151;text-decoration:none">📄 ${esc(a.name)}<span style="color:#9ca3af">${sz}</span></a>`;
    }).join('') + '</div>';
  };

  const renderConvList = () => {
    const kw = ($('#acConvSearch')?.value || '').trim();
    let list = convs;
    if (kw) list = list.filter(c => (c.title || '').includes(kw));
    const today = new Date().toLocaleDateString('zh-CN');
    const yest = new Date(Date.now() - 86400000).toLocaleDateString('zh-CN');
    const groups = { '今天': [], '昨天': [], '更早': [] };
    list.forEach(c => {
      const d = (c.updated_at || c.created_at || '').slice(0, 10);
      if (d === today) groups['今天'].push(c);
      else if (d === yest) groups['昨天'].push(c);
      else groups['更早'].push(c);
    });
    let html = '';
    for (const g of ['今天', '昨天', '更早']) {
      if (!groups[g].length) continue;
      html += `<div class="doubao-conv-group">${g}</div>`;
      html += groups[g].map(c => `
        <div class="doubao-conv ${c.id === curId ? 'active' : ''}" data-id="${c.id}">
          <div class="doubao-conv-title">${esc(c.title || '新对话')}</div>
          <div class="doubao-conv-time">${esc((c.updated_at || '').slice(5, 16))}</div>
          <span class="doubao-conv-del" data-del="${c.id}" title="删除">×</span>
        </div>`).join('');
    }
    $('#acConvList').innerHTML = html || '<div class="small" style="color:#c0c4cc;text-align:center;padding:20px 0">暂无历史对话</div>';
    $('#acConvList').querySelectorAll('.doubao-conv').forEach(el => el.onclick = (e) => {
      if (e.target.dataset.del) return;
      sessionStorage.setItem('aiCurId', String(el.dataset.id));
      loadConv(+el.dataset.id);
    });
    $('#acConvList').querySelectorAll('[data-del]').forEach(s => s.onclick = (e) => {
      e.stopPropagation();
      const id = +s.dataset.del;
      const c = convs.find(x => x.id === id);
      confirmModal('删除对话', `确定删除「${c?.title || '该对话'}」吗？`, async () => {
        await api(`/ai/convs/${id}`, 'DELETE');
        if (id === curId) { sessionStorage.removeItem('aiCurId'); await init(); }
        else await refreshList();
      });
    });
  };

  const renderPending = () => {
    const box = $('#acPending');
    if (!pendingFiles.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap">' + pendingFiles.map((f,i) =>
      `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#eef3ff;border-radius:8px;font-size:12px">📎 ${esc(f.name)}<span style="cursor:pointer;color:#dc2626" data-rm="${i}">×</span></span>`
    ).join('') + '</div>';
    box.querySelectorAll('[data-rm]').forEach(s => s.onclick = () => { pendingFiles.splice(+s.dataset.rm,1); renderPending(); });
  };

  const render = () => {
    renderConvList();
    if (cur) $('#acTitle').textContent = cur.title || '新对话';
    if (!msgs.length) {
      body.innerHTML = `
        <div class="doubao-welcome">
          <div class="doubao-welcome-logo">龙</div>
          <div class="doubao-welcome-title">有什么我可以帮你？</div>
          <div class="doubao-welcome-sub">我可以查系统数据、生成工作记录、解答运维问题，支持发图片/文件</div>
          <div class="doubao-sug-grid">
            <button class="doubao-sug" data-q="系统总览怎么样？"><b>🗂 系统总览</b><span>查看打印机/耗材/备件整体情况</span></button>
            <button class="doubao-sug" data-q="本月耗材费用是多少？"><b>💰 本月费用</b><span>统计当月耗材采购与发放金额</span></button>
            <button class="doubao-sug" data-q="有哪些耗材库存低于预警？"><b>⚠️ 低库存预警</b><span>列出需要补货的耗材</span></button>
            <button class="doubao-sug" data-q="各部门耗材发放情况？"><b>📦 发放统计</b><span>按部门汇总耗材发放量</span></button>
            <button class="doubao-sug" data-q="最近备品备件出入库流水"><b>🔄 出入库流水</b><span>查看最近备件流水</span></button>
            <button class="doubao-sug" data-q="打印机报修维修情况？"><b>🔧 维修统计</b><span>统计故障与维修记录</span></button>
          </div>
        </div>`;
      body.querySelectorAll('.doubao-sug').forEach(b => b.onclick = () => { $('#acInput').value = b.dataset.q; send(); });
      return;
    }
    body.innerHTML = msgs.map((m, i) => `
      <div class="doubao-msg ${m.role === 'user' ? 'me' : 'ai'}">
        <div class="doubao-avatar">${m.role === 'user' ? '我' : '龙'}</div>
        <div class="doubao-bubble-wrap">
          <div class="doubao-bubble">${m.role === 'ai' ? escMd(m.content) : esc(m.content)}</div>
          ${attHtml(m.attachments)}
          ${m.table ? `<div style="margin-top:8px">${m.table}</div>` : ''}
          ${m.role === 'ai' && m.content !== '…' ? `
            <div class="doubao-msg-ops">
              <button data-copy="${i}" title="复制">📋 复制</button>
              ${m.saveTicket ? '<button data-saveticket="'+i+'" title="保存到工作记录库">💾 保存工单</button>' : ''}
              <span class="small" style="color:#c0c4cc">${m.ts || ''}</span>
            </div>` : ''}
          ${m.content === '…' ? '<div class="doubao-think">正在思考<span>.</span><span>.</span><span>.</span></div>' : ''}
        </div>
      </div>`).join('');
    body.scrollTop = body.scrollHeight;
    body.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copyText(msgs[+b.dataset.copy].content, b));
    body.querySelectorAll('[data-saveticket]').forEach(b => b.onclick = async () => {
      const t = msgs[+b.dataset.saveticket].saveTicket;
      if (!t) return;
      try {
        await api('/ai/records', 'POST', { title: t.title, summary: t.summary, requester: t.requester, raw_text: '' });
        b.textContent = '✅ 已保存'; b.disabled = true;
        toast('已保存到工作记录库', 'ok');
      } catch (e) { toast(e.message, 'err'); }
    });
  };

  const aiTableHtml = (cols, rows) => {
    if (!cols || !rows || !rows.length) return '';
    return `<div style="margin-top:10px;overflow-x:auto"><table style="font-size:12px;border-collapse:collapse;width:100%">
      <thead><tr>${cols.map(c => `<th style="border:1px solid #d1d5db;padding:4px 6px;background:#eff6ff">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(v => `<td style="border:1px solid #d1d5db;padding:4px 6px">${esc(String(v ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };

  async function refreshList() {
    const r = await api('/ai/convs', 'GET');
    convs = r.items || [];
    renderConvList();
  }

  async function loadConv(cid) {
    curId = cid;
    sessionStorage.setItem('aiCurId', String(cid));
    cur = convs.find(c => c.id === cid);
    msgs = [];
    render();
    try {
      const r = await api(`/ai/convs/${cid}/messages`, 'GET');
      msgs = (r.items || []).map(m => ({ role: m.role === 'assistant' ? 'ai' : m.role, content: m.content, attachments: m.attachments || [], ts: (m.ts || '').slice(11,16) }));
      render();
    } catch (e) { toast(e.message, 'err'); }
  }

  async function init() {
    await refreshList();
    let cid = sessionStorage.getItem('aiCurId');
    if (cid && convs.find(c => c.id === +cid)) await loadConv(+cid);
    else if (convs.length) await loadConv(convs[0].id);
    else { curId = null; cur = null; msgs = []; render(); }
  }

  const send = async () => {
    const text = $('#acInput').value.trim();
    if (!text && !pendingFiles.length) return;
    // 确保有会话
    if (!curId) {
      try {
        const c = await api('/ai/convs', 'POST', { title: (text || '新对话').slice(0,18) });
        curId = c.id;
        sessionStorage.setItem('aiCurId', String(curId));
        await refreshList();
        cur = convs.find(x => x.id === curId);
      } catch (e) { toast(e.message, 'err'); return; }
    }
    $('#acInput').value = '';
    autoGrow();
    const atts = pendingFiles.slice();
    pendingFiles = []; renderPending();
    msgs.push({ role: 'user', content: text, attachments: atts, ts: nowTs() });
    render();
    // 存用户消息到服务端
    try { await api(`/ai/convs/${curId}/messages`, 'POST', { role: 'user', content: text, attachments: atts }); } catch (e) {}
    msgs.push({ role: 'ai', content: '…', ts: nowTs() });
    render();
    const btn = $('#acSend'); btn.disabled = true;
    try {
      let tableHtml = '';
      try {
        const a = await api('/ai/analyze', 'POST', { text });
        if (a.matched) {
          tableHtml = aiTableHtml(a.cols, a.rows);
          msgs[msgs.length - 1] = { role: 'ai', content: a.answer, table: tableHtml, ts: nowTs() };
          await saveAiMsg(msgs[msgs.length-1]);
          render(); btn.disabled = false; return;
        }
      } catch (e) { }
      const looksLikeTicket = !/[?？]|多少|怎么样|为什么|如何|请问|分析|统计|查询|帮我看看|系统|概览|情况/.test(text) && text.length <= 300;
      if (looksLikeTicket) {
        try {
          const g = await api('/ai/generate', 'POST', { text, images: [] });
          if (g.title || g.summary) {
            const out = `工单名称：${g.title || ''}\n工单描述：${g.summary || ''}\n需求人：${g.requester || ''}`;
            msgs[msgs.length - 1] = { role: 'ai', content: out, ts: nowTs(), saveTicket: { title: g.title, summary: g.summary, requester: g.requester } };
            await saveAiMsg(msgs[msgs.length-1]);
            render(); btn.disabled = false; return;
          }
        } catch (e) { }
      }
      const r = await api('/ai/chat', 'POST', { messages: msgs.filter(m => m.content !== '…').map(m => ({role: m.role === 'ai' ? 'assistant' : m.role, content: m.content, attachments: m.attachments || []})) });
      msgs[msgs.length - 1] = { role: 'ai', content: r.reply || '(无回复)', ts: nowTs() };
      await saveAiMsg(msgs[msgs.length-1]);
      render();
    } catch (e) {
      msgs.pop(); render();
      toast(e.message, 'err');
      if (/未配置/.test(e.message)) openAiSettings();
    }
    btn.disabled = false;
    refreshList();
  };

  async function saveAiMsg(m) {
    if (!curId) return;
    try { await api(`/ai/convs/${curId}/messages`, 'POST', { role: 'assistant', content: m.content, attachments: [] }); } catch (e) {}
  }

  const autoGrow = () => {
    const t = $('#acInput');
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 160) + 'px';
  };
  $('#acSend').onclick = send;
  $('#acInput').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  $('#acInput').oninput = autoGrow;
  $('#acNewSide').onclick = async () => {
    sessionStorage.removeItem('aiCurId');
    curId = null; cur = null; msgs = []; pendingFiles = []; renderPending();
    await refreshList(); render();
    $('#acInput').focus();
  };
  $('#acConvSearch').oninput = renderConvList;
  $('#acRename').onclick = async () => {
    if (!curId) return toast('请先选择一个对话', 'err');
    const n = prompt('重命名对话', cur?.title || '');
    if (n && n.trim()) {
      await api(`/ai/convs/${curId}/title`, 'POST', { title: n.trim() });
      await refreshList();
    }
  };
  $('#acDel').onclick = () => {
    if (!curId) return;
    confirmModal('删除对话', `确定删除「${cur?.title}」吗？`, async () => {
      await api(`/ai/convs/${curId}`, 'DELETE');
      sessionStorage.removeItem('aiCurId');
      curId = null; cur = null; msgs = [];
      await init();
    });
  };
  // 文件上传
  $('#acAttach').onclick = () => $('#acFile').click();
  $('#acFile').onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const f of files) {
      try {
        const fd = new FormData(); fd.append('file', f);
        const x = await fetch('/api/ai/upload', { method: 'POST', body: fd });
        const r = await x.json();
        if (r.ok) pendingFiles.push({ url: r.url, name: r.name, size: r.size, is_image: r.is_image });
        else toast(r.error || '上传失败', 'err');
      } catch (err) { toast(err.message, 'err'); }
    }
    renderPending();
  };
  // 拖拽
  const drop = $('#acDrop');
  drop.ondragover = (e) => { e.preventDefault(); drop.style.background = '#eef3ff'; };
  drop.ondragleave = () => { drop.style.background = ''; };
  drop.ondrop = async (e) => {
    e.preventDefault(); drop.style.background = '';
    const files = Array.from(e.dataTransfer.files || []);
    for (const f of files) {
      try {
        const fd = new FormData(); fd.append('file', f);
        const x = await fetch('/api/ai/upload', { method: 'POST', body: fd });
        const r = await x.json();
        if (r.ok) pendingFiles.push({ url: r.url, name: r.name, size: r.size, is_image: r.is_image });
      } catch (err) { toast(err.message, 'err'); }
    }
    renderPending();
  };

  async function loadModelSel() {
    try {
      const r = await api('/ai/settings');
      const sel = $('#acModelSel');
      if (!sel) return;
      sel.innerHTML = (r.model_list||[]).map(m => `<option value="${esc(m.id)}" ${m.id===r.active_model?'selected':''}>${esc(m.name||m.model)}${m.id===r.active_model?' ✓':''}</option>`).join('');
      sel.onchange = async () => {
        await api('/ai/settings', 'PUT', { switch_to: sel.value });
        toast('已切换模型', 'ok');
      };
    } catch (e) {}
  }

  await init();
  loadModelSel();
  $('#acInput').focus();
}

function renderAiGen() {
  const page = $('#aiPage');
  page.innerHTML = `
    <div class="aigen-wrap">
      <div class="aigen-left">
        <div class="aigen-card">
          <div class="aigen-card-title">✍️ 原始信息</div>
          <textarea id="aiText" rows="6" class="aigen-textarea" placeholder="粘贴原始信息，例如：3楼财务科的小李电脑开不了机，电话报修，说是电源问题，编号IT02202610027，需求人：李某某……"></textarea>
          <div id="aiDrop" class="aigen-drop">
            <div class="aigen-drop-icon">📎</div>
            <div>拖拽图片到这里，或 <span class="aigen-browse">点击选择</span></div>
            <div class="small" style="color:#9ca3af;margin-top:4px">支持 JPG/PNG，最多 3 张，单张 ≤ 2MB</div>
            <input type="file" id="aiFile" accept="image/*" multiple style="display:none">
          </div>
          <div id="aiImgs" class="aigen-imgs"></div>
          <button class="btn btn-primary aigen-send" id="aiGen">🤖 生成工作记录</button>
        </div>
      </div>
      <div class="aigen-right">
        <div class="aigen-card">
          <div class="aigen-card-title">📄 生成结果 <span class="small" style="color:#9ca3af;font-weight:normal">（可编辑后复制）</span></div>
          <div id="aiResultEmpty" class="aigen-empty">
            <div style="font-size:36px;margin-bottom:8px">📋</div>
            <div>结果会显示在这里</div>
          </div>
          <div id="aiResult" style="display:none">
            <div class="aigen-field"><label>工单名称</label>
              <div class="aigen-row"><input id="aiTitle" placeholder="桌面 -- 区域 -- 部门 -- 事项 [流程编号]"><button class="btn btn-sm" data-copy="aiTitle">📋</button></div></div>
            <div class="aigen-field"><label>工单描述</label>
              <div class="aigen-row"><textarea id="aiSummary" rows="3" placeholder="只写核心故障内容"></textarea><button class="btn btn-sm" data-copy="aiTitle" data-copy-summary>📋</button></div></div>
            <div class="aigen-field"><label>需求人</label>
              <div class="aigen-row"><input id="aiReq" placeholder="需求人姓名"><button class="btn btn-sm" data-copy="aiReq">📋</button></div></div>
            <div class="aigen-actions">
              <button class="btn" data-copyall="1">📋 复制整单</button>
              <button class="btn btn-primary" id="aiSave" data-perm="ai:edit">💾 保存到工作记录库</button>
            </div>
            <div class="small" id="aiSaveMsg" style="color:#16a34a;margin-top:6px"></div>
          </div>
        </div>
        <div class="aigen-card" style="margin-top:12px">
          <div class="aigen-card-title">📌 输出格式</div>
          <div class="aigen-format">
            <div><b>工单名称：</b>桌面 -- 区域 -- 部门 -- 事项 [流程编号]</div>
            <div><b>工单描述：</b>只写核心故障内容（不含部门/人名/地点）</div>
          </div>
        </div>
      </div>
    </div>`;
  aiImages = [];
  $('#aiImgs').innerHTML = '';
  const addFiles = (files) => {
    [...files].slice(0, 3 - aiImages.length).forEach(f => {
      if (!/^image\//.test(f.type)) { toast('仅支持图片', 'err'); return; }
      if (f.size > 2 * 1024 * 1024) { toast('图片需小于 2MB', 'err'); return; }
      const rd = new FileReader();
      rd.onload = () => {
        aiImages.push(rd.result.split(',')[1]);
        const i = aiImages.length - 1;
        const d = document.createElement('div');
        d.className = 'aigen-thumb';
        d.innerHTML = `<img src="${rd.result}"><span class="rm">×</span>`;
        d.querySelector('.rm').onclick = () => { aiImages.splice(i, 1); d.remove(); };
        $('#aiImgs').appendChild(d);
      };
      rd.readAsDataURL(f);
    });
  };
  $('#aiFile').onchange = () => { addFiles($('#aiFile').files); $('#aiFile').value = ''; };
  $('.aigen-browse').onclick = () => $('#aiFile').click();
  const drop = $('#aiDrop');
  drop.onclick = (e) => { if (e.target.tagName !== 'INPUT') $('#aiFile').click(); };
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  $('#aiGen').onclick = async () => {
    const text = $('#aiText').value.trim();
    if (!text && !aiImages.length) { toast('请先输入文字或上传图片', 'err'); return; }
    $('#aiGen').disabled = true; $('#aiGen').textContent = '🤖 生成中…';
    try {
      const r = await api('/ai/generate', 'POST', { text, images: aiImages });
      $('#aiTitle').value = r.title || '';
      $('#aiSummary').value = r.summary || '';
      $('#aiReq').value = r.requester || '';
      $('#aiResult').style.display = '';
      $('#aiResultEmpty').style.display = 'none';
      if (!r.title && !r.summary) toast('未提取到内容，请检查输入或重试', 'err');
      else if (r.mode === 'rule') toast('已生成（本地规则模式）', 'ok');
      else toast('生成完成', 'ok');
    } catch (e) { toast(e.message, 'err'); }
    $('#aiGen').disabled = false; $('#aiGen').textContent = '🤖 生成工作记录';
  };
  $('#aiResult').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.copyall) {
      const t = '工单名称：' + ($('#aiTitle').value || '').trim() + '\n工单描述：' + ($('#aiSummary').value || '').trim() + '\n需求人：' + ($('#aiReq').value || '').trim();
      copyText(t, b); return;
    }
    const cid = b.dataset.copy;
    if (cid) copyText($('#' + cid).value, b);
  };
  // 修复工单描述复制按钮
  document.querySelectorAll('[data-copy-summary]').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); copyText($('#aiSummary').value, b); };
  });
  $('#aiSave').onclick = async () => {
    const body = { title: $('#aiTitle').value.trim(), summary: $('#aiSummary').value.trim(), requester: $('#aiReq').value.trim(), raw_text: $('#aiText').value.trim() + (aiImages.length ? ' [含' + aiImages.length + '张图片]' : '') };
    if (!body.title && !body.summary) { toast('请先生成或填写内容', 'err'); return; }
    try {
      await api('/ai/records', 'POST', body);
      $('#aiSaveMsg').textContent = '✅ 已保存，可在「工作记录库」查看';
      toast('已保存到工作记录库', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };
}

function copyText(text, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = '✅ 已复制'; setTimeout(() => btn.textContent = o, 1500); } toast('已复制到剪贴板', 'ok'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选择复制', 'err'); }
  document.body.removeChild(ta);
}

async function renderAiRecords() {
  const page = $('#aiPage');
  page.innerHTML = `
    <div class="card">
      <div class="card-title">🗂️ 工作记录库（本地存储）</div>
      <div class="toolbar">
        <input type="text" id="arQ" placeholder="搜索工单名称/描述/需求人" class="grow">
        <input type="date" id="arStart" title="开始日期">
        <span class="small">至</span>
        <input type="date" id="arEnd" title="结束日期">
        <button class="btn btn-primary" id="arSearch">🔍 查询</button>
        <button class="btn" id="arReset">重置</button>
        <button class="btn" id="arImport" data-perm="ai:edit">📥 模板导入</button>
        <button class="btn" id="arExport">📤 导出 CSV</button>
      </div>
      <div class="tz-batch" id="arBatch"></div>
      <div class="table-wrap"><table>
        <thead></thead><tbody id="arBody"></tbody></table></div>
      <div class="empty" id="arEmpty" style="display:none">暂无工作记录</div>
      <div class="tz-pager" id="arPager"></div>
    </div>`;
  let arAll = [];
  const mkArFilter = () => {
    const q = $('#arQ').value.trim(), start = $('#arStart').value, end = $('#arEnd').value;
    return row => {
      if (q && ![row.title, row.summary, row.requester].some(v => String(v || '').includes(q))) return false;
      if (start && (row.created_at || '').slice(0, 10) < start) return false;
      if (end && (row.created_at || '').slice(0, 10) > end) return false;
      return true;
    };
  };
  const tz = new TZTable($('#arBody').closest('.table-wrap'), {
    id: 'ai_arBody',
    perm: 'ai',
    columns: [
      { key: 'created_at', label: '时间', render: v => `<span class="nowrap">${esc(v)}</span>` },
      { key: 'title', label: '工单名称', render: v => esc(v || '—') },
      { key: 'requester', label: '需求人', render: v => esc(v || '—') },
      { key: 'summary', label: '工单描述', render: v => `<span style="max-width:340px">${esc((v || '').slice(0, 80))}</span>` },
    ],
    ops: [
      { label: '查看', act: 'view' },
      { label: '删除', cls: 'btn-danger', act: 'del' },
    ],
    batchOps: [
      { label: '批量删除', cls: 'btn-danger', act: 'del' },
      { label: '导出选中', act: 'export' },
    ],
    search: [],
    searchBox: '',
    pageSize: 10,
    multi: { key: 'id' },
    batchEl: '#arBatch', pagerEl: '#arPager', emptyEl: '#arEmpty',
    data: arAll,
    extraFilter: mkArFilter(),
    onRowOps: async (act, x) => {
      if (act === 'del') confirmModal('删除工作记录', '确定删除这条工作记录吗？', async () => {
        try { await api('/ai/records/' + x.id, 'DELETE'); toast('已删除'); arAll = arAll.filter(v => v.id !== x.id); tz.setData(arAll); } catch (err) { toast(err.message, 'err'); }
      });
      if (act === 'view') {
        openModal('工作记录详情', `
          <div class="form-field"><label>工单名称</label><input readonly value="${esc(x.title || '')}"></div>
          <div class="form-field"><label>工单描述</label><textarea readonly rows="3" style="width:100%">${esc(x.summary || '')}</textarea></div>
          <div class="form-field"><label>需求人</label><input readonly value="${esc(x.requester || '')}"></div>
          <div class="form-field"><label>原始信息</label><textarea readonly rows="4" style="width:100%">${esc(x.raw_text || '')}</textarea></div>
          <p class="small">操作人：${esc(x.operator)} ｜ 时间：${esc(x.created_at)}</p>`,
          '<button class="btn" data-a="close">关闭</button>');
        $('#modalFoot').querySelector('[data-a=close]').onclick = closeModal;
      }
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条工作记录吗？`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/ai/records/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        arAll = arAll.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(arAll); toast('已删除 ' + ok + ' 条');
      });
      if (act === 'export') exportRowsCSV('工作记录_选中导出.csv', ['时间', '工单名称', '需求人', '工单描述'], rows, ['created_at', 'title', 'requester', 'summary']);
    },
  });
  const load = async () => {
    const r = await api('/ai/records?' + new URLSearchParams({ page: 1, size: 100000 }).toString());
    arAll = r.data || [];
    tz.setData(arAll);
  };
  const refilter = () => { tz.extraFilter = mkArFilter(); tz.page = 1; tz.render(); };
  $('#arSearch').onclick = refilter;
  $('#arReset').onclick = () => { $('#arQ').value = ''; $('#arStart').value = ''; $('#arEnd').value = ''; refilter(); };
  $('#arQ').oninput = refilter;
  $('#arStart').onchange = refilter;
  $('#arEnd').onchange = refilter;
  $('#arImport').onclick = () => openAiImport('records');
  $('#arExport').onclick = () => {
    downloadExport('/api/ai/records/export?' + new URLSearchParams({ q: $('#arQ').value.trim(), start: $('#arStart').value, end: $('#arEnd').value }).toString());
  };
  await load();
}

async function renderAiKb() {
  const page = $('#aiPage');
  page.innerHTML = `
    <div class="card">
      <div class="card-title">📚 知识库（本地存储）
        <span class="spacer"></span><button class="btn btn-primary" id="akAdd" data-perm="ai:edit">＋ 新增知识</button></div>
      <div class="toolbar">
        <input type="text" id="akQ" placeholder="搜索标题/内容/标签" class="grow">
        <select id="akSort" title="排序">
          <option value="new">最新优先</option>
          <option value="old">最旧优先</option>
          <option value="title">标题 A-Z</option>
        </select>
        <button class="btn btn-primary" id="akSearch">🔍 查询</button>
        <button class="btn" id="akReset">重置</button>
        <button class="btn" id="akImport" data-perm="ai:edit">📥 模板导入</button>
        <button class="btn" id="akExport">📤 导出 CSV</button>
      </div>
      <div id="akList"></div>
      <div class="empty" id="akEmpty" style="display:none">暂无知识条目</div>
    </div>`;
  let akAll = [];
  const renderAkPage = () => {
    const sort = $('#akSort').value;
    let rows = akAll.slice();
    if (sort === 'old') rows.sort((a, b) => cmpVal(a.created_at, b.created_at));
    else if (sort === 'title') rows.sort((a, b) => cmpVal(a.title, b.title));
    else rows.sort((a, b) => -cmpVal(a.created_at, b.created_at));
    $('#akEmpty').style.display = rows.length ? 'none' : '';
    $('#akList').innerHTML = rows.map(x => `<div style="border:1px solid var(--line,#e5e7eb);border-radius:8px;padding:12px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <b>${esc(x.title)}</b>
        ${(x.tags || '').split(/[,，]/).filter(Boolean).map(t => `<span class="badge badge-green">${esc(t.trim())}</span>`).join('')}
        <span class="spacer"></span><span class="small">${esc(x.creator)} · ${esc(x.created_at)}</span>
        <button class="btn btn-sm btn-danger" data-a="del" data-id="${x.id}">删除</button>
      </div>
      <p style="margin-top:6px;white-space:pre-wrap">${esc(x.content)}</p>
    </div>`).join('');
  };
  const load = async () => {
    const q = $('#akQ').value.trim();
    const qs = new URLSearchParams({ q, page: 1, size: 100000 });
    const r = await api('/ai/knowledge?' + qs.toString());
    akAll = r.data || [];
    renderAkPage();
  };
  $('#akAdd').onclick = () => {
    openModal('新增知识', `
      <div class="form-field"><label>标题</label><input id="akTitle" placeholder="如：三星4521硒鼓更换步骤"></div>
      <div class="form-field"><label>内容</label><textarea id="akContent" rows="6" placeholder="知识内容/操作步骤/经验总结"></textarea></div>
      <div class="form-field"><label>标签（逗号分隔）</label><input id="akTags" placeholder="如：打印机,耗材,维修"></div>`,
      '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>');
    $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
    $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
      const body = { title: $('#akTitle').value.trim(), content: $('#akContent').value.trim(), tags: $('#akTags').value.trim() };
      if (!body.title || !body.content) { toast('标题与内容不能为空', 'err'); return; }
      try { await api('/ai/knowledge', 'POST', body); closeModal(); toast('已保存', 'ok'); load(); } catch (e) { toast(e.message, 'err'); }
    };
  };
  $('#akSearch').onclick = () => load();
  $('#akReset').onclick = () => { $('#akQ').value = ''; $('#akSort').value = 'new'; load(); };
  $('#akImport').onclick = () => openAiImport('knowledge');
  $('#akExport').onclick = () => downloadExport(expUrl('/api/ai/knowledge/export', { q: $('#akQ').value.trim() }));
  $('#akQ').onkeydown = (e) => { if (e.key === 'Enter') load(); };
  $('#akSort').onchange = () => renderAkPage();
  $('#akList').onclick = (e) => {
    const b = e.target.closest('button'); if (!b || b.dataset.a !== 'del') return;
    const id = +b.dataset.id;
    confirmModal('删除知识', '确定删除这条知识吗？', async () => {
      try { await api('/ai/knowledge/' + id, 'DELETE'); toast('已删除'); load(); } catch (err) { toast(err.message, 'err'); }
    });
  };
  load();
}


function renderAiReqs() {
  const page = $('#aiPage');
  page.innerHTML = `
    <div class="card">
      <div class="card-title">🛠 功能修改 / 新增需求登记</div>
      <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:6px;padding:10px 12px;margin-bottom:12px">
        <p class="small" style="line-height:1.8">在 AI 对话或这里登记功能修改/新增需求（例如：某某模块要增加某某功能）。需求提交后由系统管理员排期实现，状态可在下方跟踪。</p>
      </div>
      <div class="form-row">
        <div class="form-field" style="flex:1"><label>需求标题 <b style="color:var(--danger,#dc2626)">*</b></label>
          <input id="rqTitle" placeholder="如：耗材模块增加导出月度报表"></div>
        <div class="form-field" style="flex:2"><label>详细描述</label>
          <textarea id="rqDetail" rows="2" placeholder="具体说明想要的改动/新增功能、使用场景"></textarea></div>
        <div style="display:flex;align-items:flex-end;padding-bottom:2px"><button class="btn btn-primary" id="rqAdd" data-perm="ai:edit">提交需求</button></div>
      </div>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="card-title">📋 需求列表
        <span class="spacer"></span>
        <select id="rqStatus" style="width:auto"><option value="">全部状态</option><option>待处理</option><option>处理中</option><option>已完成</option><option>已关闭</option></select>
      </div>
      <div class="tz-batch" id="rqBatch"></div>
      <div class="table-wrap"><table><thead></thead>
        <tbody id="rqBody"></tbody></table></div>
      <div class="tz-pager" id="rqPager"></div>
    </div>`;
  $('#rqAdd').onclick = async () => {
    const title = $('#rqTitle').value.trim(), detail = $('#rqDetail').value.trim();
    if (!title) { toast('请填写需求标题', 'err'); return; }
    try {
      await api('/ai/requests', 'POST', { title, detail });
      toast('需求已登记');
      $('#rqTitle').value = ''; $('#rqDetail').value = '';
      loadReqs();
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#rqStatus').onchange = () => loadReqs();
  let rqAll = [];
  const tz = new TZTable($('#rqBody').closest('.table-wrap'), {
    id: 'ai_rqBody',
    perm: 'ai',
    columns: [
      { key: 'id', label: '编号', render: v => '#' + v },
      { key: 'title', label: '标题', render: v => `<span style="max-width:220px">${esc(v)}</span>` },
      { key: 'detail', label: '描述', render: v => `<span style="max-width:320px;color:#6b7280">${esc(v || '—')}</span>` },
      { key: 'status', label: '状态', render: v => `<span class="badge ${v === '已完成' ? 'green' : v === '处理中' ? 'blue' : v === '已关闭' ? 'gray' : 'warn'}">${esc(v)}</span>` },
      { key: 'created_by', label: '登记人' },
      { key: 'created_at', label: '登记时间', render: v => `<span class="num">${esc(v)}</span>` },
    ],
    ops: [
      { label: '✅ 完成', act: 'done', show: x => x.status !== '已完成' },
      { label: '▶ 处理中', act: 'doing', show: x => x.status !== '处理中' },
      { label: '🗑 删除', cls: 'btn-danger', act: 'del' },
    ],
    search: ['title', 'detail', 'created_by'],
    searchBox: '',
    pageSize: 10,
    batchEl: '#rqBatch', pagerEl: '#rqPager', emptyEl: '',
    data: rqAll,
    extraFilter: (() => { const st = $('#rqStatus').value; return row => !st || row.status === st; })(),
    onRowOps: (act, x) => {
      if (act === 'done' || act === 'doing') {
        const st = act === 'done' ? '已完成' : '处理中';
        (async () => { try { await api('/ai/requests/' + x.id + '/status', 'POST', { status: st }); toast('状态已更新'); await loadReqs(); } catch (e) { toast(e.message, 'err'); } })();
      }
      if (act === 'del') confirmModal('删除需求', '确定删除该功能修改需求吗？', async () => {
        try { await api('/ai/requests/' + x.id, 'DELETE'); toast('已删除'); rqAll = rqAll.filter(v => v.id !== x.id); tz.setData(rqAll); } catch (e) { toast(e.message, 'err'); }
      });
    },
    onBatch: (act, rows) => {
      if (act === 'del') confirmModal('批量删除', `确定删除选中的 ${rows.length} 条需求吗？`, async () => {
        let ok = 0;
        for (const r of rows) { try { await api('/ai/requests/' + r.id, 'DELETE'); ok++; } catch (e) {} }
        rqAll = rqAll.filter(v => !rows.some(r => r.id === v.id));
        tz.selected.clear(); tz.setData(rqAll); toast('已删除 ' + ok + ' 条');
      });
    },
  });
  const loadReqs = async () => {
    const r = await api('/ai/requests?status=');
    rqAll = r.data || [];
    tz.extraFilter = (() => { const st = $('#rqStatus').value; return row => !st || row.status === st; })();
    tz.setData(rqAll);
  };
  loadReqs();
}

function renderAiStats() {
  const page = $('#aiPage');
  page.innerHTML = `
    <div class="toolbar">
      <select id="asPeriod">
        <option value="daily">📅 每日</option>
        <option value="weekly">🗓️ 每周</option>
        <option value="monthly" selected>📆 每月</option>
      </select>
      <button class="btn btn-primary" id="asQuery">📊 分析</button>
      <span class="spacer"></span>
      <span class="small" id="asTotal"></span>
    </div>
    <div class="stat-grid" id="asSummary"></div>
    <div class="dash-grid" style="margin-top:14px">
      <div class="col">
        <div class="card"><div class="card-title">📈 记录趋势</div><div class="panel-body" id="asTrend"></div></div>
        <div class="card"><div class="card-title">🖥️ 设备类型分布</div><div class="panel-body" id="asType"></div></div>
      </div>
      <div class="col">
        <div class="card"><div class="card-title">🏢 部门分布</div><div class="panel-body" id="asDept"></div></div>
        <div class="card"><div class="card-title">📍 区域分布</div><div class="panel-body" id="asArea"></div></div>
      </div>
    </div>`;
  const load = async () => {
    const period = $('#asPeriod').value;
    const r = await api('/ai/records/stats?period=' + period);
    $('#asTotal').textContent = '累计记录 ' + r.total + ' 条';
    const arr = r.trend.map(x => x.count);
    const sum = arr.reduce((a, b) => a + b, 0);
    const avg = r.trend.length ? sum / r.trend.length : 0;
    $('#asSummary').innerHTML = statCardsHTML([
      { ico: '📝', cls: 'blue', n: r.total, t: '累计记录' },
      { ico: '📈', cls: 'green', n: sum, t: '近' + r.trend.length + (period === 'daily' ? '天' : period === 'weekly' ? '周' : '个月') },
      { ico: '📊', cls: 'warn', n: avg.toFixed(1), t: '平均 / 周期' },
    ]);
    bindStatClick($('#asSummary'), [() => renderAi('records'), () => renderAi('records'), () => renderAi('records')]);
    const mx = Math.max.apply(null, arr.concat([1]));
    $('#asTrend').innerHTML = `<div style="display:flex;align-items:flex-end;gap:4px;height:150px;padding:10px 4px 0">
      ${r.trend.map(x => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
        <div style="width:70%;background:linear-gradient(180deg,#3b82f6,#1d4ed8);border-radius:4px 4px 0 0;height:${Math.max(2, Math.round(x.count / mx * 100))}%" title="${esc(x.label)}: ${x.count} 条"></div>
      </div>`).join('')}</div>
      <div style="display:flex;gap:4px;padding:0 4px">${r.trend.map(x => `<div style="flex:1;text-align:center;font-size:11px;color:#6b7280;white-space:nowrap;overflow:hidden">${esc(x.label)}</div>`).join('')}</div>
      <div style="text-align:center;font-size:12px;color:#6b7280;margin-top:6px">${period === 'daily' ? '近 30 天' : period === 'weekly' ? '近 12 周' : '近 12 个月'}记录数</div>`;
    const bar = (list) => {
      const m2 = Math.max.apply(null, list.map(x => x.count).concat([1]));
      return `<div style="max-height:320px;overflow-y:auto">` + (list.length ? list.map(x => `<div style="display:flex;align-items:center;gap:8px;margin:5px 0">
        <span style="width:130px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(x.name)}">${esc(x.name)}</span>
        <div style="flex:1;background:#f3f4f6;border-radius:4px;height:18px"><div style="height:18px;width:${Math.max(2, Math.round(x.count / m2 * 100))}%;background:#10b981;border-radius:4px"></div></div>
        <span style="width:44px;text-align:right;font-size:12px">${x.count}</span></div>`).join('') : '<div class="empty">暂无数据</div>') + `</div>`;
    };
    $('#asType').innerHTML = bar(r.by_type);
    $('#asDept').innerHTML = bar(r.by_dept);
    $('#asArea').innerHTML = bar(r.by_area);
  };
  $('#asQuery').onclick = load;
  load();
}

function parseCsvText(text, type) {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l);
  if (!lines.length) return [];
  const sep = lines[0].includes('\t') ? '\t' : /[,，]/;
  const header = lines[0].split(sep).map(h => h.trim());
  const idx = {};
  const names = type === 'records'
    ? ['工单名称', '工单描述', '需求人', '原始信息', '记录时间', 'title', 'summary', 'requester', 'raw_text', 'created_at']
    : ['标题', '内容', '标签', '创建时间', 'title', 'content', 'tags', 'created_at'];
  header.forEach((h, i) => { const n = names.find(x => h.indexOf(x) >= 0); if (n) idx[n] = i; });
  const pick = (key, def) => (idx[key] !== undefined ? (lines[i].split(sep)[idx[key]] || '') : (def !== undefined ? def : ''));
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    if (type === 'records') {
      const o = { title: pick('工单名称', '').trim(), summary: pick('工单描述', '').trim(), requester: pick('需求人', '').trim(), raw_text: pick('原始信息', ''), created_at: pick('记录时间', '') };
      if (o.title || o.summary) out.push(o);
    } else {
      const o = { title: pick('标题', '').trim(), content: pick('内容', '').trim(), tags: pick('标签', '').trim(), created_at: pick('创建时间', '') };
      if (o.title && o.content) out.push(o);
    }
  }
  return out;
}

function downloadTemplate(type) {
  const head = type === 'records' ? ['工单名称', '工单描述', '需求人', '原始信息', '记录时间'] : ['标题', '内容', '标签', '创建时间'];
  const sample = type === 'records'
    ? ['电脑--3楼--财务科--无法开机--TZ20260901', '电脑无法开机，电源故障已处理', '李某某', '3楼财务科小李电脑开不了机', '2026-09-25 09:30:00']
    : ['三星4521硒鼓更换步骤', '1.关机断电 2.取出旧硒鼓 3.装入新硒鼓 4.开机测试', '打印机,耗材,维修', '2026-09-25 09:30:00'];
  const blob = new Blob(['\ufeff' + [head.join(','), sample.join(',')].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (type === 'records' ? '工作记录导入模板' : '知识库导入模板') + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function openAiImport(type) {
  const isRec = type === 'records';
  openModal(isRec ? '📥 批量导入工作记录' : '📥 批量导入知识', `
    <p class="small">支持粘贴文本或上传 CSV 文件（也可先导出 CSV 修改后再导入）。第一行为表头：
      ${isRec ? '工单名称,工单描述,需求人,原始信息,记录时间' : '标题,内容,标签,创建时间'}。
      记录时间可留空（自动取当前时间）。</p>
    <div class="toolbar" style="margin-bottom:8px"><button class="btn" id="aiImpTpl">📄 下载模板</button></div>
    <textarea id="aiImpText" rows="8" style="width:100%;font-family:monospace;font-size:12px" placeholder="粘贴 CSV / 表格文本…"></textarea>
    <div style="margin-top:8px"><input type="file" id="aiImpFile" accept=".csv,.txt"></div>
    <p class="small" id="aiImpMsg" style="margin-top:6px;color:#6b7280"></p>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">导入</button>');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#aiImpTpl').onclick = () => downloadTemplate(type);
  $('#aiImpFile').onchange = () => {
    const f = $('#aiImpFile').files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { $('#aiImpText').value = rd.result; $('#aiImpMsg').textContent = '已读取文件：' + f.name; };
    rd.readAsText(f, 'utf-8');
    $('#aiImpFile').value = '';
  };
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const rows = parseCsvText($('#aiImpText').value, type);
    if (!rows.length) { toast('未解析到有效数据，请检查内容或模板格式', 'err'); return; }
    try {
      const r = await api('/ai/' + (isRec ? 'records' : 'knowledge') + '/import', 'POST', { rows });
      closeModal();
      toast('导入成功 ' + r.imported + ' 条' + (r.skipped ? '，跳过 ' + r.skipped + ' 条' : ''), 'ok');
      if (isRec) renderAiRecords(); else renderAiKb();
    } catch (e) { toast(e.message, 'err'); }
  };
}

function openAiSettings() {
  api('/ai/settings').then(r => {
    const ml = r.model_list || [];
    const curId = r.active_model || (ml[0]?.id);
    const listHtml = ml.map((m,i) => `
      <div class="ai-model-row" data-id="${esc(m.id)}" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:8px;background:${m.id===curId?'#eef3ff':'#fff'}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <b style="flex:1">${m.id===curId?'✅ ':''}${esc(m.name||m.model||'未命名')}</b>
          <button class="btn btn-sm" data-act="set" style="padding:2px 8px">设为当前</button>
          <button class="btn btn-sm" data-act="del" style="padding:2px 8px;color:#dc2626">删除</button>
        </div>
        <div class="small" style="color:#6b7280">接口：${esc(m.api_base||'-')} · 模型：${esc(m.model||'-')}</div>
      </div>`).join('') || '<div class="small" style="color:#9ca3af">暂无模型，点下方添加</div>';
    openModal('AI 模型管理（可配置多个，随时切换）', `
      <p class="small" style="margin-bottom:10px">可添加多个模型配置，对话时在左上角下拉切换。所有 Key 仅保存在本机数据库。</p>
      <div id="aiModelList">${listHtml}</div>
      <div style="border-top:1px dashed #e5e7eb;margin:12px 0;padding-top:12px">
        <div style="font-weight:600;margin-bottom:8px">＋ 添加新模型</div>
        <div class="form-field"><label>名称（如：主力122B / 快速4B）</label><input id="aiN_name" placeholder="主力122B"></div>
        <div class="form-field"><label>API 地址</label><input id="aiN_base" placeholder="http://10.138.76.101:32788/v1"></div>
        <div class="form-field"><label>模型名</label><input id="aiN_model" placeholder="Qwen3.5-122B"></div>
        <div class="form-field"><label>API Key</label><input id="aiN_key" placeholder="sk-..."></div>
        <button class="btn" id="aiAddModel">＋ 添加</button>
      </div>`,
      '<button class="btn" data-a="cancel">关闭</button>');
    $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
    const refreshList = async () => {
      const r2 = await api('/ai/settings');
      openAiSettings();
    };
    $('#aiModelList')?.querySelectorAll('[data-act=set]').forEach(b => b.onclick = async (e) => {
      const id = e.target.closest('.ai-model-row').dataset.id;
      await api('/ai/settings', 'PUT', { switch_to: id });
      toast('已切换到当前模型', 'ok');
      openAiSettings();
    });
    $('#aiModelList')?.querySelectorAll('[data-act=del]').forEach(b => b.onclick = async (e) => {
      const id = e.target.closest('.ai-model-row').dataset.id;
      const r2 = await api('/ai/settings');
      const newList = (r2.model_list||[]).filter(m => m.id !== id);
      await api('/ai/settings', 'PUT', { model_list: newList, active_model: newList[0]?.id });
      toast('已删除', 'ok');
      openAiSettings();
    });
    $('#aiAddModel').onclick = async () => {
      const name = $('#aiN_name').value.trim();
      const base = $('#aiN_base').value.trim();
      const model = $('#aiN_model').value.trim();
      const key = $('#aiN_key').value.trim();
      if (!base || !model) return toast('接口和模型名必填', 'err');
      const r2 = await api('/ai/settings');
      const newList = r2.model_list || [];
      newList.push({ id: 'm'+Date.now(), name, api_base: base, api_key: key, model });
      await api('/ai/settings', 'PUT', { model_list: newList, active_model: newList[newList.length-1].id });
      toast('已添加', 'ok');
      openAiSettings();
    };
  }).catch(e => toast(e.message, 'err'));
}

/* ============ 记事本（富文本笔记 + 待办） ============ */
let notesList = [], notesCats = [], notesSelId = null, notesSaveTimer = null;
async function renderNotes() {
  const c = $('#content');
  c.innerHTML = `
    <div class="notes-layout">
      <div class="notes-side">
        <div class="notes-hero">
          <div class="notes-hero-t">📝 我的笔记</div>
          <div class="notes-hero-s">记录工作 · 待办 · 灵感</div>
        </div>
        <div class="toolbar">
          <input type="text" id="noteSearch" class="grow" placeholder="搜索标题/内容…">
          <button class="btn btn-primary" id="noteNew">＋ 新建</button>
        </div>
        <div class="note-filters" id="noteFilters">
          <span class="chip active" data-todo="">全部</span>
          <span class="chip" data-todo="undone">☐ 待办中</span>
          <span class="chip" data-todo="done">☑ 已完成</span>
        </div>
        <div class="note-cats" id="noteCats"></div>
        <div id="noteList" class="note-list"></div>
        <div class="note-trash-bar" id="noteTrashBar">
          <span>🗑️ 回收站 <b id="trashCount">0</b></span>
          <span class="trash-arrow">›</span>
        </div>
      </div>
      <div class="note-editor" id="noteEditor">
        <div class="note-placeholder">
          <div class="np-icon">📝</div>
          <div>从左侧选一篇笔记，或点「＋ 新建」开始记录</div>
        </div>
      </div>
    </div>
    <style>
      .notes-layout{display:grid;grid-template-columns:340px 1fr;gap:14px;height:calc(100vh - 130px)}
      .notes-side{display:flex;flex-direction:column;gap:10px;overflow:hidden;background:linear-gradient(180deg,#eef2ff 0%,#fff 120px);border-radius:14px;padding:12px;border:1px solid #e5e7eb}
      .notes-hero{padding:4px 6px 8px;border-bottom:1px dashed #e0e7ff}
      .notes-hero-t{font-size:17px;font-weight:700;color:#312e81}
      .notes-hero-s{font-size:12px;color:#6366f1;margin-top:2px}
      .note-filters{display:flex;gap:6px;flex-wrap:wrap}
      #noteFilters .chip{padding:4px 12px;border-radius:14px;background:#f1f5f9;font-size:13px;cursor:pointer;user-select:none;transition:.15s;border:1px solid transparent}
      #noteFilters .chip.active{color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.12)}
      #noteFilters .chip[data-todo=""].active{background:#4f46e5}
      #noteFilters .chip[data-todo="undone"].active{background:#f59e0b}
      #noteFilters .chip[data-todo="done"].active{background:#10b981}
      .note-cats{display:flex;gap:6px;flex-wrap:wrap;max-height:40px;overflow:auto}
      .note-cats .chip{font-size:12px;padding:2px 10px}
      .note-cats .chip[data-cat="工作"]{background:#dbeafe;color:#1e40af}
      .note-cats .chip[data-cat="待办"]{background:#fef3c7;color:#92400e}
      .note-cats .chip[data-cat="会议"]{background:#d1fae5;color:#065f46}
      .note-cats .chip[data-cat="技术"]{background:#cffafe;color:#155e75}
      .note-cats .chip[data-cat="其他"]{background:#f3f4f6;color:#374151}
      .note-cats .chip.active{outline:2px solid #4f46e5;outline-offset:1px}
      .note-list{overflow:auto;flex:1;display:flex;flex-direction:column;gap:8px;padding-right:4px}
      .note-card{background:#fff;border:1px solid #e5e7eb;border-left-width:3px;border-radius:10px;padding:10px 12px;cursor:pointer;transition:.15s;box-shadow:0 1px 2px rgba(0,0,0,.03)}
      .note-card:hover{border-color:#818cf8;transform:translateY(-1px);box-shadow:0 4px 12px rgba(99,102,241,.12)}
      .note-card.todo{border-left-color:#f59e0b}
      .note-card.pinned{border-left-color:#3b82f6}
      .note-card.todo.pinned{border-left:3px solid transparent;border-left-image:linear-gradient(180deg,#f59e0b,#3b82f6) 1}
      .note-card.sel{border-color:#4f46e5;box-shadow:0 0 0 2px rgba(79,70,229,.18)}
      .note-card h4{margin:0 0 4px;font-size:14px;display:flex;align-items:center;gap:6px}
      .note-card .prev{font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
      .note-card .meta{font-size:11px;color:#9ca3af;margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .note-card.done h4{text-decoration:line-through;color:#9ca3af}
      .note-card.trash{opacity:.75;background:#fef2f2;border-color:#fecaca}
      .note-card .badge{font-size:10px;padding:1px 6px;border-radius:8px;background:#fee2e2;color:#b91c1c}
      .note-card .badge.todo{background:#fef3c7;color:#92400e}
      .note-card .badge.pin{background:#dbeafe;color:#1e40af}
      .todo-ico{display:inline-block;width:14px;height:14px;border:2px solid #a5b4fc;border-radius:4px;flex-shrink:0;position:relative;top:2px}
      .todo-ico.done{background:#4f46e5;border-color:#4f46e5}
      .todo-ico.done::after{content:'';position:absolute;left:3px;top:0px;width:4px;height:8px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
      .pin-ico{font-size:13px}
      .nc-row{display:flex;gap:10px;align-items:flex-start}
      .nc-main{flex:1;min-width:0}
      .nc-spacer{width:20px;flex-shrink:0}
      .nc-todo-check{width:20px;height:20px;border:2px solid #d1d5db;border-radius:50%;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff;transition:.15s;margin-top:2px;user-select:none}
      .nc-todo-check:hover{border-color:#4f46e5;transform:scale(1.1)}
      .nc-todo-check.checked{background:#10b981;border-color:#10b981}
      .note-card.done .nc-main h4{color:#9ca3af}
      .due{color:#dc2626;font-weight:500}
      .note-editor{background:#fff;border:1px solid #e5e7eb;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04)}
      .note-placeholder{margin:auto;color:#9ca3af;font-size:14px;text-align:center}
      .np-icon{font-size:42px;margin-bottom:10px;opacity:.6}
      .note-title{border:none;outline:none;font-size:20px;font-weight:600;padding:14px 16px 4px;width:100%;box-sizing:border-box}
      .note-meta{display:flex;gap:10px;align-items:center;padding:0 16px 8px;font-size:12px;color:#6b7280;flex-wrap:wrap}
      .note-meta label{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
      #neQuill{flex:1;display:flex;flex-direction:column;overflow:hidden}
      #noteEditor .ql-toolbar{border-top:none;border-left:none;border-right:none;flex-wrap:wrap;background:linear-gradient(180deg,#f5f7ff,#fafbff);gap:2px;padding:6px 10px}
      #noteEditor .ql-toolbar button{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;transition:.15s}
      #noteEditor .ql-toolbar button:hover{background:#e0e7ff}
      #noteEditor .ql-toolbar button.ql-active{background:#c7d2fe;color:#4338ca}
      #noteEditor .ql-undo::before{content:'↺';font-size:16px;font-weight:bold;color:#475569}
      #noteEditor .ql-redo::before{content:'↻';font-size:16px;font-weight:bold;color:#475569}
      #noteEditor .ql-todo::before{content:'☑';font-size:15px;color:#4f46e5}
      #noteEditor .ql-undo:hover::before,#noteEditor .ql-redo:hover::before{color:#4f46e5}
      #neQuill{flex:1;overflow:auto}
      #neQuill .ql-editor{min-height:260px;line-height:1.7;font-size:14px}
      #neQuill .ql-editor img{max-width:100%;height:auto;border-radius:6px;cursor:zoom-in;display:block;margin:8px auto;box-shadow:0 2px 8px rgba(0,0,0,.1)}
      #neQuill .ql-editor blockquote{border-left:3px solid #a5b4fc;margin:6px 0;padding:4px 12px;color:#6b7280;background:#eef2ff;border-radius:0 6px 6px 0}
      #neQuill .ql-editor .ql-todo{display:block;padding:4px 4px 4px 30px;position:relative;min-height:26px;border-radius:6px}
      #neQuill .ql-editor .ql-todo::before{content:'';position:absolute;left:6px;top:7px;width:16px;height:16px;border:2px solid #a5b4fc;border-radius:4px;background:#fff;cursor:pointer;transition:.15s;box-sizing:border-box}
      #neQuill .ql-editor .ql-todo:hover::before{border-color:#4f46e5;background:#eef2ff}
      #neQuill .ql-editor .ql-todo.done::before{background:#4f46e5;border-color:#4f46e5}
      #neQuill .ql-editor .ql-todo.done::after{content:'';position:absolute;left:10px;top:8px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
      #neQuill .ql-editor .ql-todo.done{color:#9ca3af;text-decoration:line-through}
      .note-trash-bar{margin-top:8px;padding:8px 12px;border-radius:10px;background:linear-gradient(135deg,#fef2f2,#fee2e2);color:#991b1b;font-size:13px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border:1px solid #fecaca;transition:.15s;font-weight:500}
      .note-trash-bar:hover{background:#fecaca;transform:translateY(-1px)}
      .trash-arrow{font-size:18px;font-weight:bold}
      .trash-view-hint{padding:10px 14px;background:#fff7ed;border:1px dashed #fdba74;border-radius:10px;color:#9a3412;font-size:13px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
      #noteNew{background:linear-gradient(135deg,#4f46e5,#6366f1);border:none;box-shadow:0 2px 6px rgba(79,70,229,.3)}
      #noteNew:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(79,70,229,.4)}
      .note-card h4{font-size:14px;line-height:1.4;margin:0}
      .card-tools{position:absolute;top:8px;right:8px;display:flex;gap:4px;opacity:0;transition:.15s}
      .note-card:hover .card-tools{opacity:1}
      .ctool{width:26px;height:26px;border-radius:6px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.08)}
      .ctool:hover{background:#eef2ff;border-color:#a5b4fc}
      .ctool.on{background:#fef3c7;border-color:#f59e0b;color:#92400e}
      .note-card{position:relative}
      @media (max-width: 900px){
        .notes-layout{grid-template-columns:1fr;height:auto}
        .notes-side{max-height:45vh}
      }
    </style>`;
  let todoFilter = '', catFilter = '', kw = '', trashMode = false;
  const loadList = async () => {
    const qs = new URLSearchParams({ q: kw, todo: todoFilter });
    if (catFilter) qs.set('category', catFilter);
    if (trashMode) qs.set('trashed', '1');
    const r = await api('/notes?' + qs.toString());
    notesList = r.data || [];
    notesCats = r.categories || [];
    $('#trashCount').textContent = r.trash_count || 0;
    if (trashMode) {
      $('#noteList').innerHTML = '<div class="trash-view-hint"><span>🗑️ 回收站：笔记删除后保留 30 天，可恢复或彻底删除</span></div>';
    }
    $('#noteCats').innerHTML = trashMode ? '' : ['<span class="chip" data-cat="">全部分类</span>'].concat(
      notesCats.map(c => `<span class="chip ${catFilter===c?'active':''}" data-cat="${esc(c)}">${esc(c)}</span>`)).join('');
    $('#noteFilters').style.display = trashMode ? 'none' : 'flex';
    const cards = notesList.map(x => {
      const badges = [];
      if (x.pinned) badges.push('<span class="badge pin">📌 置顶</span>');
      if (x.is_todo && !x.todo_done) badges.push('<span class="badge todo">☐ 待办</span>');
      if (x.todo_done) badges.push('<span class="badge">✓ 已完成</span>');
      const trashBtns = trashMode ? `<div style="margin-top:8px;display:flex;gap:6px">
          <button class="btn btn-sm" data-op="restore" data-id="${x.id}" style="background:#dcfce7;color:#166534">↩ 恢复</button>
          <button class="btn btn-sm btn-danger" data-op="hard" data-id="${x.id}">✕ 彻底删除</button>
        </div>` : '';
      return `
      <div class="note-card ${notesSelId===x.id?'sel':''} ${x.todo_done?'done':''} ${x.is_todo && !x.todo_done?'todo':''} ${x.pinned?'pinned':''} ${trashMode?'trash':''}" data-id="${x.id}">
        <div class="card-tools">
          <button class="ctool ${x.is_todo?'on':''}" data-todo="${x.id}" title="${x.is_todo?'取消待办':'标为待办'}">☐</button>
          <button class="ctool ${x.pinned?'on':''}" data-pin="${x.id}" title="${x.pinned?'取消置顶':'置顶'}">📌</button>
        </div>
        <div class="nc-row">
          ${x.is_todo ? `<span class="nc-todo-check ${x.todo_done?'checked':''}" data-tog="${x.id}" title="点击切换完成">${x.todo_done?'✓':''}</span>` : '<span class="nc-spacer"></span>'}
          <div class="nc-main">
            <h4>${esc(x.title||'未命名')}</h4>
            <div class="prev">${esc((x.preview||'').replace(/<[^>]+>/g,' ').slice(0,80))}</div>
            <div class="meta"><span>${esc(x.author_name||'')}</span><span>${(x.updated_at||'').slice(5,16)}</span>${x.todo_due?`<span class="due">⏰${x.todo_due}</span>`:''}</div>
          </div>
        </div>
        <div style="margin-top:4px">${badges.join(' ')}</div>
        ${trashBtns}
      </div>`;
    }).join('');
    if (trashMode) {
      $('#noteList').innerHTML += (notesList.length ? cards : '<div class="empty" style="padding:20px;text-align:center;color:#9ca3af">回收站是空的</div>');
    } else {
      $('#noteList').innerHTML = notesList.length ? cards : '<div class="empty" style="padding:20px;text-align:center;color:#9ca3af">暂无笔记，点「＋ 新建」开始</div>';
    }
  };
  $('#noteSearch').oninput = (e) => { kw = e.target.value.trim(); loadList(); };
  $('#noteFilters').onclick = (e) => {
    const ch = e.target.closest('.chip'); if (!ch) return;
    todoFilter = ch.dataset.todo;
    $$('.chip', $('#noteFilters')).forEach(x => x.classList.toggle('active', x === ch));
    loadList();
  };
  $('#noteCats').onclick = (e) => {
    const ch = e.target.closest('.chip'); if (!ch) return;
    catFilter = ch.dataset.cat; loadList();
  };
  $('#noteTrashBar').onclick = () => {
    trashMode = !trashMode; notesSelId = null;
    $('#noteEditor').innerHTML = '<div class="note-placeholder"><div class="np-icon">🗑️</div><div>回收站模式</div></div>';
    loadList();
  };
  $('#noteNew').onclick = async () => {
    if (trashMode) return;
    const r = await api('/notes', 'POST', { title: '未命名笔记', category: '默认' });
    notesSelId = r.id;
    await loadList(); openEditor(r.id);
  };
  $('#noteList').onclick = async (e) => {
    const tog = e.target.closest('[data-tog]');
    if (tog) {
      e.stopPropagation();
      const id = tog.dataset.tog;
      const willDone = !tog.classList.contains('checked');
      try { await api('/notes/' + id, 'PUT', { todo_done: willDone }); loadList(); } catch(err) { toast(err.message,'err'); }
      return;
    }
    const tBtn = e.target.closest('[data-todo]');
    if (tBtn) {
      e.stopPropagation();
      const id = tBtn.dataset.todo;
      const on = !tBtn.classList.contains('on');
      try { await api('/notes/' + id, 'PUT', { is_todo: on, todo_done: on ? false : false }); loadList(); } catch(err) { toast(err.message,'err'); }
      return;
    }
    const pBtn = e.target.closest('[data-pin]');
    if (pBtn) {
      e.stopPropagation();
      const id = pBtn.dataset.pin;
      const on = !pBtn.classList.contains('on');
      try { await api('/notes/' + id, 'PUT', { pinned: on }); loadList(); } catch(err) { toast(err.message,'err'); }
      return;
    }
    const rb = e.target.closest('button[data-op]');
    if (rb) {
      e.stopPropagation();
      const id = rb.dataset.id;
      if (rb.dataset.op === 'restore') {
        await api('/notes/' + id + '/restore', 'POST'); toast('已恢复'); loadList();
      } else if (rb.dataset.op === 'hard') {
        confirmModal('彻底删除', '此操作不可恢复，确定永久删除？', async () => {
          await api('/notes/' + id + '/hard', 'DELETE'); toast('已彻底删除'); loadList();
        });
      }
      return;
    }
    const card = e.target.closest('.note-card'); if (!card) return;
    notesSelId = +card.dataset.id;
    $$('.note-card', $('#noteList')).forEach(x => x.classList.toggle('sel', x === card));
    if (!trashMode) openEditor(notesSelId);
  };
  const openEditor = async (id) => {
    const r = await api('/notes/' + id);
    const n = r.data;
    if (window._quill) { try { window._quill = null; } catch(e){} }
    $('#noteEditor').innerHTML = `
      <input class="note-title" id="neTitle" value="${esc(n.title||'')}" placeholder="笔记标题">
      <div class="note-meta">
        <span>✍️ ${esc(n.author_name||'')}</span>
        <span>🕐 ${(n.updated_at||'').slice(0,16)}</span>
        <label>分类 <select id="neCat">${['默认','工作','待办','会议','技术','其他'].concat(notesCats.filter(x=>!['默认','工作','待办','会议','技术','其他'].includes(x))).map(c=>`<option ${n.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
        <span class="spacer"></span>
        <span style="font-size:11px;color:#16a34a">● 自动保存中</span>
        <button class="btn btn-danger btn-sm" id="neDel">🗑 删除到回收站</button>
      </div>
      <div id="neQuill"></div>
      <input type="file" id="neFile" accept="image/*" style="display:none">`;
    const save = (extra, immediate) => {
      clearTimeout(notesSaveTimer);
      const doSave = async () => {
        const html = window._quill ? window._quill.root.innerHTML : '';
        const body = { title: $('#neTitle').value.trim() || '未命名笔记', content: html, category: $('#neCat').value };
        if (extra) Object.assign(body, extra);
        try { await api('/notes/' + id, 'PUT', body); loadList(); } catch (e) {}
      };
      if (immediate) doSave(); else notesSaveTimer = setTimeout(doSave, 700);
    };
    // 注册待办 blot（Quill 原生 block，支持回车新建、删除、撤销、完成态）
    if (!Quill.imports['blots/todo']) {
      const Block = Quill.import('blots/block');
      class TodoBlot extends Block {
        static formats(node) { return { done: node.classList.contains('done') }; }
        format(name, value) {
          if (name === 'done') {
            this.domNode.classList.toggle('done', !!value);
          } else {
            super.format(name, value);
          }
        }
      }
      TodoBlot.blotName = 'todo';
      TodoBlot.tagName = 'div';
      TodoBlot.className = 'ql-todo';
      Quill.register({ 'blots/todo': TodoBlot, 'formats/todo': TodoBlot });
    }
    const quill = new Quill('#neQuill', {
      theme: 'snow',
      placeholder: '开始写点什么…支持撤销/重做、插入图片和待办行',
      modules: {
        history: { delay: 1000, maxStack: 200, userOnly: true },
        toolbar: {
          container: [[{header:[1,2,3,false]}], ['bold','italic','underline','strike'],
            [{list:'ordered'},{list:'bullet'}], ['link','image','blockquote','code-block'], ['clean']],
          handlers: {
            image: () => { $('#neFile').click(); },
            undo: () => quill.history.undo(),
            redo: () => quill.history.redo(),
            todo: () => {
              const range = quill.getSelection(true);
              quill.insertText(range.index, '\n', 'user');
              quill.formatLine(range.index + 1, 1, 'todo', true, 'user');
              quill.setSelection(range.index + 1, 0);
              save();
            }
          }
        }
      }
    });
    window._quill = quill;
    if (n.content) {
      quill.clipboard.dangerouslyPasteHTML(n.content);
      // 手动恢复待办完成态：dangerouslyPasteHTML 还原时会剥掉 done 类，需按原始内容重建
      const tmp = document.createElement('div');
      tmp.innerHTML = n.content;
      const srcTodos = Array.prototype.slice.call(tmp.querySelectorAll('.ql-todo'));
      const edTodos = Array.prototype.slice.call(quill.root.querySelectorAll('.ql-todo'));
      let restored = false;
      srcTodos.forEach((t, i) => {
        if (t.classList.contains('done') && edTodos[i]) {
          const blot = Quill.find(edTodos[i]);
          if (blot) {
            const idx = blot.offset(quill.scroll);
            quill.formatLine(idx, 1, 'done', true, 'user');
            restored = true;
          }
        }
      });
      if (restored) save(null, true);
    }
    // 手动加撤销/重做/待办按钮（Quill 主题不自带）
    const tb = document.querySelector('#noteEditor .ql-toolbar');
    if (tb) {
      const mk = (cls, title, onClick) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ql-' + cls; b.title = title;
        b.onclick = onClick;
        tb.appendChild(b);
      };
      mk('undo', '撤销', () => quill.history.undo());
      mk('redo', '重做', () => quill.history.redo());
      mk('todo', '插入待办行', () => {
        const range = quill.getSelection(true);
        quill.insertText(range.index, '\n', 'user');
        quill.formatLine(range.index + 1, 1, 'todo', true, 'user');
        quill.setSelection(range.index + 1, 0);
        save();
      });
    }
    $('#neFile').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const fd = new FormData(); fd.append('file', f);
      try {
        const r = await fetch('/api/upload', { method:'POST', body: fd, credentials:'same-origin' }).then(x=>x.json());
        if (r.ok) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, 'image', r.url, 'user');
          quill.setSelection(range.index + 1); save();
        } else { toast(r.error || '图片上传失败', 'err'); }
      } catch (err) { toast('图片上传失败', 'err'); }
      e.target.value = '';
    };
    quill.on('text-change', () => save());
    $('#neTitle').addEventListener('input', () => save());
    $('#neCat').onchange = () => save();
    // 待办行点击切换完成态
    $('#noteEditor').onclick = (e) => {
      const img = e.target.closest('#neQuill img');
      if (img) {
        const lb = document.createElement('div');
        lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
        lb.innerHTML = `<img src="${img.src}" style="max-width:92vw;max-height:92vh;box-shadow:0 8px 40px rgba(0,0,0,.5)">`;
        lb.onclick = () => lb.remove();
        document.body.appendChild(lb);
        return;
      }
      const tl = e.target.closest('#neQuill .ql-todo');
      if (tl) {
        const rect = tl.getBoundingClientRect();
        // 点左边框 30px 内（方框位置）才切换完成，点文字正常编辑
        if (e.clientX - rect.left < 30) {
          e.preventDefault();
          const blot = Quill.find(tl);
          if (blot) {
            const idx = blot.offset(quill.scroll);
            quill.formatLine(idx, 1, 'done', !tl.classList.contains('done'), 'user'); // 走 Quill 模型，完成态随内容保存
            save(null, true); // 立即保存，避免勾选后马上刷新丢失
          }
        }
      }
    };
    $('#neDel').onclick = () => confirmModal('移入回收站', `将「${n.title||'未命名'}」移入回收站？可在回收站恢复。`, async () => {
      try { await api('/notes/' + id, 'DELETE'); notesSelId = null; window._quill = null; $('#noteEditor').innerHTML = '<div class="note-placeholder">已移入回收站</div>'; loadList(); }
      catch (e) { toast(e.message, 'err'); }
    });
  };
  loadList();
}

/* ============ 系统管理 ============ */
async function renderSystem(tab) {
  const cur = tab || 'users';
  const c = $('#content');
  c.innerHTML = `
    <div class="tabs" data-mod="system">
      <div class="tab ${cur === 'users' ? 'active' : ''}" data-t="users">用户管理</div>
      <div class="tab ${cur === 'backup' ? 'active' : ''}" data-t="backup">数据备份</div>
      <div class="tab ${cur === 'logs' ? 'active' : ''}" data-t="logs">操作日志</div>
      <div class="tab ${cur === 'password' ? 'active' : ''}" data-t="password">修改密码</div>
      <div class="tab ${cur === 'menu' ? 'active' : ''}" data-t="menu">菜单设置</div>
    </div>
    <div id="sysPage"></div>`;
  $$('.tab', c).forEach(t => t.onclick = () => renderSystem(t.dataset.t));
  if (cur === 'users') renderUsers();
  if (cur === 'backup') renderBackup();
  if (cur === 'logs') renderLogs();
  if (cur === 'password') renderPassword();
  if (cur === 'menu') renderMenu();
}

/* 菜单设置：模块显隐 + 排序（每账号本机记忆） */
function renderMenu() {
  const page = $('#sysPage');
  const cfg = getNavCfg();
  const order = (Array.isArray(cfg.order) && cfg.order.length ? cfg.order : NAV_ORDER_DEF).filter(p => NAV_DEF[p]);
  const hide = cfg.hide || [];
  page.innerHTML = `
    <div class="toolbar"><span style="color:var(--text2)">设置左侧功能菜单的顺序与显示（仅本机记住）</span></div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th style="width:60px">顺序</th><th>模块</th><th>显示</th><th style="width:150px">操作</th></tr></thead>
      <tbody>${order.map((p, i) => `
        <tr data-p="${p}"><td>${i + 1}</td><td>${NAV_DEF[p].i} ${NAV_DEF[p].t}</td>
        <td><input type="checkbox" class="mnVis" data-p="${p}" ${!hide.includes(p) ? 'checked' : ''}></td>
        <td><div class="ops">
          <button class="btn btn-sm" data-mv="up" data-p="${p}" ${i === 0 ? 'disabled' : ''}>↑ 上移</button>
          <button class="btn btn-sm" data-mv="down" data-p="${p}" ${i === order.length - 1 ? 'disabled' : ''}>↓ 下移</button>
        </div></td></tr>`).join('')}
      </tbody></table></div>
      <div style="padding:10px 14px"><button class="btn btn-primary" id="mnSave">保存设置</button></div>
    </div>`;
  page.querySelector('#mnSave').onclick = () => {
    const rows = [...page.querySelectorAll('tbody tr')].map(tr => tr.dataset.p);
    const h = [];
    page.querySelectorAll('.mnVis').forEach(cb => { if (!cb.checked) h.push(cb.dataset.p); });
    setNavCfg({ order: rows, hide: h });
    renderNav(); toast('菜单设置已保存', 'ok');
  };
  page.querySelectorAll('[data-mv]').forEach(btn => btn.onclick = () => {
    const p = btn.dataset.p, dir = btn.dataset.mv;
    const idx = order.indexOf(p);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= order.length) return;
    [order[idx], order[swap]] = [order[swap], order[idx]];
    setNavCfg({ order, hide });
    renderMenu();
  });
}

let userList = [];
async function renderUsers() {
  const page = $('#sysPage');
  page.innerHTML = `
    <div class="toolbar"><span style="color:var(--text2)">管理员账号管理</span><span class="spacer"></span>
    <button class="btn" id="uBatch" data-perm="system:edit">📋 批量创建</button>
    <button class="btn btn-primary" id="uAdd" data-perm="system:edit">＋ 新增管理员</button></div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>用户名</th><th>姓名</th><th>角色</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
      <tbody id="uBody"></tbody></table></div></div>`;
  const r = await api('/users');
  userList = r.data;
  $('#uBody').innerHTML = userList.map(u => `
    <tr><td>${u.id}</td><td>${esc(u.username)}</td><td>${esc(u.real_name)}</td>
    <td>${u.role === 'admin' ? '<span class="badge badge-blue">管理员</span>' : '<span class="badge badge-gray">只读</span>'}</td>
    <td>${u.active ? '<span class="badge badge-green">启用</span>' : '<span class="badge badge-gray">停用</span>'}</td>
    <td>${esc(u.created_at)}</td>
    <td><div class="ops">
      <button class="btn btn-sm" data-a="edit" data-id="${u.id}">编辑</button>
      <button class="btn btn-sm" data-a="reset" data-id="${u.id}">重置密码</button>
      <button class="btn btn-sm btn-danger" data-a="del" data-id="${u.id}">删除</button>
    </div></td></tr>`).join('');
  $('#uAdd').onclick = () => userForm(null);
  $('#uBatch').onclick = batchUserForm;
  $('#uBody').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = +b.dataset.id, u = userList.find(v => v.id === id);
    if (b.dataset.a === 'edit') userForm(u);
    if (b.dataset.a === 'reset') confirmModal('重置密码', `确定将用户「${u.username}（${u.real_name||''}）」的密码重置为 <b>123456</b>？该用户下次登录后可自行修改。`, async () => {
      try { await api('/users/' + id, 'PUT', { password: '123456' }); toast('已重置为 123456', 'ok'); } catch (ex) { toast(ex.message, 'err'); }
    });
    if (b.dataset.a === 'del') confirmModal('删除用户', `确定删除用户「${u.username}」吗？`, async () => {
      try { await api('/users/' + id, 'DELETE'); toast('已删除'); renderUsers(); } catch (e) { toast(e.message, 'err'); }
    });
  };
}

function userForm(u) {
  const d = u || {};
  const isViewer = (d.role || 'admin') !== 'admin';
  let p = {};
  try { p = (typeof d.perms === 'string' ? JSON.parse(d.perms) : (d.perms || {})); } catch (e) { p = {}; }
  const permRows = MODULES.map(m => `
      <div class="perm-row" style="display:flex;align-items:center;gap:10px;padding:6px 4px;border-bottom:1px solid #f0f2f5">
        <span style="width:110px;flex:none">${MODULE_NAMES[m]}</span>
        <select data-pm="${m}" style="flex:1">
          <option value="" ${!p[m] ? 'selected' : ''}>无权限</option>
          <option value="view" ${p[m] === 'view' ? 'selected' : ''}>仅查看</option>
          <option value="edit" ${p[m] === 'edit' ? 'selected' : ''}>可编辑</option>
        </select></div>`).join('');
  const permPanel = `<div class="form-field full"><label>模块权限（仅 viewer 生效）</label><div id="uPerms">${permRows}</div></div>`;
  openModal(u ? '编辑用户' : '新增用户', `
    <div class="form-grid">
      <div class="form-field"><label>用户名 ${u ? '(不可改)' : '*'} </label><input id="u_name" value="${esc(d.username || '')}" ${u ? 'disabled style="background:#f8fafc"' : ''}></div>
      <div class="form-field"><label>${u ? '重置密码（留空不改）' : '密码 *'}</label><input id="u_pass" type="password" placeholder="${u ? '留空保持不变' : '至少4位'}"></div>
      <div class="form-field"><label>姓名</label><input id="u_real" value="${esc(d.real_name || '')}"></div>
      <div class="form-field"><label>角色</label><select id="u_role"><option ${(d.role || 'admin') === 'admin' ? 'selected' : ''}>admin</option><option ${d.role === 'viewer' ? 'selected' : ''}>viewer</option></select></div>
      <div class="form-field full"><label>状态</label><select id="u_active"><option value="1" ${d.active !== 0 ? 'selected' : ''}>启用</option><option value="0" ${d.active === 0 ? 'selected' : ''}>停用</option></select></div>
    </div>
    <div style="margin-top:12px;border-top:1px dashed #e0e3e8;padding-top:10px">${permPanel}</div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存</button>', null, true);
  const permWrap = $('#uPerms');
  const togglePerm = () => {
    const isV = $('#u_role').value === 'viewer';
    permWrap.style.display = isV ? '' : 'none';
  };
  $('#u_role').onchange = togglePerm;
  togglePerm();
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const role = $('#u_role').value;
    const perms = {};
    if (role === 'viewer') {
      document.querySelectorAll('#uPerms [data-pm]').forEach(sel => { if (sel.value) perms[sel.dataset.pm] = sel.value; });
    }
    const body = { username: $('#u_name').value.trim(), password: $('#u_pass').value, real_name: $('#u_real').value.trim(), role, active: +$('#u_active').value, perms };
    try {
      if (u) await api('/users/' + u.id, 'PUT', body); else await api('/users', 'POST', body);
      toast('已保存'); closeModal(); renderUsers();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* 批量创建用户：每行 用户名,密码,姓名,角色（角色可空=viewer） */
function batchUserForm() {
  openModal('批量创建用户', `
    <div style="margin-bottom:10px;color:#667;font-size:13px">每行一条：<b>用户名,密码,姓名,角色</b>（角色可填 admin / viewer，留空默认 viewer）<br>
    viewer 账号默认各模块「仅查看」，创建后可在编辑中调整权限</div>
    <textarea id="uBatchText" rows="10" style="width:100%;border:1px solid #dde1e6;border-radius:6px;padding:10px;font-size:13px;font-family:Consolas,'Courier New',monospace" placeholder="zhangsan,123456,张三,viewer&#10;lisi,123456,李四,admin&#10;wangwu,123456,王五"></textarea>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">开始创建</button>', null, true);
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const lines = $('#uBatchText').value.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (!lines.length) { toast('请先填写要创建的用户', 'err'); return; }
    const users = [];
    for (const ln of lines) {
      const parts = ln.split(',').map(s => s.trim());
      if (!parts[0]) continue;
      users.push({ username: parts[0], password: parts[1] || '123456', real_name: parts[2] || parts[0], role: parts[3] || 'viewer' });
    }
    const btn = $('#modalFoot').querySelector('[data-a=ok]');
    btn.disabled = true; btn.textContent = '创建中…';
    try {
      const r = await api('/users/batch', 'POST', { users });
      closeModal();
      if (r.ok) {
        const fails = (r.data || []).filter(x => !x.ok);
        if (fails.length) {
          toast(`创建完成：成功 ${r.success}/${r.total}，失败 ${fails.length} 条`, 'err');
        } else {
          toast(`批量创建成功 ${r.success} 个账号`, 'ok');
        }
      } else { toast(r.error || '创建失败', 'err'); }
      renderUsers();
    } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = '开始创建'; }
  };
}

async function renderBackup() {
  const page = $('#sysPage');
  page.innerHTML = `
    <div class="toolbar">
      <span style="color:var(--text2)">系统每天自动备份（服务在线即补做），保留最近 60 份</span>
      <span class="spacer"></span>
      <button class="btn btn-primary" id="bkNow" data-perm="system:edit">立即备份</button>
    </div>
    <div class="card">
      <div class="card-title">📦 备份文件（本地 data\\backup 目录）</div>
      <div class="table-wrap"><table><thead><tr><th>文件名</th><th>大小</th><th>时间</th></tr></thead>
      <tbody id="bkFiles"></tbody></table></div>
    </div>
    <div class="card">
      <div class="card-title">🕐 备份记录</div>
      <div class="table-wrap"><table><thead><tr><th>时间</th><th>结果</th><th>文件</th><th>大小</th></tr></thead>
      <tbody id="bkLogs"></tbody></table></div>
    </div>`;
  await loadBackup();
  $('#bkNow').onclick = async () => {
    $('#bkNow').disabled = true;
    try { const r = await api('/backup', 'POST'); toast(r.ok ? '备份成功：' + r.file : '备份失败：' + r.error, r.ok ? '' : 'err'); loadBackup(); } catch (e) { toast(e.message, 'err'); }
    $('#bkNow').disabled = false;
  };
}
async function loadBackup() {
  const r = await api('/backups');
  $('#bkFiles').innerHTML = r.files.length ? r.files.map(f => `
    <tr><td>${esc(f.name)}</td><td class="num">${(f.size / 1024).toFixed(1)} KB</td><td>${esc(f.mtime)}</td></tr>`).join('')
    : '<tr><td colspan="3"><div class="empty">暂无备份文件</div></td></tr>';
  $('#bkLogs').innerHTML = r.logs.length ? r.logs.map(l => `
    <tr><td>${esc(l.time)}</td><td>${l.result === 'ok' ? '<span class="badge badge-green">成功</span>' : '<span class="badge badge-red">失败</span>'}</td>
    <td>${esc(l.file)}</td><td class="num">${l.size ? (l.size / 1024).toFixed(1) + ' KB' : '—'}</td></tr>`).join('')
    : '<tr><td colspan="4"><div class="empty">暂无备份记录</div></td></tr>';
}

async function renderLogs() {
  const page = $('#sysPage');
  page.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <input type="text" id="lgQ" placeholder="搜索用户/操作/详情" class="grow">
        <button class="btn" id="lgRefresh">🔄 刷新</button>
      </div>
      <div class="table-wrap"><table>
        <thead></thead><tbody id="lgBody"></tbody></table></div>
      <div class="empty" id="lgEmpty" style="display:none">暂无日志</div>
      <div class="tz-pager" id="lgPager"></div>
    </div>`;
  const tbl = $('#lgBody').closest('.table-wrap');
  let logAll = [];
  const tz = new TZTable(tbl, {
    id: 'system_lgBody',
    perm: 'system',
    columns: [
      { key: 'time', label: '时间', render: v => `<span class="nowrap">${esc(v)}</span>` },
      { key: 'user', label: '用户' },
      { key: 'action', label: '操作' },
      { key: 'detail', label: '详情', render: v => `<span style="white-space:normal;max-width:380px">${esc(v)}</span>` },
    ],
    ops: [],
    search: ['user', 'action', 'detail'],
    searchBox: '#lgQ',
    pageSize: 10,
    batchEl: '', pagerEl: '#lgPager', emptyEl: '#lgEmpty',
    data: logAll,
  });
  const loadLogs = async () => {
    const r = await api('/logs?page=1&per=100000');
    logAll = r.data || [];
    tz.setData(logAll);
  };
  $('#lgRefresh').onclick = loadLogs;
  await loadLogs();
}

function renderPassword() {
  const page = $('#sysPage');
  page.innerHTML = `
    <div class="card" style="max-width:480px">
      <div class="card-title">🔑 修改当前账号密码</div>
      <div class="form-field"><label>原密码</label><input type="password" id="pw_old"></div>
      <div class="form-field"><label>新密码（至少4位）</label><input type="password" id="pw_new"></div>
      <div class="form-field"><label>确认新密码</label><input type="password" id="pw_new2"></div>
      <button class="btn btn-primary" id="pwBtn">确认修改</button>
    </div>`;
  $('#pwBtn').onclick = async () => {
    const old = $('#pw_old').value, n1 = $('#pw_new').value, n2 = $('#pw_new2').value;
    if (!old) { toast('请输入原密码', 'err'); return; }
    if (n1.length < 4) { toast('新密码至少4位', 'err'); return; }
    if (n1 !== n2) { toast('两次新密码不一致', 'err'); return; }
    try { await api('/password', 'POST', { old, new: n1 }); toast('密码已修改，请重新登录'); setTimeout(() => { $('#logoutBtn').click(); }, 800); } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 启动 ============ */
showApp();


/* ============ 费用统计 ============ */
let _statsData = null;
async function renderStats() {
  const c = $('#content');
  c.innerHTML = `
    <div class="toolbar">
      <select id="stYear"></select>
      <select id="stMonth">
        <option value="">全年</option>
        <option value="1">1月</option><option value="2">2月</option><option value="3">3月</option>
        <option value="4">4月</option><option value="5">5月</option><option value="6">6月</option>
        <option value="7">7月</option><option value="8">8月</option><option value="9">9月</option>
        <option value="10">10月</option><option value="11">11月</option><option value="12">12月</option>
      </select>
      <button class="btn btn-primary" id="stQuery">查询</button>
      <span class="spacer"></span>
      <button class="btn" id="stExport">📤 导出Excel</button>
      <button class="btn" id="stBudget">预算设置</button>
    </div>
    <div class="stat-grid" id="stSummary"></div>
    <div id="stWarn" style="margin-top:10px"></div>
    <div class="dash-grid" style="margin-top:14px">
      <div class="col">
        <div class="card">
          <div class="card-title">📈 月度费用趋势（近12个月）</div>
          <div class="panel-body" id="stTrend"></div>
        </div>
        <div class="card">
          <div class="card-title">🏢 部门费用排行（全量）</div>
          <div class="table-wrap" style="max-height:420px;overflow:auto"><table><thead><tr><th>部门</th><th>次数</th><th>数量</th><th>金额(元)</th></tr></thead>
            <tbody id="stDept"></tbody></table></div>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-title">🏆 耗材费用 TOP（全量）</div>
          <div class="table-wrap" style="max-height:300px;overflow:auto"><table><thead><tr><th>型号</th><th>耗材</th><th>次数</th><th>数量</th><th>金额(元)</th></tr></thead>
            <tbody id="stTop"></tbody></table></div>
        </div>
        <div class="card">
          <div class="card-title">👤 经办人统计</div>
          <div class="table-wrap" style="max-height:260px;overflow:auto"><table><thead><tr><th>经办人</th><th>次数</th><th>数量</th><th>金额(元)</th></tr></thead>
            <tbody id="stOperator"></tbody></table></div>
        </div>
        <div class="card">
          <div class="card-title">💰 预算执行对比（当前年）</div>
          <div class="table-wrap"><table><thead><tr><th>月份</th><th>预算(元)</th><th>实际(元)</th><th>结余(元)</th><th>执行率</th></tr></thead>
            <tbody id="stBudgetBody"></tbody></table></div>
        </div>
      </div>
    </div>`;
  const now = new Date();
  const y = now.getFullYear();
  const years = [y - 1, y, y + 1];
  $('#stYear').innerHTML = years.map(v => `<option value="${v}" ${v === y ? 'selected' : ''}>${v}年</option>`).join('');
  $('#stQuery').onclick = () => loadStats();
  $('#stExport').onclick = () => {
    const y = +$('#stYear').value, m = $('#stMonth').value;
    let start = '', end = '';
    if (m) {
      start = y + '-' + String(m).padStart(2, '0') + '-01';
      end = y + '-' + String(m).padStart(2, '0') + '-' + new Date(y, m, 0).getDate();
    } else { start = y + '-01-01'; end = y + '-12-31'; }
    downloadExport('/api/statistics/export?start=' + start + '&end=' + end);
  };
  $('#stBudget').onclick = () => openBudget();
  await loadStats();
}

async function loadStats() {
  const y = +$('#stYear').value, m = $('#stMonth').value;
  let start = '', end = '';
  if (m) {
    start = y + '-' + String(m).padStart(2, '0') + '-01';
    const last = new Date(y, m, 0).getDate();
    end = y + '-' + String(m).padStart(2, '0') + '-' + last;
  } else {
    start = y + '-01-01'; end = y + '-12-31';
  }
  const r = await api('/statistics?start=' + start + '&end=' + end);
  _statsData = r.data;
  const t = r.data.total;
  const amt = t.a || 0;
  // 预算结余（当前年）
  const budgets = (r.data.budgets || []).filter(b => b.year === y);
  const budgetYear = budgets.reduce((s, b) => s + (b.amount || 0), 0);
  const budgetUsed = (r.data.trend || []).filter(x => x.month.startsWith(String(y))).reduce((s, x) => s + (x.amount || 0), 0);
  const balYear = budgetYear - budgetUsed;
  const rate = budgetYear > 0 ? (budgetUsed / budgetYear * 100).toFixed(1) : '—';
  $('#stSummary').innerHTML = statCardsHTML([
    { ico: '💰', cls: 'blue', n: '¥' + amt.toLocaleString(), t: (m ? y + '年' + m + '月' : y + '年') + '耗材费用' },
    { ico: '📄', cls: 'green', n: t.c, t: '发放次数' },
    { ico: '🧴', cls: 'warn', n: t.q, t: '耗材数量（件）' },
    { ico: '📊', cls: 'red', n: '¥' + budgetYear.toLocaleString() + (budgetYear ? ' / 结余 ¥' + balYear.toLocaleString() + ' (' + rate + '%)' : '（未设置）'), t: '年度预算 / 结余' },
  ]);
  bindStatClick($('#stSummary'), [() => navigate('consumables'), () => navigate('consumables'), () => navigate('consumables'), () => openBudget()]);
  // 趋势柱状图
  const maxA = Math.max(...r.data.trend.map(x => x.amount), 1);
  $('#stTrend').innerHTML = '<div class="trend-bars">' + r.data.trend.map(x => `
    <div class="trend-item" title="${x.month}：¥${(x.amount || 0).toLocaleString()} / ${x.count}次">
      <div class="trend-bar-wrap"><div class="trend-bar" style="height:${Math.max(2, Math.round((x.amount || 0) / maxA * 100))}%"></div></div>
      <div class="trend-val">${(x.amount || 0) >= 10000 ? (x.amount / 10000).toFixed(1) + 'w' : Math.round(x.amount || 0)}</div>
      <div class="trend-label">${x.month.slice(5)}</div>
    </div>`).join('') + '</div>';
  // 部门
  $('#stDept').innerHTML = (r.data.departments || []).length ? r.data.departments.map(x => `
    <tr><td>${esc(x.department)}</td><td class="num">${x.c}</td><td class="num">${x.q}</td><td class="num">¥${(x.a || 0).toLocaleString()}</td></tr>`).join('')
    : '<tr><td colspan="4"><div class="empty">区间内无发放记录</div></td></tr>';
  // TOP（含数量列）
  $('#stTop').innerHTML = (r.data.tops || []).length ? r.data.tops.map(x => `
    <tr><td>${esc(x.model)}</td><td>${esc(x.consumable)}</td><td class="num">${x.c}</td><td class="num">${x.q}</td><td class="num">¥${(x.a || 0).toLocaleString()}</td></tr>`).join('')
    : '<tr><td colspan="5"><div class="empty">区间内无发放记录</div></td></tr>';
  // 经办人
  $('#stOperator').innerHTML = (r.data.operators || []).length ? r.data.operators.map(x => `
    <tr><td>${esc(x.operator)}</td><td class="num">${x.c}</td><td class="num">${x.q}</td><td class="num">¥${(x.a || 0).toLocaleString()}</td></tr>`).join('')
    : '<tr><td colspan="4"><div class="empty">区间内无经办人记录</div></td></tr>';
  // 异常提醒
  const warns = [];
  if (r.data.missing_price) warns.push(`⚠️ 有 <b style="color:var(--danger)">${r.data.missing_price}</b> 条发放记录未填单价（未计入金额统计），请到「耗材管理→发放记录」补录`);
  if (r.data.missing_time) warns.push(`⚠️ 有 <b style="color:var(--danger)">${r.data.missing_time}</b> 条发放记录未填发放时间，可能未计入月度趋势`);
  $('#stWarn').innerHTML = warns.length ? `<div class="card" style="padding:10px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px">${warns.join('<br>')}</div>` : '';
  // 预算对比
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  $('#stBudgetBody').innerHTML = months.map(mm => {
    const b = budgets.find(v => v.month === mm);
    const act = (r.data.trend || []).find(x => x.month === y + '-' + String(mm).padStart(2, '0'));
    const bAmt = b ? b.amount : 0, aAmt = act ? (act.amount || 0) : 0;
    const bal = bAmt - aAmt;
    const rte = bAmt > 0 ? (aAmt / bAmt * 100).toFixed(1) + '%' : (aAmt > 0 ? '未设预算' : '—');
    return `<tr><td>${mm}月</td><td class="num">${bAmt ? '¥' + bAmt.toLocaleString() : '—'}</td><td class="num">${aAmt ? '¥' + aAmt.toLocaleString() : '—'}</td>
      <td class="num" style="color:${bal < 0 ? 'var(--danger)' : 'var(--ok,#16a34a)'}">${bAmt ? (bal < 0 ? '-' : '') + '¥' + Math.abs(bal).toLocaleString() : '—'}</td>
      <td class="num">${rte}</td></tr>`;
  }).join('');
}

function openBudget() {
  const y = +$('#stYear').value;
  const budgets = (_statsData ? _statsData.budgets || [] : []).filter(b => b.year === y);
  let rows = '';
  for (let mm = 1; mm <= 12; mm++) {
    const b = budgets.find(v => v.month === mm);
    rows += `<div class="form-field" style="width:calc(25% - 8px)"><label>${mm}月</label><input type="number" step="0.01" id="bg_${mm}" value="${b ? b.amount : ''}" placeholder="0"></div>`;
  }
  openModal('年度预算设置 · ' + y + '年', `
    <p style="font-size:13px;color:#6b7280;margin-bottom:10px">填写各月耗材费用预算（元），留空表示该月不设预算。设置后可在统计页查看预算执行对比。</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px">${rows}</div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">保存预算</button>', null, true);
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    try {
      for (let mm = 1; mm <= 12; mm++) {
        const v = $('#bg_' + mm).value;
        if (v === '') continue;
        await api('/budgets', 'POST', { year: y, month: mm, amount: parseFloat(v), remark: '' });
      }
      toast('预算已保存'); closeModal(); loadStats();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 批量发放 ============ */
async function openBatchIssue() {
  if (!conList.length) {
    try { const r = await api('/consumables'); conList = r.data; } catch (e) { toast(e.message, 'err'); return; }
  }
  const locs = await api('/issues?per=1000');
  const locSet = [...new Set(locs.data.map(x => x.location).filter(Boolean))];
  const deptSet = [...new Set(locs.data.map(x => x.department).filter(Boolean))].sort();
  let rowCount = 0;
  const rowHtml = () => `
    <tr data-row>
      <td><input class="bi_con w100" list="biConList" placeholder="输入型号/类别搜索…"></td>
      <td><input type="number" class="bi_qty w60" min="1" value="1"></td>
      <td class="bi_stock" style="color:#6b7280">—</td>
      <td><button class="btn btn-sm btn-danger" data-a="rm">删除</button></td>
    </tr>`;
  const prs = await loadPrinters();
  openModal('批量领取多种耗材', `
    <p style="font-size:13px;color:#6b7280;margin-bottom:10px">一次登记多类耗材发放：整单共用一个OA流程号，逐项校验库存并自动扣减，任一不足整体回滚。</p>
    <div class="form-grid" style="margin-bottom:10px">
      <div class="form-field"><label>OA流程号 *</label><input id="bi_oa" placeholder="必填，整单共用"></div>
      <div class="form-field"><label>发放时间</label><input type="date" id="bi_time" value="${today()}"></div>
      <div class="form-field full"><label>选择打印机（按型号/部署位置/编号搜索，自动填充所在地）</label>
        <input id="bi_printer" list="biPrinterList"><datalist id="biPrinterList">${prs.map(p => `<option value="${esc(printerOption(p))}">`).join('')}</datalist></div>
      <div class="form-field full"><label>打印机所处地（联动自动填充，可微调）</label><input id="bi_loc" list="biLocList"><datalist id="biLocList">${locSet.map(v => `<option value="${esc(v)}">`).join('')}</datalist></div>
      <div class="form-field"><label>领用部门 *</label><input id="bi_dept" list="biDeptList"><datalist id="biDeptList">${deptSet.map(v => `<option value="${esc(v)}">`).join('')}</datalist></div>
      <div class="form-field"><label>领用人 *</label><input id="bi_applicant"></div>
      <div class="form-field"><label>登记人/经办人</label><input id="bi_operator" list="bi_opList" placeholder="下拉选择或手写">${opOpts('bi_opList')}</div>
    </div>
    <datalist id="biConList">${conList.map(x => `<option value="${esc(conSelText(x))}">`).join('')}</datalist>
    <table class="bi-table"><thead><tr><th style="width:60%">耗材（输入型号/类别搜索，含区域）</th><th style="width:80px">数量</th><th style="width:130px">该区域库存</th><th style="width:70px"></th></tr></thead>
      <tbody id="biRows"></tbody></table>
    <div style="display:flex;gap:10px;margin-top:10px">
      <button class="btn" id="biAdd" data-perm="computers:edit">＋ 添加一行</button>
      <span style="font-size:12px;color:#9ca3af;align-self:center">共 <b id="biCount">0</b> 类耗材</span>
    </div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">提交发放</button>', null, true);
  const addRow = () => {
    rowCount++;
    $('#biRows').insertAdjacentHTML('beforeend', rowHtml());
    $('#biCount').textContent = rowCount;
    const tr = $('#biRows').lastElementChild;
    upgradeDatalists(tr);
    bindRow(tr);
  };
  const bindRow = (tr) => {
    const sel = tr.querySelector('.bi_con');
    const stock = tr.querySelector('.bi_stock');
    const upd = () => {
      const x = conSelFind(sel.value);
      stock.textContent = x ? ((x.region_stock ?? x.stock) + (x.price ? '，¥' + x.price : '')) : '—';
    };
    sel.addEventListener('input', upd); upd();
    tr.querySelector('[data-a=rm]').onclick = () => { tr.remove(); rowCount = Math.max(0, rowCount - 1); $('#biCount').textContent = rowCount; };
  };
  $('#biAdd').onclick = addRow;
  $('#bi_printer').addEventListener('input', () => {
    const v = $('#bi_printer').value;
    const p = prs.find(x => printerOption(x) === v);
    if (p) {
      $('#bi_loc').value = p.location || '';
      if (!$('#bi_dept').value.trim() && p.department) $('#bi_dept').value = p.department;
      const cands = conList.filter(x => conMatchModel(x.model, p.model, x.printer_models));
      $('#biConList').innerHTML = cands.map(x => `<option value="${esc(conSelText(x))}">`).join('');
      toast('已按打印机「' + p.model + '」索引 ' + cands.length + ' 种耗材，各行搜索选择即可', 'ok');
    } else if (!v.trim()) {
      $('#biConList').innerHTML = conList.map(x => `<option value="${esc(conSelText(x))}">`).join('');
    }
  });
  addRow(); addRow();
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const items = $$('#biRows tr[data-row]').map(tr => {
      const x = conSelFind(tr.querySelector('.bi_con').value);
      return { consumable_id: x ? x.id : 0, qty: parseFloat(tr.querySelector('.bi_qty').value) || 0, region: x ? (x.region || '办公楼') : '办公楼' };
    }).filter(it => it.consumable_id && it.qty > 0);
    if (!items.length) { toast('请至少选择一类耗材并填写数量（耗材需从列表中选择）', 'err'); return; }
    if (!$('#bi_oa').value.trim()) { toast('请填写OA流程号', 'err'); return; }
    if (!$('#bi_dept').value.trim()) { toast('领用部门必填', 'err'); return; }
    if (!$('#bi_applicant').value.trim()) { toast('请填写领用人', 'err'); return; }
    try {
      const r = await api('/issues/batch', 'POST', {
        items, oa_no: $('#bi_oa').value.trim(), department: $('#bi_dept').value.trim(), applicant: $('#bi_applicant').value.trim(),
        location: $('#bi_loc').value.trim(), issue_time: $('#bi_time').value,
        operator: $('#bi_operator').value.trim()
      });
      toast('批量发放成功，共 ' + r.count + ' 类，OA号：' + r.oa_nos.join('、'));
      closeModal();
      const cr = await api('/consumables'); conList = cr.data;
      renderConsumables('records');
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 打印机联动工具 ============ */
let _printerCache = [];
async function loadPrinters(force) {
  if (_printerCache.length && !force) return _printerCache;
  try { const r = await api('/printers?per=10000'); _printerCache = r.data || []; } catch (e) { _printerCache = []; }
  return _printerCache;
}
function printerOption(p) { return (p.model || '') + '｜' + (p.location || '') + '｜编号' + (p.printer_no || ''); }

/* 批量导入发放记录 */
function openIssueImport() {
  openModal('批量导入发放记录', `
    <p style="font-size:13px;color:#6b7280;margin-bottom:12px">
      ① 点「📋 导入模板」下载 Excel 模板（OA流程号、打印机型号、耗材品类、数量、领用部门、领用人必填）；<br>
      ② 上传后<strong>逐行校验并自动扣减库存、自动写单价快照</strong>；<br>
      ③ 校验失败的行走原因列出，可修改后重传；已成功的行不重复导入。
    </p>
    <div class="form-field"><label>选择 Excel 文件（.xlsx / .xls）</label><input type="file" id="iiFile" accept=".xlsx,.xls"></div>
    <div id="iiResult" style="font-size:13px;line-height:1.8"></div>`,
    '<button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">开始导入</button>');
  $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
  $('#modalFoot').querySelector('[data-a=ok]').onclick = async () => {
    const f = $('#iiFile').files[0];
    if (!f) { toast('请选择文件', 'err'); return; }
    const fd = new FormData();
    fd.append('file', f);
    const btn = $('#modalFoot').querySelector('[data-a=ok]');
    btn.disabled = true; btn.textContent = '导入中…';
    try {
      const res = await fetch('/api/issues/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) { toast(d.error || '导入失败', 'err'); $('#iiResult').innerHTML = '<span style="color:var(--danger)">' + esc(d.error || '') + '</span>'; }
      else {
        toast('导入完成：成功 ' + d.added + ' 条，失败 ' + d.failed + ' 条');
        let html = '<div style="color:var(--ok,#16a34a)">✅ 导入成功 <b>' + d.added + '</b> 条，失败 <b>' + d.failed + '</b> 条</div>';
        if (d.errors && d.errors.length) html += '<div style="color:var(--danger);margin-top:6px">' + d.errors.map(e => esc(e)).join('<br>') + '</div>';
        $('#iiResult').innerHTML = html;
        if (d.failed === 0) { setTimeout(() => { closeModal(); loadIssuePage(); }, 600); }
      }
    } catch (e) { toast('上传失败：' + e.message, 'err'); }
    btn.disabled = false; btn.textContent = '开始导入';
  };
}

/* 通用：选中数据导出 CSV（含公式注入防护：=+-@ 开头加 ' 前缀） */
function exportRowsCSV(filename, heads, rows, fields) {
  const csvSafe = v => { const s = String(v ?? ''); return /^[=+\-@]/.test(s) ? "'" + s : s; };
  const lines = rows.map(r => fields.map(f => '"' + csvSafe(r[f]).replace(/"/g, '""') + '"').join(','));
  const blob = new Blob(['\ufeff' + heads.join(',') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

/* 通用：后端导出 Excel 下载（fetch+blob，火狐兼容，出错时提示具体原因并给出兜底下载） */
async function downloadExport(url, retried) {
  try {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) {
      let msg = '导出失败（' + res.status + '）';
      try { const d = await res.json(); if (d && d.error) msg = d.error; } catch (e) {}
      toast(msg, 'err'); return;
    }
    const blob = await res.blob();
    let fname = '导出.xlsx';
    const cd = res.headers.get('Content-Disposition') || '';
    let m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
    if (m) { try { fname = decodeURIComponent(m[1].replace(/\+/g, '%20')); } catch (e) { fname = m[1]; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('导出成功');
  } catch (e) {
    // 瞬时网络问题自动重试一次
    if (!retried) {
      toast('导出网络异常，正在自动重试…', 'err');
      setTimeout(() => downloadExport(url, true), 1200);
      return;
    }
    // 仍失败：给出可直接点击的兜底下载链接
    const t = document.createElement('div'); t.className = 'toast err';
    t.innerHTML = '导出失败：' + esc(e.message) + '<br>请<a href="' + esc(url) + '" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline;font-weight:bold;">点击此处直接下载</a>';
    $('#toastWrap').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 12000);
  }
}
function expUrl(base, obj) {
  const p = new URLSearchParams();
  Object.keys(obj).forEach(k => { if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') p.set(k, obj[k]); });
  const s = p.toString();
  return base + (s ? '?' + s : '');
}
/* =========================================================================
 * TZTable 统一表格引擎（Excel 式：排序 / 筛选 / 自定义列序与显隐 / 搜索 / 多选 / 分页）
 * 所有逻辑按「列 key / 列 label」驱动，表头重排后筛选、排序、数据行永不错位。
 * 配置：
 *   {
 *     id: 'printers_pBody',
    perm: 'printers',            // 表格标识（列配置全局键，兼容既有 tz_cols_ 配置）
 *     columns: [{ key, label, fixed?, w?, render?(v,row), tdAttr? }],
 *     search: ['printer_no', ...],     // 搜索匹配字段
 *     searchBox: '#pSearch',           // 搜索框选择器
 *     pageSize: 10,                    // 每页条数（0=不分页）
 *     pageSizeOpts: [10,20,50,100],
 *     multi: { key: 'id' },            // 多选
 *     ops: [{ label, cls, act }],      // 行操作按钮
 *     batchOps: [{ label, cls, act }], // 批量操作按钮
 *     batchEl / pagerEl / emptyEl: 选择器,
 *     onRowOps: (act, row), onBatch: (act, rows), onState: (st),
 *     extraFilter: fn(row)->bool       // 模块级附加过滤（如部门/状态下拉）
 *   }
 * ========================================================================= */
class TZTable {
  constructor(wrap, cfg) {
    this.cfg = cfg || {};
    this.id = cfg.id || 'tbl';
    this.cols = cfg.columns || [];
    this.movCols = this.cols.filter(c => !c.fixed);
    this.searchFields = cfg.search || [];
    this.searchSel = cfg.searchBox || '';
    this.pageSize = cfg.pageSize || 10;
    this.pageSizeOpts = cfg.pageSizeOpts || [10, 20, 50, 100];
    this.data = cfg.data || [];
    this.selKey = (cfg.multi && cfg.multi.key) || 'id';
    this.multi = cfg.multi || null;
    this.batchSel = cfg.batchEl || '';
    this.pagerSel = cfg.pagerEl || '';
    this.emptySel = cfg.emptyEl || '';
    this.onRowOps = cfg.onRowOps || null;
    this.onBatch = cfg.onBatch || null;
    this.onState = cfg.onState || null;
    this.extraFilter = cfg.extraFilter || null;
    this.sort = { key: '', dir: '' };
    this.filters = {};
    this.search = '';
    this.page = 1;
    this.selected = new Set();
    this.wrap = wrap;
    this.tbl = wrap.tagName === 'TABLE' ? wrap : (wrap.querySelector('table') || wrap);
    this.tbl.setAttribute('data-tz', '1');          // 标记：跳过旧 enhanceTable / 旧分页器干扰
    this.tbody = this.tbl.querySelector('tbody[id]');
    if (!this.tbody) { this.tbody = document.createElement('tbody'); this.tbl.appendChild(this.tbody); }
    if (!this.tbody.id) this.tbody.id = this.id;
    this.perm = cfg.perm || '';                     // 模块编辑权限键（viewer 隐藏操作列/操作按钮）
    this.canOp = !this.perm || canEdit(this.perm);
    // 全局列配置（label 顺序 / 显隐），与既有 tz_cols_ 全局键兼容（hide: label->true=显示）
    const g = getColCfg(this.id) || {};
    const gOrder = Array.isArray(g.order) ? g.order : [];
    if (gOrder.length) {
      this.order = gOrder.filter(l => this.movCols.some(c => c.label === l))
        .concat(this.movCols.filter(c => !gOrder.includes(c.label)).map(c => c.label));
    } else {
      this.order = this.movCols.map(c => c.label);
    }
    this.hide = {};                    // label -> true = 隐藏
    if (g.hide && typeof g.hide === 'object') {
      Object.keys(g.hide).forEach(l => { if (g.hide[l] === false) this.hide[l] = true; });
    }
    this.batchEl = this.batchSel ? document.querySelector(this.batchSel) : null;
    this.pagerEl = this.pagerSel ? document.querySelector(this.pagerSel) : null;
    this.emptyEl = this.emptySel ? document.querySelector(this.emptySel) : null;
    this._bind();
    this.render();
  }
  setData(d) { this.data = d || []; this.render(); }
  /* 搜索+筛选+附加过滤后的全量行 */
  filteredRows() {
    let rows = this.data.slice();
    const q = this.search.trim().toLowerCase();
    if (q) rows = rows.filter(r => this.searchFields.some(f => typeof f === 'function' ? String(f(r) ?? '').toLowerCase().includes(q) : String(r[f] ?? '').toLowerCase().includes(q)));
    Object.keys(this.filters).forEach(k => {
      const c = this.filters[k];
      if (!c || (!c.kw && !(Array.isArray(c.vals) && c.vals.length))) return;
      rows = rows.filter(r => {
        const v = String(r[k] ?? '').trim();
        if (c.kw && String(c.kw).trim() && !v.toLowerCase().includes(String(c.kw).trim().toLowerCase())) return false;
        if (Array.isArray(c.vals) && c.vals.length && !c.vals.includes(v)) return false;
        return true;
      });
    });
    if (this.extraFilter) rows = rows.filter(this.extraFilter);
    return rows;
  }
  render() {
    let rows = this.filteredRows();
    if (this.sort.key && this.sort.dir) {
      const k = this.sort.key, d = this.sort.dir === 'desc' ? -1 : 1;
      rows = rows.slice().sort((a, b) => d * cmpVal(a[k], b[k]));
    }
    const total = rows.length;
    const pages = this.pageSize ? Math.max(1, Math.ceil(total / this.pageSize)) : 1;
    if (this.page > pages) this.page = pages;
    const pageRows = this.pageSize ? rows.slice((this.page - 1) * this.pageSize, this.page * this.pageSize) : rows;
    this._renderHead();
    this._renderBody(pageRows);
    if (this.pagerEl) this._renderPager(total, pages);
    if (this.batchEl) this._renderBatch();
    if (this.emptyEl) this.emptyEl.style.display = total ? 'none' : '';
    if (this.onState) this.onState({ total, pages, page: this.page });
  }
  _safeId() { return this.id.replace(/[^a-z0-9_]/gi, '_'); }
  _renderHead() {
    let tr = this.tbl.querySelector('thead tr');
    if (!tr) { const t = document.createElement('thead'); tr = document.createElement('tr'); t.appendChild(tr); this.tbl.insertBefore(t, this.tbody); }
    const sid = this._safeId();
    let html = '';
    if (this.multi) html += `<th class="tz-sel" style="width:38px"><input type="checkbox" id="tzall_${sid}" ${this._allChecked() ? 'checked' : ''}></th>`;
    this.order.forEach(l => {
      if (this.hide[l]) return;
      const c = this.cols.find(x => x.label === l);
      if (!c) return;
      const sorted = this.sort.key === c.key;
      const arrow = sorted ? (this.sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
      const f = this.filters[c.key];
      const fOn = (f && (f.kw || (Array.isArray(f.vals) && f.vals.length))) ? ' on' : '';
      html += `<th class="tz-col" data-key="${esc(c.key)}" data-label="${esc(l)}" title="点击排序" style="cursor:pointer;${c.w ? 'width:' + c.w + 'px' : ''}">${esc(l)}<span class="th-filter${fOn}">▾</span>${arrow}</th>`;
    });
    if (this.canOp) html += `<th class="tz-ops" style="width:${this._opsW() + 70}px">操作 <span class="tz-cfg" title="列显示设置">⚙</span></th>`;
    tr.innerHTML = html;
    tr.querySelectorAll('.tz-col').forEach(th => {
      const key = th.dataset.key, label = th.dataset.label;
      const fspan = th.querySelector('.th-filter');
      fspan.onclick = e => { e.stopPropagation(); this._openFilter(key, label); };
      th.onclick = e => {
        if (e.target === fspan || fspan.contains(e.target)) return;
        const next = this.sort.key === key ? (this.sort.dir === 'asc' ? 'desc' : (this.sort.dir === 'desc' ? '' : 'asc')) : 'asc';
        this.sort = { key, dir: next }; this.page = 1; this.render();
      };
    });
    const allCk = tr.querySelector('#tzall_' + sid);
    if (allCk) allCk.onchange = () => {
      const rows = this.filteredRows();
      if (allCk.checked) rows.forEach(r => this.selected.add(String(r[this.selKey])));
      else rows.forEach(r => this.selected.delete(String(r[this.selKey])));
      this.render();
    };
    const cfg = tr.querySelector('.tz-cfg');
    if (cfg) cfg.onclick = e => { e.stopPropagation(); this._openSettings(); };
  }
  _renderBody(rows) {
    const order = this.order.filter(l => !this.hide[l]);
    let html = '';
    rows.forEach(r => {
      let td = '';
      if (this.multi) td += `<td class="tz-sel"><input type="checkbox" data-id="${esc(String(r[this.selKey]))}" ${this.selected.has(String(r[this.selKey])) ? 'checked' : ''}></td>`;
      order.forEach(l => {
        const c = this.cols.find(x => x.label === l);
        if (!c) return;
        td += `<td ${c.tdAttr || ''}>${c.render ? c.render(r[c.key], r) : esc(r[c.key] ?? '')}</td>`;
      });
      if (this.canOp) {
        const ops = (this.cfg.ops || []).filter(o => !o.show || o.show(r)).map(o => `<button class="btn btn-sm ${o.cls || ''}" data-act="${o.act}">${typeof o.label === 'function' ? o.label(r) : o.label}</button>`).join(' ');
        td += `<td><div class="ops">${ops || ''}</div></td>`;
      }
      html += `<tr data-id="${esc(String(r[this.selKey]))}">${td}</tr>`;
    });
    this.tbody.innerHTML = html || '<tr><td colspan="99" class="empty" style="text-align:center;padding:24px">暂无数据</td></tr>';
    this.tbody.onclick = e => {
      const ck = e.target.closest('input[type=checkbox][data-id]');
      if (ck) {
        const id = ck.dataset.id;
        if (ck.checked) this.selected.add(id); else this.selected.delete(id);
        if (this.batchEl) this._renderBatch();
        return;
      }
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const trEl = e.target.closest('tr'); if (!trEl) return;
      const row = this.data.find(x => String(x[this.selKey]) === trEl.dataset.id);
      if (row && this.onRowOps) this.onRowOps(b.dataset.act, row);
    };
  }
  _allChecked() {
    const rows = this.filteredRows();
    return rows.length > 0 && rows.every(r => this.selected.has(String(r[this.selKey])));
  }
  _opsW() { return Math.max(60, (this.cfg.ops || []).length * 62); }
  _renderPager(total, pages) {
    this.pagerEl.innerHTML = `
      <button class="btn btn-sm" data-pg="prev" ${this.page <= 1 ? 'disabled' : ''}>上一页</button>
      <span class="pg-info">第${this.page}/${pages}页 共${total}条</span>
      <input type="number" class="pg-go" value="${this.page}" min="1" max="${pages}" style="width:56px">
      <button class="btn btn-sm" data-pg="go">跳转</button>
      <button class="btn btn-sm" data-pg="next" ${this.page >= pages ? 'disabled' : ''}>下一页</button>
      <select class="pg-size">${this.pageSizeOpts.map(n => `<option ${n === this.pageSize ? 'selected' : ''}>${n}</option>`).join('')}</select><span>条/页</span>`;
    this.pagerEl.onclick = e => {
      const b = e.target.closest('button[data-pg]'); if (!b) return;
      if (b.dataset.pg === 'prev') this.page = Math.max(1, this.page - 1);
      if (b.dataset.pg === 'next') this.page = Math.min(pages, this.page + 1);
      if (b.dataset.pg === 'go') { const v = parseInt(this.pagerEl.querySelector('.pg-go').value, 10); if (!isNaN(v)) this.page = Math.min(pages, Math.max(1, v)); }
      this.render();
    };
    const sz = this.pagerEl.querySelector('.pg-size');
    if (sz) sz.onchange = () => { this.pageSize = parseInt(sz.value, 10) || 10; this.page = 1; this.render(); };
  }
  _renderBatch() {
    const n = this.selected.size;
    const ops = (this.cfg.batchOps || []).filter(o => this.canOp || o.act === 'export');   // 导出为只读能力，viewer 也可用
    this.batchEl.innerHTML = `<span class="sel-n" style="margin-right:8px">已选 ${n} 项</span>` +
      ops.map(o => `<button class="btn btn-sm ${o.cls || ''}" data-bact="${o.act}">${o.label}</button>`).join(' ') +
      `<button class="btn btn-sm" data-bact="clear" style="margin-left:8px">清除</button>`;
    this.batchEl.onclick = e => {
      const b = e.target.closest('button[data-bact]'); if (!b) return;
      const act = b.dataset.bact;
      if (act === 'clear') { this.selected.clear(); this.render(); return; }
      const rows = this.data.filter(x => this.selected.has(String(x[this.selKey])));
      if (this.onBatch) this.onBatch(act, rows);
    };
  }
  /* 单列筛选菜单：按列 key 取值，与表头位置无关 */
  _openFilter(key, label) {
    const allVals = [...new Set(this.data.map(r => String(r[key] ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'));
    const cur = this.filters[key] || { kw: '', vals: [] };
    const curVals = Array.isArray(cur.vals) ? cur.vals : [];
    openModal('按「' + esc(label) + '」筛选（对全部数据生效）', `
      <div class="form-field" style="margin-bottom:8px"><input id="cfKw" placeholder="输入包含的关键字过滤值列表…" value="${esc(cur.kw || '')}"></div>
      <div style="max-height:300px;overflow:auto;border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:6px 10px">
        <label style="display:block;padding:4px 0;border-bottom:1px dashed #eef1f4;font-weight:600"><input type="checkbox" id="cfAll" ${allVals.length && curVals.length === allVals.length ? 'checked' : ''}> 全选（${allVals.length} 个值）</label>
        ${allVals.length ? allVals.map(v => `<label class="cf-item" style="display:block;padding:4px 0;border-bottom:1px dashed #f0f2f5"><input type="checkbox" data-v="${esc(v)}" ${curVals.includes(v) ? 'checked' : ''}> <span>${esc(v)}</span></label>`).join('') : '<div class="small" style="padding:6px 0">暂无可选值（可在上方输入关键字筛选）</div>'}
      </div>`,
      '<button class="btn" data-a="clear">清除</button><button class="btn" data-a="cancel">取消</button><button class="btn btn-primary" data-a="ok">确定</button>', null, true);
    const setAll = ck => document.querySelectorAll('#modalBody .cf-item input[data-v]').forEach(cb => { cb.checked = ck; });
    $('#cfAll').onchange = () => setAll($('#cfAll').checked);
    $('#cfKw').oninput = () => {
      const kw = $('#cfKw').value.trim().toLowerCase();
      document.querySelectorAll('#modalBody .cf-item').forEach(l => { l.style.display = (!kw || l.textContent.toLowerCase().includes(kw)) ? '' : 'none'; });
    };
    $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
    $('#modalFoot').querySelector('[data-a=clear]').onclick = () => {
      delete this.filters[key]; this.render(); closeModal(); toast('已清除筛选');
    };
    $('#modalFoot').querySelector('[data-a=ok]').onclick = () => {
      const kw = $('#cfKw').value.trim();
      const vals = [...document.querySelectorAll('#modalBody .cf-item input[data-v]:checked')].map(cb => cb.value);
      if (!kw && !vals.length) delete this.filters[key];
      else this.filters[key] = { kw, vals };
      this.render(); closeModal(); toast(kw || vals.length ? '筛选已应用' : '已清除筛选');
    };
  }
  /* 列设置面板：调整顺序/显隐，保存到全局（admin 为准全员同步） */
  _openSettings() {
    const order = this.order.slice();
    const hide = Object.assign({}, this.hide);   // label -> true=隐藏
    const rowHtml = (l, i) => `
      <div class="colset-row" data-i="${i}" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed #f0f2f5">
        <span class="colset-move" style="cursor:grab;color:#9aa4b0">☰</span>
        <button class="btn btn-sm" data-ca="up" style="padding:0 8px">↑</button>
        <button class="btn btn-sm" data-ca="down" style="padding:0 8px">↓</button>
        <span style="flex:1">${esc(l)}</span>
        <input type="checkbox" class="colset-ck" data-l="${esc(l)}" ${hide[l] ? '' : 'checked'} title="勾选=显示该列">
      </div>`;
    openModal('列显示设置', `
      <div style="max-height:380px;overflow:auto" id="colsetList">
        ${order.map((l, i) => rowHtml(l, i)).join('')}
      </div>
      <div class="small" style="margin-top:8px;color:#9aa4b0">点 ↑/↓ 调整列顺序；勾选控制显示/隐藏。保存后所有用户同步一致。</div>`,
      '<button class="btn" data-a="cancel">取消</button><button class="btn" data-a="reset">恢复默认</button><button class="btn btn-primary" data-a="ok">保存</button>', null, true);
    const list = $('#colsetList');
    const rebuild = () => { list.innerHTML = order.map((l, i) => rowHtml(l, i)).join(''); bindRows(); };
    const bindRows = () => {
      list.querySelectorAll('.colset-row').forEach(rEl => {
        const i = +rEl.dataset.i;
        rEl.querySelector('[data-ca=up]').onclick = () => { if (i > 0) { const t = order[i]; order[i] = order[i - 1]; order[i - 1] = t; rebuild(); } };
        rEl.querySelector('[data-ca=down]').onclick = () => { if (i < order.length - 1) { const t = order[i]; order[i] = order[i + 1]; order[i + 1] = t; rebuild(); } };
      });
      list.querySelectorAll('.colset-ck').forEach(ck => {
        ck.onchange = () => { if (ck.checked) delete hide[ck.dataset.l]; else hide[ck.dataset.l] = true; };
      });
    };
    bindRows();
    $('#modalFoot').querySelector('[data-a=cancel]').onclick = closeModal;
    $('#modalFoot').querySelector('[data-a=reset]').onclick = () => {
      this.order = this.movCols.map(c => c.label); this.hide = {};
      saveGlobalCol(colKey(this.id), { order: this.order, hide: {} });
      this.render(); closeModal(); toast('已恢复默认并同步');
    };
    $('#modalFoot').querySelector('[data-a=ok]').onclick = () => {
      this.order = order; this.hide = hide;
      const hideOut = {}; this.movCols.forEach(c => { hideOut[c.label] = !this.hide[c.label]; });
      saveGlobalCol(colKey(this.id), { order, hide: hideOut });
      this.render(); closeModal(); toast('列设置已保存，已同步到所有用户');
    };
  }
  _bind() {
    if (this.searchSel) {
      const el = document.querySelector(this.searchSel);
      if (el) {
        this.search = el.value || '';          // 构造时读取输入框当前值（模块先恢复再构造）
        el.oninput = () => { this.search = el.value; this.page = 1; this.render(); };
      }
    }
  }
}

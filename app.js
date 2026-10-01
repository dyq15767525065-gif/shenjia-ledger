const APP_VERSION = '0.1.0';
const APP_NAME = '身家账本';

const KINDS = {
  cash:       {label:'现金',     icon:'💵', group:'asset'},
  debit:      {label:'储蓄卡',   icon:'🏦', group:'asset'},
  wallet:     {label:'电子钱包', icon:'📲', group:'asset'},
  deposit:    {label:'定期存款', icon:'🔒', group:'asset'},
  fund:       {label:'理财基金', icon:'📈', group:'asset'},
  invest:     {label:'股票投资', icon:'📊', group:'asset'},
  property:   {label:'房产',     icon:'🏡', group:'asset'},
  car:        {label:'车辆',     icon:'🚗', group:'asset'},
  lent:       {label:'借出应收', icon:'🤝', group:'asset'},
  other_asset:{label:'其他资产', icon:'📦', group:'asset'},
  credit:     {label:'信用卡',   icon:'💳', group:'liability'},
  loan:       {label:'贷款',     icon:'🧾', group:'liability'},
  borrow:     {label:'欠款',     icon:'📄', group:'liability'},
  other_liab: {label:'其他负债', icon:'📦', group:'liability'}
};

const CATS = {
  expense: [
    {name:'餐饮', icon:'🍜'},{name:'日用', icon:'🧴'},{name:'购物', icon:'🛍️'},{name:'交通', icon:'🚌'},
    {name:'通讯', icon:'📱'},{name:'居住', icon:'🏠'},{name:'医疗', icon:'💊'},{name:'娱乐', icon:'🎮'},
    {name:'人情', icon:'🧧'},{name:'还贷', icon:'🏦'},{name:'学习', icon:'📚'},{name:'其他', icon:'📝'}
  ],
  income: [
    {name:'工资', icon:'💼'},{name:'副业', icon:'🛠️'},{name:'理财收益', icon:'📈'},{name:'红包', icon:'🧧'},
    {name:'退款', icon:'↩️'},{name:'其他', icon:'💰'}
  ]
};

function catIcon(name){
  if(!name) return '🔁';
  const all = CATS.expense.concat(CATS.income);
  const hit = all.find(c => c.name === name);
  return hit ? hit.icon : '📝';
}

function fmtFen(fen){
  let n = Math.round(Number(fen) || 0);
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  const yuan = Math.trunc(n / 100);
  const cents = String(n % 100).padStart(2, '0');
  const grouped = String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + grouped + '.' + cents;
}

function parseAmountToFen(str){
  if(str === null || str === undefined) return NaN;
  let s = String(str).replace(/[,，\s]/g, '').replace(/。/g, '.');
  if(s === '') return NaN;
  if(!/^\d*\.?\d*$/.test(s)) return NaN;
  const v = parseFloat(s);
  if(!isFinite(v)) return NaN;
  return Math.round(v * 100);
}

function pad2(n){ return String(n).padStart(2, '0'); }
function dateToStr(d){ return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function todayStr(){ return dateToStr(new Date()); }
function daysAgo(n){ const d = new Date(); d.setDate(d.getDate() - n); return dateToStr(d); }
function monthOf(dateStr){ return dateStr.slice(0, 7); }
function curMonthKey(){ return monthOf(todayStr()); }
function monthShift(key, delta){
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}
function monthLabel(key){
  const [y, m] = key.split('-').map(Number);
  return y + '年' + m + '月';
}
const WEEK = ['日','一','二','三','四','五','六'];
function dayLabel(dateStr){
  if(dateStr === todayStr()) return '今天';
  if(dateStr === daysAgo(1)) return '昨天';
  const d = new Date(dateStr + 'T00:00:00');
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 周' + WEEK[d.getDay()];
}
function stamp(d){
  d = d || new Date();
  return dateToStr(d).replace(/-/g, '') + '-' + pad2(d.getHours()) + pad2(d.getMinutes());
}
function esc(s){
  const AMP = String.fromCharCode(38) + 'amp;';
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, AMP)
    .replace(/</g, String.fromCharCode(38) + 'lt;')
    .replace(/>/g, String.fromCharCode(38) + 'gt;')
    .replace(/"/g, String.fromCharCode(38) + 'quot;');
}
function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}


let _db = null;

function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('shenjia_ledger', 1);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if(!d.objectStoreNames.contains('accounts')){
        d.createObjectStore('accounts', {keyPath:'id', autoIncrement:true});
      }
      if(!d.objectStoreNames.contains('transactions')){
        const s = d.createObjectStore('transactions', {keyPath:'id', autoIncrement:true});
        s.createIndex('date', 'date');
      }
      if(!d.objectStoreNames.contains('meta')){
        d.createObjectStore('meta', {keyPath:'key'});
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function idbStore(name, mode){
  return openDB().then(db => db.transaction(name, mode).objectStore(name));
}

function wrapReq(req){
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const DB = {
  async getAll(name){
    return wrapReq((await idbStore(name, 'readonly')).getAll());
  },
  async put(name, value){
    return wrapReq((await idbStore(name, 'readwrite')).put(value));
  },
  async del(name, key){
    return wrapReq((await idbStore(name, 'readwrite')).delete(key));
  },
  async clear(name){
    return wrapReq((await idbStore(name, 'readwrite')).clear());
  },
  async getMeta(key){
    return wrapReq((await idbStore('meta', 'readonly')).get(key));
  },
  async setMeta(key, value){
    return wrapReq((await idbStore('meta', 'readwrite')).put({key, value}));
  }
};


const S = {
  tab: 'home',
  month: null,
  filterAcc: null,
  accounts: [],
  txs: [],
  balances: {},
  totals: {asset:0, debt:0, net:0, mInc:0, mExp:0},
  demoActive: false,
  lastBackup: null
};

function accountById(id){
  return S.accounts.find(a => a.id === id) || null;
}

function txAmountDirection(tx, account){
  const isDebt = KINDS[account.kind] && KINDS[account.kind].group === 'liability';
  if(tx.type === 'transfer'){
    if(tx.accountId === account.id) return isDebt ? 1 : -1;
    if(tx.toAccountId === account.id) return isDebt ? -1 : 1;
    return 0;
  }
  const base = tx.type === 'income' ? 1 : -1;
  return isDebt ? -base : base;
}

function computeAll(){
  const bal = {};
  S.accounts.forEach(a => { bal[a.id] = a.initialFen || 0; });
  S.txs.forEach(tx => {
    const from = accountById(tx.accountId);
    const to = tx.type === 'transfer' ? accountById(tx.toAccountId) : null;
    if(from) bal[from.id] += tx.amountFen * txAmountDirection(tx, from);
    if(to && to.id !== from.id) bal[to.id] += tx.amountFen * txAmountDirection(tx, to);
  });
  S.balances = bal;

  let asset = 0, debt = 0;
  S.accounts.forEach(a => {
    const g = KINDS[a.kind] ? KINDS[a.kind].group : 'asset';
    if(g === 'asset') asset += bal[a.id]; else debt += bal[a.id];
  });
  const mk = curMonthKey();
  let mInc = 0, mExp = 0;
  S.txs.forEach(tx => {
    if(monthOf(tx.date) !== mk) return;
    if(tx.type === 'income') mInc += tx.amountFen;
    else if(tx.type === 'expense') mExp += tx.amountFen;
  });
  S.totals = {asset, debt, net: asset - debt, mInc, mExp};
}

function sortTxs(list){
  return list.slice().sort((a, b) => (a.date === b.date ? (b.id - a.id) : (a.date < b.date ? 1 : -1)));
}

function txsOfAccount(id){
  return sortTxs(S.txs.filter(t => t.accountId === id || t.toAccountId === id));
}

async function loadAll(){
  S.accounts = await DB.getAll('accounts');
  S.txs = await DB.getAll('transactions');
  S.accounts.sort((a, b) => a.id - b.id);
  const demoMeta = await DB.getMeta('demo');
  S.demoActive = demoMeta ? demoMeta.value === 'active' : false;
  const backupMeta = await DB.getMeta('backup');
  S.lastBackup = backupMeta ? backupMeta.value : null;
  if(!S.month) S.month = curMonthKey();
  computeAll();
}


async function seedDemo(){
  const accDefs = [
    {name:'钱包现金',     kind:'cash',    initialFen:50000},
    {name:'招商银行卡',   kind:'debit',   initialFen:1250000},
    {name:'微信零钱',     kind:'wallet',  initialFen:30000},
    {name:'支付宝',       kind:'wallet',  initialFen:80000},
    {name:'工行定期存款', kind:'deposit', initialFen:5000000},
    {name:'余额宝理财',   kind:'fund',    initialFen:1000000},
    {name:'招行信用卡',   kind:'credit',  initialFen:150000},
    {name:'房贷',         kind:'loan',    initialFen:42000000}
  ];
  const ids = {};
  for(const def of accDefs){
    const id = await DB.put('accounts', {
      name: def.name, kind: def.kind, initialFen: def.initialFen,
      note: '', createdAt: new Date().toISOString()
    });
    ids[def.name] = id;
  }
  const txDefs = [
    {d:0, type:'expense', amount:1850,  cat:'餐饮', acc:'微信零钱',   note:'早餐+午饭'},
    {d:0, type:'expense', amount:600,   cat:'交通', acc:'微信零钱',   note:'地铁'},
    {d:1, type:'expense', amount:3200,  cat:'餐饮', acc:'支付宝',     note:'晚饭外卖'},
    {d:1, type:'expense', amount:2500,  cat:'交通', acc:'支付宝',     note:'打车'},
    {d:2, type:'expense', amount:9650,  cat:'购物', acc:'招商银行卡', note:'超市采购'},
    {d:3, type:'expense', amount:5000,  cat:'通讯', acc:'招商银行卡', note:'话费充值'},
    {d:3, type:'expense', amount:3000,  cat:'娱乐', acc:'微信零钱',   note:'视频会员'},
    {d:4, type:'income',  amount:1236,  cat:'理财收益', acc:'余额宝理财', note:'基金收益'},
    {d:5, type:'income',  amount:860000, cat:'工资', acc:'招商银行卡', note:'工资到账'},
    {d:5, type:'transfer', amount:50000, acc:'招商银行卡', to:'微信零钱', note:'转点零花'}
  ];
  const now = Date.now();
  for(const t of txDefs){
    await DB.put('transactions', {
      date: daysAgo(t.d), type: t.type, amountFen: t.amount,
      category: t.cat || '', accountId: ids[t.acc],
      toAccountId: t.type === 'transfer' ? ids[t.to] : null,
      note: t.note, createdAt: new Date(now - t.d * 3600000).toISOString()
    });
  }
  await DB.setMeta('demo', 'active');
}

async function clearAllData(setCleared){
  await DB.clear('accounts');
  await DB.clear('transactions');
  await DB.clear('meta');
  if(setCleared) await DB.setMeta('demo', 'cleared');
}


function downloadFile(filename, content, mime){
  const blob = new Blob([content], {type: mime || 'application/octet-stream'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 600);
}

async function exportJSON(){
  const data = {
    app: 'shenjia-ledger',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    accounts: S.accounts,
    transactions: S.txs
  };
  downloadFile('shenjia-backup-' + stamp() + '.json', JSON.stringify(data, null, 2), 'application/json');
  await DB.setMeta('backup', new Date().toISOString());
  S.lastBackup = new Date().toISOString();
}

function csvCell(v){
  return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
}

function exportCSV(){
  const BOM = '\uFEFF';
  const rows = [['日期','类型','分类','账户','金额(元)','备注']];
  sortTxs(S.txs).forEach(t => {
    const acc = accountById(t.accountId);
    const to = t.type === 'transfer' ? accountById(t.toAccountId) : null;
    let typeLabel, cat, accLabel, amt;
    if(t.type === 'transfer'){
      typeLabel = '转账';
      cat = '转账';
      accLabel = (acc ? acc.name : '') + (to ? ' → ' + to.name : '');
      amt = fmtFen(t.amountFen);
    } else {
      typeLabel = t.type === 'income' ? '收入' : '支出';
      cat = t.category || '';
      accLabel = acc ? acc.name : '';
      amt = (t.type === 'income' ? '' : '-') + fmtFen(t.amountFen);
    }
    rows.push([t.date, typeLabel, cat, accLabel, amt, t.note || '']);
  });
  const csv = BOM + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  downloadFile('shenjia-records-' + stamp() + '.csv', csv, 'text/csv');
}

function importJSONText(text){
  let obj;
  try { obj = JSON.parse(text); }
  catch(e){ return {ok:false, msg:'文件不是有效的 JSON'}; }
  if(!obj || obj.app !== 'shenjia-ledger' || !Array.isArray(obj.accounts) || !Array.isArray(obj.transactions)){
    return {ok:false, msg:'不是身家账本的备份文件'};
  }
  return {ok:true, obj};
}

async function restoreFromObject(obj){
  await DB.clear('accounts');
  await DB.clear('transactions');
  await DB.clear('meta');
  for(const a of obj.accounts) await DB.put('accounts', a);
  for(const t of obj.transactions) await DB.put('transactions', t);
  await DB.setMeta('demo', 'cleared');
  await DB.setMeta('backup', new Date().toISOString());
}

function daysSinceBackup(){
  if(!S.lastBackup) return null;
  const diff = Date.now() - new Date(S.lastBackup).getTime();
  return Math.floor(diff / 86400000);
}


let _toastTimer = null;

function showToast(msg, btnText, onBtn){
  const el = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const btnEl = document.getElementById('toast-btn');
  msgEl.textContent = msg;
  if(btnText){
    btnEl.textContent = btnText;
    btnEl.classList.remove('hidden');
    btnEl.onclick = () => { hideToast(); if(onBtn) onBtn(); };
  } else {
    btnEl.classList.add('hidden');
    btnEl.onclick = null;
  }
  el.classList.remove('hidden');
  if(_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(hideToast, btnText ? 8000 : 2600);
}

function hideToast(){
  document.getElementById('toast').classList.add('hidden');
}

function openSheet(html){
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = html;
  sheet.classList.remove('hidden');
  document.getElementById('sheet-mask').onclick = null;
  requestAnimationFrame(() => sheet.classList.add('open'));
  document.getElementById('sheet-mask').classList.remove('hidden');
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
}

function closeSheet(){
  const sheet = document.getElementById('sheet');
  sheet.classList.remove('open');
  document.getElementById('sheet-mask').classList.add('hidden');
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
}

function sheetHead(title){
  return '<div class="sheet-bar"><h3>' + esc(title) + '</h3>' +
    '<button class="x" data-act="sheet-close">✕</button></div>';
}

function confirmSheet(title, msg, okText, danger){
  return new Promise(resolve => {
    const btnClass = danger ? 'danger' : 'primary';
    openSheet(
      '<div class="sheet-in"><div class="cf">' +
      '<h3>' + esc(title) + '</h3><p>' + esc(msg) + '</p>' +
      '<div class="btn-row">' +
      '<button class="btn ghost" id="cf-cancel">取消</button>' +
      '<button class="btn ' + btnClass + '" id="cf-ok">' + esc(okText || '确定') + '</button>' +
      '</div></div></div>'
    );
    document.getElementById('cf-cancel').onclick = () => { closeSheet(); resolve(false); };
    document.getElementById('cf-ok').onclick = () => { closeSheet(); resolve(true); };
    document.getElementById('sheet-mask').onclick = () => { closeSheet(); resolve(false); };
  });
}


function txRowHtml(tx){
  const acc = accountById(tx.accountId);
  const to = tx.type === 'transfer' ? accountById(tx.toAccountId) : null;
  let icon, title, sub, amt, cls;
  if(tx.type === 'transfer'){
    icon = '🔁';
    title = '转账';
    sub = (acc ? acc.name : '?') + ' → ' + (to ? to.name : '?');
    amt = '¥' + fmtFen(tx.amountFen);
    cls = 'traf';
  } else if(tx.type === 'income'){
    icon = catIcon(tx.category);
    title = tx.category || '收入';
    sub = acc ? acc.name : '';
    amt = '+¥' + fmtFen(tx.amountFen);
    cls = 'inc';
  } else {
    icon = catIcon(tx.category);
    title = tx.category || '支出';
    sub = acc ? acc.name : '';
    amt = '-¥' + fmtFen(tx.amountFen);
    cls = 'exp';
  }
  if(tx.note) sub = sub ? sub + ' · ' + tx.note : tx.note;
  return '<button class="row" data-act="tx-edit" data-id="' + tx.id + '">' +
    '<span class="ric">' + icon + '</span>' +
    '<span class="rmid"><span class="rtitle">' + esc(title) + '</span><span class="rsub">' + esc(sub) + '</span></span>' +
    '<span class="ramt ' + cls + ' num">' + amt + '</span>' +
    '</button>';
}

function accRowHtml(acc, balances){
  const k = KINDS[acc.kind] || {label:'其他', icon:'📦', group:'asset'};
  const bal = balances[acc.id] || 0;
  const isDebt = k.group === 'liability';
  return '<button class="row" data-act="acc-open" data-id="' + acc.id + '">' +
    '<span class="ric">' + k.icon + '</span>' +
    '<span class="rmid"><span class="rtitle">' + esc(acc.name) + '</span>' +
    '<span class="rsub">' + k.label + '</span></span>' +
    '<span class="ramt ' + (isDebt ? 'debt' : 'exp') + ' num">' +
    (isDebt ? '欠 ¥' : '¥') + fmtFen(bal) + '</span>' +
    '</button>';
}

function renderHome(){
  const t = S.totals;
  const net = t.net;
  let html = '<div class="hero">' +
    '<div class="hero-label">净资产（身家）</div>' +
    '<div class="hero-amt num ' + (net < 0 ? 'neg' : '') + '">' + (net < 0 ? '-¥' : '¥') + fmtFen(Math.abs(net)) + '</div>' +
    '<div class="hero-grid">' +
    '<div class="hero-cell"><div class="hl">总资产</div><div class="hv num">¥' + fmtFen(t.asset) + '</div></div>' +
    '<div class="hero-cell"><div class="hl">总负债</div><div class="hv num">¥' + fmtFen(t.debt) + '</div></div>' +
    '</div>' +
    '<div class="hero-grid g3" style="margin-top:10px">' +
    '<div class="hero-cell"><div class="hl">本月收入</div><div class="hv num">¥' + fmtFen(t.mInc) + '</div></div>' +
    '<div class="hero-cell"><div class="hl">本月支出</div><div class="hv num">¥' + fmtFen(t.mExp) + '</div></div>' +
    '<div class="hero-cell"><div class="hl">本月结余</div><div class="hv num">¥' + fmtFen(t.mInc - t.mExp) + '</div></div>' +
    '</div></div>';

  if(S.demoActive){
    html += '<button class="banner" data-act="demo-clear"><span>📌 当前是示例占位数据，记账流程熟悉后可一键清除</span><b>清除 →</b></button>';
  }

  const assets = S.accounts.filter(a => (KINDS[a.kind] || {}).group !== 'liability');
  const debts = S.accounts.filter(a => (KINDS[a.kind] || {}).group === 'liability');
  html += '<div class="card">' +
    '<div class="card-h"><b>账户</b><span>资产 ¥' + fmtFen(t.asset) + ' · 负债 ¥' + fmtFen(t.debt) + '</span></div>';
  if(S.accounts.length === 0){
    html += '<div class="empty"><span class="ei">👛</span>还没有账户<br>点下方「账户」页添加一个开始</div>';
  }
  assets.forEach(a => { html += accRowHtml(a, S.balances); });
  if(debts.length){
    html += '<div class="day-h">负债（欠款）</div>';
    debts.forEach(a => { html += accRowHtml(a, S.balances); });
  }
  html += '</div>';

  const recent = sortTxs(S.txs).slice(0, 5);
  html += '<div class="card">' +
    '<div class="card-h"><b>最近流水</b><button data-act="tab" data-id="ledger" style="color:var(--brand);font-size:13px">查看全部 →</button></div>';
  if(recent.length === 0){
    html += '<div class="empty"><span class="ei">📖</span>还没有流水<br>点右下角 ＋ 记第一笔</div>';
  } else {
    recent.forEach(tx => { html += txRowHtml(tx); });
  }
  html += '</div>';
  return html;
}


function monthTxStats(){
  let inc = 0, exp = 0;
  S.txs.forEach(tx => {
    if(monthOf(tx.date) !== S.month) return;
    if(tx.type === 'income') inc += tx.amountFen;
    else if(tx.type === 'expense') exp += tx.amountFen;
  });
  return {inc, exp, bal: inc - exp};
}

function renderLedger(){
  const st = monthTxStats();
  let html = '<div class="mnav">' +
    '<button data-act="month-prev">‹</button>' +
    '<b>' + monthLabel(S.month) + '</b>' +
    '<button data-act="month-next" ' + (S.month >= curMonthKey() ? 'disabled' : '') + '>›</button>' +
    '</div>';

  html += '<div class="stats">' +
    '<div class="stat"><div class="sl">支出</div><div class="sv num">¥' + fmtFen(st.exp) + '</div></div>' +
    '<div class="stat"><div class="sl">收入</div><div class="sv num">¥' + fmtFen(st.inc) + '</div></div>' +
    '<div class="stat"><div class="sl">结余</div><div class="sv num" style="color:' + (st.bal < 0 ? 'var(--red)' : 'var(--brand)') + '">¥' + fmtFen(st.bal) + '</div></div>' +
    '</div>';

  let chips = '<div class="acc-row"><button class="acc-chip ' + (S.filterAcc === null ? 'sel' : '') + '" data-act="filter-acc" data-id="all">全部</button>';
  S.accounts.forEach(a => {
    const k = KINDS[a.kind] || {icon:'📦'};
    chips += '<button class="acc-chip ' + (S.filterAcc === a.id ? 'sel' : '') + '" data-act="filter-acc" data-id="' + a.id + '">' + k.icon + ' ' + esc(a.name) + '</button>';
  });
  chips += '</div>';
  html += chips;

  const list = sortTxs(S.txs.filter(tx =>
    monthOf(tx.date) === S.month &&
    (S.filterAcc === null || tx.accountId === S.filterAcc || tx.toAccountId === S.filterAcc)
  ));

  html += '<div class="card">';
  if(list.length === 0){
    html += '<div class="empty"><span class="ei">📭</span>本月还没有流水<br>点右下角 ＋ 记一笔</div>';
  } else {
    const byDay = {};
    list.forEach(tx => { (byDay[tx.date] = byDay[tx.date] || []).push(tx); });
    Object.keys(byDay).sort().reverse().forEach(d => {
      html += '<div class="day-h"><span>' + dayLabel(d) + '</span><span>' + byDay[d].length + ' 笔</span></div>';
      byDay[d].forEach(tx => { html += txRowHtml(tx); });
    });
  }
  html += '</div>';
  return html;
}


function renderAccounts(){
  const assets = S.accounts.filter(a => (KINDS[a.kind] || {}).group !== 'liability');
  const debts = S.accounts.filter(a => (KINDS[a.kind] || {}).group === 'liability');
  let html = '<div class="mnav"><b>我的账户</b></div>';

  html += '<div class="card">' +
    '<div class="card-h"><b>资产账户</b><span class="num">合计 ¥' + fmtFen(S.totals.asset) + '</span></div>';
  if(assets.length === 0) html += '<div class="empty"><span class="ei">💰</span>还没有资产账户</div>';
  assets.forEach(a => { html += accRowHtml(a, S.balances); });
  html += '</div>';

  html += '<div class="card">' +
    '<div class="card-h"><b>负债账户</b><span class="num">合计 ¥' + fmtFen(S.totals.debt) + '</span></div>';
  if(debts.length === 0) html += '<div class="empty"><span class="ei">✅</span>没有负债，继续保持</div>';
  debts.forEach(a => { html += accRowHtml(a, S.balances); });
  html += '</div>';

  html += '<button class="btn primary" data-act="acc-add" style="margin-top:4px">＋ 添加账户</button>' +
    '<div class="about">负债账户（信用卡、贷款等）填写的金额是<b>当前欠款</b>；净资产 = 总资产 − 总负债。</div>';
  return html;
}


function renderMe(){
  const days = daysSinceBackup();
  let backupPill, backupColor;
  if(days === null){ backupPill = '从未备份'; backupColor = 'red'; }
  else if(days > 7){ backupPill = days + ' 天前'; backupColor = 'red'; }
  else { backupPill = days + ' 天前'; backupColor = 'gray'; }

  let html = '<div class="card card-pad" style="display:flex;align-items:center;gap:14px">' +
    '<span class="ric" style="width:48px;height:48px;font-size:24px">📒</span>' +
    '<div style="flex:1"><div style="font-size:18px;font-weight:800">' + APP_NAME + '</div>' +
    '<div class="sub-l">v' + APP_VERSION + ' · 记好账 · 知身家</div></div>' +
    (isStandalone() ? '<span class="pill">✓ 已安装</span>' : '<span class="pill gray">网页模式</span>') +
    '</div>';

  html += '<div class="sec">数据备份（铁律）</div><div class="card">' +
    '<div class="kv"><span class="kl">距上次备份</span><span class="pill ' + backupColor + '">' + backupPill + '</span></div>' +
    '<button class="row" data-act="exp-json"><span class="ric">💾</span>' +
    '<span class="rmid"><span class="rtitle">导出备份（JSON）</span><span class="rsub">全量数据，用于恢复 / 换机搬家</span></span></button>' +
    '<button class="row" data-act="exp-csv"><span class="ric">📊</span>' +
    '<span class="rmid"><span class="rtitle">导出流水（CSV）</span><span class="rsub">Excel 可直接打开对账</span></span></button>' +
    '<button class="row" data-act="imp-json"><span class="ric">📥</span>' +
    '<span class="rmid"><span class="rtitle">导入备份（JSON）</span><span class="rsub">用备份文件覆盖恢复，操作前先导出一份当前的</span></span></button>' +
    '</div>';

  html += '<div class="sec">数据管理</div><div class="card">' +
    '<button class="row" data-act="seed-load"><span class="ric">🎁</span>' +
    '<span class="rmid"><span class="rtitle">载入示例数据</span><span class="rsub">假数据占位，先熟悉流程（会覆盖当前数据）</span></span></button>' +
    '<button class="row" data-act="wipe"><span class="ric">🗑️</span>' +
    '<span class="rmid"><span class="rtitle" style="color:var(--red)">清空全部数据</span><span class="rsub">开始真实记账前先备份导出</span></span></button>' +
    '</div>';

  html += '<div class="sec">安装到手机</div><div class="card">' +
    '<div class="about">' +
    (isStandalone()
      ? '✓ 已安装为 App，可离线使用，数据长期保留。'
      : '📱 <b>iPhone</b>：用 Safari 打开本页 → 底部分享按钮 → 添加到主屏幕<br>' +
        '🤖 <b>安卓</b>：Chrome 打开本页 → 菜单 → 安装应用<br>' +
        '💻 <b>电脑</b>：Chrome 地址栏右侧安装图标<br>' +
        '<b style="color:var(--red)">重要</b>：装到主屏幕后数据才长期保留（iOS 对未安装的网页 7 天不用会清数据）。') +
    '</div></div>';

  html += '<div class="sec">关于</div><div class="card"><div class="about">' +
    '本应用为个人自用记账工具，所有数据<b>仅保存在本机浏览器</b>，不上传任何服务器。<br>' +
    '备份铁律：每周至少导出一次 JSON 备份，大额变动后立即导出。<br>' +
    '对标：微信小程序「算身家」· 自建增强版' +
    '</div></div>';
  return html;
}


let T = null;

function defaultFromId(){
  const recent = sortTxs(S.txs);
  if(recent.length) return recent[0].accountId;
  return S.accounts.length ? S.accounts[0].id : null;
}

function openTxSheet(tx){
  const defFrom = tx ? null : defaultFromId();
  let defTo = null;
  if(S.accounts.length > 1){
    const cand = S.accounts.find(a => a.id !== (tx ? tx.accountId : defFrom));
    defTo = cand ? cand.id : null;
  }
  T = {
    mode: tx ? 'edit' : 'add',
    id: tx ? tx.id : null,
    createdAt: tx ? tx.createdAt : null,
    type: tx ? tx.type : 'expense',
    amountStr: tx ? String(tx.amountFen / 100) : '',
    category: tx ? (tx.category || '') : '',
    accountId: tx ? tx.accountId : defFrom,
    toAccountId: tx ? (tx.toAccountId || null) : defTo,
    date: tx ? tx.date : todayStr(),
    note: tx ? (tx.note || '') : ''
  };
  renderTxSheet(true);
}

function syncTFromDom(){
  if(!T) return;
  const a = document.getElementById('tx-amt'); if(a) T.amountStr = a.value;
  const d = document.getElementById('tx-date'); if(d) T.date = d.value;
  const n = document.getElementById('tx-note'); if(n) T.note = n.value;
}

function txChips(act, selId){
  if(!S.accounts.length){
    return '<span class="sub-l" style="padding:6px 2px">还没有账户，先到「账户」页添加一个</span>';
  }
  return S.accounts.map(a => {
    const k = KINDS[a.kind] || {icon:'📦'};
    return '<button class="acc-chip ' + (selId === a.id ? 'sel' : '') + '" data-act="' + act + '" data-id="' + a.id + '">' + k.icon + ' ' + esc(a.name) + '</button>';
  }).join('');
}

function renderTxParts(){
  const el = document.getElementById('tx-parts');
  if(!el) return;
  let html = '';
  if(T.type === 'transfer'){
    html += '<div class="list-t">转出账户</div><div class="acc-row">' + txChips('tx-from', T.accountId) + '</div>';
    html += '<div class="list-t">转入账户</div><div class="acc-row">' + txChips('tx-to', T.toAccountId) + '</div>';
  } else {
    html += '<div class="list-t">分类</div><div class="cat-grid">' +
      CATS[T.type].map(c =>
        '<button class="cat ' + (T.category === c.name ? 'sel' : '') + '" data-act="tx-cat" data-id="' + esc(c.name) + '">' +
        '<span class="ci">' + c.icon + '</span>' + c.name + '</button>'
      ).join('') + '</div>';
    html += '<div class="list-t">账户</div><div class="acc-row">' + txChips('tx-acc', T.accountId) + '</div>';
  }
  el.innerHTML = html;
}

function renderTxSheet(focus){
  const isEdit = T.mode === 'edit';
  const seg = '<div class="seg">' +
    '<button class="' + (T.type === 'expense' ? 'on exp' : '') + '" data-act="tx-type" data-id="expense">支出</button>' +
    '<button class="' + (T.type === 'income' ? 'on inc' : '') + '" data-act="tx-type" data-id="income">收入</button>' +
    '<button class="' + (T.type === 'transfer' ? 'on' : '') + '" data-act="tx-type" data-id="transfer">转账</button>' +
    '</div>';
  openSheet(
    sheetHead(isEdit ? '编辑流水' : '记一笔') +
    '<div class="sheet-in">' + seg +
    '<div class="amt-wrap"><span class="amt-sign">¥</span>' +
    '<input class="amt-input num" id="tx-amt" inputmode="decimal" placeholder="0.00" value="' + esc(T.amountStr) + '" autocomplete="off"></div>' +
    '<div id="tx-parts"></div>' +
    '<div class="f"><label>日期</label><input type="date" id="tx-date" value="' + esc(T.date) + '"></div>' +
    '<div class="f"><label>备注（选填）</label><input id="tx-note" maxlength="60" value="' + esc(T.note) + '"></div>' +
    '<div class="btn-row">' +
    (isEdit ? '<button class="btn danger" data-act="tx-del">删除</button>' : '') +
    '<button class="btn primary" data-act="tx-save">' + (isEdit ? '保存' : '记 ✓') + '</button>' +
    '</div></div>'
  );
  renderTxParts();
  if(focus){
    const amtEl = document.getElementById('tx-amt');
    if(amtEl){ amtEl.focus(); if(amtEl.select) amtEl.select(); }
  }
}

async function saveTx(){
  const amountFen = parseAmountToFen(document.getElementById('tx-amt').value);
  if(isNaN(amountFen) || amountFen <= 0){ showToast('请输入正确的金额'); return; }
  syncTFromDom();
  const date = T.date || todayStr();
  const tx = {date, type: T.type, amountFen, note: T.note.trim(), category: '', accountId: null, toAccountId: null};
  if(T.type === 'transfer'){
    if(T.accountId == null || T.toAccountId == null){ showToast('请选择转出和转入账户'); return; }
    if(T.accountId === T.toAccountId){ showToast('转出和转入不能是同一个账户'); return; }
    tx.accountId = T.accountId;
    tx.toAccountId = T.toAccountId;
  } else {
    if(!T.category){ showToast('请点选一个分类'); return; }
    if(T.accountId == null){ showToast('请选择账户（没有就先到「账户」页添加）'); return; }
    tx.category = T.category;
    tx.accountId = T.accountId;
  }
  if(T.mode === 'edit'){ tx.id = T.id; tx.createdAt = T.createdAt; }
  else tx.createdAt = new Date().toISOString();
  await DB.put('transactions', tx);
  await loadAll();
  closeSheet();
  render();
  showToast(T.mode === 'edit' ? '已保存 ✓' : '已记 ✓');
}

async function deleteTx(){
  const ok = await confirmSheet('删除这笔流水', '删除后无法恢复（有备份文件可恢复）', '删除', true);
  if(!ok) return;
  await DB.del('transactions', T.id);
  await loadAll();
  closeSheet();
  render();
  showToast('已删除');
}


let A = null;

function kindSelectHtml(selKind){
  let html = '<select id="ac-kind">';
  html += '<optgroup label="资产">';
  Object.keys(KINDS).filter(k => KINDS[k].group === 'asset').forEach(k => {
    html += '<option value="' + k + '"' + (selKind === k ? ' selected' : '') + '>' + KINDS[k].icon + ' ' + KINDS[k].label + '</option>';
  });
  html += '</optgroup><optgroup label="负债">';
  Object.keys(KINDS).filter(k => KINDS[k].group === 'liability').forEach(k => {
    html += '<option value="' + k + '"' + (selKind === k ? ' selected' : '') + '>' + KINDS[k].icon + ' ' + KINDS[k].label + '</option>';
  });
  html += '</optgroup></select>';
  return html;
}

function updateKindHint(){
  const k = KINDS[document.getElementById('ac-kind').value];
  document.getElementById('ac-kind-hint').textContent = k.group === 'asset' ? '资产 · 计入总资产' : '负债 · 计入总负债';
  document.getElementById('ac-init-label').textContent = k.group === 'asset' ? '初始金额（元）' : '当前欠款（元）';
  document.getElementById('ac-init-hint').textContent = k.group === 'asset'
    ? '当前余额 = 初始金额 + 流水累计'
    : '欠款记正数，之后用信用卡刷卡会自动增加';
}

function openAccountForm(acc){
  A = acc ? {mode:'edit', id:acc.id, createdAt:acc.createdAt} : {mode:'add'};
  openSheet(
    sheetHead(acc ? '编辑账户' : '添加账户') +
    '<div class="sheet-in">' +
    '<div class="f"><label>名称</label><input id="ac-name" maxlength="20" placeholder="如：招商银行卡" value="' + esc(acc ? acc.name : '') + '"></div>' +
    '<div class="f"><label>类型</label>' + kindSelectHtml(acc ? acc.kind : 'debit') + '<div class="hint" id="ac-kind-hint"></div></div>' +
    '<div class="f"><label id="ac-init-label">初始金额（元）</label>' +
    '<input id="ac-init" inputmode="decimal" placeholder="0.00" value="' + (acc ? esc(String((acc.initialFen || 0) / 100)) : '') + '">' +
    '<div class="hint" id="ac-init-hint"></div></div>' +
    '<div class="f"><label>备注（选填）</label><input id="ac-note" maxlength="50" value="' + esc(acc ? (acc.note || '') : '') + '"></div>' +
    '<div class="btn-row">' +
    (A.mode === 'edit' ? '<button class="btn danger" data-act="acc-del" data-id="' + A.id + '">删除</button>' : '') +
    '<button class="btn primary" data-act="acc-save">保存</button>' +
    '</div></div>'
  );
  updateKindHint();
  document.getElementById('ac-kind').addEventListener('change', updateKindHint);
}

async function saveAccount(){
  const name = document.getElementById('ac-name').value.trim();
  const kind = document.getElementById('ac-kind').value;
  const initFen = parseAmountToFen(document.getElementById('ac-init').value || '0');
  if(!name){ showToast('请填写账户名称'); return; }
  if(isNaN(initFen) || initFen < 0){ showToast('金额不正确（需为 0 或正数）'); return; }
  const note = document.getElementById('ac-note').value.trim();
  const obj = {name, kind, initialFen: initFen, note};
  if(A.mode === 'edit'){ obj.id = A.id; obj.createdAt = A.createdAt; }
  else obj.createdAt = new Date().toISOString();
  await DB.put('accounts', obj);
  await loadAll();
  closeSheet();
  render();
  showToast('账户已保存 ✓');
}

async function deleteAccount(id){
  const n = txsOfAccount(id).length;
  if(n > 0){ showToast('该账户还有 ' + n + ' 笔流水，请先在「明细」里删除相关流水'); return; }
  const ok = await confirmSheet('删除账户', '删除后无法恢复，确定？', '删除', true);
  if(!ok) return;
  await DB.del('accounts', id);
  await loadAll();
  closeSheet();
  render();
  showToast('账户已删除');
}

function openAccountDetail(id){
  const acc = accountById(id);
  if(!acc) return;
  const k = KINDS[acc.kind] || {label:'其他', icon:'📦', group:'asset'};
  const bal = S.balances[acc.id] || 0;
  const isDebt = k.group === 'liability';
  let html = sheetHead(acc.name) + '<div class="sheet-in">' +
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">' +
    '<span class="ric" style="width:46px;height:46px;font-size:22px">' + k.icon + '</span>' +
    '<span class="pill ' + (isDebt ? 'red' : '') + '">' + esc(k.label) + ' · ' + (isDebt ? '负债' : '资产') + '</span></div>' +
    '<div class="sub-l">' + (isDebt ? '当前欠款' : '当前结余') + '</div>' +
    '<div class="big-balance num ' + (isDebt || bal < 0 ? 'debt' : '') + '">' + (bal < 0 ? '-' : '') + '¥' + fmtFen(Math.abs(bal)) + '</div>' +
    '<div class="sub-l">初始：¥' + fmtFen(acc.initialFen || 0) + (acc.note ? ' · ' + esc(acc.note) : '') + '</div>';
  const txs = txsOfAccount(id).slice(0, 5);
  if(txs.length){
    html += '<div class="list-t">该账户流水（最近 ' + txs.length + ' 笔）</div>';
    txs.forEach(t => { html += txRowHtml(t); });
  } else {
    html += '<div class="empty" style="padding:18px">该账户暂无流水</div>';
  }
  html += '<div class="btn-row">' +
    '<button class="btn ghost" data-act="acc-edit" data-id="' + acc.id + '">编辑</button>' +
    '<button class="btn danger" data-act="acc-del" data-id="' + acc.id + '">删除</button>' +
    '</div></div>';
  openSheet(html);
}


function render(){
  const main = document.getElementById('main');
  let html = '';
  if(S.tab === 'home') html = renderHome();
  else if(S.tab === 'ledger') html = renderLedger();
  else if(S.tab === 'accounts') html = renderAccounts();
  else html = renderMe();
  main.innerHTML = html;
  document.querySelectorAll('#tabbar .tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === S.tab);
  });
}

function setTab(name){
  S.tab = name;
  render();
  window.scrollTo(0, 0);
}

function handleAct(act, id){
  switch(act){
    case 'tab': setTab(id); break;
    case 'sheet-close': closeSheet(); break;
    case 'month-prev': S.month = monthShift(S.month, -1); render(); break;
    case 'month-next': S.month = monthShift(S.month, 1); render(); break;
    case 'filter-acc': S.filterAcc = id === 'all' ? null : Number(id); render(); break;
    case 'tx-edit': {
      const tx = S.txs.find(t => String(t.id) === String(id));
      if(tx) openTxSheet(tx);
      break;
    }
    case 'tx-type':
      syncTFromDom();
      T.type = id;
      T.category = '';
      if(id !== 'transfer' && T.accountId == null && S.accounts.length) T.accountId = S.accounts[0].id;
      renderTxSheet(false);
      break;
    case 'tx-cat': T.category = id; renderTxParts(); break;
    case 'tx-acc': T.accountId = Number(id); renderTxParts(); break;
    case 'tx-from': T.accountId = Number(id); renderTxParts(); break;
    case 'tx-to': T.toAccountId = Number(id); renderTxParts(); break;
    case 'tx-save': saveTx(); break;
    case 'tx-del': deleteTx(); break;
    case 'acc-open': openAccountDetail(Number(id)); break;
    case 'acc-add': openAccountForm(null); break;
    case 'acc-edit': openAccountForm(accountById(Number(id))); break;
    case 'acc-del': deleteAccount(Number(id)); break;
    case 'acc-save': saveAccount(); break;
    case 'exp-json':
      exportJSON().then(() => { render(); showToast('备份已导出 ✓ 请妥善保存'); });
      break;
    case 'exp-csv': exportCSV(); showToast('CSV 已导出 ✓'); break;
    case 'imp-json': document.getElementById('file-import').click(); break;
    case 'demo-clear':
      confirmSheet('清除示例数据', '将删除全部示例账户与流水，之后即可开始记真实账。确定？', '清除', true)
        .then(async ok => {
          if(!ok) return;
          await clearAllData(true);
          await loadAll();
          render();
          showToast('已清除 ✓ 开始记真实账');
        });
      break;
    case 'seed-load':
      confirmSheet('载入示例数据', '将清空当前全部数据并载入示例占位数据，确定？', '载入', true)
        .then(async ok => {
          if(!ok) return;
          await clearAllData(false);
          await seedDemo();
          await loadAll();
          render();
          showToast('示例数据已载入');
        });
      break;
    case 'wipe':
      confirmSheet('清空全部数据', '所有账户与流水将被删除且无法恢复。建议先「导出备份」。确定继续？', '继续', true)
        .then(ok => ok ? confirmSheet('再次确认', '真的要清空全部数据吗？此操作不可撤销。', '清空', true) : false)
        .then(async ok => {
          if(!ok) return;
          await clearAllData(true);
          await loadAll();
          render();
          showToast('已全部清空');
        });
      break;
  }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if(!el) return;
  e.preventDefault();
  handleAct(el.dataset.act, el.dataset.id);
});

document.getElementById('fab').addEventListener('click', () => openTxSheet(null));
document.getElementById('sheet-mask').addEventListener('click', closeSheet);

document.getElementById('file-import').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if(!file) return;
  let text;
  try { text = await file.text(); }
  catch(err){ showToast('读取文件失败'); return; }
  const res = importJSONText(text);
  if(!res.ok){ showToast(res.msg); return; }
  const ok = await confirmSheet('导入备份', '将用备份覆盖当前全部数据（当前 ' + S.txs.length + ' 笔流水），确定？', '导入覆盖', true);
  if(!ok) return;
  await restoreFromObject(res.obj);
  await loadAll();
  render();
  showToast('恢复完成 ✓');
});

async function init(){
  try {
    await openDB();
    const demoMeta = await DB.getMeta('demo');
    const accounts = await DB.getAll('accounts');
    if(accounts.length === 0 && !demoMeta){
      await seedDemo();
      showToast('已载入示例占位数据，熟悉后可在「我的」中清除');
    }
    await loadAll();
    render();
    const days = daysSinceBackup();
    if(days === null || days > 7){
      setTimeout(() => {
        showToast(days === null ? '还没有备份过，建议立即导出 JSON 备份' : '已 ' + days + ' 天未备份，建议导出一份', '去备份', () => setTab('me'));
      }, 1200);
    }
  } catch(err){
    console.error(err);
    showToast('初始化失败：' + (err && err.message ? err.message : String(err)));
  }
}

if('serviceWorker' in navigator &&
   (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))){
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if(!nw) return;
      nw.addEventListener('statechange', () => {
        if(nw.state === 'installed' && navigator.serviceWorker.controller){
          showToast('新版本已就绪', '刷新', () => nw.postMessage({type:'SKIP_WAITING'}));
        }
      });
    });
  }).catch(() => {});
  let _reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if(_reloading) return;
    _reloading = true;
    location.reload();
  });
}

init();

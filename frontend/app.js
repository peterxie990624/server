/* ============================================================
   数字化学习空间 - 前端逻辑 v4.0
   支持在线模式（后端API）和离线模式（localStorage）自动切换
   ============================================================ */

const API_BASE = 'http://124.223.1.32:3001/api';

// ============================================================
// 全局状态
// ============================================================
let state = {
  user: null,
  token: null,
  isOnline: false,
  memos: [],
  currentFilter: 'all',
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  calSelectedDate: null,
  currentCircleId: null,
  heatmapYear: new Date().getFullYear(),
};

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initPetals();
  await detectMode();
  tryAutoLogin();
});

async function detectMode() {
  try {
    const r = await fetch(API_BASE + '/health', { signal: AbortSignal.timeout(3000) });
    state.isOnline = r.ok;
  } catch {
    state.isOnline = false;
  }
}

function tryAutoLogin() {
  const savedToken = localStorage.getItem('dlspace_token');
  const savedUser = localStorage.getItem('dlspace_user');
  if (savedToken && savedUser) {
    try {
      state.token = savedToken;
      state.user = JSON.parse(savedUser);
      enterApp();
      return;
    } catch {}
  }
  // 显示登录页
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('registerPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'none';
}

// ============================================================
// 花瓣动画
// ============================================================
function initPetals() {
  const container = document.getElementById('petalsContainer');
  if (!container) return;
  const colors = ['#f8b4c8','#fbd4e4','#d4b8f0','#e8d0f8','#fce4ec','#f3e5f5','#e1bee7'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'petal';
    const size = 8 + Math.random() * 14;
    p.style.cssText = `width:${size}px;height:${size*0.7}px;left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-delay:-${Math.random()*12}s;animation-duration:${8+Math.random()*10}s;`;
    container.appendChild(p);
  }
}

// ============================================================
// 认证 - 登录/注册页面切换
// ============================================================
function showPage(pageId) {
  ['loginPage','registerPage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === pageId) ? 'flex' : 'none';
  });
}

function togglePwd(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  if (el.type === 'password') { el.type = 'text'; btn.textContent = '🙈'; }
  else { el.type = 'password'; btn.textContent = '👁'; }
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const remember = document.getElementById('rememberMe')?.checked;
  const hint = document.getElementById('loginHint');
  if (!username || !password) { hint.textContent = '请输入用户名和密码'; return; }
  hint.textContent = '登录中...'; hint.style.color = '#9b7ec8';

  if (state.isOnline) {
    try {
      const r = await fetch(API_BASE + '/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const d = await r.json();
      if (!r.ok) { hint.textContent = d.error || d.message || '用户名或密码错误'; hint.style.color = '#e57373'; return; }
      state.token = d.token;
      state.user = d.user;
      if (remember) {
        localStorage.setItem('dlspace_token', d.token);
        localStorage.setItem('dlspace_user', JSON.stringify(d.user));
      }
      enterApp();
    } catch { hint.textContent = '网络错误，请稍后重试'; hint.style.color = '#e57373'; }
  } else {
    // 离线模式：检查本地用户表
    const users = JSON.parse(localStorage.getItem('dlspace_offline_users') || '[]');
    const u = users.find(x => x.username === username && x.password === password);
    if (!u) { hint.textContent = '用户名或密码错误'; hint.style.color = '#e57373'; return; }
    state.token = 'offline_' + u.id;
    state.user = { id: u.id, username: u.username, display_name: u.display_name };
    if (remember) {
      localStorage.setItem('dlspace_token', state.token);
      localStorage.setItem('dlspace_user', JSON.stringify(state.user));
    }
    enterApp();
  }
}

async function doRegister() {
  const username = document.getElementById('regUsername').value.trim();
  const displayName = document.getElementById('regDisplayName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regPasswordConfirm').value;
  const hint = document.getElementById('registerHint');

  if (!username) { hint.textContent = '请输入用户名'; hint.style.color = '#e57373'; return; }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { hint.textContent = '用户名3-20位，仅字母数字下划线'; hint.style.color = '#e57373'; return; }
  if (!phone) { hint.textContent = '请输入手机号码'; hint.style.color = '#e57373'; return; }
  if (!/^1[3-9]\d{9}$/.test(phone)) { hint.textContent = '请输入正确的11位手机号码'; hint.style.color = '#e57373'; return; }
  if (!password || password.length < 6) { hint.textContent = '密码至少6位'; hint.style.color = '#e57373'; return; }
  if (password !== confirm) { hint.textContent = '两次密码不一致'; hint.style.color = '#e57373'; return; }
  
  // 检查昵称或用户名中的敏感词
  const nameToCheck = displayName || username;
  if (window.filterSystem && window.filterSystem.hasSensitiveWord(nameToCheck)) {
    hint.textContent = '昵称或用户名包含敏感词，请修改'; hint.style.color = '#e57373'; return;
  }
  
  hint.textContent = '注册中...'; hint.style.color = '#9b7ec8';

  if (state.isOnline) {
    try {
      const r = await fetch(API_BASE + '/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, display_name: displayName || username })
      });
      const d = await r.json();
      if (!r.ok) { hint.textContent = d.error || d.message || '注册失败'; hint.style.color = '#e57373'; return; }
      state.token = d.token; state.user = d.user;
      localStorage.setItem('dlspace_token', d.token);
      localStorage.setItem('dlspace_user', JSON.stringify(d.user));
      hint.textContent = '注册成功！'; hint.style.color = '#7cb87c';
      setTimeout(enterApp, 600);
    } catch { hint.textContent = '网络错误，请稍后重试'; hint.style.color = '#e57373'; }
  } else {
    const users = JSON.parse(localStorage.getItem('dlspace_offline_users') || '[]');
    if (users.find(x => x.username === username)) { hint.textContent = '用户名已存在'; hint.style.color = '#e57373'; return; }
    const newUser = { id: Date.now(), username, password, display_name: displayName || username };
    users.push(newUser);
    localStorage.setItem('dlspace_offline_users', JSON.stringify(users));
    state.token = 'offline_' + newUser.id;
    state.user = { id: newUser.id, username: newUser.username, display_name: newUser.display_name };
    localStorage.setItem('dlspace_token', state.token);
    localStorage.setItem('dlspace_user', JSON.stringify(state.user));
    hint.textContent = '注册成功！'; hint.style.color = '#7cb87c';
    setTimeout(enterApp, 600);
  }
}

function enterApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('registerPage').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';

  const dn = state.user.display_name || state.user.username;
  document.getElementById('displayName').textContent = dn;
  const avatarEl = document.getElementById('userAvatarSm');
  if (avatarEl) avatarEl.textContent = dn.charAt(0).toUpperCase();
  const badge = document.getElementById('modeBadge');
  if (badge) { badge.textContent = state.isOnline ? '在线' : '离线'; badge.className = 'mode-badge' + (state.isOnline ? '' : ' offline'); }

  loadMemos().then(() => {
    switchTab('checkin');
    renderCalendar();
    showToast(`欢迎，${dn} 🌸`);
  });
}

function doAlipayLogin() {
  const hint = document.getElementById('loginHint');
  hint.textContent = '正在跳转支付宝授权...';
  hint.style.color = '#1677FF';
  // 模拟支付宝授权过程
  setTimeout(() => {
    // 假设后端返回的支付宝用户信息
    const alipayUser = {
      id: 'alipay_' + Date.now(),
      username: 'alipay_user',
      display_name: '支付宝用户',
      phone: '13800138000'
    };
    state.token = 'alipay_token_' + Date.now();
    state.user = alipayUser;
    localStorage.setItem('dlspace_token', state.token);
    localStorage.setItem('dlspace_user', JSON.stringify(state.user));
    enterApp();
  }, 1000);
}

function doLogout() {
  localStorage.removeItem('dlspace_token');
  localStorage.removeItem('dlspace_user');
  state.user = null; state.token = null; state.memos = []; state.currentCircleId = null;
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginHint').textContent = '';
  showToast('已安全退出');
}

// ============================================================
// 导航
// ============================================================
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  const tab = document.getElementById('tab-' + name);
  if (tab) tab.classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-tab="${name}"]`);
  if (btn) btn.classList.add('active');

  if (name === 'checkin') renderCheckinTab();
  if (name === 'memo') renderMemos();
  if (name === 'calendar') renderCalendar();
  if (name === 'search') { document.getElementById('searchInput').value = ''; showSearchEmpty(); }
  if (name === 'profile') renderProfile();
}

// ============================================================
// 打卡圈子
// ============================================================
async function renderCheckinTab() {
  const el = document.getElementById('tab-checkin');
  if (!el) return;
  if (state.currentCircleId) { await renderCircleDetail(state.currentCircleId); return; }

  el.innerHTML = `
    <div class="page-header">
      <div><h2 class="page-title">打卡圈子</h2><p class="page-subtitle">加入圈子，坚持每日打卡</p></div>
      <button class="add-btn" onclick="openCreateCircle()">+ 创建</button>
    </div>
    <div id="circleList" class="circle-list"><div class="loading-state">加载中...</div></div>
  `;
  await loadCircles();
}

async function loadCircles() {
  const el = document.getElementById('circleList');
  if (!el) return;
  let circles = [];
  if (state.isOnline) {
    try {
      const d = await apiFetch('GET', '/circles');
      circles = (d.circles || []).map(c => ({...c, member_count: c.member_count || 1}));
    } catch { circles = []; }
  }
  // 合并本地圈子（离线创建的）
  const localCircles = JSON.parse(localStorage.getItem('dlspace_circles') || '[]');
  const onlineIds = new Set(circles.map(c => c.id));
  localCircles.forEach(c => { if (!onlineIds.has(c.id)) circles.push(c); });

  if (!circles.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🌸</div><p>还没有圈子，来创建第一个吧</p></div>';
    return;
  }
  const myIds = getMyCircleIds();
  el.innerHTML = circles.map(c => `
    <div class="circle-card ${myIds.includes(String(c.id)) ? 'joined' : ''}">
      <div class="circle-card-header">
        <div class="circle-icon-badge">${c.name.charAt(0).toUpperCase()}</div>
        <div class="circle-info">
          <div class="circle-name">${escHtml(c.name)} ${c.is_private ? '🔒' : ''}</div>
          <div class="circle-meta">${c.member_count || 1} 人加入 · ${formatDate(c.created_at)}</div>
        </div>
        ${myIds.includes(String(c.id)) ? '<span class="badge-joined">已加入</span>' : ''}
      </div>
      ${c.description ? `<div class="circle-desc">${escHtml(c.description)}</div>` : ''}
      <div class="circle-card-footer">
        ${myIds.includes(String(c.id))
          ? `<button class="btn-enter-circle" onclick="enterCircle('${c.id}')">进入圈子 →</button>`
          : `<button class="btn-join-circle" onclick="joinCircle('${c.id}', ${c.is_private ? 'true' : 'false'})">加入圈子</button>`
        }
      </div>
    </div>
  `).join('');
}

function getMyCircleIds() {
  if (!state.user) return [];
  return JSON.parse(localStorage.getItem('dlspace_my_circles_' + state.user.id) || '[]').map(String);
}

function addMyCircleId(id) {
  if (!state.user) return;
  const ids = getMyCircleIds();
  if (!ids.includes(String(id))) {
    ids.push(String(id));
    localStorage.setItem('dlspace_my_circles_' + state.user.id, JSON.stringify(ids));
  }
}

function openCreateCircle() {
  showModal(`
    <div class="modal-header">
      <h3>创建打卡圈子</h3>
      <button class="modal-close" onclick="closeTopModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="input-group"><label>圈子名称 <span class="input-tip">必填</span></label>
        <input type="text" id="mc_name" placeholder="给圈子起个名字" class="modal-input"></div>
      <div class="input-group"><label>圈子简介</label>
        <textarea id="mc_desc" placeholder="描述一下这个圈子的目标..." class="modal-textarea"></textarea></div>
      <label class="checkbox-label">
        <input type="checkbox" id="mc_private" onchange="document.getElementById('mc_pwd_wrap').style.display=this.checked?'block':'none'">
        🔒 需要密码才能加入
      </label>
      <div id="mc_pwd_wrap" style="display:none;margin-top:8px">
        <div class="input-group"><label>加入密码</label>
          <input type="password" id="mc_pwd" placeholder="设置加入密码" class="modal-input"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick="closeTopModal()">取消</button>
      <button class="btn-save" onclick="doCreateCircle()">创建</button>
    </div>
  `);
}

async function doCreateCircle() {
  const name = document.getElementById('mc_name').value.trim();
  const desc = document.getElementById('mc_desc').value.trim();
  const isPrivate = document.getElementById('mc_private').checked;
  const pwd = document.getElementById('mc_pwd')?.value || '';
  if (!name) { showToast('请填写圈子名称'); return; }

  let newCircle;
  if (state.isOnline) {
    try {
      const d = await apiFetch('POST', '/circles', { name, description: desc, is_private: isPrivate, password: pwd });
      newCircle = d.circle;
    } catch (e) { showToast(e.message || '创建失败'); return; }
  }
  if (!newCircle) {
    newCircle = { id: 'local_' + Date.now(), name, description: desc, is_private: isPrivate,
      password: pwd, owner_id: state.user.id, member_count: 1, created_at: new Date().toISOString() };
    const circles = JSON.parse(localStorage.getItem('dlspace_circles') || '[]');
    circles.push(newCircle);
    localStorage.setItem('dlspace_circles', JSON.stringify(circles));
  }
  addMyCircleId(newCircle.id);
  showToast('圈子创建成功！🎉');
  closeTopModal();
  await loadCircles();
}

async function joinCircle(id, isPrivate) {
  let pwd = '';
  if (isPrivate) {
    pwd = prompt('此圈子需要密码，请输入：') || '';
    if (!pwd) return;
  }
  if (state.isOnline) {
    try {
      await apiFetch('POST', '/circles/' + id + '/join', { password: pwd });
    } catch (e) { showToast(e.message || '加入失败'); return; }
  } else {
    const circles = JSON.parse(localStorage.getItem('dlspace_circles') || '[]');
    const c = circles.find(x => String(x.id) === String(id));
    if (c && c.is_private && c.password && c.password !== pwd) { showToast('密码错误'); return; }
    if (c) { c.member_count = (c.member_count || 1) + 1; localStorage.setItem('dlspace_circles', JSON.stringify(circles)); }
  }
  addMyCircleId(id);
  showToast('加入成功！');
  await loadCircles();
}

function enterCircle(id) {
  state.currentCircleId = id;
  renderCircleDetail(id);
}

function exitCircle() {
  state.currentCircleId = null;
  renderCheckinTab();
}

async function renderCircleDetail(id) {
  const el = document.getElementById('tab-checkin');
  if (!el) return;

  // 获取圈子信息
  let circle = null;
  const localCircles = JSON.parse(localStorage.getItem('dlspace_circles') || '[]');
  circle = localCircles.find(x => String(x.id) === String(id));
  if (state.isOnline && !circle) {
    try { const d = await apiFetch('GET', '/circles/' + id); circle = d.circle; } catch {}
  }
  if (!circle) { state.currentCircleId = null; renderCheckinTab(); return; }

  const todayStr = getTodayStr();
  const checkedToday = hasCheckedInToday(id, todayStr);
  const stats = getCircleStats(id);

  el.innerHTML = `
    <div class="circle-detail-header">
      <button class="back-btn" onclick="exitCircle()">‹ 返回</button>
      <span class="circle-detail-title">${escHtml(circle.name)}</span>
      <button class="btn-checkin-now ${checkedToday ? 'checked' : ''}" onclick="${checkedToday ? 'showToast(\"今天已打卡 ✅\")' : 'openCheckinPost(\"' + id + '\")'}">
        ${checkedToday ? '✅ 已打卡' : '打卡'}
      </button>
    </div>
    <div class="checkin-stats-bar">
      <div class="checkin-stat-item">
        <div class="stat-big-num">${stats.streak}</div>
        <div class="stat-small-label">连续天</div>
      </div>
      <div class="stat-divider"></div>
      <div class="checkin-stat-item">
        <div class="stat-big-num">${stats.total}</div>
        <div class="stat-small-label">累计打卡</div>
      </div>
      <div class="stat-divider"></div>
      <div class="checkin-stat-item">
        <div class="stat-big-num">${circle.member_count || 1}</div>
        <div class="stat-small-label">圈子成员</div>
      </div>
    </div>
    <div id="checkinFeed" class="checkin-feed"><div class="loading-state">加载中...</div></div>
  `;
  await loadCheckinFeed(id);
}

async function loadCheckinFeed(circleId) {
  const el = document.getElementById('checkinFeed');
  if (!el) return;
  let checkins = [];
  if (state.isOnline) {
    try { const d = await apiFetch('GET', '/checkins/circle/' + circleId); checkins = d.checkins || []; } catch {}
  }
  // 合并本地打卡记录
  const localCheckins = JSON.parse(localStorage.getItem('dlspace_checkins_' + circleId) || '[]');
  const onlineIds = new Set(checkins.map(c => String(c.id)));
  localCheckins.forEach(c => { if (!onlineIds.has(String(c.id))) checkins.unshift(c); });
  checkins.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  if (!checkins.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🌸</div><p>还没有打卡记录，快来第一个打卡吧！</p></div>';
    return;
  }
  el.innerHTML = checkins.map(c => renderCheckinCard(c)).join('');
}

function renderCheckinCard(c) {
  const name = escHtml(c.display_name || c.username || '用户');
  const liked = isLiked(c.id);
  let imgs = [];
  try { imgs = c.images ? (typeof c.images === 'string' ? JSON.parse(c.images) : c.images) : []; } catch {}
  return `
    <div class="feed-card">
      <div class="feed-card-header">
        <div class="feed-avatar">${name.charAt(0).toUpperCase()}</div>
        <div class="feed-user-meta">
          <div class="feed-username">${name}</div>
          <div class="feed-time">${formatDateTime(c.created_at)}</div>
        </div>
        <span class="feed-checkin-tag">✅ 打卡</span>
      </div>
      ${c.content ? `<div class="feed-content">${escHtml(c.content)}</div>` : ''}
      ${imgs.length ? `<div class="feed-images">${imgs.map(img => `<img class="feed-img" src="${img}" onclick="previewImg('${img}')" loading="lazy">`).join('')}</div>` : ''}
      <div class="feed-card-footer">
        <button class="like-btn ${liked ? 'liked' : ''}" onclick="toggleLike('${c.id}', this)">
          ${liked ? '❤️' : '🤍'} <span class="like-count">${c.likes_count || 0}</span>
        </button>
      </div>
    </div>
  `;
}

function openCheckinPost(circleId) {
  showModal(`
    <div class="modal-header">
      <h3>今日打卡</h3>
      <button class="modal-close" onclick="closeTopModal()">✕</button>
    </div>
    <div class="modal-body">
      <textarea id="ci_content" placeholder="记录今天的收获和感想..." class="modal-textarea" style="min-height:100px"></textarea>
      <div class="upload-area">
        <label style="font-size:13px;color:var(--text-mid);display:block;margin-bottom:6px">📷 添加图片（最多3张）</label>
        <input type="file" id="ci_images" accept="image/*" multiple class="file-input">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick="closeTopModal()">取消</button>
      <button class="btn-save" onclick="doCheckin('${circleId}')">发布打卡 🎉</button>
    </div>
  `);
}

async function doCheckin(circleId) {
  const content = document.getElementById('ci_content').value.trim();
  const fileInput = document.getElementById('ci_images');
  const todayStr = getTodayStr();
  if (hasCheckedInToday(circleId, todayStr)) { showToast('今天已经打卡过了 ✅'); closeTopModal(); return; }

  let imageUrls = [];
  if (fileInput && fileInput.files.length) {
    for (let i = 0; i < Math.min(fileInput.files.length, 3); i++) {
      imageUrls.push(await readFileAsDataURL(fileInput.files[i]));
    }
  }

  // 本地存储打卡记录
  const newCheckin = {
    id: 'local_' + Date.now(),
    circle_id: circleId,
    user_id: state.user.id,
    display_name: state.user.display_name || state.user.username,
    content, images: imageUrls,
    date: todayStr,
    created_at: new Date().toISOString(),
    likes_count: 0
  };
  const localCheckins = JSON.parse(localStorage.getItem('dlspace_checkins_' + circleId) || '[]');
  localCheckins.unshift(newCheckin);
  localStorage.setItem('dlspace_checkins_' + circleId, JSON.stringify(localCheckins));

  // 标记今日已打卡
  markCheckedIn(circleId, todayStr);

  // 在线模式同步
  if (state.isOnline) {
    try {
      // 先上传图片，再发打卡
      const uploadedUrls = [];
      if (fileInput && fileInput.files.length) {
        for (let i = 0; i < Math.min(fileInput.files.length, 3); i++) {
          const fd = new FormData(); fd.append('image', fileInput.files[i]);
          const ur = await fetch(API_BASE + '/upload/image', { method: 'POST', headers: { 'Authorization': 'Bearer ' + state.token }, body: fd });
          if (ur.ok) { const ud = await ur.json(); uploadedUrls.push(ud.url); }
        }
      }
      await apiFetch('POST', '/checkins/circle/' + circleId, { content, date: todayStr, images: uploadedUrls });
    } catch {}
  }

  showToast('打卡成功！🎉');
  closeTopModal();
  await renderCircleDetail(circleId);
}

function hasCheckedInToday(circleId, dateStr) {
  if (!state.user) return false;
  return !!localStorage.getItem(`dlspace_ci_${state.user.id}_${circleId}_${dateStr}`);
}

function markCheckedIn(circleId, dateStr) {
  if (!state.user) return;
  localStorage.setItem(`dlspace_ci_${state.user.id}_${circleId}_${dateStr}`, '1');
}

function getCircleStats(circleId) {
  if (!state.user) return { streak: 0, total: 0 };
  const checkins = JSON.parse(localStorage.getItem('dlspace_checkins_' + circleId) || '[]');
  const mine = checkins.filter(x => String(x.user_id) === String(state.user.id));
  const total = mine.length;
  const dates = [...new Set(mine.map(x => x.date))].sort().reverse();
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  for (let i = 0; i < dates.length; i++) {
    const ds = d.toISOString().split('T')[0];
    if (dates[i] === ds) { streak++; d.setDate(d.getDate() - 1); }
    else if (i === 0 && dates[0] !== getTodayStr()) break;
    else break;
  }
  return { streak, total };
}

function isLiked(checkinId) {
  if (!state.user) return false;
  return !!localStorage.getItem(`dlspace_like_${state.user.id}_${checkinId}`);
}

async function toggleLike(checkinId, btn) {
  if (!state.user) return;
  const liked = isLiked(checkinId);
  const countEl = btn.querySelector('.like-count');
  const n = parseInt(countEl?.textContent || '0');
  if (liked) {
    localStorage.removeItem(`dlspace_like_${state.user.id}_${checkinId}`);
    btn.classList.remove('liked');
    btn.innerHTML = `🤍 <span class="like-count">${Math.max(0, n-1)}</span>`;
    // 后端点赞是 toggle，再调一次即取消
    if (state.isOnline) { try { await apiFetch('POST', '/checkins/' + checkinId + '/like'); } catch {} }
  } else {
    localStorage.setItem(`dlspace_like_${state.user.id}_${checkinId}`, '1');
    btn.classList.add('liked');
    btn.innerHTML = `❤️ <span class="like-count">${n+1}</span>`;
    if (state.isOnline) { try { await apiFetch('POST', '/checkins/' + checkinId + '/like'); } catch {} }
  }
}

// ============================================================
// 年历热力图
// ============================================================
function renderYearHeatmap(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  // 收集所有圈子的打卡日期
  const dateMap = {};
  const myCircleIds = getMyCircleIds();
  myCircleIds.forEach(cid => {
    const checkins = JSON.parse(localStorage.getItem('dlspace_checkins_' + cid) || '[]');
    checkins.filter(x => String(x.user_id) === String(state.user.id)).forEach(c => {
      dateMap[c.date] = (dateMap[c.date] || 0) + 1;
    });
  });

  const today = new Date(); today.setHours(0,0,0,0);
  const yearStart = new Date(state.heatmapYear, 0, 1);
  const startDay = new Date(yearStart);
  startDay.setDate(startDay.getDate() - startDay.getDay()); // 从周日开始

  const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const monthLabelCols = {};
  let lastMonth = -1;

  let cellsHtml = '';
  for (let col = 0; col < 53; col++) {
    cellsHtml += `<div class="hm-col">`;
    for (let row = 0; row < 7; row++) {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + col * 7 + row);
      const ds = d.toISOString().split('T')[0];
      const inYear = d.getFullYear() === state.heatmapYear;
      const isFuture = d > today;
      const count = dateMap[ds] || 0;
      const isToday = ds === getTodayStr();

      if (inYear && d.getDate() === 1 && d.getMonth() !== lastMonth) {
        monthLabelCols[col] = MONTHS[d.getMonth()];
        lastMonth = d.getMonth();
      }

      let cls = 'hm-cell';
      if (!inYear || isFuture) cls += ' hm-empty';
      else if (count === 0) cls += ' hm-zero';
      else if (count === 1) cls += ' hm-l1';
      else if (count === 2) cls += ' hm-l2';
      else if (count === 3) cls += ' hm-l3';
      else cls += ' hm-l4';
      if (isToday) cls += ' hm-today';

      cellsHtml += `<div class="${cls}" title="${inYear ? ds + (count ? '：' + count + '次打卡' : '') : ''}"></div>`;
    }
    cellsHtml += `</div>`;
  }

  // 月份标签行
  let monthRow = '<div class="hm-month-row">';
  for (let col = 0; col < 53; col++) {
    monthRow += `<div class="hm-month-cell">${monthLabelCols[col] || ''}</div>`;
  }
  monthRow += '</div>';

  el.innerHTML = `
    <div class="heatmap-header">
      <span class="section-title-lg">打卡年历</span>
      <div class="year-nav-btns">
        <button class="year-nav-btn" onclick="changeHeatmapYear(-1)">‹</button>
        <span class="year-label">${state.heatmapYear}</span>
        <button class="year-nav-btn" onclick="changeHeatmapYear(1)">›</button>
      </div>
    </div>
    <div class="heatmap-scroll">
      ${monthRow}
      <div class="hm-grid">${cellsHtml}</div>
    </div>
    <div class="hm-legend-row">
      <span class="hm-legend-label">少</span>
      <div class="hm-legend-cell hm-zero"></div>
      <div class="hm-legend-cell hm-l1"></div>
      <div class="hm-legend-cell hm-l2"></div>
      <div class="hm-legend-cell hm-l3"></div>
      <div class="hm-legend-cell hm-l4"></div>
      <span class="hm-legend-label">多</span>
    </div>
  `;
}

function changeHeatmapYear(delta) {
  state.heatmapYear += delta;
  renderYearHeatmap('heatmapContainer');
}

// ============================================================
// 用户资料页
// ============================================================
async function renderProfile() {
  const el = document.getElementById('tab-profile');
  if (!el || !state.user) return;
  const dn = state.user.display_name || state.user.username;

  // 统计所有圈子的打卡数据
  const myCircleIds = getMyCircleIds();
  let totalCheckins = 0;
  const allDates = new Set();
  myCircleIds.forEach(cid => {
    const checkins = JSON.parse(localStorage.getItem('dlspace_checkins_' + cid) || '[]');
    checkins.filter(x => String(x.user_id) === String(state.user.id)).forEach(c => {
      totalCheckins++;
      allDates.add(c.date);
    });
  });

  // 计算连续打卡天数
  const sortedDates = [...allDates].sort().reverse();
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  for (let i = 0; i < sortedDates.length; i++) {
    const ds = d.toISOString().split('T')[0];
    if (sortedDates[i] === ds) { streak++; d.setDate(d.getDate() - 1); }
    else if (i === 0 && sortedDates[0] !== getTodayStr()) break;
    else break;
  }

  // 获取我的圈子列表
  const allCircles = JSON.parse(localStorage.getItem('dlspace_circles') || '[]');
  let onlineCircles = [];
  if (state.isOnline) {
    try {
      const d = await apiFetch('GET', '/circles');
      onlineCircles = d.circles || [];
      // 从后端获取用户统计
      const stats = await apiFetch('GET', '/checkins/my/stats').catch(() => null);
      if (stats) {
        streak = stats.streak || 0;
        totalCheckins = stats.total_days || 0;
      }
    } catch {}
  }
  const onlineMap = {};
  onlineCircles.forEach(c => { onlineMap[String(c.id)] = c; });
  const myCircles = myCircleIds.map(id => onlineMap[id] || allCircles.find(c => String(c.id) === id)).filter(Boolean);

  el.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar-lg">${dn.charAt(0).toUpperCase()}</div>
      <div class="profile-name">${escHtml(dn)}</div>
      <div class="profile-uname">@${escHtml(state.user.username)}</div>
      <div class="profile-mode-tag">${state.isOnline ? '🟢 在线模式' : '🔴 离线模式'}</div>
    </div>
    <div class="profile-stats-row">
      <div class="profile-stat"><div class="profile-stat-num">${streak}</div><div class="profile-stat-label">连续打卡天</div></div>
      <div class="profile-stat"><div class="profile-stat-num">${totalCheckins}</div><div class="profile-stat-label">累计打卡</div></div>
      <div class="profile-stat"><div class="profile-stat-num">${myCircles.length}</div><div class="profile-stat-label">加入圈子</div></div>
    </div>
    <div class="heatmap-section" id="heatmapContainer"></div>
    <div class="my-circles-section">
      <div class="section-title-lg">我的圈子</div>
      ${myCircles.length ? myCircles.map(c => `
        <div class="my-circle-row" onclick="enterCircle('${c.id}');switchTab('checkin')">
          <div class="my-circle-badge">${c.name.charAt(0).toUpperCase()}</div>
          <div class="my-circle-info">
            <div class="my-circle-name">${escHtml(c.name)}</div>
            <div class="my-circle-meta">${c.member_count || 1} 人 · ${c.description ? escHtml(c.description.slice(0,20)) + '...' : '暂无简介'}</div>
          </div>
          <span class="my-circle-arrow">›</span>
        </div>
      `).join('') : '<div class="empty-hint">还没有加入任何圈子</div>'}
    </div>
  `;
  renderYearHeatmap('heatmapContainer');
}

// ============================================================
// 备忘录
// ============================================================
async function loadMemos() {
  if (state.isOnline) {
    try {
      const d = await apiFetch('GET', '/memos');
      state.memos = d.memos || [];
      return;
    } catch {}
  }
  const key = 'dlspace_memos_' + state.user.id;
  state.memos = JSON.parse(localStorage.getItem(key) || '[]');
}

function renderMemos() {
  const el = document.getElementById('memoList');
  if (!el) return;
  if (!state.memos.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>还没有备忘录，点击右上角新建</p></div>';
    return;
  }
  el.innerHTML = state.memos.map(m => renderMemoCard(m)).join('');
}

function renderMemoCard(m, highlight = '') {
  let title = escHtml(m.title || '无标题');
  let body = escHtml(m.content || '');
  if (highlight) {
    const re = new RegExp('(' + escRegex(highlight) + ')', 'gi');
    title = title.replace(re, '<mark>$1</mark>');
    body = body.replace(re, '<mark>$1</mark>');
  }
  const tagMap = { work: '💼 工作', life: '🌿 生活', study: '📚 学习' };
  const dateStr = m.memo_date || (m.updated_at ? m.updated_at.split('T')[0] : '');
  return `
    <div class="memo-card ${m.is_important ? 'important' : ''}">
      <div class="memo-card-header">
        <div class="memo-card-title">${m.is_important ? '⭐ ' : ''}${title}</div>
        <div class="memo-card-actions">
          <button class="memo-action-btn" onclick="openMemoEditor('${m.id}');event.stopPropagation()">编辑</button>
          <button class="memo-action-btn delete" onclick="deleteMemo('${m.id}',event)">删除</button>
        </div>
      </div>
      ${m.content ? `<div class="memo-card-body">${body}</div>` : ''}
      <div class="memo-card-footer">
        <span class="memo-tag ${m.category || 'life'}">${tagMap[m.category] || '🌿 生活'}</span>
        ${dateStr ? `<span class="memo-date-tag">📅 ${dateStr}</span>` : ''}
      </div>
    </div>
  `;
}

let editingMemoId = null;
function openMemoEditor(id = null) {
  editingMemoId = id;
  const m = id ? state.memos.find(x => String(x.id) === String(id)) : null;
  document.getElementById('modalTitle').textContent = m ? '编辑备忘录' : '新建备忘录';
  document.getElementById('memoTitleInput').value = m ? (m.title || '') : '';
  document.getElementById('memoContent').value = m ? (m.content || '') : '';
  document.getElementById('memoCategory').value = m ? (m.category || 'life') : 'life';
  document.getElementById('memoDate').value = m ? (m.memo_date || '') : getTodayStr();
  document.getElementById('memoImportant').checked = m ? !!m.is_important : false;
  document.getElementById('memoModal').style.display = 'flex';
}

function closeMemoEditor() { document.getElementById('memoModal').style.display = 'none'; editingMemoId = null; }
function closeMemoModal(e) { if (e.target === document.getElementById('memoModal')) closeMemoEditor(); }

async function saveMemo() {
  const title = document.getElementById('memoTitleInput').value.trim() || '无标题';
  const content = document.getElementById('memoContent').value.trim();
  const category = document.getElementById('memoCategory').value;
  const memo_date = document.getElementById('memoDate').value;
  const is_important = document.getElementById('memoImportant').checked;
  if (!content) { showToast('请输入备忘录内容'); return; }
  const data = { title, content, category, memo_date, is_important };

  if (state.isOnline) {
    try {
      if (editingMemoId) {
        const d = await apiFetch('PUT', '/memos/' + editingMemoId, data);
        const idx = state.memos.findIndex(m => String(m.id) === String(editingMemoId));
        if (idx !== -1) state.memos[idx] = d.memo;
      } else {
        const d = await apiFetch('POST', '/memos', data);
        state.memos.unshift(d.memo);
      }
    } catch {}
  } else {
    const key = 'dlspace_memos_' + state.user.id;
    if (editingMemoId) {
      const idx = state.memos.findIndex(m => String(m.id) === String(editingMemoId));
      if (idx !== -1) state.memos[idx] = { ...state.memos[idx], ...data, updated_at: new Date().toISOString() };
    } else {
      const newMemo = { id: Date.now(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      state.memos.unshift(newMemo);
    }
    localStorage.setItem(key, JSON.stringify(state.memos));
  }
  closeMemoEditor();
  renderMemos();
  renderCalendar();
  showToast(editingMemoId ? '已更新 ✓' : '备忘录已保存 🌸');
}

async function deleteMemo(id, e) {
  e.stopPropagation();
  if (!confirm('确定删除这条备忘录？')) return;
  if (state.isOnline) { try { await apiFetch('DELETE', '/memos/' + id); } catch {} }
  state.memos = state.memos.filter(m => String(m.id) !== String(id));
  if (!state.isOnline) localStorage.setItem('dlspace_memos_' + state.user.id, JSON.stringify(state.memos));
  renderMemos();
  renderCalendar();
  showToast('已删除');
}

// ============================================================
// 搜索
// ============================================================
function doSearch(q) {
  const el = document.getElementById('searchResults');
  if (!q) { showSearchEmpty(); return; }
  let items = state.memos;
  if (state.currentFilter === 'important') items = items.filter(m => m.is_important);
  else if (state.currentFilter !== 'all') items = items.filter(m => m.category === state.currentFilter);
  const lq = q.toLowerCase();
  items = items.filter(m => (m.title||'').toLowerCase().includes(lq) || (m.content||'').toLowerCase().includes(lq));
  if (!items.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>未找到包含"${escHtml(q)}"的内容</p></div>`;
    return;
  }
  el.innerHTML = items.map(m => renderMemoCard(m, q)).join('');
}

function showSearchEmpty() {
  const el = document.getElementById('searchResults');
  if (el) el.innerHTML = '<div class="empty-state"><div class="empty-icon">🌸</div><p>输入关键词开始搜索</p></div>';
}

function clearSearch() { document.getElementById('searchInput').value = ''; showSearchEmpty(); }

function setFilter(f, btn) {
  state.currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const q = document.getElementById('searchInput').value;
  if (q) doSearch(q);
}

// ============================================================
// 日历
// ============================================================
function renderCalendar() {
  const titleEl = document.getElementById('calMonthTitle');
  const gridEl = document.getElementById('calendarGrid');
  if (!titleEl || !gridEl) return;
  const y = state.calYear, m = state.calMonth;
  titleEl.textContent = `${y}年 ${m+1}月`;
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m+1, 0).getDate();
  const todayStr = getTodayStr();
  const memoDateSet = new Set(state.memos.filter(x => x.memo_date && x.memo_date.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)).map(x => x.memo_date));
  let html = '';
  for (let i = 0; i < first; i++) html += '<div class="cal-grid-day empty"></div>';
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = ds === todayStr;
    const hasMemo = memoDateSet.has(ds);
    const isSelected = state.calSelectedDate === ds;
    html += `<div class="cal-grid-day ${isToday ? 'today' : ''} ${hasMemo ? 'has-memo' : ''} ${isSelected && !isToday ? 'selected' : ''}" onclick="selectCalDate('${ds}')">${d}${hasMemo ? '<span class="cal-dot"></span>' : ''}</div>`;
  }
  gridEl.innerHTML = html;
  if (state.calSelectedDate) showDayMemos(state.calSelectedDate);
  else showDayMemos(todayStr);
}

function changeMonth(delta) {
  state.calMonth += delta;
  if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
  if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
  renderCalendar();
}

function selectCalDate(ds) {
  state.calSelectedDate = ds;
  renderCalendar();
}

function showDayMemos(dateStr) {
  const el = document.getElementById('calendarDayMemos');
  if (!el) return;
  const memos = state.memos.filter(m => m.memo_date === dateStr);
  el.innerHTML = `<div class="day-memo-title">📅 ${dateStr} <button class="add-btn" style="margin-left:8px" onclick="openMemoEditorForDate('${dateStr}')">+ 新建</button></div>`;
  if (!memos.length) {
    el.innerHTML += `<div class="empty-hint">这天还没有备忘录</div>`;
    return;
  }
  el.innerHTML += memos.map(m => renderMemoCard(m)).join('');
}

function openMemoEditorForDate(dateStr) {
  openMemoEditor();
  setTimeout(() => { document.getElementById('memoDate').value = dateStr; }, 50);
}

// ============================================================
// 模态框通用
// ============================================================
function showModal(innerHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'dynamicModal';
  overlay.onclick = (e) => { if (e.target === overlay) closeTopModal(); };
  overlay.innerHTML = `<div class="modal-card">${innerHtml}</div>`;
  document.body.appendChild(overlay);
  overlay.style.display = 'flex';
}

function closeTopModal() {
  const el = document.getElementById('dynamicModal');
  if (el) el.remove();
}

// ============================================================
// 工具函数
// ============================================================
async function apiFetch(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API_BASE + path, opts);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || d.message || '请求失败');
  return d;
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(s) { return s ? String(s).split('T')[0] : ''; }

function formatDateTime(s) {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function readFileAsDataURL(file) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

function previewImg(src) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  div.onclick = () => div.remove();
  div.innerHTML = `<img src="${src}" style="max-width:95vw;max-height:90vh;border-radius:12px;object-fit:contain">`;
  document.body.appendChild(div);
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

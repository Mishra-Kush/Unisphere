/* UNISPHERE core: API client, login state, header/footer, toasts, helpers. No inline scripts (strict CSP). */
(function () {
  'use strict';
  const U = (window.U = {});
  U.user = null; U.csrf = null;

  /* ---- safe HTML: interpolated values are escaped unless wrapped in raw() ---- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  class Raw { constructor(s) { this.s = s; } }
  U.esc = esc; U.raw = (s) => new Raw(s);
  U.html = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (i < vals.length ? (vals[i] instanceof Raw ? vals[i].s : esc(vals[i])) : ''), '');
  const html = U.html, raw = U.raw;
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---- API ---- */
  U.api = async function (method, path, body) {
    const opt = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    if (method !== 'GET' && U.csrf) opt.headers['X-CSRF-Token'] = U.csrf;
    let res;
    try { res = await fetch(path, opt); } catch (e) { throw Object.assign(new Error('Cannot reach the server. Is it running?'), { status: 0 }); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok || !data || data.ok === false) {
      const err = new Error((data && data.error && data.error.message) || 'Request failed (' + res.status + ').');
      err.status = res.status; err.code = data && data.error && data.error.code; throw err;
    }
    return data;
  };
  U.qs = (o) => Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  U.param = (k) => new URLSearchParams(location.search).get(k);

  /* ---- toasts ---- */
  U.toast = function (msg, kind) {
    const box = U.$('#toasts'); if (!box) return;
    const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; t.setAttribute('role', kind === 'err' ? 'alert' : 'status');
    box.appendChild(t); setTimeout(() => t.remove(), 4500);
  };
  U.busy = async function (btn, fn) {
    btn.disabled = true; btn.classList.add('loading');
    try { return await fn(); } finally { btn.disabled = false; btn.classList.remove('loading'); }
  };
  U.skeleton = (n) => '<div aria-hidden="true">' + '<div class="skel"></div>'.repeat(n || 3) + '</div>';
  U.empty = (title, text, cta) => html`<div class="empty"><h3>${title}</h3><p class="muted">${text}</p>${raw(cta || '')}</div>`;

  /* ---- formatting ---- */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dparts = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };
  U.dateShort = (s) => { const p = dparts(s); return DAYS[p.dow] + ', ' + p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y; };
  U.time12 = (t) => { let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; };
  U.timeRange = (e) => U.time12(e.start_time) + ' - ' + U.time12(e.end_time);
  U.todayIST = () => { const d = new Date(Date.now() + 19800000); return d.toISOString().slice(0, 10); };
  U.CATS = [['technical', 'Technical', '⚙️'], ['coding-ai', 'Coding and AI', '💻'], ['cultural', 'Cultural', '🎭'], ['music-dance', 'Music and Dance', '🎵'], ['sports-fitness', 'Sports and Fitness', '🏅'], ['arts-photography', 'Arts and Photography', '🎨'], ['entrepreneurship-career', 'Entrepreneurship and Career', '🚀'], ['environment-social', 'Environment and Social Service', '🌱'], ['research-innovation', 'Research and Innovation', '🔬'], ['wellness-community', 'Wellness and Community', '🧘']];
  U.catName = (slug) => (U.CATS.find((c) => c[0] === slug) || [0, slug])[1];
  U.EVCATS = [['workshop', 'Workshop'], ['hackathon', 'Hackathon'], ['technical-fest', 'Technical fest'], ['cultural-fest', 'Cultural fest'], ['seminar', 'Seminar'], ['competition', 'Competition'], ['sports', 'Sports'], ['music-dance', 'Music and dance'], ['career', 'Career event'], ['environmental', 'Environmental'], ['community-service', 'Community service'], ['other', 'Other']];
  U.evCatName = (slug) => (U.EVCATS.find((c) => c[0] === slug) || [0, slug])[1];
  const STATE = { open: 'Registration open', full: 'Event full', closed: 'Registration closed', not_open: 'Opens soon', disabled: 'Registration off', cancelled: 'Cancelled', ended: 'Ended' };
  U.stateLabel = (s) => STATE[s] || s;
  U.clubImg = (c) => c.image_path || 'assets/images/event-default.svg';
  U.evImg = (e) => e.cover_image || 'assets/images/event-default.svg';
  const fallback = (e) => { if (e.target.tagName === 'IMG' && !e.target.dataset.fb) { e.target.dataset.fb = 1; e.target.src = 'assets/images/event-default.svg'; } };
  document.addEventListener('error', fallback, true);   // broken image -> local fallback

  /* ---- shared renderers ---- */
  U.eventRow = function (e) {
    const canReg = e.registration_status === 'open' && !e.is_registered;
    return html`<article class="ev"><time datetime="${e.event_date}">${U.dateShort(e.event_date).split(',')[0]},<br>${U.dateShort(e.event_date).split(', ')[1]}<span>${U.timeRange(e)}</span></time>
      <img src="${U.evImg(e)}" alt="" loading="lazy" width="96" height="96">
      <div><h3><a href="event-details.html?id=${e.id}">${e.title}</a></h3>
        <div class="meta"><span>📍 ${e.venue}</span><a class="handle" href="club-details.html?id=${e.club_id}">${e.club_name}</a><span>${U.evCatName(e.category)}</span></div>
        <div class="meta" style="margin-top:8px"><span class="badge ${e.registration_status}">${U.stateLabel(e.registration_status)}</span>${raw(e.is_registered ? '<span class="badge pink">You are registered</span>' : '')}${raw(e.capacity ? html`<span>${e.registered_count}/${e.capacity} seats taken</span>` : '')}</div></div>
      <div class="acts">${raw(canReg ? html`<button class="btn btn-pink btn-sm" data-register="${e.id}">Register Now</button>` : '')}<a class="btn btn-sm" href="event-details.html?id=${e.id}">View Details</a></div></article>`;
  };
  U.clubCard = (c) => html`<article class="card club"><img src="${U.clubImg(c)}" alt="" loading="lazy"><div class="body">
      <h3>${c.name}</h3><div><span class="badge ${c.recruitment_status === 'open' ? 'open' : ''}">Recruitment: ${c.recruitment_status}</span></div>
      <p>${c.description}</p>${raw(c.instagram_handle ? html`<a class="handle" href="${c.instagram_url}" target="_blank" rel="noopener noreferrer">${c.instagram_handle}</a>` : '')}
      <div class="acts"><a class="btn btn-pink btn-sm" href="club-details.html?id=${c.id}">View Club</a>${raw(c.instagram_url ? html`<a class="btn btn-sm" href="${c.instagram_url}" target="_blank" rel="noopener noreferrer">Open Instagram</a>` : '')}</div></div></article>`;
  U.notice = (n) => html`<article class="notice ${n.priority}"><h3>${n.title}${raw(n.priority !== 'normal' ? html`<span class="badge ${n.priority === 'urgent' ? 'full' : 'not_open'}">${n.priority}</span>` : '')}</h3>
      <p>${n.message}</p><div class="muted" style="font-size:.85rem">${n.published_at ? 'Published ' + n.published_at.slice(0, 10) : 'Draft'}${n.expires_at ? ' (expires ' + n.expires_at + ')' : ''}${n.club_name ? ' | ' + n.club_name : ''}${n.event_title ? ' | ' + n.event_title : ''}</div></article>`;

  /* one-click registration from any event row/button */
  U.register = async function (id, btn, after) {
    if (!U.user) { location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); return; }
    if (U.user.role !== 'student') { U.toast('Only student accounts can register for events.', 'err'); return; }
    try { await U.busy(btn, () => U.api('POST', '/api/events/' + id + '/register')); U.toast('Registered successfully!', 'ok'); } catch (e) { U.toast(e.message, 'err'); }
    if (after) after();
  };
  document.addEventListener('click', (ev) => { const b = ev.target.closest('[data-register]'); if (b && U.afterRegister) U.register(b.dataset.register, b, U.afterRegister); });

  /* ---- modal ---- */
  U.modal = function (title, bodyHtml) {
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = html`<div class="modal" role="dialog" aria-modal="true" aria-label="${title}"><button class="x" aria-label="Close">&times;</button><h2 style="font-size:1.4rem">${title}</h2>${raw(bodyHtml)}</div>`;
    const prev = document.activeElement;
    const close = () => { back.remove(); document.removeEventListener('keydown', key); if (prev && prev.focus) prev.focus(); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    U.$('.x', back).addEventListener('click', close);
    document.addEventListener('keydown', key); document.body.appendChild(back);
    const f = U.$('input,select,textarea,button:not(.x)', back); (f || U.$('.x', back)).focus();
    back.close = close; return back;
  };

  /* ---- header / footer ---- */
  const NAV = [['index.html', 'Home'], ['clubs.html', 'Clubs'], ['events.html', 'Events'], ['calendar.html', 'Calendar'], ['notices.html', 'Notice Board'], ['about.html', 'About']];
  function renderHeader() {
    const here = location.pathname.split('/').pop() || 'index.html';
    const links = NAV.map(([h, l]) => html`<a href="${h}" ${raw(h === here ? 'aria-current="page"' : '')}>${l}</a>`).join('');
    let acct;
    if (U.user) {
      const home = U.user.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html';
      acct = html`<div class="profile"><button class="link" id="profile-btn" aria-haspopup="true" aria-expanded="false">👤 ${U.user.full_name.split(' ')[0]} ▾</button>
        <div class="profile-pop" id="profile-pop"><div class="who">${U.user.full_name}<br>${U.user.email}<br>${U.user.role === 'admin' ? 'Administrator' : 'Student'}</div>
        <a href="${home}">${U.user.role === 'admin' ? 'Admin dashboard' : 'My dashboard'}</a><button class="link" id="logout-btn">Logout</button></div></div>`;
    } else acct = '<a class="login" href="login.html">Student Login</a><a class="login" href="admin-login.html">Administrator Login</a>';
    U.$('#site-header').className = 'site-header';
    U.$('#site-header').innerHTML = html`<div class="wrap bar"><a class="brand" href="index.html"><b>UNI<span>SPHERE</span></b><small>College Activity and Club Information System</small></a>
      <button class="menu-btn" id="menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="nav"><span></span></button>
      <nav class="nav" id="nav" aria-label="Main">${raw(links)}${raw(acct)}</nav></div>`;
    const mb = U.$('#menu-btn'), nav = U.$('#nav');
    mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
    const pb = U.$('#profile-btn');
    if (pb) {
      pb.addEventListener('click', () => { const o = U.$('#profile-pop').classList.toggle('open'); pb.setAttribute('aria-expanded', o); });
      U.$('#logout-btn').addEventListener('click', async () => { try { await U.api('POST', '/api/auth/logout'); } catch (e) { /* ignore */ } location.href = 'index.html'; });
    }
  }
  function renderFooter() {
    U.$('#site-footer').className = 'site-footer';
    U.$('#site-footer').innerHTML = `<div class="wrap fcols"><div><div class="brand"><b>UNI<span>SPHERE</span></b><small>College Activity and Club Information System</small></div>
      <p class="muted" style="margin-top:12px">Clubs, events, calendar and notices for MITS-DU, Gwalior in one place.</p></div>
      <div><h4>Explore</h4><a href="clubs.html">All clubs</a><a href="events.html">Events</a><a href="calendar.html">Calendar</a><a href="notices.html">Notice board</a></div>
      <div><h4>Shortcuts</h4><a href="clubs.html?category=technical">Technical clubs</a><a href="clubs.html?category=music-dance">Music and dance</a><a href="events.html?upcoming=1">Upcoming events</a><a href="about.html">About UniSphere</a></div>
      <div><h4>Accounts</h4><a href="login.html">Student login</a><a href="student-register.html">Student registration</a><a href="admin-login.html">Administrator login</a>
      <p class="muted" style="font-size:.85rem;margin-top:10px">Each club links to its own Instagram page from its club card.</p></div></div>
      <div class="credit">Developed by: Kush Mishra (BTCS26O1070), MITS_DU, Gwalior</div>`;
  }

  U.init = async function () {
    try { const r = await U.api('GET', '/api/auth/me'); U.user = r.user; U.csrf = r.csrf_token; } catch (e) { U.user = null; }
    renderHeader(); renderFooter();
    document.addEventListener('click', (e) => { const p = U.$('#profile-pop'); if (p && !e.target.closest('.profile')) p.classList.remove('open'); });
    const page = document.body.dataset.page;
    if (U.pages && U.pages[page]) { try { await U.pages[page](); } catch (e) { console.error(e); U.toast(e.message || 'Something went wrong.', 'err'); } }
  };
  U.pages = {};
  document.addEventListener('DOMContentLoaded', () => setTimeout(U.init, 0));
})();

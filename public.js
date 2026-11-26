/* Public pages: home, clubs, club details, events, event details, calendar, notices. */
(function () {
  'use strict';
  const U = window.U, html = U.html, raw = U.raw, $ = U.$;
  const pad = (n) => String(n).padStart(2, '0');
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const catOptions = (sel) => '<option value="">All categories</option>' + U.CATS.map(([v, l]) => html`<option value="${v}" ${raw(v === sel ? 'selected' : '')}>${l}</option>`).join('');

  /* ---------- calendar widget ---------- */
  U.calendar = function (box, listBox, opts) {
    opts = opts || {};
    const now = new Date(Date.now() + 19800000);
    let y = now.getUTCFullYear(), m = now.getUTCMonth() + 1, byDate = {}, sel = null;
    const today = U.todayIST();
    const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    async function load() {
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      box.setAttribute('aria-busy', 'true');
      try {
        const r = await U.api('GET', '/api/events?' + U.qs({ from: y + '-' + pad(m) + '-01', to: y + '-' + pad(m) + '-' + pad(last), limit: 100 }));
        byDate = {}; r.events.forEach((e) => (byDate[e.event_date] = byDate[e.event_date] || []).push(e));
      } catch (e) { U.toast(e.message, 'err'); }
      box.removeAttribute('aria-busy'); draw(); list();
    }
    function draw() {
      const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      let cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="dow" aria-hidden="true">${d}</div>`).join('');
      cells += '<span class="day blank"></span>'.repeat(first);
      for (let d = 1; d <= days; d++) {
        const key = y + '-' + pad(m) + '-' + pad(d), n = (byDate[key] || []).length;
        cells += html`<button class="day ${n ? 'has' : ''} ${key === today ? 'today' : ''}" data-date="${key}" ${raw(n ? 'data-n="' + n + '"' : '')} aria-pressed="${key === sel}" aria-label="${d} ${MN[m - 1]} ${y}, ${n ? n + (n > 1 ? ' events' : ' event') : 'no events'}">${d}</button>`;
      }
      box.innerHTML = html`<div class="calhead"><button class="btn btn-sm" id="cal-prev" aria-label="Previous month">&larr;</button><h3 aria-live="polite">${MN[m - 1]} ${y}</h3><button class="btn btn-sm" id="cal-next" aria-label="Next month">&rarr;</button></div><div class="calgrid">${raw(cells)}</div>`;
      $('#cal-prev', box).onclick = () => { m--; if (m < 1) { m = 12; y--; } sel = null; load(); };
      $('#cal-next', box).onclick = () => { m++; if (m > 12) { m = 1; y++; } sel = null; load(); };
      U.$$('.day[data-date]', box).forEach((b) => (b.onclick = () => { sel = b.dataset.date; draw(); list(); }));
    }
    function list() {
      const evs = sel ? byDate[sel] || [] : Object.values(byDate).flat().sort((a, b) => (a.event_date + a.start_time).localeCompare(b.event_date + b.start_time));
      const title = sel ? 'Events on ' + U.dateShort(sel) : 'Events in ' + MN[m - 1] + ' ' + y;
      listBox.innerHTML = html`<h3>${title}</h3>` + (evs.length ? '<div class="events daylist">' + evs.map(U.eventRow).join('') + '</div>' : U.empty('Nothing scheduled', sel ? 'No events on this date.' : 'No published events this month yet.'));
    }
    load(); return { reload: load };
  };

  /* ---------- HOME ---------- */
  U.pages.home = async function () {
    const st = { category: '', club: '', from: '', sort: 'upcoming' };
    U.afterRegister = loadEvents;
    $('#cat-grid').innerHTML = U.CATS.map(([v, l, i]) => html`<button class="cat" data-cat="${v}" aria-pressed="false"><span class="ico" aria-hidden="true">${i}</span><b>${l}</b><small>Show clubs and events</small></button>`).join('');
    $('#search-cat').innerHTML = catOptions('');

    /* featured event */
    try {
      const r = await U.api('GET', '/api/events?upcoming=1&limit=1');
      const e = r.events[0];
      $('#featured').innerHTML = e ? html`<div class="featured"><img src="${U.evImg(e)}" alt=""><div><span class="badge pink">Featured event</span><h3 style="margin-top:10px">${e.title}</h3><p class="muted">${U.dateShort(e.event_date)} at ${U.time12(e.start_time)}<br>${e.venue} | ${e.club_name}</p><a class="btn btn-pink btn-sm" href="event-details.html?id=${e.id}">View Details</a></div></div>`
        : '<div class="featured" style="grid-template-columns:1fr"><div><h3>No events published yet</h3><p class="muted" style="margin:0">Club events will appear here as soon as the administrators publish them.</p></div></div>';
    } catch (e) { $('#featured').innerHTML = ''; }

    /* clubs for the filter dropdown */
    const all = await U.api('GET', '/api/clubs?limit=200');
    $('#f-club').innerHTML = '<option value="">All clubs</option>' + all.clubs.map((c) => html`<option value="${c.id}">${c.name}</option>`).join('');
    $('#f-cat').innerHTML = catOptions('');

    async function loadEvents() {
      $('#home-events').innerHTML = U.skeleton(3);
      const r = await U.api('GET', '/api/events?' + U.qs({ upcoming: 1, category: st.category, club: st.club, from: st.from, sort: st.sort, limit: 6 }));
      $('#home-events').innerHTML = r.events.length ? '<div class="events">' + r.events.map(U.eventRow).join('') + '</div>'
        : U.empty('No upcoming events', st.category || st.club || st.from ? 'No published events match these filters.' : 'No events have been published yet. Check back soon, or browse the clubs in the meantime.', '<a class="btn btn-pink btn-sm" href="clubs.html">Discover Clubs</a>');
    }
    async function loadClubs() {
      $('#home-clubs').innerHTML = U.skeleton(2);
      const r = await U.api('GET', '/api/clubs?' + U.qs({ category: st.category, limit: 6 }));
      $('#home-clubs').innerHTML = r.clubs.length ? r.clubs.map(U.clubCard).join('') : U.empty('No clubs in this category', 'Try another category.');
      $('#all-clubs-link').href = 'clubs.html' + (st.category ? '?category=' + st.category : '');
    }
    function setCategory(v) {
      st.category = v; $('#f-cat').value = v; $('#search-cat').value = v;
      U.$$('.cat').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === v));
      $('#cat-status').innerHTML = v ? html`Showing <b>${U.catName(v)}</b> <button class="btn btn-sm" id="cat-clear">Clear filter</button>` : '';
      const cc = $('#cat-clear'); if (cc) cc.onclick = () => setCategory('');
      loadEvents(); loadClubs();
    }
    $('#cat-grid').addEventListener('click', (e) => { const b = e.target.closest('.cat'); if (b) { setCategory(st.category === b.dataset.cat ? '' : b.dataset.cat); $('#events-sec').scrollIntoView({ behavior: 'smooth' }); } });
    $('#f-cat').onchange = (e) => setCategory(e.target.value);
    $('#f-club').onchange = (e) => { st.club = e.target.value; loadEvents(); };
    $('#f-from').onchange = (e) => { st.from = e.target.value; loadEvents(); };
    $('#f-sort').onchange = (e) => { st.sort = e.target.value; loadEvents(); };

    /* global search with suggestions */
    const input = $('#q'), box = $('#suggest'), res = $('#results');
    const run = async () => U.api('GET', '/api/search?' + U.qs({ q: input.value.trim(), category: $('#search-cat').value, limit: 8 }));
    const suggest = debounce(async () => {
      if (input.value.trim().length < 2 && !$('#search-cat').value) { box.hidden = true; return; }
      try {
        const r = await run();
        const items = r.clubs.map((c) => html`<a href="club-details.html?id=${c.id}"><img src="${U.clubImg(c)}" alt=""><span>${c.name}<small>Club ${c.instagram_handle ? '| ' + c.instagram_handle : ''}</small></span></a>`)
          .concat(r.events.map((e) => html`<a href="event-details.html?id=${e.id}"><img src="${U.evImg(e)}" alt=""><span>${e.title}<small>Event | ${U.dateShort(e.event_date)} | ${e.club_name}</small></span></a>`));
        box.innerHTML = items.length ? items.join('') : '<div style="padding:14px" class="muted">No matching clubs or events.</div>'; box.hidden = false;
      } catch (e) { box.hidden = true; }
    }, 220);
    input.addEventListener('input', suggest);
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') box.hidden = true; });
    document.addEventListener('click', (e) => { if (!e.target.closest('.searchbox')) box.hidden = true; });
    async function fullSearch() {
      box.hidden = true;
      if (!input.value.trim() && !$('#search-cat').value) { res.hidden = true; return; }
      res.hidden = false; res.innerHTML = '<div class="wrap" style="padding:40px 20px">' + U.skeleton(2) + '</div>';
      const r = await run();
      res.innerHTML = html`<div class="wrap" style="padding:40px 20px"><div class="head"><h2>Search results</h2><button class="btn btn-sm" id="clear-search">Clear search</button></div>
        <h3>Clubs (${r.club_count})</h3><div class="grid">${raw(r.clubs.length ? r.clubs.map(U.clubCard).join('') : '<p class="muted">No clubs found.</p>')}</div>
        <h3 style="margin-top:28px">Events (${r.event_count})</h3>${raw(r.events.length ? '<div class="events">' + r.events.map(U.eventRow).join('') + '</div>' : '<p class="muted">No events found.</p>')}</div>`;
      $('#clear-search').onclick = () => { input.value = ''; $('#search-cat').value = ''; res.hidden = true; input.focus(); };
      res.scrollIntoView({ behavior: 'smooth' });
    }
    $('#search-form').addEventListener('submit', (e) => { e.preventDefault(); fullSearch(); });
    $('#search-cat').addEventListener('change', () => fullSearch());

    loadEvents(); loadClubs();
    U.api('GET', '/api/announcements?limit=4').then((r) => { $('#home-notices').innerHTML = r.announcements.length ? r.announcements.map(U.notice).join('') : U.empty('No notices right now', 'Official announcements from the administrators will appear here.'); });
    U.calendar($('#cal'), $('#cal-list'));
  };

  /* ---------- CLUBS ---------- */
  U.pages.clubs = async function () {
    const st = { q: '', category: U.param('category') || '', recruitment: '' };
    $('#c-cat').innerHTML = catOptions(st.category);
    const load = async () => {
      $('#club-grid').innerHTML = U.skeleton(3);
      const r = await U.api('GET', '/api/clubs?' + U.qs(Object.assign({ limit: 200 }, st)));
      $('#club-count').textContent = r.count + (r.count === 1 ? ' club' : ' clubs');
      $('#club-grid').innerHTML = r.clubs.length ? r.clubs.map(U.clubCard).join('') : U.empty('No clubs found', 'Try a different search or category.');
    };
    $('#c-q').addEventListener('input', debounce((e) => { st.q = e.target.value.trim(); load(); }, 250));
    $('#c-cat').onchange = (e) => { st.category = e.target.value; load(); };
    $('#c-rec').onchange = (e) => { st.recruitment = e.target.value; load(); };
    $('#c-clear').onclick = () => { st.q = st.category = st.recruitment = ''; $('#c-q').value = ''; $('#c-cat').value = ''; $('#c-rec').value = ''; load(); };
    load();
  };

  U.pages.club = async function () {
    const id = U.param('id'); U.afterRegister = () => U.pages.club();
    try {
      const r = await U.api('GET', '/api/clubs/' + encodeURIComponent(id)); const c = r.club;
      document.title = c.name + ' | UNISPHERE';
      $('#club-detail').innerHTML = html`<div class="detail"><img class="cover" src="${U.clubImg(c)}" alt=""><div><h1 style="font-size:2rem">${c.name}</h1>
        <p><span class="badge">${U.catName(c.category)}</span> <span class="badge ${c.recruitment_status === 'open' ? 'open' : ''}">Recruitment: ${c.recruitment_status}</span></p><p>${c.description}</p>
        <dl class="kv"><dt>Faculty advisor</dt><dd>${c.faculty_advisor}</dd><dt>Student leads</dt><dd>${c.student_leads}</dd><dt>Instagram</dt><dd>${raw(c.instagram_handle ? html`<a class="handle" href="${c.instagram_url}" target="_blank" rel="noopener noreferrer">${c.instagram_handle}</a>` : 'Not yet provided')}</dd></dl>
        ${raw(c.instagram_url ? html`<a class="btn btn-pink" href="${c.instagram_url}" target="_blank" rel="noopener noreferrer">Open Instagram</a>` : '')}</div></div>`;
      const ev = await U.api('GET', '/api/clubs/' + c.id + '/events?upcoming=1');
      $('#club-events').innerHTML = ev.events.length ? '<div class="events">' + ev.events.map(U.eventRow).join('') + '</div>' : U.empty('No upcoming events', 'This club has no published events right now.');
    } catch (e) { $('#club-detail').innerHTML = U.empty('Club not found', e.message, '<a class="btn btn-pink btn-sm" href="clubs.html">Back to clubs</a>'); $('#club-events').innerHTML = ''; }
  };

  /* ---------- EVENTS ---------- */
  U.pages.events = async function () {
    const st = { q: '', category: '', club: '', from: '', upcoming: U.param('upcoming') === '0' ? '' : 1, sort: 'upcoming', offset: 0 }, PER = 10;
    let view = 'list';
    U.afterRegister = () => load(true);
    const clubs = await U.api('GET', '/api/clubs?limit=200');
    $('#e-club').innerHTML = '<option value="">All clubs</option>' + clubs.clubs.map((c) => html`<option value="${c.id}">${c.name}</option>`).join('');
    $('#e-cat').innerHTML = catOptions('');
    $('#e-up').checked = !!st.upcoming;
    async function load(reset) {
      if (reset) st.offset = 0;
      const first = st.offset === 0;
      if (first) $('#ev-list').innerHTML = U.skeleton(3);
      const r = await U.api('GET', '/api/events?' + U.qs({ q: st.q, category: st.category, club: st.club, from: st.from, upcoming: st.upcoming, sort: st.sort, limit: PER, offset: st.offset }));
      const rows = r.events.map(U.eventRow).join('');
      $('#ev-list').className = 'events' + (view === 'cards' ? ' cards' : '');
      if (first) $('#ev-list').innerHTML = rows || U.empty('No events found', 'No published events match your filters yet.', '<a class="btn btn-pink btn-sm" href="clubs.html">Discover Clubs</a>');
      else $('#ev-list').insertAdjacentHTML('beforeend', rows);
      $('#more').hidden = r.count < PER;
    }
    $('#e-q').addEventListener('input', debounce((e) => { st.q = e.target.value.trim(); load(true); }, 250));
    $('#e-cat').onchange = (e) => { st.category = e.target.value; load(true); };
    $('#e-club').onchange = (e) => { st.club = e.target.value; load(true); };
    $('#e-from').onchange = (e) => { st.from = e.target.value; load(true); };
    $('#e-sort').onchange = (e) => { st.sort = e.target.value; load(true); };
    $('#e-up').onchange = (e) => { st.upcoming = e.target.checked ? 1 : ''; load(true); };
    $('#more').onclick = () => { st.offset += PER; load(false); };
    U.$$('[data-view]').forEach((b) => (b.onclick = () => { view = b.dataset.view; U.$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', x === b)); load(true); }));
    load(true);
  };

  U.pages.event = async function () {
    const id = U.param('id'), box = $('#event-detail');
    async function draw() {
      try {
        const e = (await U.api('GET', '/api/events/' + encodeURIComponent(id))).event;
        document.title = e.title + ' | UNISPHERE';
        const canReg = e.registration_status === 'open' && !e.is_registered;
        let action;
        if (e.is_registered) action = e.registration_status === 'ended' ? '<span class="badge pink">You attended / registered</span>' : '<button class="btn" id="cancel-reg">Cancel my registration</button>';
        else if (canReg) action = U.user && U.user.role !== 'student' ? '<span class="muted">Administrators cannot register for events.</span>' : '<button class="btn btn-pink" id="reg-btn">Register Now</button>';
        else action = html`<button class="btn" disabled>${U.stateLabel(e.registration_status)}</button>`;
        box.innerHTML = html`<div class="detail"><div><img class="cover" src="${U.evImg(e)}" alt=""><h2 style="margin-top:24px;font-size:1.3rem">About this event</h2><p style="white-space:pre-line">${e.description}</p></div>
          <aside class="card" style="padding:24px"><span class="badge ${e.registration_status}">${U.stateLabel(e.registration_status)}</span>${raw(e.is_registered ? ' <span class="badge pink">You are registered</span>' : '')}
          <h1 style="font-size:1.8rem;margin:12px 0">${e.title}</h1>
          <dl class="kv"><dt>Date</dt><dd>${U.dateShort(e.event_date)}</dd><dt>Time</dt><dd>${U.timeRange(e)}</dd><dt>Venue</dt><dd>${e.venue}</dd>
          <dt>Organised by</dt><dd><a class="handle" href="club-details.html?id=${e.club_id}">${e.club_name}</a></dd><dt>Category</dt><dd>${U.evCatName(e.category)}</dd>
          <dt>Registration</dt><dd>${e.reg_opens || e.reg_closes ? (e.reg_opens ? 'from ' + e.reg_opens : '') + (e.reg_closes ? ' until ' + e.reg_closes : '') : 'No date limits'}</dd>
          <dt>Seats</dt><dd>${e.capacity ? e.registered_count + ' of ' + e.capacity + ' taken' : e.registered_count + ' registered (no limit)'}</dd></dl>
          ${raw(action)}${raw(!U.user && canReg ? '<p class="muted" style="margin-top:12px">You will be asked to log in with your college email.</p>' : '')}</aside></div>`;
        const rb = $('#reg-btn'); if (rb) rb.onclick = () => U.register(id, rb, draw);
        const cb = $('#cancel-reg');
        if (cb) cb.onclick = async () => { try { await U.busy(cb, () => U.api('DELETE', '/api/events/' + id + '/register')); U.toast('Registration cancelled.', 'ok'); } catch (err) { U.toast(err.message, 'err'); } draw(); };
      } catch (err) { box.innerHTML = U.empty('Event not found', err.message, '<a class="btn btn-pink btn-sm" href="events.html">Browse events</a>'); }
    }
    draw();
  };

  U.pages.about = function () {};

  U.pages.calendar = function () { U.afterRegister = () => U.pages.calendar(); U.calendar($('#cal'), $('#cal-list')); };

  U.pages.notices = async function () {
    const st = { priority: '' };
    const load = async () => {
      $('#notice-list').innerHTML = U.skeleton(3);
      const r = await U.api('GET', '/api/announcements?' + U.qs(Object.assign({ limit: 100 }, st)));
      $('#notice-list').innerHTML = r.announcements.length ? r.announcements.map(U.notice).join('') : U.empty('No notices', 'There are no active announcements right now.');
    };
    $('#n-prio').onchange = (e) => { st.priority = e.target.value; load(); };
    load();
  };
})();

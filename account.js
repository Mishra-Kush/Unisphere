/* Login, registration and the student dashboard. */
(function () {
  'use strict';
  const U = window.U, html = U.html, raw = U.raw, $ = U.$;
  const DOMAIN = '@mitsgwl.ac.in';
  const safeNext = (n) => (n && /^[a-z0-9-]+\.html(\?[a-zA-Z0-9=&%_.-]*)?$/i.test(n) ? n : null);
  const showErr = (msg) => { const a = $('#form-alert'); a.hidden = false; a.className = 'alert err'; a.textContent = msg; a.focus(); };
  const fieldErr = (id, msg) => { const e = $('#' + id + '-err'); if (e) e.textContent = msg || ''; };

  function redirectIfLoggedIn() {
    if (U.user) { location.replace(U.user.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html'); return true; }
    return false;
  }

  U.pages.login = function () {
    if (redirectIfLoggedIn()) return;
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#email').value.trim().toLowerCase(), password = $('#password').value;
      fieldErr('email', ''); $('#form-alert').hidden = true;
      if (!email.endsWith(DOMAIN)) { fieldErr('email', 'Use your college email ending in ' + DOMAIN); return; }
      try {
        await U.busy($('#submit'), () => U.api('POST', '/api/auth/student/login', { email, password }));
        location.href = safeNext(U.param('next')) || 'student-dashboard.html';
      } catch (err) { showErr(err.message); }
    });
  };

  U.pages.register = function () {
    if (redirectIfLoggedIn()) return;
    $('#reg-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      ['name', 'email', 'password', 'confirm'].forEach((k) => fieldErr(k, ''));
      $('#form-alert').hidden = true;
      const body = { full_name: $('#name').value.trim(), email: $('#email').value.trim().toLowerCase(), enrollment_no: $('#enroll').value.trim(), password: $('#password').value, confirm_password: $('#confirm').value };
      let bad = false;
      if (body.full_name.length < 2) { fieldErr('name', 'Enter your full name.'); bad = true; }
      if (!body.email.endsWith(DOMAIN)) { fieldErr('email', 'Only ' + DOMAIN + ' emails are allowed.'); bad = true; }
      if (body.password.length < 8 || !/[A-Za-z]/.test(body.password) || !/\d/.test(body.password)) { fieldErr('password', 'At least 8 characters with a letter and a number.'); bad = true; }
      if (body.password !== body.confirm_password) { fieldErr('confirm', 'Passwords do not match.'); bad = true; }
      if (bad) return;
      try {
        await U.busy($('#submit'), () => U.api('POST', '/api/auth/student/register', body));
        location.href = 'student-dashboard.html';
      } catch (err) { showErr(err.message); }
    });
  };

  U.pages.adminLogin = function () {
    if (redirectIfLoggedIn()) return;
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault(); $('#form-alert').hidden = true;
      try {
        await U.busy($('#submit'), () => U.api('POST', '/api/auth/admin/login', { email: $('#email').value.trim(), password: $('#password').value }));
        location.href = 'admin-dashboard.html';
      } catch (err) { showErr(err.message); }
    });
  };

  U.pages.student = async function () {
    if (!U.user || U.user.role !== 'student') { location.replace('login.html?next=student-dashboard.html'); return; }
    const u = U.user;
    $('#welcome').textContent = 'Welcome, ' + u.full_name.split(' ')[0] + '!';
    $('#profile').innerHTML = html`<dl class="kv"><dt>Name</dt><dd>${u.full_name}</dd><dt>College email</dt><dd>${u.email}</dd><dt>Enrollment no.</dt><dd>${u.enrollment_no || 'Not provided'}</dd></dl>
      <p class="muted" style="font-size:.88rem">Your email domain is checked, but ownership of the address is not verified yet. Profile editing is not available in this version.</p>`;
    async function load() {
      const [mine, upc, clubs, notes] = await Promise.all([U.api('GET', '/api/student/registrations'), U.api('GET', '/api/events?upcoming=1&limit=5'), U.api('GET', '/api/clubs?limit=200'), U.api('GET', '/api/announcements?limit=3')]);
      const active = mine.events.filter((e) => e.event_date >= U.todayIST());
      $('#st-count').textContent = active.length;
      $('#my-events').innerHTML = mine.events.length ? '<div class="events">' + mine.events.map((e) => html`<article class="ev"><time>${U.dateShort(e.event_date).split(',')[0]},<br>${U.dateShort(e.event_date).split(', ')[1]}<span>${U.timeRange(e)}</span></time><img src="${U.evImg(e)}" alt="" width="96" height="96">
          <div><h3><a href="event-details.html?id=${e.id}">${e.title}</a></h3><div class="meta"><span>📍 ${e.venue}</span><span>${e.club_name}</span><span class="badge ${e.registration_status}">${U.stateLabel(e.registration_status)}</span></div></div>
          <div class="acts">${raw(e.event_date >= U.todayIST() && e.registration_status !== 'ended' ? html`<button class="btn btn-sm" data-cancel="${e.id}">Cancel registration</button>` : '')}<a class="btn btn-sm" href="event-details.html?id=${e.id}">View Details</a></div></article>`).join('') + '</div>'
        : U.empty('No registrations yet', 'Register for an event and it will show up here.', '<a class="btn btn-pink btn-sm" href="events.html">Explore Events</a>');
      $('#up-events').innerHTML = upc.events.length ? '<div class="events">' + upc.events.map(U.eventRow).join('') + '</div>' : U.empty('No upcoming events', 'Nothing has been published yet.');
      const joined = new Set(mine.events.map((e) => e.club_id)), cats = new Set(clubs.clubs.filter((c) => joined.has(c.id)).map((c) => c.category));
      let rec = clubs.clubs.filter((c) => cats.has(c.category) && !joined.has(c.id));
      if (rec.length < 4) rec = rec.concat(clubs.clubs.filter((c) => c.recruitment_status === 'open' && !rec.includes(c)));
      if (rec.length < 4) rec = rec.concat(clubs.clubs.filter((c) => !rec.includes(c)));
      $('#rec-clubs').innerHTML = rec.slice(0, 4).map(U.clubCard).join('');
      $('#rec-note').textContent = cats.size ? 'Based on the clubs behind your registered events.' : 'Clubs to get you started.';
      $('#notes').innerHTML = notes.announcements.length ? notes.announcements.map(U.notice).join('') : U.empty('No notices', 'Nothing new right now.');
    }
    U.afterRegister = load;
    document.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-cancel]'); if (!b) return;
      if (!confirm('Cancel this registration?')) return;
      try { await U.busy(b, () => U.api('DELETE', '/api/events/' + b.dataset.cancel + '/register')); U.toast('Registration cancelled.', 'ok'); load(); } catch (err) { U.toast(err.message, 'err'); }
    });
    load();
  };
})();

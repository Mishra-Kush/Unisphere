/* Administrator dashboard: overview, events, clubs, notices. */
(function () {
  'use strict';
  const U = window.U, html = U.html, raw = U.raw, $ = U.$;

  /* ---- tiny form builder ---- */
  const input = (f, v) => {
    const val = v == null ? '' : v, id = 'f-' + f.name, req = f.required ? 'required' : '';
    let ctl;
    if (f.type === 'textarea') ctl = html`<textarea id="${id}" name="${f.name}" rows="4" ${raw(req)}>${val}</textarea>`;
    else if (f.type === 'select') ctl = html`<select id="${id}" name="${f.name}" ${raw(req)}>${raw(f.options.map(([k, l]) => html`<option value="${k}" ${raw(String(k) === String(val) ? 'selected' : '')}>${l}</option>`).join(''))}</select>`;
    else if (f.type === 'checkbox') return html`<div class="field ${f.full ? 'full' : ''}"><label><input type="checkbox" id="${id}" name="${f.name}" ${raw(v ? 'checked' : '')}> ${f.label}</label>${raw(f.hint ? html`<small>${f.hint}</small>` : '')}</div>`;
    else ctl = html`<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${val}" ${raw(req)} ${raw(f.list ? 'list="' + f.list + '"' : '')} ${raw(f.type === 'number' ? 'min="1"' : '')}>`;
    return html`<div class="field ${f.full ? 'full' : ''}"><label for="${id}">${f.label}${raw(f.required ? ' *' : '')}</label>${raw(ctl)}${raw(f.hint ? html`<small>${f.hint}</small>` : '')}</div>`;
  };
  const formHtml = (fields, vals) => '<form id="admin-form" novalidate><div id="form-err" class="alert err" role="alert" hidden></div><div class="form-grid">' + fields.map((f) => input(f, vals[f.name])).join('') + '</div><button class="btn btn-pink" type="submit">Save</button></form>';
  const readForm = (form, fields) => { const o = {}; fields.forEach((f) => { const el = form.elements[f.name]; o[f.name] = f.type === 'checkbox' ? el.checked : el.value.trim(); }); return o; };
  function openForm(title, fields, vals, save) {
    const m = U.modal(title, formHtml(fields, vals));
    $('#admin-form', m).addEventListener('submit', async (e) => {
      e.preventDefault(); const b = $('button[type=submit]', m), er = $('#form-err', m); er.hidden = true;
      try { await U.busy(b, () => save(readForm(e.target, fields))); m.close(); } catch (err) { er.hidden = false; er.textContent = err.message; }
    });
  }
  const yesno = (v) => (v ? 'Yes' : 'No');

  U.pages.admin = async function () {
    if (!U.user || U.user.role !== 'admin') { location.replace('admin-login.html'); return; }
    const IMGS = '<datalist id="img-list"><option value="assets/images/event-default.svg"></option></datalist>';
    document.body.insertAdjacentHTML('beforeend', IMGS);
    let clubs = [];
    const clubOpts = (blank) => (blank ? [['', 'None']] : []).concat(clubs.filter((c) => !c.is_archived).map((c) => [c.id, c.name]));
    const loadClubs = async () => { clubs = (await U.api('GET', '/api/admin/clubs?all=1&limit=200')).clubs; };
    await loadClubs();
    const panes = { overview, events, clubsTab, notices };
    const tabs = U.$$('[role=tab]');
    tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
    async function show(name) {
      tabs.forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === name));
      $('#pane').innerHTML = U.skeleton(3);
      try { await panes[name](); } catch (e) { $('#pane').innerHTML = U.empty('Could not load', e.message); }
    }
    const pane = (h) => ($('#pane').innerHTML = h);

    async function overview() {
      const r = await U.api('GET', '/api/admin/dashboard'), s = r.stats;
      pane(html`<div class="stats">${raw([['Total clubs', s.clubs], ['Published events', s.published_events], ['Upcoming events', s.upcoming_events], ['Registrations', s.registrations], ['Students', s.students], ['Active notices', s.active_announcements]].map(([l, n]) => html`<div class="stat"><b>${n}</b><span class="muted">${l}</span></div>`).join(''))}</div>
        <div class="two"><div><h3>Recent announcements</h3>${raw(r.recent_announcements.length ? r.recent_announcements.map((a) => html`<div class="notice ${a.priority}"><b>${a.title}</b><div class="muted" style="font-size:.85rem">${a.priority} | ${a.is_published ? 'published' : 'draft'} | ${a.created_at.slice(0, 10)}</div></div>`).join('') : U.empty('No announcements yet', 'Create one in the Notices tab.'))}</div>
        <div><h3>Recent administrative activity</h3>${raw(r.recent_activity.length ? '<div class="tablewrap"><table><tbody>' + r.recent_activity.map((a) => html`<tr><td>${a.action.replace(/_/g, ' ')}</td><td>${a.target}</td><td class="muted">${a.created_at.replace('T', ' ').slice(0, 16)}</td></tr>`).join('') + '</tbody></table></div>' : U.empty('No activity yet', 'Changes you make are logged here.'))}</div></div>`);
    }

    /* ---------- events ---------- */
    const evFields = (isEdit) => [
      { name: 'title', label: 'Title', required: true, full: true }, { name: 'club_id', label: 'Organising club', type: 'select', options: clubOpts(false), required: true },
      { name: 'category', label: 'Category', type: 'select', options: U.EVCATS }, { name: 'description', label: 'Description', type: 'textarea', full: true, required: true },
      { name: 'event_date', label: 'Date', type: 'date', required: true }, { name: 'venue', label: 'Venue', required: true },
      { name: 'start_time', label: 'Start time', type: 'time', required: true }, { name: 'end_time', label: 'End time', type: 'time', required: true },
      { name: 'reg_opens', label: 'Registration opens', type: 'date', hint: 'Optional' }, { name: 'reg_closes', label: 'Registration closes', type: 'date', hint: 'Optional' },
      { name: 'capacity', label: 'Capacity', type: 'number', hint: 'Leave empty for no limit' }, { name: 'cover_image', label: 'Cover image path', list: 'img-list', hint: 'Under assets/images/. Empty uses the default.' },
      { name: 'is_published', label: 'Published (visible to everyone)', type: 'checkbox' }, { name: 'registration_enabled', label: 'Registration enabled', type: 'checkbox' }]
      .concat(isEdit ? [{ name: 'status', label: 'Status', type: 'select', options: [['active', 'Active'], ['cancelled', 'Cancelled'], ['archived', 'Archived']] }] : []);
    async function events() {
      const r = await U.api('GET', '/api/admin/events?limit=100'); const list = r.events;
      pane(html`<div class="head"><h2 style="font-size:1.4rem">Events (${list.length})</h2><button class="btn btn-pink" id="add-ev">Add event</button></div>
        ${raw(list.length ? '<div class="tablewrap"><table><thead><tr><th>Event</th><th>Date</th><th>Club</th><th>Seats</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + list.map((e) => html`<tr><td><b>${e.title}</b></td><td>${e.event_date}<br><span class="muted">${U.timeRange(e)}</span></td><td>${e.club_name}</td>
          <td>${e.registered_count}${e.capacity ? '/' + e.capacity : ''}</td><td><span class="badge ${e.status === 'archived' ? 'closed' : e.is_published ? 'open' : ''}">${e.status === 'archived' ? 'Archived' : e.is_published ? 'Published' : 'Draft'}</span> <span class="badge ${e.registration_status}">${U.stateLabel(e.registration_status)}</span></td>
          <td style="white-space:nowrap"><button class="btn btn-sm" data-edit="${e.id}">Edit</button> <button class="btn btn-sm" data-pub="${e.id}" data-to="${e.is_published ? 0 : 1}">${e.is_published ? 'Unpublish' : 'Publish'}</button> <button class="btn btn-sm" data-att="${e.id}">Attendees</button> ${raw(e.status !== 'archived' ? html`<button class="btn btn-sm" data-arch="${e.id}">Archive</button>` : '')}</td></tr>`).join('') + '</tbody></table></div>'
          : U.empty('No events yet', 'Create the first event. Nothing is shown to students until you publish it.'))}`);
      $('#add-ev').onclick = () => openForm('Add event', evFields(false), { category: 'workshop', registration_enabled: true, club_id: clubOpts(false)[0] && clubOpts(false)[0][0] }, async (v) => { await U.api('POST', '/api/admin/events', v); U.toast('Event created.', 'ok'); events(); });
      $('#pane').onclick = async (ev) => {
        const t = ev.target.closest('button'); if (!t) return;
        const id = t.dataset.edit || t.dataset.pub || t.dataset.att || t.dataset.arch; if (!id) return;
        if (t.dataset.edit) { const e = list.find((x) => x.id == id); openForm('Edit event', evFields(true), e, async (v) => { await U.api('PUT', '/api/admin/events/' + id, v); U.toast('Event updated.', 'ok'); events(); }); }
        else if (t.dataset.pub) { try { await U.api('PUT', '/api/admin/events/' + id, { is_published: t.dataset.to === '1' }); U.toast(t.dataset.to === '1' ? 'Event published.' : 'Event unpublished.', 'ok'); events(); } catch (e) { U.toast(e.message, 'err'); } }
        else if (t.dataset.arch) { if (!confirm('Archive this event? It disappears from the public site; registrations are kept.')) return; try { await U.api('DELETE', '/api/admin/events/' + id); U.toast('Event archived.', 'ok'); events(); } catch (e) { U.toast(e.message, 'err'); } }
        else if (t.dataset.att) {
          const a = await U.api('GET', '/api/admin/events/' + id + '/registrations');
          U.modal('Attendees: ' + a.event, html`<p><b>${a.count}</b> registered. <a class="btn btn-sm" href="/api/admin/events/${id}/registrations?format=csv">Download CSV</a></p>${raw(a.count ? '<div class="tablewrap"><table><thead><tr><th>Name</th><th>Email</th><th>Enrollment</th><th>Registered</th></tr></thead><tbody>' + a.attendees.map((p) => html`<tr><td>${p.full_name}</td><td>${p.email}</td><td>${p.enrollment_no || '-'}</td><td class="muted">${p.registered_at.replace('T', ' ').slice(0, 16)}</td></tr>`).join('') + '</tbody></table></div>' : U.empty('No registrations yet', ''))}`);
        }
      };
    }

    /* ---------- clubs ---------- */
    const clubFields = () => [
      { name: 'name', label: 'Club name', required: true, full: true }, { name: 'description', label: 'Description', type: 'textarea', required: true, full: true },
      { name: 'instagram_handle', label: 'Instagram handle', hint: 'e.g. @artistrymits' }, { name: 'category', label: 'Category', type: 'select', options: U.CATS.map(([v, l]) => [v, l]), required: true },
      { name: 'faculty_advisor', label: 'Faculty advisor' }, { name: 'student_leads', label: 'Student leads' },
      { name: 'recruitment_status', label: 'Recruitment status', type: 'select', options: [['To be announced', 'To be announced'], ['open', 'Open'], ['closed', 'Closed']] },
      { name: 'image_path', label: 'Image path', list: 'img-list', hint: 'Under assets/images/' }];
    async function clubsTab() {
      await loadClubs();
      pane(html`<div class="head"><h2 style="font-size:1.4rem">Clubs (${clubs.filter((c) => !c.is_archived).length})</h2><button class="btn btn-pink" id="add-club">Add club</button></div>
        <div class="toolbar"><input type="search" id="club-q" placeholder="Filter clubs" aria-label="Filter clubs"></div><div id="club-table"></div>`);
      const draw = (q) => {
        const l = clubs.filter((c) => (c.name + ' ' + (c.instagram_handle || '')).toLowerCase().includes(q.toLowerCase()));
        $('#club-table').innerHTML = '<div class="tablewrap"><table><thead><tr><th>Club</th><th>Instagram</th><th>Advisor / leads</th><th>Recruitment</th><th>Actions</th></tr></thead><tbody>' + l.map((c) => html`<tr><td><b>${c.name}</b><br><span class="muted">${U.catName(c.category)}</span>${raw(c.is_archived ? ' <span class="badge closed">Archived</span>' : '')}</td><td>${c.instagram_handle || '-'}</td><td>${c.faculty_advisor}<br><span class="muted">${c.student_leads}</span></td><td>${c.recruitment_status}</td>
          <td style="white-space:nowrap"><button class="btn btn-sm" data-cedit="${c.id}">Edit</button> ${raw(c.is_archived ? '' : html`<button class="btn btn-sm" data-carch="${c.id}">Archive</button>`)}</td></tr>`).join('') + '</tbody></table></div>';
      };
      draw(''); $('#club-q').oninput = (e) => draw(e.target.value);
      $('#add-club').onclick = () => openForm('Add club', clubFields(), { category: 'technical', recruitment_status: 'To be announced' }, async (v) => { await U.api('POST', '/api/admin/clubs', v); U.toast('Club added.', 'ok'); clubsTab(); });
      $('#pane').onclick = async (ev) => {
        const t = ev.target.closest('button'); if (!t) return;
        if (t.dataset.cedit) { const c = clubs.find((x) => x.id == t.dataset.cedit); openForm('Edit club', clubFields(), c, async (v) => { await U.api('PUT', '/api/admin/clubs/' + c.id, v); U.toast('Club updated.', 'ok'); clubsTab(); }); }
        else if (t.dataset.carch) { if (!confirm('Archive this club? Past events keep their club link.')) return; try { await U.api('DELETE', '/api/admin/clubs/' + t.dataset.carch); U.toast('Club archived.', 'ok'); clubsTab(); } catch (e) { U.toast(e.message, 'err'); } }
      };
    }

    /* ---------- notices ---------- */
    async function notices() {
      const [r, ev] = await Promise.all([U.api('GET', '/api/admin/announcements?limit=100'), U.api('GET', '/api/admin/events?limit=100')]);
      const fields = () => [{ name: 'title', label: 'Title', required: true, full: true }, { name: 'message', label: 'Message', type: 'textarea', required: true, full: true },
        { name: 'priority', label: 'Priority', type: 'select', options: [['normal', 'Normal'], ['important', 'Important'], ['urgent', 'Urgent']] }, { name: 'expires_at', label: 'Expiry date', type: 'date', hint: 'Optional' },
        { name: 'club_id', label: 'Related club', type: 'select', options: clubOpts(true) }, { name: 'event_id', label: 'Related event', type: 'select', options: [['', 'None']].concat(ev.events.map((e) => [e.id, e.title])) },
        { name: 'is_published', label: 'Published', type: 'checkbox' }];
      pane(html`<div class="head"><h2 style="font-size:1.4rem">Notices (${r.count})</h2><button class="btn btn-pink" id="add-n">New notice</button></div>${raw(r.count ? r.announcements.map((n) => html`<div class="notice ${n.priority}"><h3>${n.title} <span class="badge ${n.is_published ? 'open' : ''}">${n.is_published ? 'Published' : 'Draft'}</span>${raw(n.is_expired ? '<span class="badge closed">Expired</span>' : '')}</h3><p>${n.message}</p>
        <button class="btn btn-sm" data-nedit="${n.id}">Edit</button> <button class="btn btn-sm" data-ndel="${n.id}">Delete</button></div>`).join('') : U.empty('No notices yet', 'Create the first official notice.'))}`);
      $('#add-n').onclick = () => openForm('New notice', fields(), { priority: 'normal', is_published: true }, async (v) => { await U.api('POST', '/api/admin/announcements', v); U.toast('Notice saved.', 'ok'); notices(); });
      $('#pane').onclick = async (e) => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.nedit) { const n = r.announcements.find((x) => x.id == t.dataset.nedit); openForm('Edit notice', fields(), n, async (v) => { await U.api('PUT', '/api/admin/announcements/' + n.id, v); U.toast('Notice updated.', 'ok'); notices(); }); }
        else if (t.dataset.ndel) { if (!confirm('Delete this notice permanently?')) return; try { await U.api('DELETE', '/api/admin/announcements/' + t.dataset.ndel); U.toast('Notice deleted.', 'ok'); notices(); } catch (err) { U.toast(err.message, 'err'); } }
      };
    }
    show('overview');
  };
})();

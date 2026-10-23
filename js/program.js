(() => {
  'use strict';

  const data = window.PROGRAMME;
  const root = document.getElementById('conference-programme');
  if (!data || !root) return;

  const get = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const sessions = new Map(data.sessions.map(session => [session.id, session]));
  const rooms = new Map(data.rooms.map(room => [room.id, room]));
  const labels = {
    oral: 'Oral', poster: 'Poster', keynote: 'Keynote', workshop: 'Workshop',
    tutorial: 'Tutorial', encore: 'Encore', forum: 'Forum / Special',
    industry: 'Industry', break: 'Break', social: 'Social', other: 'Conference activity'
  };
  let selectedDay = '2026-11-28';

  function roomName(id) {
    const room = rooms.get(id);
    return room ? `${room.name} · ${room.id}` : 'Venue to be announced';
  }

  function dayName(date) {
    const day = data.days.find(item => item.date === date);
    return `${day.weekday}, ${day.label}`;
  }

  function renderDays() {
    get('days').innerHTML = data.days.map(day => `
      <button type="button" data-day="${escape(day.date)}" aria-controls="schedule">
        <b>${escape(day.label.split(' ')[0])} NOV</b><span>${escape(day.weekday)}</span>
      </button>`).join('');
    get('days').querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        selectedDay = button.dataset.day;
        render();
        get('grid-wrap').scrollTop = 0;
      });
    });
  }

  function render() {
    get('days').querySelectorAll('button').forEach(button => {
      const active = button.dataset.day === selectedDay;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderGrid();
  }

  function renderGrid() {
    const day = data.days.find(item => item.date === selectedDay);
    const all = data.sessions.filter(session => session.date === selectedDay);
    const timed = all.filter(session => session.room);
    const start = timed.length ? Math.floor(Math.min(...timed.map(session => minutes(session.start))) / 60) * 60 : 480;
    const end = Math.max(1080, start + 60, ...timed.map(session => Math.ceil(minutes(session.end) / 60) * 60));
    const scale = 2;
    const height = (end - start) * scale;
    get('day-title').textContent = dayName(selectedDay);
    get('day-subtitle').textContent = day.theme;

    let html = '<div class="programme-room-head programme-time-head">NZDT</div>';
    html += data.rooms.map(room => `
      <div class="programme-room-head">${escape(room.name)}
        <small>${escape(room.id)} · Capacity ${room.capacity}</small>
      </div>`).join('');
    html += `<div class="programme-time-axis" style="height:${height}px">`;
    for (let time = start; time < end; time += 30) {
      html += `<span class="programme-time-label" style="top:${(time - start) * scale}px">${clock(time)}</span>`;
    }
    html += '</div>';

    for (const room of data.rooms) {
      html += `<div class="programme-room-body" data-room="${escape(room.id)}" style="height:${height}px">`;
      const availability = (room.availability[selectedDay] || [])
        .map(([from, to]) => [Math.max(start, minutes(from)), Math.min(end, minutes(to))])
        .filter(([from, to]) => from < to)
        .sort((a, b) => a[0] - b[0]);
      let cursor = start;
      for (const [from, to] of [...availability, [end, end]]) {
        if (from > cursor) {
          html += `<div class="programme-closed" style="top:${(cursor - start) * scale}px;height:${(from - cursor) * scale}px">Not booked</div>`;
        }
        cursor = Math.max(cursor, to);
      }
      for (const session of timed.filter(item => item.room === room.id)) {
        const duration = minutes(session.end) - minutes(session.start);
        const meta = session.papers.length
          ? `${session.papers.length} ${session.type === 'poster' ? 'posters' : 'papers'}${session.type === 'oral' ? ' · 20 min each' : ''}`
          : session.agenda
            ? session.agenda.filter(item => item.role).map(item => item.speaker).join(' · ')
            : labels[session.type];
        html += `
          <button class="programme-session ${escape(session.type)} ${duration <= 30 ? 'compact' : ''}"
            type="button" data-session="${escape(session.id)}" id="${escape(session.id)}"
            style="top:${(minutes(session.start) - start) * scale}px;height:${duration * scale - 3}px"
            aria-label="${escape(session.title)}. ${session.start} to ${session.end}. ${escape(roomName(session.room))}. Open details.">
            <span class="programme-session-time">${session.start}–${session.end}</span>
            <span class="programme-session-name">${escape(session.title)}</span>
            <span class="programme-session-meta">${escape(meta)}</span>
            ${session.chair ? `<span class="programme-session-chair">Chair · ${escape(session.chair)}</span>` : ''}
          </button>`;
      }
      html += '</div>';
    }
    get('grid').style.setProperty('--rooms', data.rooms.length);
    get('grid').innerHTML = html;
    get('offsite').innerHTML = all.filter(session => !session.room).map(session => `
      <button class="programme-offsite-item" type="button" data-session="${escape(session.id)}">
        ${session.start}–${session.end}　${escape(session.title)} <span>Venue to be announced</span>
      </button>`).join('');
    root.querySelectorAll('[data-session]').forEach(button => {
      button.addEventListener('click', () => openSession(button.dataset.session));
    });
  }

  function paperHTML(paper, session, focus = '') {
    const other = session.type === 'oral'
      ? sessions.get(paper.poster_session_id)
      : paper.acceptance === 'oral' ? sessions.get(paper.oral_session_id) : null;
    const crosslink = other ? `
      <a href="#${escape(other.id)}" data-crosslink="${escape(other.id)}" data-paper-focus="${escape(paper.number)}"
        class="programme-paper-link">${session.type === 'oral' ? 'Also ' : 'Also oral: '}${escape(other.title.split(' · ')[0])}
        · ${Number(other.date.slice(-2))} Nov, ${other.start}</a>` : '';
    const timing = session.type === 'oral'
      ? `${paper.talk_start}–${paper.talk_end}`
      : `Board ${String(paper.order).padStart(2, '0')}`;
    return `<li class="programme-paper-row ${paper.number === focus ? 'match' : ''}" data-paper-number="${escape(paper.number)}">
      <div class="programme-paper-time">${timing}</div>
      <div><p class="programme-paper-title"><span class="programme-paper-number">#${escape(paper.number)}</span>${escape(paper.title)}</p>
        ${paper.authors?.length ? `<p class="programme-muted">${escape(paper.authors.join(', '))}</p>` : ''}${crosslink}
      </div></li>`;
  }

  function paperList(session, focus = '') {
    let previous = '';
    return session.papers.map(paper => {
      let heading = '';
      if (session.type === 'poster' && paper.cluster && paper.cluster !== previous) {
        previous = paper.cluster;
        heading = `<li class="programme-topic" role="presentation">${escape(paper.cluster)}</li>`;
      }
      return heading + paperHTML(paper, session, focus);
    }).join('');
  }

  function wireCrosslinks(container) {
    container.querySelectorAll('[data-crosslink]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        jumpToSession(link.dataset.crosslink, link.dataset.paperFocus || '');
      });
    });
  }

  function openSession(id, focus = '') {
    const session = sessions.get(id);
    if (!session) return;
    get('session-category').textContent = labels[session.type];
    get('session-title').textContent = session.title;
    get('session-location').textContent = `${dayName(session.date)} · ${session.start}–${session.end} · ${roomName(session.room)}`;
    let content = session.chair ? `<p class="programme-muted">Chair · ${escape(session.chair)}</p>` : '';
    if (session.papers.length) {
      content += `<p class="programme-muted">${session.papers.length} ${session.type === 'poster'
        ? 'posters. Board numbers restart in each poster session.'
        : 'papers. Each presentation includes 15 minutes for the talk and 5 minutes for questions.'}</p>
        <ol class="programme-paper-list">${paperList(session, focus)}</ol>`;
    } else if (session.agenda) {
      content += `<ol class="programme-paper-list">${session.agenda.map(item => `
        <li class="programme-paper-row"><span class="programme-paper-time">${item.start}–${item.end}</span>
          <div><p class="programme-paper-title">${escape(item.title)}</p>
            ${item.speaker ? `<span class="programme-agenda-speaker">${escape(item.speaker)}${item.role ? ` · <span>${escape(item.role)}</span>` : ''}</span>` : ''}
            ${item.link ? `<a class="programme-paper-link" href="${escape(item.link)}" target="_blank" rel="noopener">LinkedIn ↗</a>` : ''}
          </div></li>`).join('')}</ol>`;
    } else {
      const note = session.type === 'keynote' ? 'Speaker listed in the session title.'
        : !session.room ? 'The venue will be announced.' : 'See the timetable above for the session time and room.';
      content += `<p class="programme-muted">${note}</p>`;
    }
    get('session-content').innerHTML = content;
    wireCrosslinks(get('session-content'));
    if (!get('session-dialog').open) get('session-dialog').showModal();
    get('session-dialog').scrollTop = 0;
    if (focus) {
      requestAnimationFrame(() => {
        [...get('session-content').querySelectorAll('[data-paper-number]')]
          .find(paper => paper.dataset.paperNumber === focus)?.scrollIntoView({ block: 'center' });
      });
    }
  }

  function jumpToSession(id, focus = '') {
    const session = sessions.get(id);
    if (!session) return;
    root.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    selectedDay = session.date;
    render();
    get(id)?.scrollIntoView({ block: 'center', inline: 'center' });
    openSession(id, focus);
    history.replaceState(null, '', `#${id}`);
  }

  function renderSearch() {
    const query = get('search').value.trim().toLowerCase();
    const found = data.sessions.map(session => ({
      session,
      matching: session.papers.filter(paper => [paper.number, `#${paper.number}`, paper.title, ...(paper.authors || [])]
        .join(' ').toLowerCase().includes(query))
    })).filter(({ session, matching }) => !query || matching.length || [session.title, session.chair,
      roomName(session.room), dayName(session.date), session.date,
      ...(session.agenda || []).map(item => [item.title, item.speaker, item.role].join(' '))
    ].join(' ').toLowerCase().includes(query));
    get('search-count').textContent = `${found.length} ${found.length === 1 ? 'session' : 'sessions'}${query ? ' matching your search' : ' across all five days'}`;
    get('search-results').innerHTML = found.length ? found.map(({ session, matching }) => `
      <button type="button" class="programme-search-result" data-search-session="${escape(session.id)}"
        data-paper-focus="${query && matching.length === 1 ? escape(matching[0].number) : ''}">
        <strong>${escape(session.title)}</strong>
        <small>${dayName(session.date)} · ${session.start}–${session.end} · ${escape(roomName(session.room))}</small>
        ${query ? matching.map(paper => `<span class="programme-matching-paper">#${escape(paper.number)} ${escape(paper.title)}</span>`).join('') : ''}
      </button>`).join('') : '<p class="programme-empty">No matching sessions. Try a paper number, a shorter title or a room.</p>';
    get('search-results').querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => jumpToSession(button.dataset.searchSession, button.dataset.paperFocus));
    });
  }

  function openIndex() {
    const groups = data.sessions.filter(session => session.papers.length).slice().sort((a, b) => a.type === b.type
      ? Number(a.title.match(/\d+/)?.[0] || 0) - Number(b.title.match(/\d+/)?.[0] || 0)
      : a.type === 'oral' ? -1 : 1);
    get('papers-content').innerHTML = groups.map(session => `
      <details class="programme-group" data-paper-session="${escape(session.id)}">
        <summary>${escape(session.title)} <span>${session.papers.length} ${session.type === 'poster' ? 'posters' : 'papers'}</span></summary>
        <p class="programme-group-meta">${dayName(session.date)} · ${session.start}–${session.end} · ${escape(roomName(session.room))}</p>
        <button class="programme-group-jump" type="button" data-jump="${escape(session.id)}">View in timetable</button>
        <ol class="programme-paper-list">${paperList(session)}</ol>
      </details>`).join('');
    get('papers-content').querySelectorAll('[data-jump]').forEach(button => {
      button.addEventListener('click', () => jumpToSession(button.dataset.jump));
    });
    wireCrosslinks(get('papers-content'));
    get('papers-dialog').showModal();
  }

  const oralPapers = data.sessions.filter(session => session.type === 'oral').flatMap(session => session.papers);
  const posterPapers = data.sessions.filter(session => session.type === 'poster').flatMap(session => session.papers);
  const acceptedCount = new Set([...oralPapers, ...posterPapers].map(paper => paper.number)).size;
  get('oral-count').textContent = oralPapers.length;
  get('poster-count').textContent = posterPapers.length;
  get('papers-summary').textContent = `${acceptedCount} accepted papers · ${oralPapers.length} oral presentations and ${posterPapers.length} poster presentations. Every oral paper also appears in a poster session.`;
  get('programme-updated').textContent = `Updated ${data.updated} · Programme subject to change.`;
  get('paper-index').addEventListener('click', openIndex);
  get('find-session').addEventListener('click', () => {
    renderSearch();
    get('search-dialog').showModal();
    get('search').focus();
  });
  get('search').addEventListener('input', renderSearch);
  root.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => get(button.dataset.close).close());
  });

  renderDays();
  render();
  if (sessions.has(location.hash.slice(1))) jumpToSession(location.hash.slice(1));
  window.addEventListener('hashchange', () => {
    if (sessions.has(location.hash.slice(1))) jumpToSession(location.hash.slice(1));
  });
})();

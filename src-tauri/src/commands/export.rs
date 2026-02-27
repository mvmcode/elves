// Session export commands — generate self-contained HTML replay files from session data.

use crate::db;
use super::projects::DbState;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

/// Generate a self-contained HTML replay file for a session.
///
/// Reads the session, its elves, and all events from SQLite, then builds an HTML string
/// with inline CSS (neo-brutalist styling) and inline JS (replay engine with play/pause/speed).
/// All session data is embedded as JSON in a script tag. The frontend handles the file save dialog.
///
/// Returns the complete HTML string on success, or an error message if the session is not found.
#[tauri::command]
pub fn export_session_html(
    db: State<'_, DbState>,
    session_id: String,
) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;

    let session = db::sessions::get_session(&conn, &session_id)
        .map_err(|e| format!("Database error: {e}"))?
        .ok_or_else(|| format!("Session not found: {session_id}"))?;

    let elves = db::elves::list_elves(&conn, &session_id)
        .map_err(|e| format!("Database error: {e}"))?;

    let events = db::events::list_events(&conn, &session_id)
        .map_err(|e| format!("Database error: {e}"))?;

    let session_json = serde_json::to_string(&session)
        .map_err(|e| format!("Serialization error: {e}"))?;
    let elves_json = serde_json::to_string(&elves)
        .map_err(|e| format!("Serialization error: {e}"))?;
    let events_json = serde_json::to_string(&events)
        .map_err(|e| format!("Serialization error: {e}"))?;

    let html = build_replay_html(&session_json, &elves_json, &events_json);
    Ok(html)
}

/// Save a session replay as an HTML file using the native save dialog.
///
/// Generates the HTML replay (reusing `export_session_html` logic), shows a native save dialog
/// for the user to choose a file path, and writes the HTML to disk. Returns `true` if the file
/// was saved, `false` if the user cancelled the dialog.
#[tauri::command]
pub async fn save_session_replay(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    session_id: String,
) -> Result<bool, String> {
    /* Generate the HTML string */
    let html = {
        let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;

        let session = db::sessions::get_session(&conn, &session_id)
            .map_err(|e| format!("Database error: {e}"))?
            .ok_or_else(|| format!("Session not found: {session_id}"))?;

        let elves = db::elves::list_elves(&conn, &session_id)
            .map_err(|e| format!("Database error: {e}"))?;

        let events = db::events::list_events(&conn, &session_id)
            .map_err(|e| format!("Database error: {e}"))?;

        let session_json = serde_json::to_string(&session)
            .map_err(|e| format!("Serialization error: {e}"))?;
        let elves_json = serde_json::to_string(&elves)
            .map_err(|e| format!("Serialization error: {e}"))?;
        let events_json = serde_json::to_string(&events)
            .map_err(|e| format!("Serialization error: {e}"))?;

        build_replay_html(&session_json, &elves_json, &events_json)
    };

    /* Show native save dialog */
    let file_path = app
        .dialog()
        .file()
        .set_title("Save Session Replay")
        .set_file_name(&format!("elves-replay-{}.html", &session_id[..8.min(session_id.len())]))
        .add_filter("HTML", &["html"])
        .blocking_save_file();

    match file_path {
        Some(path) => {
            std::fs::write(path.as_path().expect("Invalid file path"), html.as_bytes())
                .map_err(|e| format!("Failed to write file: {e}"))?;
            Ok(true)
        }
        None => Ok(false),
    }
}

/// Build the complete self-contained HTML string for the session replay.
///
/// Embeds session data as JSON, includes inline neo-brutalist CSS and a JavaScript replay engine
/// with play/pause, speed control, and event stepping. Works in any modern browser with zero
/// external dependencies.
fn build_replay_html(session_json: &str, elves_json: &str, events_json: &str) -> String {
    format!(
        r##"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ELVES Session Replay</title>
<style>
{css}
</style>
</head>
<body>
<script>
window.__ELVES_SESSION__ = {session_json};
window.__ELVES_ELVES__ = {elves_json};
window.__ELVES_EVENTS__ = {events_json};
</script>

<div id="app">
  <header id="header">
    <div class="header-left">
      <h1 class="logo">ELVES</h1>
      <span class="badge" id="status-badge">REPLAY</span>
    </div>
    <div class="header-center">
      <h2 class="task-title" id="task-title"></h2>
      <div class="meta-row">
        <span class="meta-item" id="meta-runtime"></span>
        <span class="meta-sep">&middot;</span>
        <span class="meta-item" id="meta-duration"></span>
        <span class="meta-sep">&middot;</span>
        <span class="meta-item" id="meta-elves"></span>
        <span class="meta-sep">&middot;</span>
        <span class="meta-item" id="meta-events"></span>
      </div>
    </div>
    <div class="header-right">
      <span class="meta-item" id="meta-cost"></span>
    </div>
  </header>

  <main id="main">
    <section class="elves-panel" id="elves-panel">
      <h3 class="panel-title">ELVES</h3>
      <div id="elf-cards"></div>
    </section>

    <section class="events-panel" id="events-panel">
      <h3 class="panel-title">ACTIVITY FEED</h3>
      <div class="event-counter">
        <span id="event-index">0</span> / <span id="event-total">0</span>
      </div>
      <div id="event-feed"></div>
    </section>
  </main>

  <footer id="controls">
    <div class="controls-bar">
      <button class="ctrl-btn" id="btn-start" title="Jump to start">&#9198;</button>
      <button class="ctrl-btn" id="btn-prev" title="Previous event">&#9664;</button>
      <button class="ctrl-btn ctrl-btn-play" id="btn-play" title="Play / Pause">&#9654;</button>
      <button class="ctrl-btn" id="btn-next" title="Next event">&#9654;</button>
      <button class="ctrl-btn" id="btn-end" title="Jump to end">&#9197;</button>
      <div class="speed-group">
        <label class="speed-label">SPEED</label>
        <button class="speed-btn" data-speed="0.5">0.5x</button>
        <button class="speed-btn active" data-speed="1">1x</button>
        <button class="speed-btn" data-speed="2">2x</button>
        <button class="speed-btn" data-speed="5">5x</button>
      </div>
      <div class="progress-wrapper">
        <div class="progress-bar" id="progress-bar">
          <div class="progress-fill" id="progress-fill"></div>
        </div>
      </div>
    </div>
  </footer>

  <div class="branding">Made with ELVES &#127850; &mdash; elves.dev</div>
</div>

<script>
{js}
</script>
</body>
</html>"##,
        css = REPLAY_CSS,
        js = REPLAY_JS,
        session_json = session_json,
        elves_json = elves_json,
        events_json = events_json,
    )
}

/// Inline CSS for the self-contained HTML replay — neo-brutalist styling.
const REPLAY_CSS: &str = r#"
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;800&family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap');

:root {
  --bg: #FFFDF7;
  --bg-dark: #1A1A2E;
  --gold: #FFD93D;
  --red: #FF6B6B;
  --green: #6BCB77;
  --blue: #4D96FF;
  --orange: #FF8B3D;
  --black: #000000;
  --white: #FFFDF7;
  --border: 3px solid #000;
  --shadow: 6px 6px 0px 0px #000;
  --shadow-sm: 3px 3px 0px 0px #000;
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--black);
  min-height: 100vh;
  overflow-x: hidden;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ── Header ──────────────────────────────────────────── */
#header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: var(--border);
  background: var(--gold);
}

.header-left { display: flex; align-items: center; gap: 12px; }
.header-center { flex: 1; min-width: 0; }
.header-right { display: flex; align-items: center; gap: 8px; }

.logo {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.badge {
  display: inline-block;
  padding: 4px 12px;
  border: 2px solid var(--black);
  background: var(--black);
  color: var(--gold);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.task-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.meta-item {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
}

.meta-sep {
  font-size: 12px;
  opacity: 0.4;
}

/* ── Main layout ─────────────────────────────────────── */
#main {
  display: grid;
  grid-template-columns: 280px 1fr;
  flex: 1;
  overflow: hidden;
}

/* ── Elves panel ─────────────────────────────────────── */
.elves-panel {
  border-right: var(--border);
  padding: 16px;
  overflow-y: auto;
  background: var(--bg);
}

.panel-title {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--black);
}

.elf-card {
  border: var(--border);
  box-shadow: var(--shadow-sm);
  padding: 12px;
  margin-bottom: 10px;
  transition: transform 0.1s, box-shadow 0.1s;
  background: #FFF;
}

.elf-card:hover {
  transform: translate(1px, 1px);
  box-shadow: 2px 2px 0px 0px #000;
}

.elf-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.elf-avatar {
  width: 32px;
  height: 32px;
  border: 2px solid var(--black);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.elf-name {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.elf-role {
  font-family: var(--font-mono);
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.elf-runtime {
  display: inline-block;
  padding: 2px 6px;
  border: 2px solid var(--black);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.elf-status {
  font-family: var(--font-mono);
  font-size: 11px;
  margin-top: 4px;
  font-style: italic;
  color: #444;
}

.elf-status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border: 2px solid var(--black);
  margin-right: 4px;
}

/* ── Events panel ────────────────────────────────────── */
.events-panel {
  padding: 16px;
  overflow-y: auto;
  position: relative;
}

.event-counter {
  position: absolute;
  top: 16px;
  right: 16px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  padding: 4px 10px;
  border: 2px solid var(--black);
  background: var(--gold);
}

#event-feed {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.event-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 2px solid var(--black);
  background: #FFF;
  opacity: 0.3;
  transition: opacity 0.15s, transform 0.15s;
}

.event-row.active {
  opacity: 1;
  box-shadow: var(--shadow-sm);
  border-color: var(--black);
}

.event-row.past {
  opacity: 0.7;
}

.event-timestamp {
  font-family: var(--font-mono);
  font-size: 11px;
  color: #888;
  white-space: nowrap;
  min-width: 60px;
}

.event-type-badge {
  display: inline-block;
  padding: 2px 8px;
  border: 2px solid var(--black);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
}

.event-type-thinking    { background: var(--blue); color: #FFF; }
.event-type-tool_call   { background: var(--orange); color: #000; }
.event-type-tool_result { background: var(--green); color: #000; }
.event-type-output      { background: var(--gold); color: #000; }
.event-type-spawn       { background: #E0C3FC; color: #000; }
.event-type-chat        { background: #FFF; color: #000; }
.event-type-error       { background: var(--red); color: #FFF; }
.event-type-task_update { background: #B8E6D0; color: #000; }
.event-type-file_change { background: #FFE4B5; color: #000; }
.event-type-permission_request { background: #FFB4B4; color: #000; }

.event-body {
  flex: 1;
  min-width: 0;
}

.event-elf-name {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 2px;
}

.event-content {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
  max-height: 120px;
  overflow-y: auto;
}

.event-funny {
  font-family: var(--font-body);
  font-size: 11px;
  font-style: italic;
  color: #666;
  margin-top: 4px;
}

/* ── Controls bar ────────────────────────────────────── */
#controls {
  border-top: var(--border);
  padding: 12px 24px;
  background: #FFF;
}

.controls-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctrl-btn {
  width: 40px;
  height: 40px;
  border: var(--border);
  background: #FFF;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, box-shadow 0.1s;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.ctrl-btn:hover {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0px 0px #000;
}

.ctrl-btn:active {
  transform: translate(3px, 3px);
  box-shadow: none;
}

.ctrl-btn-play {
  width: 48px;
  height: 48px;
  background: var(--gold);
  font-size: 20px;
}

.speed-group {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
}

.speed-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-right: 4px;
}

.speed-btn {
  padding: 4px 8px;
  border: 2px solid var(--black);
  background: #FFF;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  transition: background 0.1s;
}

.speed-btn.active {
  background: var(--gold);
}

.speed-btn:hover {
  background: var(--gold);
}

.progress-wrapper {
  flex: 1;
  margin-left: 16px;
}

.progress-bar {
  height: 12px;
  border: 2px solid var(--black);
  background: #EEE;
  cursor: pointer;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: var(--gold);
  width: 0%;
  transition: width 0.15s;
}

/* ── Branding ────────────────────────────────────────── */
.branding {
  text-align: center;
  padding: 12px;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  color: #999;
  border-top: 2px solid #EEE;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 768px) {
  #main { grid-template-columns: 1fr; }
  .elves-panel {
    border-right: none;
    border-bottom: var(--border);
    max-height: 200px;
  }
  .elves-panel #elf-cards {
    display: flex;
    gap: 8px;
    overflow-x: auto;
  }
  .elf-card {
    min-width: 180px;
    margin-bottom: 0;
  }
  #header { flex-direction: column; gap: 8px; text-align: center; }
  .controls-bar { flex-wrap: wrap; justify-content: center; }
  .progress-wrapper { width: 100%; margin-left: 0; margin-top: 8px; }
}

/* ── Scrollbar styling ───────────────────────────────── */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #F5F5F0; }
::-webkit-scrollbar-thumb { background: #000; border: 1px solid #F5F5F0; }
"#;

/// Inline JavaScript for the self-contained HTML replay engine.
const REPLAY_JS: &str = r#"
(function() {
  'use strict';

  var session = window.__ELVES_SESSION__;
  var elves = window.__ELVES_ELVES__;
  var events = window.__ELVES_EVENTS__;

  /* ── Helpers ─────────────────────────────────────── */

  function formatDuration(startMs, endMs) {
    var diff = Math.floor(((endMs || Date.now()) - startMs) / 1000);
    if (diff < 0) diff = 0;
    if (diff < 60) return diff + 's';
    var m = Math.floor(diff / 60);
    var s = diff % 60;
    if (m < 60) return m + 'm ' + s + 's';
    var h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }

  function formatTime(ts) {
    var d = new Date(ts * 1000);
    var hh = d.getHours().toString().padStart(2, '0');
    var mm = d.getMinutes().toString().padStart(2, '0');
    var ss = d.getSeconds().toString().padStart(2, '0');
    return hh + ':' + mm + ':' + ss;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function truncate(str, max) {
    if (str.length <= max) return str;
    return str.substring(0, max) + '...';
  }

  function parsePayload(payloadStr) {
    try { return JSON.parse(payloadStr); }
    catch(e) { return {}; }
  }

  function summarizePayload(type, payload) {
    if (typeof payload === 'string') payload = parsePayload(payload);
    switch(type) {
      case 'thinking':
        return payload.text ? truncate(payload.text, 200) : 'Thinking...';
      case 'tool_call':
        var tool = payload.tool || payload.name || 'unknown';
        var args = payload.args || payload.input || '';
        if (typeof args === 'object') args = JSON.stringify(args);
        return tool + '(' + truncate(String(args), 100) + ')';
      case 'tool_result':
        var out = payload.output || payload.result || '';
        if (typeof out === 'object') out = JSON.stringify(out);
        return truncate(String(out), 200);
      case 'output':
        return payload.text || payload.content || JSON.stringify(payload);
      case 'spawn':
        return 'Spawned: ' + (payload.name || payload.elfName || 'elf');
      case 'chat':
        return payload.message || payload.text || '';
      case 'error':
        return payload.message || payload.error || JSON.stringify(payload);
      case 'task_update':
        return (payload.status || '') + ': ' + (payload.label || payload.task || '');
      case 'file_change':
        return (payload.action || 'changed') + ' ' + (payload.path || payload.file || '');
      case 'permission_request':
        return 'Permission: ' + (payload.tool || payload.action || 'unknown');
      default:
        return JSON.stringify(payload).substring(0, 200);
    }
  }

  /* ── Build header ──────────────────────────────── */

  document.getElementById('task-title').textContent = session.task || 'Untitled Session';
  document.getElementById('meta-runtime').textContent = (session.runtime || '').toUpperCase();
  document.getElementById('meta-duration').textContent = formatDuration(
    session.startedAt, session.endedAt
  );
  document.getElementById('meta-elves').textContent = elves.length + (elves.length === 1 ? ' elf' : ' elves');
  document.getElementById('meta-events').textContent = events.length + ' events';
  document.getElementById('meta-cost').textContent =
    session.tokensUsed.toLocaleString() + ' tokens · $' + session.costEstimate.toFixed(4);

  var statusBadge = document.getElementById('status-badge');
  var statusColors = {
    completed: '#6BCB77', failed: '#FF6B6B', cancelled: '#FF8B3D', active: '#4D96FF'
  };
  statusBadge.textContent = (session.status || 'REPLAY').toUpperCase();
  if (statusColors[session.status]) {
    statusBadge.style.background = statusColors[session.status];
    statusBadge.style.color = '#000';
  }

  /* ── Build elf cards ───────────────────────────── */

  var elfMap = {};
  var elfCardsEl = document.getElementById('elf-cards');

  elves.forEach(function(elf) {
    elfMap[elf.id] = elf;
    var card = document.createElement('div');
    card.className = 'elf-card';
    card.id = 'elf-card-' + elf.id;
    card.style.borderLeftColor = elf.color;
    card.style.borderLeftWidth = '6px';

    var runtimeLabel = elf.runtime === 'claude-code' ? 'CC' : 'CX';
    var runtimeColor = elf.runtime === 'claude-code' ? '#A78BFA' : '#34D399';

    card.innerHTML =
      '<div class="elf-card-header">' +
        '<div class="elf-avatar" style="background:' + escapeHtml(elf.color) + '">' +
          escapeHtml(elf.avatar) +
        '</div>' +
        '<div>' +
          '<div class="elf-name">' + escapeHtml(elf.name) + '</div>' +
          (elf.role ? '<div class="elf-role">' + escapeHtml(elf.role) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;margin-top:4px">' +
        '<span class="elf-runtime" style="background:' + runtimeColor + '">' + runtimeLabel + '</span>' +
        '<span class="elf-status-indicator" id="elf-indicator-' + elf.id + '" style="background:' + escapeHtml(elf.color) + '"></span>' +
        '<span class="elf-status" id="elf-status-' + elf.id + '">Ready</span>' +
      '</div>';

    elfCardsEl.appendChild(card);
  });

  /* ── Build event feed ──────────────────────────── */

  var feedEl = document.getElementById('event-feed');
  var eventTotalEl = document.getElementById('event-total');
  var eventIndexEl = document.getElementById('event-index');
  eventTotalEl.textContent = events.length;

  var eventRows = [];
  events.forEach(function(evt, i) {
    var row = document.createElement('div');
    row.className = 'event-row';
    row.id = 'event-row-' + i;

    var elfName = '';
    if (evt.elfId && elfMap[evt.elfId]) {
      elfName = elfMap[evt.elfId].name;
    }

    var summary = summarizePayload(evt.eventType, evt.payload);

    row.innerHTML =
      '<div class="event-timestamp">' + formatTime(evt.timestamp) + '</div>' +
      '<div class="event-type-badge event-type-' + escapeHtml(evt.eventType) + '">' +
        escapeHtml(evt.eventType.replace(/_/g, ' ')) +
      '</div>' +
      '<div class="event-body">' +
        (elfName ? '<div class="event-elf-name">' + escapeHtml(elfName) + '</div>' : '') +
        '<div class="event-content">' + escapeHtml(summary) + '</div>' +
        (evt.funnyStatus ? '<div class="event-funny">"' + escapeHtml(evt.funnyStatus) + '"</div>' : '') +
      '</div>';

    feedEl.appendChild(row);
    eventRows.push(row);
  });

  /* ── Replay engine ─────────────────────────────── */

  var currentIndex = -1;
  var isPlaying = false;
  var playInterval = null;
  var speed = 1;
  var baseDelay = 800;

  function goToEvent(index) {
    if (events.length === 0) return;
    if (index < -1) index = -1;
    if (index >= events.length) index = events.length - 1;
    currentIndex = index;

    eventIndexEl.textContent = index + 1;

    // Update progress bar
    var pct = events.length > 0 ? ((index + 1) / events.length) * 100 : 0;
    document.getElementById('progress-fill').style.width = pct + '%';

    // Update event row styling
    eventRows.forEach(function(row, i) {
      row.className = 'event-row';
      if (i < index) row.className += ' past';
      else if (i === index) row.className += ' active';
    });

    // Scroll active row into view
    if (index >= 0 && eventRows[index]) {
      eventRows[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Update elf statuses based on current event
    if (index >= 0) {
      var evt = events[index];
      if (evt.elfId && document.getElementById('elf-status-' + evt.elfId)) {
        var statusText = evt.funnyStatus || evt.eventType.replace(/_/g, ' ');
        document.getElementById('elf-status-' + evt.elfId).textContent = truncate(statusText, 30);

        var statusColors2 = {
          thinking: '#4D96FF', tool_call: '#FF8B3D', tool_result: '#6BCB77',
          output: '#FFD93D', error: '#FF6B6B', spawn: '#E0C3FC',
          done: '#6BCB77'
        };
        var indicatorEl = document.getElementById('elf-indicator-' + evt.elfId);
        if (indicatorEl) {
          indicatorEl.style.background = statusColors2[evt.eventType] || '#999';
        }
      }
    }
  }

  function play() {
    if (isPlaying) return;
    if (currentIndex >= events.length - 1) {
      currentIndex = -1;
    }
    isPlaying = true;
    document.getElementById('btn-play').innerHTML = '&#9646;&#9646;';
    tick();
  }

  function pause() {
    isPlaying = false;
    document.getElementById('btn-play').innerHTML = '&#9654;';
    if (playInterval) {
      clearTimeout(playInterval);
      playInterval = null;
    }
  }

  function tick() {
    if (!isPlaying) return;
    if (currentIndex >= events.length - 1) {
      pause();
      return;
    }
    goToEvent(currentIndex + 1);
    var delay = baseDelay / speed;
    playInterval = setTimeout(tick, delay);
  }

  /* ── Control bindings ──────────────────────────── */

  document.getElementById('btn-play').addEventListener('click', function() {
    if (isPlaying) pause(); else play();
  });

  document.getElementById('btn-prev').addEventListener('click', function() {
    pause();
    goToEvent(currentIndex - 1);
  });

  document.getElementById('btn-next').addEventListener('click', function() {
    pause();
    goToEvent(currentIndex + 1);
  });

  document.getElementById('btn-start').addEventListener('click', function() {
    pause();
    goToEvent(0);
  });

  document.getElementById('btn-end').addEventListener('click', function() {
    pause();
    goToEvent(events.length - 1);
  });

  document.querySelectorAll('.speed-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      speed = parseFloat(btn.dataset.speed);
      document.querySelectorAll('.speed-btn').forEach(function(b) { b.className = 'speed-btn'; });
      btn.className = 'speed-btn active';
    });
  });

  // Progress bar click-to-seek
  document.getElementById('progress-bar').addEventListener('click', function(e) {
    var rect = this.getBoundingClientRect();
    var pct = (e.clientX - rect.left) / rect.width;
    var idx = Math.floor(pct * events.length);
    goToEvent(Math.min(idx, events.length - 1));
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    switch(e.key) {
      case ' ':
        e.preventDefault();
        if (isPlaying) pause(); else play();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        pause();
        goToEvent(currentIndex - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        pause();
        goToEvent(currentIndex + 1);
        break;
      case 'Home':
        e.preventDefault();
        pause();
        goToEvent(0);
        break;
      case 'End':
        e.preventDefault();
        pause();
        goToEvent(events.length - 1);
        break;
    }
  });

  // Initialize: show all events as dimmed, ready to play
  if (events.length > 0) {
    goToEvent(-1);
  }

})();
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_replay_html_contains_session_data() {
        let session = r#"{"id":"s1","task":"Test task","runtime":"claude-code","status":"completed","startedAt":1000,"endedAt":2000,"tokensUsed":500,"costEstimate":0.01,"agentCount":1}"#;
        let elves = r##"[{"id":"e1","name":"Cookie","avatar":"🍪","color":"#FFD93D","runtime":"claude-code","status":"done"}]"##;
        let events = r#"[{"id":1,"sessionId":"s1","elfId":"e1","eventType":"thinking","payload":"{}","timestamp":1000}]"#;

        let html = build_replay_html(session, elves, events);

        assert!(html.contains("<!DOCTYPE html>"));
        assert!(html.contains("ELVES Session Replay"));
        assert!(html.contains("__ELVES_SESSION__"));
        assert!(html.contains("__ELVES_ELVES__"));
        assert!(html.contains("__ELVES_EVENTS__"));
        assert!(html.contains("Test task"));
        assert!(html.contains("Cookie"));
        assert!(html.contains("neo-brutalist") || html.contains("var(--gold)"));
        assert!(html.contains("elves.dev"));
    }

    #[test]
    fn build_replay_html_is_self_contained() {
        let html = build_replay_html("{}", "[]", "[]");

        // Should have inline CSS and JS, not external references
        assert!(html.contains("<style>"));
        assert!(html.contains("<script>"));
        // Should not reference external JS or CSS files (except Google Fonts)
        assert!(!html.contains("src=\"http"));
        assert!(!html.contains("href=\"http") || html.contains("fonts.googleapis.com"));
    }

    #[test]
    fn build_replay_html_has_controls() {
        let html = build_replay_html("{}", "[]", "[]");

        assert!(html.contains("btn-play"));
        assert!(html.contains("btn-prev"));
        assert!(html.contains("btn-next"));
        assert!(html.contains("btn-start"));
        assert!(html.contains("btn-end"));
        assert!(html.contains("speed-btn"));
        assert!(html.contains("progress-bar"));
    }
}

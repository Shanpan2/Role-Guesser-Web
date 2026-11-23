const $ = (selector) => document.querySelector(selector);
const state = { roles: [], registry: {}, filtered: [], candidates: [], history: [], asked: [], scope: 'Vanilla' };

function parseCsv(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) { const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i++; row.push(value); if (row.length > 1) rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const [headers, ...data] = rows;
  return data.map((fields) => Object.fromEntries(headers.map((header, i) => [header, fields[i] ?? ''])));
}

function truth(value) { return value === 'true' ? true : value === 'false' ? false : null; }
function teamJa(team) { return ({Crewmate:'クルーメイト',Impostor:'インポスター',Neutral:'第三陣営',Other:'その他',Madmate:'マッドメイト',Jackal:'ジャッカル',Liberal:'リベラル'})[team] || team; }
function normalizeTerminology(value) {
  return String(value || '')
    .replace(/\bFungle\b/gi, 'ファングル')
    .replace(/クルー(?!メイト)/g, 'クルーメイト')
    .replace(/ニュートラル/g, '第三陣営');
}
function verifiedSignals(role) {
  const ability = role.abilities || [];
  return {
    isImpostor: role.team === 'Impostor', canKill: ability.includes('キル'), usesVent: ability.includes('ベント'),
    canProtect: ability.includes('保護'), canInvestigate: ability.some(x => ['バイタル確認','位置追跡','尋問','メモ'].includes(x)),
    isGhost: ability.includes('ゴースト能力'), hasMeetingAbility: ability.includes('会議中の強制追放'),
    canDisguise: ability.includes('変身') || ability.includes('透明化')
  };
}
function signals(role) {
  if (role.verified) return verifiedSignals(role);
  return { isImpostor: role.team === 'Impostor', canKill: truth(role.raw.can_kill), usesVent: truth(role.raw.uses_vent), canProtect: truth(role.raw.can_protect), canInvestigate: truth(role.raw.can_investigate), isGhost: truth(role.raw.ghost_role), hasMeetingAbility: truth(role.raw.meeting_ability), canDisguise: truth(role.raw.disguise_or_invisible) || truth(role.raw.shapeshift_power) || truth(role.raw.invisibility_power) };
}
const questions = [
  ['isImpostor','この役職はインポスター陣営ですか？'],['canKill','キル能力を持ちますか？'],['usesVent','ベントを使えますか？'],['canProtect','他者を保護できますか？'],['canInvestigate','情報収集・調査能力がありますか？'],['isGhost','ゴーストとして固有の能力を持ちますか？'],['hasMeetingAbility','会議中に固有の能力を使えますか？'],['canDisguise','変身または透明化ができますか？']
];
const detailQuestions = [
  ['has_tasks', 'タスクを持つ役職ですか？'], ['no_task_role', 'タスクを持たない役職ですか？'],
  ['normal_kill', '通常のキルを使えますか？'], ['special_kill', '特殊な方法でキルできますか？'],
  ['limited_kill_power', 'キル回数またはキル条件に制限がありますか？'], ['ranged_power', '遠距離に影響する能力がありますか？'],
  ['sabotage_power', 'サボタージュに関係する能力がありますか？'], ['report_power', '通報に関係する能力がありますか？'],
  ['vote_power', '投票数や投票先に影響できますか？'], ['role_info_power', '他プレイヤーの役職情報を得られますか？'],
  ['tracking_power', 'プレイヤーの位置を追跡できますか？'], ['body_info_power', '死体から情報を得られますか？'],
  ['body_clear_power', '死体を消すことができますか？'], ['body_move_power', '死体を動かせますか？'],
  ['revenge_kill', '死亡・追放時に誰かを道連れにできますか？'], ['delayed_kill', '時間差でキルや死亡を発生させますか？'],
  ['teleport_power', 'テレポート能力がありますか？'], ['movement_power', '移動速度や移動方法を変える能力がありますか？'],
  ['area_effect', '周囲の複数人・範囲に影響する能力がありますか？'], ['conversion_power', '他プレイヤーの役職や陣営を変更できますか？'],
  ['can_win_alone', '単独勝利できる勝利条件を持ちますか？'], ['exile_win', '追放されることで勝利できますか？'],
  ['survival_requirement_power', '生存していることが勝利条件ですか？'], ['modifier_role', '追加属性（モディファイア）ですか？'],
  ['partner_power', 'ペア・相棒に関係する役職ですか？'], ['target_power', '特定の対象を選ぶ能力がありますか？']
];

async function load() {
  const [csv, verified, verifiedMods, registry] = await Promise.all([fetch('/data/roles-source.csv').then(r => r.text()), fetch('/data/vanilla-verified.json').then(r => r.json()), fetch('/data/mod-verified.json?v=20261123-tohk').then(r => r.json()), fetch('/data/mod-registry.json').then(r => r.json())]);
  state.registry = registry; const verifiedMap = new Map(verified.map(role => [role.name, role])); const verifiedModMap = new Map(verifiedMods.map(role => [`${role.mod}:${role.name}`, role]));
  state.roles = parseCsv(csv).map(raw => {
    const official = verifiedMap.get(raw.name);
    const modRecord = verifiedModMap.get(`${raw.mod}:${raw.name}`);
    if (official) return {...official, mod:'Vanilla', verified:true, verificationLabel:'公式確認済み', raw};
    if (modRecord) return {...modRecord, verified:true, verificationLabel:'MOD資料確認済み', raw};
    return {name:raw.name, displayName:raw.display_name || raw.name, mod:raw.mod, team:raw.team, raw, verified:false, verificationLabel:'MOD確認中'};
  });
  for (const role of verified) if (!state.roles.some(existing => existing.name === role.name)) state.roles.push({...role, mod:'Vanilla', verified:true, verificationLabel:'公式確認済み', raw:{}});
  state.filtered = state.roles; renderStats(); setupFilters(); renderRoles(); setupQuiz(); renderSources();
}
function renderStats() { const mods = new Set(state.roles.filter(r => r.mod !== 'Vanilla').map(r => r.mod)).size; $('#stats').innerHTML = `<span class="stat"><strong>${state.roles.length}</strong> 役職</span><span class="stat"><strong>${mods}</strong> MOD分類</span><span class="stat"><strong>${state.roles.filter(r=>r.verified).length}</strong> 資料確認済み</span>`; }
function setupFilters() {
  const mods = [...new Set(state.roles.map(r => r.mod))].sort((a,b) => a === 'Vanilla' ? -1 : a.localeCompare(b));
  $('#mod-filter').innerHTML = `<option value="all">すべての分類</option>${mods.map(mod => `<option value="${mod}">${mod === 'Vanilla' ? 'Vanilla（公式）' : (state.registry[mod]?.label || mod)}</option>`).join('')}`;
  const teams = [...new Set(state.roles.map(r => r.team))]; $('#team-filter').insertAdjacentHTML('beforeend', teams.map(team => `<option value="${team}">${teamJa(team)}</option>`).join(''));
  ['#search','#mod-filter','#team-filter'].forEach(selector => $(selector).addEventListener('input', renderRoles));
}
function renderRoles() {
  const term = $('#search').value.trim().toLocaleLowerCase(), mod = $('#mod-filter').value, team = $('#team-filter').value;
  state.filtered = state.roles.filter(role => (mod === 'all' || role.mod === mod) && (team === 'all' || role.team === team) && (`${role.name} ${role.displayName}`.toLowerCase().includes(term)));
  $('#result-count').textContent = `${state.filtered.length}件を表示`;
  $('#role-grid').innerHTML = state.filtered.map(role => `<button class="role-card" data-role="${role.mod}:${role.name}"><div class="badges"><span class="badge">${role.mod === 'Vanilla' ? 'Vanilla' : (state.registry[role.mod]?.label || role.mod)}</span><span class="badge ${role.verified?'verified':'pending'}">${role.verificationLabel}</span></div><h3>${role.displayName}</h3><p>${teamJa(role.team)}${role.verified ? ` · ${normalizeTerminology(role.description)}` : ' · CSV由来の能力フラグを保持'}</p></button>`).join('');
  document.querySelectorAll('[data-role]').forEach(button => button.addEventListener('click', () => openRole(button.dataset.role)));
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function renderDescription(description, team) {
  const cleaned = normalizeTerminology(description)
    .replace(/\u3000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/(ボタン能力(?:「[^」]+」)?[：:])\s*/g, '$1\n')
    .replace(/\s*・\s*/g, '\n・')
    .trim();
  const parts = cleaned.split(/\n+/).filter(Boolean);
  const intro = parts.filter(part => !part.startsWith('・'));
  const bullets = parts.filter(part => part.startsWith('・'));
  return `<div class="role-description">${intro.map((part, index) => `<p>${index === 0 && String(team || '').trim() ? `<strong>（${escapeHtml(teamJa(team))}）：</strong>` : ''}${escapeHtml(part)}</p>`).join('')}${bullets.length ? `<ul>${bullets.map(part => `<li>${escapeHtml(part.slice(1))}</li>`).join('')}</ul>` : ''}</div>`;
}
function renderSettings(settings) {
  const lines = String(settings || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const tableRows = lines.filter(line => line.startsWith('|')).filter(line => !/^\|?\s*[-:]+(?:\s*\|\s*[-:]+)+\s*\|?$/.test(line)).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
  const prose = lines.filter(line => !line.startsWith('|'));
  if (!tableRows.length && !prose.length) return '';
  const table = tableRows.length ? `<div class="settings-table-wrap"><table class="settings-table"><thead><tr>${tableRows[0].map(cell => `<th>${escapeHtml(normalizeTerminology(cell))}</th>`).join('')}</tr></thead>${tableRows.length > 1 ? `<tbody>${tableRows.slice(1).map(row => `<tr>${row.map(cell => `<td>${escapeHtml(normalizeTerminology(cell))}</td>`).join('')}</tr>`).join('')}</tbody>` : ''}</table></div>` : '';
  return `<section class="detail-section"><h3>設定</h3>${prose.length ? `<p>${prose.map(line => escapeHtml(normalizeTerminology(line))).join('<br>')}</p>` : ''}${table}</section>`;
}
function renderNotes(notes) { return notes ? `<section class="detail-section"><h3>補足・仕様</h3>${renderDescription(notes, ' ')}</section>` : ''; }
function openRole(key) {
  const [mod, name] = key.split(':'); const role = state.roles.find(item => item.name === name && item.mod === mod), source = role.verified ? `<a class="source-link" target="_blank" rel="noreferrer" href="${role.sourceUrl}">${role.source}</a>` : `<a class="source-link" target="_blank" rel="noreferrer" href="${state.registry[role.mod]?.url || '#'}">${state.registry[role.mod]?.label || role.mod} ${state.registry[role.mod]?.version || '出典未設定'}</a>`;
  const flags = role.verified ? `${renderDescription(role.description, role.team)}${role.abilities?.length ? `<section class="detail-section"><h3>能力</h3><ul class="detail-list">${role.abilities.map(a=>`<li>${escapeHtml(normalizeTerminology(a))}</li>`).join('')}</ul></section>` : ''}${renderSettings(role.settings)}${renderNotes(role.notes)}` : `<p>この役職は元CSV由来です。文章による能力説明は未検証のため、断定して表示しません。</p><h3>CSVで有効な能力フラグ</h3><ul class="detail-list">${Object.entries(role.raw).filter(([key,value]) => value === 'true' && !['team_crewmate','team_impostor','team_neutral','team_liberal','team_madmate','team_jackal'].includes(key)).slice(0,30).map(([key])=>`<li>${key}</li>`).join('') || '<li>確認待ち</li>'}</ul>`;
  $('#dialog-content').innerHTML = `<p class="eyebrow">${role.mod} · ${teamJa(role.team)}</p><h2>${role.displayName}</h2>${flags}<p class="muted">確認状況：${role.verified ? role.verificationLabel : 'MOD個別検証待ち'}</p><p>${source}</p>`; $('#role-dialog').showModal();
}
function setupQuiz() {
  const scopes = ['Vanilla', ...Object.keys(state.registry).filter(mod => state.roles.some(r=>r.mod===mod)), ...[...new Set(state.roles.map(r=>r.mod))].filter(mod=>mod !== 'Vanilla' && !state.registry[mod])];
  $('#quiz-scope').innerHTML = scopes.map(mod => `<option value="${mod}">${mod === 'Vanilla' ? 'Vanilla（公式確認済み）' : (state.registry[mod]?.label || mod)}</option>`).join('');
  $('#start-quiz').onclick = () => { state.scope = $('#quiz-scope').value; state.candidates = state.roles.filter(role => role.mod === state.scope); state.history = []; state.asked = []; $('#guess-setup').hidden = true; $('#quiz').hidden = false; renderQuiz(); };
  document.querySelectorAll('[data-answer]').forEach(button => button.onclick = () => answer(button.dataset.answer)); $('#undo').onclick=undo; $('#restart').onclick=()=>{ $('#guess-setup').hidden=false; $('#quiz').hidden=true; };
}
function scoreQuestion(question) {
  const answers = state.candidates.map(question.test);
  const yes = answers.filter(Boolean).length, no = answers.filter(value => !value).length;
  return {...question, score: Math.min(yes, no)};
}
function nameQuestions() {
  const tokens = new Set();
  state.candidates.forEach(role => {
    const name = role.displayName.replace(/\s/g, '');
    for (let size = 1; size <= Math.min(3, name.length); size++) for (let index = 0; index <= name.length - size; index++) tokens.add(name.slice(index, index + size));
  });
  return [...tokens].filter(token => token.length >= 2).map(token => ({
    id: `name:${token}`, label: `役職名に「${token}」を含みますか？`, priority: 1,
    test: role => role.displayName.includes(token)
  }));
}
function nextQuestion() {
  const abilityQuestions = questions.map(([key, label]) => ({
    id: `ability:${key}`, label, priority: 3, test: role => signals(role)[key] === true
  }));
  const teamQuestions = [...new Set(state.candidates.map(role => role.team))].map(team => ({
    id: `team:${team}`, label: `この役職は${teamJa(team)}陣営ですか？`, priority: 2, test: role => role.team === team
  }));
  const csvQuestions = detailQuestions.map(([field, label]) => ({
    id: `detail:${field}`, label, priority: 2, test: role => truth(role.raw?.[field]) === true
  }));
  const available = [...abilityQuestions, ...teamQuestions, ...csvQuestions]
    .filter(question => !state.asked.includes(question.id))
    .map(scoreQuestion)
    .filter(question => question.score > 0);
  if (available.length) return available.sort((a, b) => b.score - a.score || b.priority - a.priority)[0];
  const nameAvailable = nameQuestions().filter(question => !state.asked.includes(question.id)).map(scoreQuestion).filter(question => question.score > 0);
  if (nameAvailable.length) return nameAvailable.sort((a, b) => b.score - a.score)[0];
  const fallback = state.candidates.find(role => !state.asked.includes(`exact:${role.mod}:${role.name}`));
  return fallback ? {
    id: `exact:${fallback.mod}:${fallback.name}`,
    label: `役職名は「${fallback.displayName}」ですか？`, priority: 0,
    test: role => role.mod === fallback.mod && role.name === fallback.name, score: 1
  } : null;
}
function renderQuiz() {
  const question = nextQuestion();
  const names = state.candidates.slice(0,20).map(role => `<span class="candidate">${role.displayName}</span>`).join('');
  $('#quiz-progress').textContent = `候補 ${state.candidates.length}件 · ${state.scope}`;
  $('#question').textContent = state.candidates.length <= 1 ? (state.candidates[0] ? `答え：${state.candidates[0].displayName}` : '候補がありません。1問戻ってください。') : question ? question.label : '候補を確認してください。';
  document.querySelectorAll('[data-answer]').forEach(button => button.disabled = state.candidates.length <= 1 || !question);
  $('#candidates').innerHTML = names + (state.candidates.length > 20 ? `<span class="candidate">ほか ${state.candidates.length-20}件</span>` : '');
}
function answer(answerValue) {
  const question = nextQuestion(); if (!question) return;
  state.history.push({candidates:[...state.candidates], asked:[...state.asked]}); state.asked.push(question.id);
  if (answerValue !== 'unknown') state.candidates = state.candidates.filter(role => answerValue === 'yes' ? question.test(role) : !question.test(role));
  renderQuiz();
}
function undo() { if (state.history.length) { const previous = state.history.pop(); state.candidates = previous.candidates; state.asked = previous.asked; } renderQuiz(); }
function renderSources() { $('#mod-sources').innerHTML = Object.entries(state.registry).map(([code, mod]) => `<div><strong>${mod.label}</strong> (${code} / ${mod.version}) · <a target="_blank" rel="noreferrer" href="${mod.url}">指定リリース</a></div>`).join(''); }
$('#close-dialog').onclick=()=>$('#role-dialog').close();
load().catch(error => { document.body.innerHTML = `<main class="panel"><h1>データを読み込めませんでした</h1><p>${error.message}</p></main>`; });

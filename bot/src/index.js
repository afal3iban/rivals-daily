// Rivals Guess — Discord bot (race mode)
// Everyone in a channel hunts the same hero; each player gets 7 private guesses.
// Runs on Cloudflare Workers (HTTP interactions, no always-on server) with a D1 database.

import { HEROES as FALLBACK_HEROES } from './heroes.js';

const MAX_GUESSES = 7;
const EPHEMERAL = 64;
const COLOR = { brand: 0x7c5cff, win: 0x25a55f, lose: 0xa8324a, info: 0x00d4ff };
// Roster pictures are drawn by .github/workflows/roster.yml from bot/roster/index.html.
const ROSTER_URL = 'https://raw.githubusercontent.com/afal3iban/rivals-guess/main/bot/roster/';
const ROLES = [
  { role: 'Vanguard', key: 'v', file: 'vanguard', emoji: '🛡️', color: 0x4aa3ff },
  { role: 'Duelist', key: 'd', file: 'duelist', emoji: '⚔️', color: 0xff5a6e },
  { role: 'Strategist', key: 's', file: 'strategist', emoji: '💚', color: 0x3fd18f },
];

/* ---------------- heroes: loaded from the website so there is one roster to maintain ---------------- */
let heroCache = { at: 0, list: null };
async function getHeroes(env) {
  if (heroCache.list && Date.now() - heroCache.at < 3600_000) return heroCache.list;
  try {
    const r = await fetch((env.SITE_URL || '').replace(/\/?$/, '/') + 'heroes.js', { cf: { cacheTtl: 600 } });
    if (r.ok) {
      const txt = await r.text();
      const start = txt.indexOf('[', txt.indexOf('const HEROES'));   // skip the "roles []" in the header comment
      const list = JSON.parse(txt.slice(start, txt.lastIndexOf(']') + 1));
      if (Array.isArray(list) && list.length) { heroCache = { at: Date.now(), list }; return list; }
    }
  } catch (e) { /* fall through to the bundled copy */ }
  heroCache = { at: Date.now(), list: FALLBACK_HEROES };
  return FALLBACK_HEROES;
}
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const findHero = (list, name) => list.find(h => norm(h.name) === norm(name));

/* ---------------- comparison (same rules as the website) ---------------- */
function compareSet(a, b) {
  const A = new Set(a.map(norm)), B = new Set(b.map(norm));
  let hit = 0; A.forEach(v => { if (B.has(v)) hit++; });
  if (!hit) return 'b';
  return (A.size === B.size && hit === A.size) ? 'g' : 'o';
}
const SQ = { g: '🟩', o: '🟧', b: '🟥' };
function rowParts(h, ans) {
  const year = h.year === ans.year ? '🟩' : (ans.year > h.year ? '⬆️' : '⬇️');
  return {
    gender: SQ[h.gender === ans.gender ? 'g' : 'b'], role: SQ[compareSet(h.roles, ans.roles)],
    team: SQ[compareSet(h.teams, ans.teams)], origin: SQ[h.origin === ans.origin ? 'g' : 'b'], year,
  };
}
const emojiRow = (h, ans) => { const p = rowParts(h, ans); return p.gender + p.role + p.team + p.origin + p.year; };
function detailLine(h, ans) {
  const p = rowParts(h, ans);
  return `${p.gender} ${h.gender}  ·  ${p.role} ${h.roles.join('/')}  ·  ${p.team} ${h.teams.join(', ')}  ·  ${p.origin} ${h.origin}  ·  ${p.year} ${h.year}`;
}

/* ---------------- portraits (community wiki; path is md5 of the file name) ---------------- */
const PORTRAIT_NAME = { 'Gorr the God Butcher': 'Gorr' };
function portraitUrl(name) {
  const f = ((PORTRAIT_NAME[name] || name) + ' Main Page Portrait.png').replace(/ /g, '_');
  const h = md5(f);
  return `https://static.wikia.nocookie.net/marvel-rivals/images/${h[0]}/${h.slice(0, 2)}/${encodeURI(f)}?width=220`;
}
function md5(str) {
  function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
  function au(x, y) { const l = (x & 0xFFFF) + (y & 0xFFFF), m = (x >> 16) + (y >> 16) + (l >> 16); return (m << 16) | (l & 0xFFFF); }
  function cmn(q, a, b, x, s, t) { return au(rl(au(au(a, q), au(x, t)), s), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  const bytes = new TextEncoder().encode(str);
  const n = ((bytes.length + 8) >> 6) + 1, x = new Array(n * 16).fill(0);
  let i; for (i = 0; i < bytes.length; i++) x[i >> 2] |= bytes[i] << ((i % 4) * 8);
  x[i >> 2] |= 0x80 << ((i % 4) * 8); x[n * 16 - 2] = bytes.length * 8;
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  const K = [
    [ff, [[0,7,-680876936],[1,12,-389564586],[2,17,606105819],[3,22,-1044525330],[4,7,-176418897],[5,12,1200080426],[6,17,-1473231341],[7,22,-45705983],[8,7,1770035416],[9,12,-1958414417],[10,17,-42063],[11,22,-1990404162],[12,7,1804603682],[13,12,-40341101],[14,17,-1502002290],[15,22,1236535329]]],
    [gg, [[1,5,-165796510],[6,9,-1069501632],[11,14,643717713],[0,20,-373897302],[5,5,-701558691],[10,9,38016083],[15,14,-660478335],[4,20,-405537848],[9,5,568446438],[14,9,-1019803690],[3,14,-187363961],[8,20,1163531501],[13,5,-1444681467],[2,9,-51403784],[7,14,1735328473],[12,20,-1926607734]]],
    [hh, [[5,4,-378558],[8,11,-2022574463],[11,16,1839030562],[14,23,-35309556],[1,4,-1530992060],[4,11,1272893353],[7,16,-155497632],[10,23,-1094730640],[13,4,681279174],[0,11,-358537222],[3,16,-722521979],[6,23,76029189],[9,4,-640364487],[12,11,-421815835],[15,16,530742520],[2,23,-995338651]]],
    [ii, [[0,6,-198630844],[7,10,1126891415],[14,15,-1416354905],[5,21,-57434055],[12,6,1700485571],[3,10,-1894986606],[10,15,-1051523],[1,21,-2054922799],[8,6,1873313359],[15,10,-30611744],[6,15,-1560198380],[13,21,1309151649],[4,6,-145523070],[11,10,-1120210379],[2,15,718787259],[9,21,-343485551]]],
  ];
  for (let o = 0; o < x.length; o += 16) {
    const oa = a, ob = b, oc = c, od = d;
    for (const [fn, steps] of K) steps.forEach(([k, s, t], j) => {
      const r = fn(...[[a, b, c, d], [d, a, b, c], [c, d, a, b], [b, c, d, a]][j % 4], x[o + k], s, t);
      if (j % 4 === 0) a = r; else if (j % 4 === 1) d = r; else if (j % 4 === 2) c = r; else b = r;
    });
    a = au(a, oa); b = au(b, ob); c = au(c, oc); d = au(d, od);
  }
  const hex = n => { let s = ''; for (let j = 0; j < 4; j++) s += ((n >> (j * 8 + 4)) & 15).toString(16) + ((n >> (j * 8)) & 15).toString(16); return s; };
  return hex(a) + hex(b) + hex(c) + hex(d);
}

/* ---------------- roster pictures + pick menus ---------------- */
const byRole = (heroes, role) => heroes.filter(h => h.roles.includes(role)).sort((a, b) => a.name.localeCompare(b.name));

function rosterEmbeds(heroes, env) {
  const base = (env.ROSTER_URL || ROSTER_URL).replace(/\/?$/, '/');
  return ROLES.map(R => {
    const list = byRole(heroes, R.role);
    return {
      color: R.color,
      title: `${R.emoji} ${R.role}s (${list.length})`,
      description: list.map(h => h.name).join(' · '),          // plain text so names are easy to copy
      image: { url: `${base}${R.file}.jpg?v=${md5(list.map(h => h.name).join('|')).slice(0, 8)}` },
    };
  });
}

/* ---------------- database ---------------- */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS rounds (channel_id TEXT PRIMARY KEY, guild_id TEXT, round_id TEXT, hero TEXT,
     started_at INTEGER, started_by TEXT, solved INTEGER DEFAULT 0, recent TEXT DEFAULT '[]')`,
  `CREATE TABLE IF NOT EXISTS attempts (round_id TEXT, user_id TEXT, guesses TEXT DEFAULT '[]',
     done INTEGER DEFAULT 0, won INTEGER DEFAULT 0, PRIMARY KEY (round_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS scores (guild_id TEXT, user_id TEXT, name TEXT, played INTEGER DEFAULT 0,
     wins INTEGER DEFAULT 0, total INTEGER DEFAULT 0, streak INTEGER DEFAULT 0, best INTEGER DEFAULT 0,
     PRIMARY KEY (guild_id, user_id))`,
];
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.map(s => env.DB.prepare(s)));
  schemaReady = true;
}

/* ---------------- Discord helpers ---------------- */
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const reply = (data) => json({ type: 4, data });
const ephemeral = (data) => reply({ ...data, flags: EPHEMERAL });
const userName = (i) => { const u = (i.member && i.member.user) || i.user || {}; return u.global_name || u.username || 'Someone'; };
const userId = (i) => ((i.member && i.member.user) || i.user || {}).id;
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10] || 'th');

function hexToBytes(hex) { const out = new Uint8Array(hex.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16); return out; }
async function verifyDiscord(request, body, publicKey) {
  const sig = request.headers.get('x-signature-ed25519'), ts = request.headers.get('x-signature-timestamp');
  if (!sig || !ts || !publicKey) return false;
  const data = new TextEncoder().encode(ts + body);
  try {
    const key = await crypto.subtle.importKey('raw', hexToBytes(publicKey), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, hexToBytes(sig), data);
  } catch (e) {
    // older Workers runtimes only know the NODE-ED25519 spelling
    const key = await crypto.subtle.importKey('raw', hexToBytes(publicKey), { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' }, false, ['verify']);
    return await crypto.subtle.verify('NODE-ED25519', key, hexToBytes(sig), data);
  }
}
async function followUp(env, token, data) {
  // public message in the channel after a private (ephemeral) reply
  const r = await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${token}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!r.ok) console.log('follow-up failed', r.status, await r.text());
}

/* ---------------- commands ---------------- */
export const COMMANDS = [
  { name: 'rivals', type: 1, description: 'Start a new round — everyone guesses the same Marvel Rivals hero' },
  { name: 'guess', type: 1, description: `Guess this round's hero (you get ${MAX_GUESSES} guesses)`,
    options: [{ type: 3, name: 'hero', description: 'Hero name', required: true, autocomplete: true }] },
  { name: 'leaderboard', type: 1, description: 'Top Rivals Guess players in this server' },
];

async function cmdRivals(i, env) {
  const heroes = await getHeroes(env);
  const channel = i.channel_id || (i.channel && i.channel.id), guild = i.guild_id || 'dm';
  const prev = await env.DB.prepare('SELECT * FROM rounds WHERE channel_id=?').bind(channel).first();
  let recent = []; try { recent = JSON.parse((prev && prev.recent) || '[]'); } catch (e) {}
  const pool = heroes.filter(h => !recent.includes(h.name));
  const hero = (pool.length ? pool : heroes)[Math.floor(Math.random() * (pool.length || heroes.length))];
  recent = [hero.name, ...recent.filter(n => n !== hero.name)].slice(0, Math.min(20, heroes.length - 1));
  const now = Date.now(), roundId = `${channel}:${now}`;
  await env.DB.prepare(`INSERT INTO rounds (channel_id, guild_id, round_id, hero, started_at, started_by, solved, recent)
      VALUES (?,?,?,?,?,?,0,?) ON CONFLICT(channel_id) DO UPDATE SET guild_id=excluded.guild_id, round_id=excluded.round_id,
      hero=excluded.hero, started_at=excluded.started_at, started_by=excluded.started_by, solved=0, recent=excluded.recent`)
    .bind(channel, guild, roundId, hero.name, now, userName(i), JSON.stringify(recent)).run();

  const lines = [
    `Everyone hunts **the same hero**. Type \`/guess\` and start typing a hero name — you get **${MAX_GUESSES} guesses**, and they're private.`,
    'Each guess shows 🟩 match · 🟧 partly · 🟥 no match · ⬆️⬇️ release year.',
  ];
  if (prev && prev.hero) lines.push(`\nLast round's hero was **${prev.hero}**` + (prev.solved ? ` — solved by ${prev.solved}.` : ' — nobody got it!'));
  if (env.SITE_URL) lines.push(`\nPractice solo: ${env.SITE_URL}`);
  return reply({
    embeds: [{ title: '🦸 New Rivals round!', description: lines.join('\n'), color: COLOR.brand,
      footer: { text: `Started by ${userName(i)}` } }, ...rosterEmbeds(heroes, env)],
  });
}

async function cmdGuess(i, env, ctx) {
  const opt = (i.data.options || []).find(o => o.name === 'hero');
  return playGuess(i, env, ctx, opt && opt.value);
}

async function playGuess(i, env, ctx, heroName) {
  const heroes = await getHeroes(env);
  const channel = i.channel_id || (i.channel && i.channel.id), guild = i.guild_id || 'dm', uid = userId(i), name = userName(i);
  const round = await env.DB.prepare('SELECT * FROM rounds WHERE channel_id=?').bind(channel).first();
  if (!round) return ephemeral({ content: 'No round running in this channel yet — start one with `/rivals`.' });
  const answer = findHero(heroes, round.hero);
  const hero = findHero(heroes, heroName);
  if (!hero) return ephemeral({ content: `I don't know a hero called **${heroName || '?'}**. Pick one from the list as you type.` });

  const att = await env.DB.prepare('SELECT * FROM attempts WHERE round_id=? AND user_id=?').bind(round.round_id, uid).first();
  let guesses = []; try { guesses = JSON.parse((att && att.guesses) || '[]'); } catch (e) {}
  if (att && att.done) return ephemeral({ content: att.won ? `You already solved this round in **${guesses.length}/${MAX_GUESSES}**. Wait for someone to start a new one with \`/rivals\`.` : `You're out of guesses for this round. Start a new one with \`/rivals\`.` });
  if (guesses.includes(hero.name)) return ephemeral({ content: `You already guessed **${hero.name}**.` });

  guesses.push(hero.name);
  const won = hero.name === answer.name, lost = !won && guesses.length >= MAX_GUESSES, done = won || lost;
  const writes = [env.DB.prepare(`INSERT INTO attempts (round_id, user_id, guesses, done, won) VALUES (?,?,?,?,?)
      ON CONFLICT(round_id, user_id) DO UPDATE SET guesses=excluded.guesses, done=excluded.done, won=excluded.won`)
    .bind(round.round_id, uid, JSON.stringify(guesses), done ? 1 : 0, won ? 1 : 0)];
  let place = 0;
  if (done) {
    writes.push(env.DB.prepare(`INSERT INTO scores (guild_id, user_id, name, played, wins, total, streak, best)
        VALUES (?,?,?,1,?,?,?,?) ON CONFLICT(guild_id, user_id) DO UPDATE SET name=excluded.name, played=played+1,
        wins=wins+excluded.wins, total=total+excluded.total,
        streak=CASE WHEN excluded.wins=1 THEN streak+1 ELSE 0 END,
        best=MAX(best, CASE WHEN excluded.wins=1 THEN streak+1 ELSE 0 END)`)
      .bind(guild, uid, name, won ? 1 : 0, won ? guesses.length : 0, won ? 1 : 0, won ? 1 : 0));
    if (won) writes.push(env.DB.prepare('UPDATE rounds SET solved=solved+1 WHERE channel_id=? AND round_id=?').bind(channel, round.round_id));
  }
  await env.DB.batch(writes);
  if (won) { const r = await env.DB.prepare('SELECT solved FROM rounds WHERE channel_id=?').bind(channel).first(); place = (r && r.solved) || 1; }

  const board = guesses.map(g => findHero(heroes, g)).filter(Boolean);
  const grid = board.map(h => emojiRow(h, answer)).join('\n');
  const fields = board.map((h, k) => ({ name: `${k + 1}. ${h.name}`, value: detailLine(h, answer) }));

  let out;
  if (won) {
    ctx.waitUntil(followUp(env, i.token, { embeds: [{ color: COLOR.win,
      description: `🏆 **${name}** solved it in **${guesses.length}/${MAX_GUESSES}** — ${ordinal(place)} to get it!\n${grid}` }] }));
    out = { embeds: [{ color: COLOR.win, title: `🎉 It's ${answer.name}! Solved in ${guesses.length}/${MAX_GUESSES}`,
      thumbnail: { url: portraitUrl(answer.name) }, fields }] };
  } else if (lost) {
    ctx.waitUntil(followUp(env, i.token, { embeds: [{ color: COLOR.lose,
      description: `💀 **${name}** ran out of guesses.\n${grid}` }] }));
    out = { embeds: [{ color: COLOR.lose, title: `Out of guesses — it was ${answer.name}`,
      description: "Keep it quiet so the others can still play!", thumbnail: { url: portraitUrl(answer.name) }, fields }] };
  } else {
    const left = MAX_GUESSES - guesses.length;
    out = { embeds: [{ color: COLOR.info, title: `Guess ${guesses.length}/${MAX_GUESSES} — ${left} left`,
      description: 'Gender · Role · Team · Origin · Year', fields }] };
  }
  return ephemeral(out);
}

async function cmdLeaderboard(i, env) {
  const guild = i.guild_id || 'dm';
  const { results } = await env.DB.prepare(`SELECT * FROM scores WHERE guild_id=? AND played>0
      ORDER BY wins DESC, CASE WHEN wins>0 THEN total*1.0/wins ELSE 99 END ASC LIMIT 10`).bind(guild).all();
  if (!results || !results.length) return reply({ content: 'No finished rounds yet — start one with `/rivals`!' });
  const medal = ['🥇', '🥈', '🥉'];
  const lines = results.map((r, k) => {
    const pct = Math.round(100 * r.wins / r.played), avg = r.wins ? (r.total / r.wins).toFixed(1) : '–';
    return `${medal[k] || `**${k + 1}.**`} **${r.name}** — ${r.wins} win${r.wins === 1 ? '' : 's'} · ${pct}% · avg ${avg}` + (r.streak > 1 ? ` · 🔥${r.streak}` : '');
  });
  return reply({ embeds: [{ title: '🏆 Rivals Guess leaderboard', description: lines.join('\n'), color: COLOR.brand }] });
}

async function autocomplete(i, env) {
  const heroes = await getHeroes(env);
  const focused = ((i.data.options || []).find(o => o.focused) || {}).value || '';
  const q = norm(focused);
  const list = heroes.filter(h => norm(h.name).includes(q))
    .sort((a, b) => (norm(a.name).startsWith(q) ? 0 : 1) - (norm(b.name).startsWith(q) ? 0 : 1) || a.name.localeCompare(b.name))
    .slice(0, 25);
  return json({ type: 8, data: { choices: list.map(h => ({ name: h.name, value: h.name })) } });
}

/* ---------------- setup page: creates tables + registers slash commands ---------------- */
async function register(env) {
  await ensureSchema(env);
  if (!env.DISCORD_TOKEN || !env.DISCORD_APPLICATION_ID) {
    return new Response('Missing DISCORD_TOKEN secret or DISCORD_APPLICATION_ID variable.', { status: 500 });
  }
  const r = await fetch(`https://discord.com/api/v10/applications/${env.DISCORD_APPLICATION_ID}/commands`, {
    method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bot ${env.DISCORD_TOKEN}` },
    body: JSON.stringify(COMMANDS),
  });
  const text = await r.text();
  if (!r.ok) return new Response(`Discord refused the commands (${r.status}):\n${text}`, { status: 502 });
  return new Response(`Registered ${JSON.parse(text).length} commands: /rivals, /guess, /leaderboard. Database ready.`, { status: 200 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if (url.pathname === '/register') return register(env);
      return new Response('Rivals Guess bot is running.', { status: 200 });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const body = await request.text();
    if (!(await verifyDiscord(request, body, env.DISCORD_PUBLIC_KEY))) return new Response('Bad request signature', { status: 401 });
    const i = JSON.parse(body);

    if (i.type === 1) return json({ type: 1 });                    // Discord's endpoint check
    await ensureSchema(env);
    try {
      if (i.type === 4) return await autocomplete(i, env);
      // menus from older round messages: point people back to the search
      if (i.type === 3) return ephemeral({ content: 'Guess with `/guess` — start typing a hero name and pick it from the list.' });
      if (i.type === 2) {
        if (i.data.name === 'rivals') return await cmdRivals(i, env);
        if (i.data.name === 'guess') return await cmdGuess(i, env, ctx);
        if (i.data.name === 'leaderboard') return await cmdLeaderboard(i, env);
      }
      return ephemeral({ content: 'Unknown command.' });
    } catch (e) {
      console.log('error', e && e.stack || e);
      return ephemeral({ content: 'Something went wrong — try again in a moment.' });
    }
  },
};

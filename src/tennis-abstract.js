import * as cheerio from 'cheerio';

const DEFAULT_BASE_URL = 'https://www.tennisabstract.com';
const PROJECTION_NAMES = ['proj128', 'proj96', 'proj64', 'proj56', 'proj48', 'proj32', 'proj28', 'proj16', 'proj8', 'proj4', 'proj2'];
const ROUND_NAMES = new Set(['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F', 'W']);

function decodeScriptString(value) {
	return value
		.replace(/\\'/g, "'")
		.replace(/\\"/g, '"')
		.replace(/\\n/g, '\n')
		.replace(/\\r/g, '\r')
		.replace(/\\t/g, '\t')
		.replace(/\\\\/g, '\\');
}

function normalize(value) {
	return String(value || '')
		.toLocaleLowerCase('en-US')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '');
}

export function extractVariables(html) {
	const variables = new Map();
	const pattern = /\bvar\s+([A-Za-z_$][\w$]*)\s*=\s*(?:'((?:\\.|[^'])*)'|"((?:\\.|[^"])*)")\s*;/g;
	let match;

	while ((match = pattern.exec(html)) !== null) {
		variables.set(match[1], decodeScriptString(match[2] ?? match[3] ?? ''));
	}

	return variables;
}

export function discoverCurrentTournaments(html, baseUrl = DEFAULT_BASE_URL) {
	const pattern = /href=["'](?:https?:\/\/www\.tennisabstract\.com)?\/current\/(\d{4})(ATP|WTA)([^"']+)\.html["']/gi;
	const tournaments = new Map();
	let match;

	while ((match = pattern.exec(html)) !== null) {
		const [path, year, tour, name] = match;
		const href = path.match(/href=["']([^"']+)/i)?.[1];
		const url = new URL(href, baseUrl).href;

		if (!tournaments.has(url)) {
			tournaments.set(url, { year: Number(year), tour: tour.toUpperCase(), name, url });
		}
	}

	return [...tournaments.values()];
}

function parseProjection(tableHtml) {
	if (!tableHtml) return { rounds: [], players: [] };

	const $ = cheerio.load(tableHtml);
	const rounds = [];
	const players = [];

	$('tr').each((_, row) => {
		const cells = $(row).find('td').toArray();
		const labels = cells.map(cell => $(cell).text().replace(/\u00a0/g, ' ').trim());
		const rowRounds = labels.filter(label => ROUND_NAMES.has(label));

		if (rowRounds.length) {
			if (!rounds.length) rounds.push(...rowRounds);
			return;
		}

		const playerLink = $(row).find('a[href*="player.cgi?p="]').first();
		if (!playerLink.length) return;

		const href = playerLink.attr('href') || '';
		const id = href.match(/[?&]p=(\d+)/)?.[1] ?? null;
		const firstCellText = labels[0] || '';
		const marker = firstCellText.match(/^\(([^)]+)\)/)?.[1] ?? null;
		const country = firstCellText.match(/\(([A-Z]{3})\)\s*$/)?.[1] ?? null;
		const percentages = labels
			.slice(1)
			.filter(value => /^\d+(?:\.\d+)?%$/.test(value))
			.map(value => Number(value.slice(0, -1)));
		const probabilities = {};

		rounds.forEach((round, index) => {
			probabilities[round] = percentages[index] ?? null;
		});

		players.push({
			id,
			name: playerLink.text().trim(),
			country,
			seed: marker && /^\d+$/.test(marker) ? Number(marker) : null,
			entry: marker && !/^\d+$/.test(marker) ? marker : null,
			probabilities
		});
	});

	return { rounds, players };
}

function parseMatchLines(value) {
	return String(value || '')
		.split(/<br\s*\/?>/i)
		.map(fragment => fragment.trim())
		.filter(fragment => fragment && fragment !== '&nbsp;')
		.map(fragment => {
			const $ = cheerio.load(fragment);
			const text = $.root().text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
			const players = [];

			$('a[href*="player.cgi?p="]').each((_, link) => {
				const name = $(link).text().trim();
				const id = ($(link).attr('href') || '').match(/[?&]p=(\d+)/)?.[1] ?? null;

				if (!name || /^\[.*\]$/.test(name) || name === 'd.' || players.some(player => player.id === id)) return;
				players.push({ id, name });
			});

			return {
				round: text.match(/^([^:]+):/)?.[1] ?? null,
				players,
				text
			};
		});
}

export function inspectHtml(html, url) {
	const variables = extractVariables(html);
	const playerIds = new Set([...html.matchAll(/[?&]p=(\d+)/g)].map(match => match[1]));

	return {
		url,
		bytes: Buffer.byteLength(html),
		variables: [...variables.keys()].sort(),
		tables: (html.match(/<table\b/gi) || []).length,
		playerLinks: playerIds.size,
		tournamentLinks: discoverCurrentTournaments(html, url).length
	};
}

export function parseTournament(html, url) {
	const variables = extractVariables(html);
	const title = cheerio.load(html)('title').text().trim();
	const drawVariable = PROJECTION_NAMES.find(name => variables.has(name));
	const draw = parseProjection(drawVariable ? variables.get(drawVariable) : '');
	const forecast = parseProjection(variables.get('projCurrent'));

	return {
		url,
		title,
		draw: drawVariable,
		players: draw.players.map(({ probabilities, ...player }) => player),
		forecast,
		matches: {
			upcoming: parseMatchLines(variables.get('upcomingSingles')),
			completed: parseMatchLines(variables.get('completedSingles'))
		},
		variables: [...variables.keys()].sort()
	};
}

export function parseRankings(html, url) {
	const $ = cheerio.load(html);
	const players = [];

	$('#reportable tr').each((_, row) => {
		const cells = $(row).find('td').toArray();
		if (cells.length < 4) return;

		const rank = Number($(cells[0]).text().trim());
		const playerLink = $(cells[1]).find('a[href*="player.cgi?p="]').first();
		if (!Number.isInteger(rank) || !playerLink.length) return;

		const playerUrl = new URL(playerLink.attr('href'), url).href;
		const taId = new URL(playerUrl).searchParams.get('p');

		players.push({
			rank,
			name: playerLink.text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(),
			country: $(cells[2]).text().trim() || null,
			birthdate: $(cells[3]).text().trim() || null,
			taId,
			url: playerUrl
		});
	});

	const pageText = $('body').text().replace(/\s+/g, ' ');

	return {
		source: 'TA',
		type: 'official',
		updated: pageText.match(/Last update:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? null,
		url,
		players
	};
}

function uniqueHeaders(headers) {
	const counts = new Map();

	return headers.map((header, index) => {
		const base = header || `column_${index + 1}`;
		const count = (counts.get(base) || 0) + 1;
		counts.set(base, count);
		return count === 1 ? base : `${base}_${count}`;
	});
}

export function parseTables(html) {
	const $ = cheerio.load(html);
	const tables = [];

	$('table').each((index, table) => {
		// TA often wraps report tables in layout tables. Only parse leaf tables and
		// direct rows/cells so an outer table cannot swallow the complete report.
		if ($(table).find('table').length > 0) return;
		const rowsInTable = $(table).children('thead, tbody, tfoot').children('tr').add($(table).children('tr'));
		const headerRow = rowsInTable.filter((_, row) => $(row).children('th').length > 0).first();
		const directRows = rowsInTable.toArray();
		const widest = Math.max(0, ...directRows.map(row => $(row).children('td').length));
		if (!headerRow.length && widest < 3) return;

		let headers;
		let inferredHeader = null;
		if (headerRow.length) {
			headers = uniqueHeaders(headerRow.children('th').toArray().map(cell => $(cell).text().replace(/\s+/g, ' ').trim()));
		} else {
			const candidates = directRows.filter(row => $(row).children('td').length === widest);
			const firstValues = candidates[0] ? $(candidates[0]).children('td').toArray().map(cell => $(cell).text().replace(/\s+/g, ' ').trim()) : [];
			const secondFirst = candidates[1] ? $(candidates[1]).children('td').first().text().trim() : '';
			const looksLikeHeader = candidates[0] === directRows[0] && !/^\d+$/.test(firstValues[0] || '') && /^\d+$/.test(secondFirst);
			if (looksLikeHeader) inferredHeader = candidates[0];
			headers = looksLikeHeader
				? uniqueHeaders(firstValues)
				: Array.from({ length: widest }, (_, cellIndex) => `column_${cellIndex + 1}`);
		}
		const rows = [];

		rowsInTable.each((_, row) => {
			if (row === inferredHeader) return;
			const cells = $(row).children('td').toArray();
			if (!cells.length || (!headerRow.length && cells.length !== widest)) return;

			const values = cells.map(cell => $(cell).text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim());
			const record = {};
			headers.forEach((header, cellIndex) => {
				record[header] = values[cellIndex] || null;
			});
			rows.push(record);
		});

		if (!rows.length) return;
		const id = $(table).attr('id') || `table-${index + 1}`;
		const heading = $(`#${id}-h`).first().text().replace(/Top$/i, '').replace(/\s+/g, ' ').trim();
		tables.push({ id, title: heading || id, headers, totalRows: rows.length, rows });
	});

	return tables;
}

export function parseReport(html, url, name) {
	const $ = cheerio.load(html);
	const pageText = $('body').text().replace(/\s+/g, ' ');

	return {
		source: 'TA',
		name,
		title: $('title').text().trim(),
		updated: pageText.match(/Last update:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? null,
		url,
		tables: parseTables(html)
	};
}

function literalVariables(html) {
	const values = new Map();
	const pattern = /\bvar\s+([A-Za-z_$][\w$]*)\s*=\s*(?:'((?:\\.|[^'])*)'|"((?:\\.|[^"])*)"|(-?\d+(?:\.\d+)?))\s*;/g;
	let match;

	while ((match = pattern.exec(html)) !== null) {
		const raw = match[2] ?? match[3];
		values.set(match[1], raw == null ? Number(match[4]) : decodeScriptString(raw));
	}

	return values;
}

function compactDate(value) {
	const text = String(value || '');
	return /^\d{8}$/.test(text) ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6)}` : null;
}

export function parsePlayer(profileHtml, fragmentJavaScript, url) {
	const variables = literalVariables(profileHtml);
	const fragment = fragmentJavaScript.match(/\bvar\s+player_frag\s*=\s*`([\s\S]*?)`\s*;/)?.[1] ?? '';
	const profile = {
		name: variables.get('fullname') ?? null,
		country: variables.get('country') ?? null,
		birthdate: compactDate(variables.get('dob')),
		heightCm: variables.get('ht') || null,
		hand: variables.get('hand') ?? null,
		backhand: variables.get('backhand') ?? null,
		active: variables.get('active') === 1,
		rank: variables.get('currentrank') || null,
		peakRank: variables.get('peakrank') || null,
		peakRankFirstDate: compactDate(variables.get('peakfirst')),
		atpId: variables.get('atp_id') ?? null,
		taId: variables.get('nameparam') ?? null,
		elo: {
			rank: Number(variables.get('elo_rank')) || null,
			rating: Number(variables.get('elo_rating')) || null
		},
		twitter: variables.get('twitter') || null,
		wikipedia: variables.get('wiki_id') || null,
		url
	};

	const tables = parseTables(fragment).map(table => {
		if (table.id !== 'year-end-rankings') return table;
		const doublesIndex = table.headers.findIndex(header => header.startsWith('Doubles:'));
		if (doublesIndex < 0) return table;
		const headers = table.headers.slice(0, doublesIndex);
		return {
			...table,
			headers,
			rows: table.rows.map(row => Object.fromEntries(headers.map(header => [header, row[header]])))
		};
	});

	return { source: 'TA', profile, tables };
}

export function parsePlayerNames(javaScript) {
	const literal = javaScript.match(/\bvar\s+playerlist\s*=\s*(\[[\s\S]*?\])\s*;/)?.[1];
	if (!literal) throw new Error('Could not parse the Tennis Abstract player index.');
	return JSON.parse(literal)
		.filter(value => value.startsWith('(M) '))
		.map(value => value.slice(4));
}

export function resolvePlayerName(target, names) {
	const query = normalize(target);
	if (query.length < 2) throw new Error(`Player search "${target}" is too short.`);
	const exact = names.filter(name => normalize(name) === query);
	if (exact.length === 1) return exact[0];

	const surname = names.filter(name => normalize(name.split(/\s+/).at(-1)) === query);
	if (surname.length === 1) return surname[0];
	if (surname.length > 1) {
		throw new Error(`Ambiguous ATP player "${target}": ${surname.slice(0, 8).join(', ')}. Use the full name.`);
	}

	const partial = names.filter(name => {
		const normalizedName = normalize(name);
		const normalizedSurname = normalize(name.split(/\s+/).at(-1));
		return normalizedSurname.startsWith(query) || normalizedName.startsWith(query);
	});
	if (partial.length === 1) return partial[0];
	if (partial.length > 1) {
		throw new Error(`Ambiguous ATP player "${target}": ${partial.slice(0, 8).join(', ')}. Type more of the name.`);
	}
	throw new Error(`Could not find ATP player "${target}" in the Tennis Abstract player index.`);
}

export async function fetchPlayer(target, { baseUrl = DEFAULT_BASE_URL } = {}) {
	let profileUrl = /^https?:\/\//i.test(target)
		? target
		: new URL(`/cgi-bin/player.cgi?p=${encodeURIComponent(target.replace(/\s+/g, ''))}`, baseUrl).href;
	let profileHtml = await fetchHtml(profileUrl);
	let $ = cheerio.load(profileHtml);
	let fragmentUrl = $('script[src*="/jsfrags/"]').attr('src');

	if (!fragmentUrl && !/^https?:\/\//i.test(target)) {
		const rankingsUrl = new URL('/reports/atpRankings.html', baseUrl).href;
		const rankedNames = parseRankings(await fetchHtml(rankingsUrl), rankingsUrl).players.map(player => player.name);
		let fullName;
		try {
			fullName = resolvePlayerName(target, rankedNames);
		} catch {
			const indexUrl = new URL('/jsplayers/mwplayerlist.js', baseUrl).href;
			fullName = resolvePlayerName(target, parsePlayerNames(await fetchHtml(indexUrl)));
		}
		profileUrl = new URL(`/cgi-bin/player.cgi?p=${encodeURIComponent(fullName.replace(/\s+/g, ''))}`, baseUrl).href;
		profileHtml = await fetchHtml(profileUrl);
		$ = cheerio.load(profileHtml);
		fragmentUrl = $('script[src*="/jsfrags/"]').attr('src');
	}

	if (!fragmentUrl) throw new Error(`No ATP singles data fragment found for "${target}".`);
	const fragmentJavaScript = await fetchHtml(new URL(fragmentUrl, baseUrl).href);
	return parsePlayer(profileHtml, fragmentJavaScript, profileUrl);
}

export async function fetchHtml(url, { timeout = 30000 } = {}) {
	const response = await fetch(url, {
		headers: {
			Accept: 'text/html,application/xhtml+xml',
			'User-Agent': 'ta-explorer/1.0 (+https://github.com/meg768/ta-explorer)'
		},
		signal: AbortSignal.timeout(timeout)
	});

	if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
	return await response.text();
}

export async function findTournament(target, { baseUrl = DEFAULT_BASE_URL } = {}) {
	if (/^https?:\/\//i.test(target)) return { name: null, url: target };

	const homeUrl = new URL('/', baseUrl).href;
	const tournaments = discoverCurrentTournaments(await fetchHtml(homeUrl), baseUrl);
	const tournament = tournaments.find(item => item.tour === 'ATP' && normalize(item.name) === normalize(target));

	if (!tournament) {
		throw new Error(`Could not find current ATP tournament "${target}".`);
	}

	return tournament;
}

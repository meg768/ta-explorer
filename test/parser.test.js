import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { discoverCurrentTournaments, inspectHtml, parsePlayer, parsePlayerNames, parseRankings, parseReport, parseTournament, resolvePlayerName } from '../src/tennis-abstract.js';

const fixture = name => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('discovers current ATP and WTA tournaments', async () => {
	const tournaments = discoverCurrentTournaments(await fixture('home.html'));

	assert.deepEqual(tournaments.map(({ tour, name }) => ({ tour, name })), [
		{ tour: 'ATP', name: 'Kitzbuhel' },
		{ tour: 'ATP', name: 'Estoril' },
		{ tour: 'WTA', name: 'Prague' }
	]);
});

test('parses tournament draw, forecast, and matches', async () => {
	const html = await fixture('tournament.html');
	const tournament = parseTournament(html, 'https://www.tennisabstract.com/current/2026ATPTest.html');

	assert.equal(tournament.draw, 'proj32');
	assert.equal(tournament.players.length, 2);
	assert.deepEqual(tournament.players[0], {
		id: '100', name: 'A One', country: 'SWE', seed: 1, entry: null
	});
	assert.equal(tournament.players[1].entry, 'Q');
	assert.equal(tournament.forecast.players[0].probabilities.W, 10);
	assert.equal(tournament.matches.upcoming[0].players.length, 2);
	assert.equal(tournament.matches.completed[0].round, 'R32');
});

test('inspects stable page primitives', async () => {
	const result = inspectHtml(await fixture('tournament.html'), 'https://example.test/tournament');

	assert.deepEqual(result.variables, ['completedSingles', 'proj32', 'projCurrent', 'upcomingSingles']);
	assert.equal(result.playerLinks, 3);
	assert.equal(result.tables, 2);
});

test('parses official ATP rankings', async () => {
	const rankings = parseRankings(
		await fixture('rankings.html'),
		'https://www.tennisabstract.com/reports/atpRankings.html'
	);

	assert.equal(rankings.updated, '2026-07-20');
	assert.equal(rankings.players.length, 2);
	assert.deepEqual(rankings.players[0], {
		rank: 1,
		name: 'Jannik Sinner',
		country: 'ITA',
		birthdate: '2001-08-16',
		taId: 'JannikSinner',
		url: 'https://www.tennisabstract.com/cgi-bin/player.cgi?p=JannikSinner'
	});
});

test('parses only the leaf data table from nested TA report layout', async () => {
	const report = parseReport(await fixture('report.html'), 'https://example.test/report', 'elo');

	assert.equal(report.tables.length, 1);
	assert.equal(report.tables[0].id, 'reportable');
	assert.equal(report.tables[0].totalRows, 2);
	assert.equal(report.tables[0].rows[0].Player, 'Jannik Sinner');
});

test('preserves old TA tables that use td cells instead of headers', () => {
	const report = parseReport(
		'<table><tr><td></td><td>JS</td><td>CA</td></tr><tr><td>1</td><td>-</td><td>7-11</td></tr></table>',
		'https://example.test/h2h',
		'h2h'
	);

	assert.equal(report.tables[0].totalRows, 1);
	assert.deepEqual(report.tables[0].headers, ['column_1', 'JS', 'CA']);
	assert.equal(report.tables[0].rows[0].CA, '7-11');
});

test('parses player profile and fragment tables', async () => {
	const player = parsePlayer(
		await fixture('player.html'),
		await fixture('player-fragment.txt'),
		'https://www.tennisabstract.com/cgi-bin/player.cgi?p=JannikSinner'
	);

	assert.equal(player.profile.name, 'Jannik Sinner');
	assert.equal(player.profile.atpId, 'S0AG');
	assert.equal(player.profile.birthdate, '2001-08-16');
	assert.deepEqual(player.tables.map(table => table.id), ['recent-results', 'challenger-results']);
});

test('drops doubles columns embedded in a player singles ranking table', () => {
	const profile = "<script>var fullname='A Player';</script>";
	const fragment = "var player_frag = `<table id='year-end-rankings'><tr><th>Year</th><th>ATP Rank</th><th>Doubles: ATP Rank</th><th>Points</th></tr><tr><td>2026</td><td>1</td><td>9</td><td>100</td></tr></table>`;";
	const player = parsePlayer(profile, fragment, 'https://example.test/player');

	assert.deepEqual(player.tables[0].headers, ['Year', 'ATP Rank']);
	assert.deepEqual(player.tables[0].rows[0], { Year: '2026', 'ATP Rank': '1' });
});

test('resolves an unambiguous ATP surname from the TA player index', () => {
	const names = parsePlayerNames('var playerlist=["(M) Jannik Sinner","(W) Sara Sinner","(M) Carlos Alcaraz"];');

	assert.deepEqual(names, ['Jannik Sinner', 'Carlos Alcaraz']);
	assert.equal(resolvePlayerName('Sinner', names), 'Jannik Sinner');
	assert.equal(resolvePlayerName('sinne', names), 'Jannik Sinner');
	assert.equal(resolvePlayerName('Carlos Alcaraz', names), 'Carlos Alcaraz');
});

test('rejects ambiguous player prefixes with useful candidates', () => {
	assert.throws(
		() => resolvePlayerName('alca', ['Carlos Alcaraz', 'Juan Alcantara']),
		/Ambiguous ATP player.*Carlos Alcaraz.*Juan Alcantara/
	);
});

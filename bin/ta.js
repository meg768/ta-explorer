#!/usr/bin/env node

import { config } from 'dotenv';
import { createRequire } from 'node:module';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { PLAYER_SECTIONS, REPORTS } from '../src/catalog.js';
import { printCurrent, printInspection, printJson, printPlayer, printRankings, printReport, printReports, printTournament } from '../src/output.js';
import { discoverCurrentTournaments, fetchHtml, fetchPlayer, findTournament, inspectHtml, parseRankings, parseReport, parseTournament } from '../src/tennis-abstract.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

config({ quiet: true });

const PLAYER_ACTIONS = {
	show: [],
	results: PLAYER_SECTIONS.recent,
	seasons: PLAYER_SECTIONS.seasons,
	surfaces: PLAYER_SECTIONS.splits,
	events: PLAYER_SECTIONS.events,
	rankings: PLAYER_SECTIONS.rankings,
	h2h: PLAYER_SECTIONS.h2h,
	performance: PLAYER_SECTIONS.performance,
	charting: PLAYER_SECTIONS.charting,
	export: Object.values(PLAYER_SECTIONS).flat()
};

function normalizedArguments(arguments_) {
	const args = [...arguments_];
	if (args[0] === 'reports') args[0] = 'report';
	if (args[0] === 'report' && args[1] && !['list', 'show'].includes(args[1]) && !args[1].startsWith('-')) args.splice(1, 0, 'show');
	if (args[0] === 'tournament' && args[1] && !['list', 'show'].includes(args[1]) && !args[1].startsWith('-')) args.splice(1, 0, 'show');
	if (args[0] === 'player' && args[1] && !Object.hasOwn(PLAYER_ACTIONS, args[1]) && !args[1].startsWith('-')) {
		const sectionIndex = args.findIndex(value => value === '--section' || value === '-s');
		const section = sectionIndex >= 0 ? args[sectionIndex + 1] : 'show';
		if (sectionIndex >= 0) args.splice(sectionIndex, 2);
		const legacyActions = { profile: 'show', recent: 'results', splits: 'surfaces', all: 'export' };
		args.splice(1, 0, legacyActions[section] || section);
	}
	return args;
}

const inputArguments = normalizedArguments(hideBin(process.argv));

const cli = yargs(inputArguments)
	.scriptName('ta')
	.usage('Usage: $0 <command> [options]\n\nExplore data available from Tennis Abstract')
	.version(packageJson.version)
	.option('base-url', {
		describe: 'Tennis Abstract base URL',
		type: 'string',
		default: process.env.TA_BASE_URL || 'https://www.tennisabstract.com'
	})
	.command('current', 'List current ATP tournaments', command => command
		.option('json', { describe: 'Output JSON', type: 'boolean', default: false }), async argv => {
		const url = new URL('/', argv.baseUrl).href;
		const tournaments = discoverCurrentTournaments(await fetchHtml(url), argv.baseUrl)
			.filter(item => item.tour === 'ATP');
		argv.json ? printJson(tournaments) : printCurrent(tournaments);
	})
	.command('inspect <url>', 'Inventory data exposed by a page', command => command
		.positional('url', { describe: 'Page URL', type: 'string' })
		.option('json', { describe: 'Output JSON', type: 'boolean', default: false }), async argv => {
		const result = inspectHtml(await fetchHtml(argv.url), argv.url);
		argv.json ? printJson(result) : printInspection(result);
	})
	.command('tournament <action> [target]', 'List or inspect current ATP tournaments', command => command
		.positional('action', { describe: 'What to do', choices: ['list', 'show'] })
		.positional('target', { describe: 'Tournament name or Tennis Abstract URL', type: 'string' })
		.option('json', { describe: 'Output JSON', type: 'boolean', default: false })
		.example('$0 tournament list', 'List current ATP tournaments')
		.example('$0 tournament show Kitzbuhel --json', 'Fetch draw, matches, and forecast'), async argv => {
		if (argv.action === 'list') {
			const url = new URL('/', argv.baseUrl).href;
			const tournaments = discoverCurrentTournaments(await fetchHtml(url), argv.baseUrl).filter(item => item.tour === 'ATP');
			argv.json ? printJson(tournaments) : printCurrent(tournaments);
			return;
		}
		if (!argv.target) throw new Error('Usage: ta tournament show <name-or-url>');
		const tournament = await findTournament(argv.target, { baseUrl: argv.baseUrl });
		const result = parseTournament(await fetchHtml(tournament.url), tournament.url);
		argv.json ? printJson(result) : printTournament(result);
	})
	.command('rankings', 'Show the official ATP rankings published by TA', command => command
		.option('top', {
			alias: 'n',
			describe: 'Number of ranked players to show',
			type: 'number',
			default: 100
		})
		.option('json', { describe: 'Output JSON', type: 'boolean', default: false })
		.check(argv => {
			if (!Number.isInteger(argv.top) || argv.top < 1) throw new Error('--top must be a positive integer.');
			return true;
		}), async argv => {
		const url = new URL('/reports/atpRankings.html', argv.baseUrl).href;
		const result = parseRankings(await fetchHtml(url), url);
		result.players = result.players.slice(0, argv.top);
		argv.json ? printJson(result) : printRankings(result);
	})
	.command('report <action> [name]', 'List or fetch ATP singles reports', command => command
		.positional('action', { describe: 'What to do', choices: ['list', 'show'] })
		.positional('name', { describe: 'Report name shown by `ta report list`', type: 'string' })
		.option('limit', { alias: 'n', describe: 'Rows per table; 0 means all', type: 'number', default: 20 })
		.option('json', { describe: 'Output JSON', type: 'boolean', default: false })
		.check(argv => {
			if (!Number.isInteger(argv.limit) || argv.limit < 0) throw new Error('--limit must be zero or a positive integer.');
			return true;
		})
		.example('$0 report list', 'List available reports')
		.example('$0 report show elo --limit 25', 'Show the first 25 Elo rows')
		.example('$0 report show surface-speed --limit 0 --json', 'Export a complete report'), async argv => {
		if (argv.action === 'list') {
			argv.json ? printJson(REPORTS) : printReports(REPORTS);
			return;
		}
		if (!argv.name) throw new Error('Usage: ta report show <name>');
		const definition = REPORTS.find(report => report.name === argv.name);
		if (!definition) throw new Error(`Unknown report "${argv.name}". Run \`ta report list\` to list valid names.`);
		const url = new URL(definition.path, argv.baseUrl).href;
		const result = parseReport(await fetchHtml(url), url, definition.name);
		if (argv.limit > 0) result.tables.forEach(table => { table.rows = table.rows.slice(0, argv.limit); });
		argv.json ? printJson(result) : printReport(result, 0);
	})
	.command('player <action> <player>', 'Inspect an ATP singles player', command => command
		.positional('action', { describe: 'Data view', choices: Object.keys(PLAYER_ACTIONS) })
		.positional('player', { describe: 'TA player id, name, or player URL', type: 'string' })
		.option('limit', { alias: 'n', describe: 'Rows per table; 0 means all', type: 'number', default: 20 })
		.option('all', { describe: 'Do not limit table rows', type: 'boolean', default: false })
		.option('json', { describe: 'Output JSON', type: 'boolean', default: false })
		.check(argv => {
			if (!Number.isInteger(argv.limit) || argv.limit < 0) throw new Error('--limit must be zero or a positive integer.');
			return true;
		})
		.example('$0 player show Sinner', 'Profile, ranking, and Elo')
		.example('$0 player h2h Sinner --json', 'Head-to-head history')
		.example('$0 player surfaces Sinner', 'Career and last-52-week splits')
		.example('$0 player export Sinner --all --json', 'Export all ATP singles data')
		.epilog('Views: show profile; results recent matches; seasons tour seasons; surfaces career/52-week splits; events event history; rankings ranking history; h2h opponents; performance detailed stats; charting serve/return/rally/tactics; export everything.'), async argv => {
		const result = await fetchPlayer(argv.player, { baseUrl: argv.baseUrl });
		const allowedIds = new Set(PLAYER_ACTIONS[argv.action]);
		const limit = argv.all ? 0 : argv.limit;
		result.tables = result.tables
			.filter(table => allowedIds.has(table.id))
			.map(table => ({ ...table, rows: limit === 0 ? table.rows : table.rows.slice(0, limit) }));
		argv.json ? printJson(result) : printPlayer(result, 0);
	})
	.help()
	.strict()
	.fail((message, error) => {
		throw error || new Error(message);
	});

if (inputArguments.length === 0) {
	cli.showHelp();
} else {
	try {
		await cli.parseAsync();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}

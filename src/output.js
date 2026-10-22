function pad(value, width) {
	return String(value ?? '').padEnd(width);
}

export function printJson(value) {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printCurrent(tournaments) {
	const widths = {
		name: Math.max(4, ...tournaments.map(item => item.name.length)),
		tour: Math.max(4, ...tournaments.map(item => item.tour.length))
	};

	console.log(`${pad('Name', widths.name)}  ${pad('Tour', widths.tour)}  Year`);
	for (const tournament of tournaments) {
		console.log(`${pad(tournament.name, widths.name)}  ${pad(tournament.tour, widths.tour)}  ${tournament.year}`);
	}
}

export function printInspection(result) {
	console.log(result.url);
	console.log(`Bytes: ${result.bytes}`);
	console.log(`Tables: ${result.tables}`);
	console.log(`Player links: ${result.playerLinks}`);
	console.log(`Tournament links: ${result.tournamentLinks}`);
	console.log('JavaScript variables:');
	result.variables.forEach(name => console.log(`  ${name}`));
}

export function printTournament(result) {
	console.log(result.title || result.url);
	console.log(result.url);
	console.log(`Draw: ${result.draw ?? '-'} · ${result.players.length} players`);
	console.log(`Matches: ${result.matches.upcoming.length} upcoming · ${result.matches.completed.length} completed`);

	if (!result.forecast.players.length) return;

	const rounds = result.forecast.rounds;
	const rows = [...result.forecast.players]
		.sort((a, b) => (b.probabilities.W ?? -1) - (a.probabilities.W ?? -1));
	const nameWidth = Math.max(6, ...rows.map(player => player.name.length));

	console.log('');
	console.log(`${pad('Player', nameWidth)}  ${rounds.map(round => pad(round, 6)).join('  ')}`.trimEnd());
	for (const player of rows) {
		const values = rounds.map(round => {
			const value = player.probabilities[round];
			return pad(value == null ? '-' : `${value.toFixed(1)}%`, 6);
		});
		console.log(`${pad(player.name, nameWidth)}  ${values.join('  ')}`.trimEnd());
	}
}

export function printRankings(result) {
	const players = result.players;
	const nameWidth = Math.max(6, ...players.map(player => player.name.length));

	console.log(`Official ATP rankings · TA update ${result.updated ?? 'unknown'}`);
	console.log('');
	console.log(`${pad('Rank', 5)}  ${pad('Player', nameWidth)}  ${pad('Country', 7)}  Birthdate`);
	for (const player of players) {
		console.log(`${pad(player.rank, 5)}  ${pad(player.name, nameWidth)}  ${pad(player.country ?? '-', 7)}  ${player.birthdate ?? '-'}`);
	}
}

export function printReports(reports) {
	const width = Math.max(...reports.map(report => report.name.length));
	for (const report of reports) console.log(`${pad(report.name, width)}  ${report.label}`);
}

function printRecords(table, limit) {
	const rows = limit === 0 ? table.rows : table.rows.slice(0, limit);
	const totalRows = table.totalRows ?? table.rows.length;
	console.log(`\n${table.title} · ${totalRows} rows`);
	for (const row of rows) {
		console.log(table.headers.map(header => `${header}: ${row[header] ?? '-'}`).join(' | '));
	}
	if (rows.length < totalRows) console.log(`… ${totalRows - rows.length} more rows`);
}

export function printReport(report, limit) {
	console.log(report.title || report.name);
	console.log(report.url);
	if (report.updated) console.log(`Updated: ${report.updated}`);
	for (const table of report.tables) printRecords(table, limit);
}

export function printPlayer(result, limit) {
	const player = result.profile;
	console.log(`${player.name} [${player.country ?? '-'}]`);
	console.log(`ATP rank: ${player.rank ?? '-'} · peak: ${player.peakRank ?? '-'} · Elo: ${player.elo.rank ?? '-'} (${player.elo.rating ?? '-'})`);
	console.log(`Born: ${player.birthdate ?? '-'} · height: ${player.heightCm ?? '-'} cm · hand: ${player.hand ?? '-'} · backhand: ${player.backhand ?? '-'}`);
	console.log(`TA id: ${player.taId ?? '-'} · ATP id: ${player.atpId ?? '-'}`);
	for (const table of result.tables) printRecords(table, limit);
}

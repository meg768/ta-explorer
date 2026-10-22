export const REPORTS = [
	{ name: 'official', label: 'Official ATP rankings', path: '/reports/atpRankings.html' },
	{ name: 'elo', label: 'Overall and surface Elo ratings', path: '/reports/atp_elo_ratings.html' },
	{ name: 'age', label: 'Rankings by age group', path: '/reports/rankingsByAge.html' },
	{ name: 'milestones', label: 'ATP ranking milestones', path: '/reports/atp_ranking_milestones.html' },
	{ name: 'countries', label: 'Country-by-country rankings', path: '/reports/countryRankings.html' },
	{ name: 'left-handers', label: 'Left-handed players', path: '/reports/leftyRankings.html' },
	{ name: 'one-handed', label: 'One-handed backhands', path: '/reports/oneHandBackhandRankings.html' },
	{ name: 'surface-speed', label: 'Tournament surface speed ratings', path: '/reports/atp_surface_speed.html' },
	{ name: 'winners-errors-52', label: 'Winners and errors, last 52 weeks', path: '/reports/winners_errors_leaders_men_last52.html' },
	{ name: 'winners-errors-career', label: 'Winners and errors, career', path: '/reports/winners_errors_leaders_men_career.html' },
	{ name: 'charting-serve-52', label: 'Match Charting serve, last 52 weeks', path: '/reports/mcp_leaders_serve_men_last52.html' },
	{ name: 'charting-return-52', label: 'Match Charting return, last 52 weeks', path: '/reports/mcp_leaders_return_men_last52.html' },
	{ name: 'charting-rally-52', label: 'Match Charting rally, last 52 weeks', path: '/reports/mcp_leaders_rally_men_last52.html' },
	{ name: 'charting-tactics-52', label: 'Match Charting tactics, last 52 weeks', path: '/reports/mcp_leaders_tactics_men_last52.html' },
	{ name: 'h2h-matrix', label: 'Head-to-head matrix for leading ATP players', path: '/reports/h2hMatrix.html' },
	{ name: 'best-who-havent', label: "Best ATP players who haven't reached milestones", path: '/reports/ATP_BestWhoHavent.html' },
	{ name: 'bakery', label: '6-0 and 6-1 set report', path: '/reports/atp_bakery_report.html' },
	{ name: 'lottery', label: 'ATP lottery matches', path: '/reports/atp_lottery_matches.html' },
	{ name: 'next-slam', label: 'Next Slam forecast', path: '/reports/atp_next_slam_report.html' }
];

export const PLAYER_SECTIONS = {
	profile: [],
	recent: ['recent-results'],
	seasons: ['tour-years'],
	splits: ['career-splits', 'last52-splits'],
	events: ['recent-events', 'recent-finals', 'titles-finals'],
	rankings: ['year-end-rankings'],
	h2h: ['head-to-heads'],
	performance: ['serve-speed', 'winners-errors', 'pbp-points', 'pbp-games', 'pbp-stats'],
	charting: ['mcp-serve', 'mcp-return', 'mcp-rally', 'mcp-tactics']
};

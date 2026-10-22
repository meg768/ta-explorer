import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const cliPath = new URL('../bin/ta.js', import.meta.url);

function run(...args) {
	return spawnSync(process.execPath, [cliPath.pathname, ...args], {
		encoding: 'utf8'
	});
}

test('prints help', () => {
	const result = run('--help');

	assert.equal(result.status, 0);
	assert.equal(result.stderr, '');
	assert.match(result.stdout, /^Usage: ta <command> \[options\]/);
});

test('prints version', () => {
	const result = run('--version');

	assert.equal(result.status, 0);
	assert.equal(result.stderr, '');
	assert.equal(result.stdout.trim(), '1.0.0');
});

test('documents resource-action command shapes', () => {
	const result = run('--help');

	assert.match(result.stdout, /player <action> <player>/);
	assert.match(result.stdout, /tournament <action> \[target\]/);
	assert.match(result.stdout, /report <action> \[name\]/);
});

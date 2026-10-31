import { describe, expect, it } from 'vitest';
import { NodeApiError } from 'n8n-workflow';

import { buildMoodleRequestBody, encodeMoodleParams, moodleApiRequest } from '../../nodes/Moodle/GenericFunctions';
import { createMockContext } from '../utils/n8nMock';

const credentials = { url: 'https://moodle.example.com/', token: 'secret' };

describe('encodeMoodleParams', () => {
	it('expands nested arrays and objects into Moodle bracket notation', () => {
		expect(
			encodeMoodleParams({
				cohortids: [5, 6],
				template: { shortname: 'T', contextid: 1 },
				members: [{ cohorttype: { type: 'id', value: 3 }, usertype: { type: 'id', value: 7 } }],
			}),
		).toEqual([
			['cohortids[0]', '5'],
			['cohortids[1]', '6'],
			['template[shortname]', 'T'],
			['template[contextid]', '1'],
			['members[0][cohorttype][type]', 'id'],
			['members[0][cohorttype][value]', '3'],
			['members[0][usertype][type]', 'id'],
			['members[0][usertype][value]', '7'],
		]);
	});

	it('drops undefined/null values instead of sending the string "undefined"', () => {
		expect(encodeMoodleParams({ a: undefined, b: null, c: 0, d: '' })).toEqual([
			['c', '0'],
			['d', ''],
		]);
	});

	it('sends booleans as 1/0', () => {
		expect(encodeMoodleParams({ yes: true, no: false })).toEqual([
			['yes', '1'],
			['no', '0'],
		]);
	});
});

describe('buildMoodleRequestBody', () => {
	it('always sends the token and JSON format first and lets params override nothing', () => {
		const body = new URLSearchParams(buildMoodleRequestBody('tok', { wsfunction: 'f', wstoken: 'evil' }));
		expect(body.get('wstoken')).toBe('tok');
		expect(body.getAll('wstoken')).toHaveLength(1);
		expect(body.get('moodlewsrestformat')).toBe('json');
		expect(body.get('wsfunction')).toBe('f');
	});

	it('url-encodes special characters', () => {
		const body = buildMoodleRequestBody('t', { text: 'a&b=c è' });
		expect(new URLSearchParams(body).get('text')).toBe('a&b=c è');
	});
});

describe('moodleApiRequest', () => {
	const call = (response: unknown) => {
		const requests: any[] = [];
		const ctx = createMockContext({}, credentials, { emitted: [], requests }, async () => response);
		return { requests, run: () => moodleApiRequest.call(ctx, 'POST', { wsfunction: 'core_webservice_get_site_info' }) };
	};

	it('posts to the REST endpoint, stripping the trailing slash of the URL', async () => {
		const { requests, run } = call('{"sitename":"x"}');
		await expect(run()).resolves.toEqual({ sitename: 'x' });
		expect(requests[0].url).toBe('https://moodle.example.com/webservice/rest/server.php');
		expect(requests[0].headers['Content-Type']).toBe('application/x-www-form-urlencoded');
	});

	it('returns null for void functions (empty body or "null")', async () => {
		await expect(call('').run()).resolves.toBeNull();
		await expect(call('null').run()).resolves.toBeNull();
	});

	it('turns Moodle exceptions into NodeApiError with the Moodle message', async () => {
		const { run } = call(JSON.stringify({ exception: 'invalid_parameter_exception', errorcode: 'invalidparameter', message: 'Invalid parameter value detected', debuginfo: 'Missing required key' }));
		const error = await run().catch((e) => e);
		expect(error).toBeInstanceOf(NodeApiError);
		expect(error.message).toBe('Invalid parameter value detected');
		expect(error.description).toContain('Missing required key');
		expect(error.description).toContain('invalidparameter');
	});

	it('reports non-JSON answers (wrong URL, HTML error pages) clearly', async () => {
		const error = await call('<html>Not found</html>').run().catch((e) => e);
		expect(error).toBeInstanceOf(NodeApiError);
		expect(error.message).toBe('Failed to parse Moodle API response');
	});
});

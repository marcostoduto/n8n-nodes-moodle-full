import { describe, expect, it } from 'vitest';

import { serializeMoodleParams } from '../../nodes/Moodle/GenericFunctions';
import { parseIdList, toJsonItems, toTimestamp } from '../../nodes/Moodle/Moodle.node';
import { listOperations, properties, resolveParameters, runOperation } from './harness';

const rl = (value: number | string) => ({ __rl: true, mode: 'id', value: String(value) });

/** Fills every visible parameter of an operation with a plausible value. */
function fillParameters(resource: string, operation: string) {
	const visible = resolveParameters({ resource, operation });
	const filled: Record<string, any> = { resource, operation };
	for (const [key, value] of Object.entries(visible)) {
		if (key === 'resource' || key === 'operation') continue;
		const prop = properties.find((p) => p.name === key);
		if (value && typeof value === 'object' && '__rl' in (value as object)) filled[key] = rl(7);
		else if (typeof value === 'number') filled[key] = value === 0 ? 7 : value;
		else if (typeof value === 'string' && value === '')
			filled[key] = prop?.type === 'dateTime' ? '2026-01-02T03:04:05Z' : 'val';
		else filled[key] = value;
	}
	return filled;
}

/** Fake Moodle responses good enough for the operations that chain several calls. */
function fakeMoodle() {
	let contentsCalls = 0;
	return (call: { params: Record<string, string> }) => {
		switch (call.params.wsfunction) {
			case 'core_course_get_courses_by_field':
				return { courses: [{ id: 7, format: 'topics' }], warnings: [] };
			case 'core_course_get_categories':
			case 'core_user_get_users_by_field':
			case 'core_cohort_get_cohorts':
			case 'core_group_get_groups':
			case 'core_group_get_groupings':
				return [{ id: 7, name: 'Existing', idnumber: 'existing', description: 'Existing' }];
			case 'core_course_get_contents':
				contentsCalls++;
				return contentsCalls % 2 === 1
					? [{ id: 70, section: 7 }]
					: [
							{ id: 70, section: 7 },
							{ id: 71, section: 8 },
						];
			case 'core_webservice_get_site_info':
				return { userid: 2, sitename: 'Moodle' };
			default:
				return [];
		}
	};
}

describe('every operation', () => {
	const operations = listOperations();

	it('has at least one operation per resource', () => {
		expect(operations.length).toBeGreaterThan(150);
	});

	for (const { resource, operation } of operations) {
		it(`${resource}.${operation} builds a valid Moodle request`, async () => {
			const { calls, output } = await runOperation(fillParameters(resource, operation), fakeMoodle());
			expect(calls.length).toBeGreaterThan(0);
			for (const call of calls) {
				expect(call.params.wsfunction).toMatch(/^[a-z0-9_]+$/);
				expect(call.params.wstoken).toBe('tok');
				for (const [key, value] of Object.entries(call.params)) {
					expect(`${key}=${value}`).not.toMatch(/undefined|\[object Object\]|NaN/);
				}
				// Moodle rejects "true"/"false" for boolean parameters.
				expect(Object.values(call.params)).not.toContain('true');
				expect(Object.values(call.params)).not.toContain('false');
			}
			for (const item of output) {
				expect(typeof item.json).toBe('object');
				expect(Array.isArray(item.json)).toBe(false);
			}
		});
	}
});

describe('serializeMoodleParams', () => {
	it('flattens nested arrays and objects using PHP bracket notation', () => {
		const form = serializeMoodleParams({
			users: [{ id: 1, customfields: [{ type: 'a', value: 'b' }] }],
			template: { shortname: 'x', contextid: 1 },
		});
		expect(form.get('users[0][id]')).toBe('1');
		expect(form.get('users[0][customfields][0][type]')).toBe('a');
		expect(form.get('template[shortname]')).toBe('x');
	});

	it('skips undefined/null values and encodes booleans as 1/0', () => {
		const form = serializeMoodleParams({ a: undefined, b: null, c: true, d: false, e: 0, f: '' });
		expect(form.has('a')).toBe(false);
		expect(form.has('b')).toBe(false);
		expect(form.get('c')).toBe('1');
		expect(form.get('d')).toBe('0');
		expect(form.get('e')).toBe('0');
		expect(form.get('f')).toBe('');
	});

	it('keeps UTF-8 text intact', () => {
		const form = serializeMoodleParams({ text: 'Perché è già così' });
		expect(new URLSearchParams(form.toString()).get('text')).toBe('Perché è già così');
	});
});

describe('helpers', () => {
	it('toJsonItems wraps primitives and nulls', () => {
		expect(toJsonItems(null)).toEqual([{ success: true }]);
		expect(toJsonItems(true)).toEqual([{ result: true }]);
		expect(toJsonItems([1, { a: 1 }])).toEqual([{ value: 1 }, { a: 1 }]);
		expect(toJsonItems({ a: 1 })).toEqual([{ a: 1 }]);
	});

	it('toTimestamp handles ISO strings, numbers and invalid values', () => {
		expect(toTimestamp('2026-01-01T00:00:00Z')).toBe(1767225600);
		expect(toTimestamp(1767225600)).toBe(1767225600);
		expect(toTimestamp('')).toBeUndefined();
		expect(toTimestamp('not a date')).toBeUndefined();
	});

	it('parseIdList parses comma separated ids', () => {
		expect(parseIdList('1, 2,x,3')).toEqual([1, 2, 3]);
		expect(parseIdList('')).toEqual([]);
	});
});

describe('request shapes', () => {
	it('user.update sends only provided fields and booleans as 0/1', async () => {
		const { calls } = await runOperation({
			resource: 'user',
			operation: 'update',
			userId: rl(5),
			additionalFields: { suspended: true },
			userUpdateFields: { firstname: 'Mario', email: '' },
		});
		expect(calls[0].params).toMatchObject({
			wsfunction: 'core_user_update_users',
			'users[0][id]': '5',
			'users[0][suspended]': '1',
			'users[0][firstname]': 'Mario',
		});
		expect(calls[0].params).not.toHaveProperty('users[0][email]');
	});

	it('cohort.addMembers uses cohorttype/usertype structures', async () => {
		const { calls } = await runOperation({
			resource: 'cohort',
			operation: 'addMembers',
			cohortId: rl(3),
			cohortMemberIds: '10, 11',
		});
		expect(calls[0].params).toMatchObject({
			wsfunction: 'core_cohort_add_cohort_members',
			'members[0][cohorttype][type]': 'id',
			'members[0][cohorttype][value]': '3',
			'members[0][usertype][value]': '10',
			'members[1][usertype][value]': '11',
		});
	});

	it('cohort.create sends the required categorytype and idnumber', async () => {
		const { calls } = await runOperation({ resource: 'cohort', operation: 'create', cohortName: 'Classe 1A' });
		expect(calls[0].params).toMatchObject({
			'cohorts[0][categorytype][type]': 'system',
			'cohorts[0][categorytype][value]': '',
			'cohorts[0][name]': 'Classe 1A',
			'cohorts[0][idnumber]': '',
		});
	});

	it('group.create always sends a description', async () => {
		const { calls } = await runOperation({
			resource: 'group',
			operation: 'create',
			groupCourseId: rl(2),
			groupName: 'G1',
		});
		expect(calls[0].params).toMatchObject({
			'groups[0][courseid]': '2',
			'groups[0][name]': 'G1',
			'groups[0][description]': '',
		});
	});

	it('group.update keeps the current name when none is given', async () => {
		const { calls } = await runOperation(
			{ resource: 'group', operation: 'update', groupId: rl(4), groupDescription: 'New' },
			(c) => (c.params.wsfunction === 'core_group_get_groups' ? [{ id: 4, name: 'Old name' }] : null),
		);
		expect(calls[1].params).toMatchObject({
			'groups[0][id]': '4',
			'groups[0][name]': 'Old name',
			'groups[0][description]': 'New',
		});
	});

	it('enrollment.unenrol does not send the unsupported instanceid', async () => {
		const { calls, output } = await runOperation(
			{ resource: 'enrollment', operation: 'unenrol', enrollUserId: rl(1), enrollCourseId: rl(2) },
			() => null,
		);
		expect(Object.keys(calls[0].params).sort()).toEqual(
			['enrolments[0][courseid]', 'enrolments[0][userid]', 'moodlewsrestformat', 'wsfunction', 'wstoken'].sort(),
		);
		expect(output[0].json).toEqual({ success: true });
	});

	it('calendar.getMonthlyView defaults to the current month', async () => {
		const { calls } = await runOperation({ resource: 'calendar', operation: 'getMonthlyView' }, () => ({}));
		const now = new Date();
		expect(calls[0].params.year).toBe(String(now.getFullYear()));
		expect(calls[0].params.month).toBe(String(now.getMonth() + 1));
		expect(calls[0].params).not.toHaveProperty('courseid');
	});

	it('invalid JSON parameters produce a clear error', async () => {
		await expect(runOperation({ resource: 'note', operation: 'create', notesJson: '[{oops' })).rejects.toThrow(
			/not valid JSON/,
		);
	});

	it('Moodle exceptions are surfaced as errors', async () => {
		await expect(
			runOperation({ resource: 'system', operation: 'getSiteInfo' }, () => ({
				exception: 'moodle_exception',
				errorcode: 'invalidtoken',
				message: 'Invalid token - token not found',
			})),
		).rejects.toThrow(/Invalid token/);
	});

	it('continueOnFail returns the error as an item', async () => {
		const { output } = await runOperation(
			{ resource: 'system', operation: 'getSiteInfo' },
			() => ({ exception: 'x', errorcode: 'invalidtoken', message: 'Invalid token' }),
			{ continueOnFail: true },
		);
		expect(output[0].json.error).toMatch(/Invalid token/);
	});
});

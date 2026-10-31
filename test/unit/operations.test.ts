import { describe, expect, it } from 'vitest';
import { IHttpRequestOptions, INodeProperties, NodeOperationError } from 'n8n-workflow';

import { Moodle } from '../../nodes/Moodle/Moodle.node';
import { createMockContext, isDisplayed } from '../utils/n8nMock';
import signatures from '../fixtures/moodle-ws-signatures.json';

/**
 * Offline contract test: every operation of the node is executed against a fake
 * Moodle server, and each request it sends is validated against the web service
 * signatures exported from a real Moodle 4.5 site (test/fixtures). This catches
 * misspelled functions, unexpected keys and missing required keys — the errors
 * Moodle reports as "Invalid parameter value detected" or "Can't find data record
 * in database table external_functions".
 */

type Spec =
	| { t: 'value'; type: string; required: boolean }
	| { t: 'list'; required: boolean; content: Spec }
	| { t: 'object'; required: boolean; keys: Record<string, Spec> }
	| { t: 'unknown' };

const functions = (signatures as { functions: Record<string, Spec> }).functions;

/** Functions that belong to third-party plugins, not to Moodle core. */
const PLUGIN_FUNCTIONS = ['joomdle_get_group_members', 'mod_customcert_delete_issue', 'mod_customcert_get_element_html', 'mod_customcert_save_element'];

/** Operations Moodle core cannot do; the node must fail with a clear message. */
const UNSUPPORTED = ['badge.issue', 'badge.revoke', 'calendar.update', 'message.createConversation'];

/** Realistic sample values for JSON parameters. */
const JSON_SAMPLES: Record<string, string> = {
	preferencesJson: '[{"name":"htmleditor","value":"atto"}]',
	addDeviceParams: '{"appid":"a","name":"n","model":"m","platform":"p","version":"1","pushid":"x","uuid":"u"}',
	gradeDataJson: '[{"studentid":2,"grade":7}]',
	notesJson: '[{"userid":2,"publishstate":"personal","courseid":2,"text":"t"}]',
	notesUpdateJson: '[{"id":1,"publishstate":"personal","text":"t"}]',
	quizDataJson: '{"q1:1_answer":"1"}',
	assignPlugindataJson: '{"onlinetext_editor":{"text":"t","format":1,"itemid":0}}',
	assignGradeDataJson: '{"plugindata":{"assignfeedbackcomments_editor":{"text":"ok","format":1}}}',
	assignFlagsJson: '{"locked":1}',
	lessonDataJson: '{"answerid":"1"}',
	scormTracksJson: '{"cmi.core.lesson_status":"completed"}',
	dataEntryJson: '{"1":"value"}',
	surveyAnswersJson: '{"q1":"1"}',
	feedbackResponsesJson: '[{"name":"multichoice_1","value":"1"}]',
	certificateElementData: '{"name":"x"}',
};

/** Canned answers for the read-before-write calls some operations make. */
function fakeResponse(wsfunction: string): unknown {
	switch (wsfunction) {
		case 'core_course_get_categories':
			return [{ id: 3, parent: 0, coursecount: 0 }];
		case 'core_cohort_get_cohorts':
			return [{ id: 1, name: 'Cohort', idnumber: 'c1' }];
		case 'core_group_get_groups':
			return [{ id: 1, name: 'Group' }];
		case 'core_group_get_groupings':
			return [{ id: 1, name: 'Grouping', description: '', groups: [] }];
		case 'core_group_get_course_groupings':
			return [{ id: 1 }];
		case 'core_course_get_contents':
			return [{ id: 10, section: 0 }];
		case 'core_course_get_courses_by_field':
			return { courses: [{ id: 2, format: 'topics' }], warnings: [] };
		case 'core_competency_list_course_competencies':
			return [{ competency: { id: 4 } }];
		case 'core_webservice_get_site_info':
			return { userid: 2 };
		case 'core_enrol_get_users_courses':
			return [{ id: 2 }];
		default:
			return {};
	}
}

function parseBody(body: string): { wsfunction: string; tree: Record<string, unknown> } {
	const params = new URLSearchParams(body);
	const tree: Record<string, unknown> = {};
	let wsfunction = '';
	for (const [key, value] of params) {
		if (key === 'wsfunction') wsfunction = value;
		if (['wsfunction', 'wstoken', 'moodlewsrestformat'].includes(key)) continue;
		const path = key.replace(/\]/g, '').split('[');
		let node: any = tree;
		path.forEach((segment, idx) => {
			if (idx === path.length - 1) node[segment] = value;
			else node = node[segment] ??= {};
		});
	}
	return { wsfunction, tree };
}

function validate(spec: Spec, value: unknown, path: string, errors: string[]): void {
	if (spec.t === 'value') {
		if (value !== null && typeof value === 'object') errors.push(`${path}: scalar expected`);
		return;
	}
	if (spec.t === 'list') {
		if (value === null || typeof value !== 'object') {
			errors.push(`${path}: list expected`);
			return;
		}
		for (const [index, item] of Object.entries(value as object)) {
			if (!/^\d+$/.test(index)) errors.push(`${path}: non numeric list index "${index}"`);
			validate(spec.content, item, `${path}[${index}]`, errors);
		}
		return;
	}
	if (spec.t === 'object') {
		if (value === null || typeof value !== 'object') {
			errors.push(`${path}: object expected`);
			return;
		}
		const obj = value as Record<string, unknown>;
		for (const key of Object.keys(obj)) {
			if (!(key in spec.keys)) errors.push(`${path}: unexpected key "${key}"`);
			else validate(spec.keys[key], obj[key], `${path}.${key}`, errors);
		}
		for (const [key, child] of Object.entries(spec.keys)) {
			if ('required' in child && child.required && !(key in obj)) errors.push(`${path}: missing required key "${key}"`);
		}
	}
}

function sampleParams(resource: string, operation: string, properties: INodeProperties[]): Record<string, unknown> {
	const params: Record<string, unknown> = { resource, operation };
	for (const prop of properties) {
		if (prop.name in params || !isDisplayed(prop, params)) continue;
		const name = prop.name;
		if (JSON_SAMPLES[name]) params[name] = JSON_SAMPLES[name];
		else if (prop.type === 'resourceLocator') params[name] = { __rl: true, mode: 'id', value: '2' };
		else if (prop.type === 'number') params[name] = (prop.default as number) > 0 ? prop.default : 2;
		else if (prop.type === 'dateTime') params[name] = '2026-01-15T10:00:00Z';
		else if (prop.type === 'string' && !prop.default) params[name] = /ids$/i.test(name) ? '2,3' : name === 'email' ? 'a@b.c' : 'value';
	}
	return params;
}

const properties = new Moodle().description.properties;
const resources = ((properties.find((p) => p.name === 'resource') as any).options as Array<{ value: string }>).map((o) => o.value);
const cases: Array<[string, string]> = [];
for (const resource of resources) {
	const opProp = properties.find((p) => p.name === 'operation' && isDisplayed(p, { resource })) as any;
	for (const op of opProp ? opProp.options : [{ value: undefined }]) cases.push([resource, op.value]);
}

describe('every operation sends requests that match the Moodle web service signatures', () => {
	it('covers all resources', () => {
		expect(cases.length).toBeGreaterThan(200);
	});

	it.each(cases)('%s.%s', async (resource, operation) => {
		const params = sampleParams(resource, operation, properties);
		const requests: IHttpRequestOptions[] = [];
		const state = { emitted: [] as unknown[], requests };
		const ctx = createMockContext(params, { url: 'https://moodle.test', token: 't' }, state, async (options) =>
			JSON.stringify(fakeResponse(parseBody(options.body as string).wsfunction)),
		);

		const run = new Moodle().execute.call(ctx);

		if (UNSUPPORTED.includes(`${resource}.${operation}`)) {
			const error = await run.catch((e) => e);
			expect(error).toBeInstanceOf(NodeOperationError);
			expect(error.message).toMatch(/does not provide/);
			return;
		}

		// Operations whose fake answer is an empty list legitimately return no items.
		const output = await run;
		for (const item of output[0]) {
			expect(item.json).toBeTypeOf('object');
			expect(item.json).not.toBeNull();
		}
		expect(requests.length).toBeGreaterThan(0);

		for (const request of requests) {
			const { wsfunction, tree } = parseBody(request.body as string);
			if (PLUGIN_FUNCTIONS.includes(wsfunction)) continue;
			expect(functions, `unknown web service function ${wsfunction}`).toHaveProperty([wsfunction]);
			const errors: string[] = [];
			validate(functions[wsfunction], tree, wsfunction, errors);
			expect(errors).toEqual([]);
		}
	});
});

describe('output normalisation', () => {
	const run = async (params: Record<string, unknown>, response: unknown, continueOnFail = false) => {
		const ctx = createMockContext(params, { url: 'https://moodle.test', token: 't' }, undefined, async () => JSON.stringify(response), { continueOnFail });
		return (await new Moodle().execute.call(ctx))[0];
	};

	it('turns void answers into { success: true }', async () => {
		const items = await run({ resource: 'group', operation: 'delete', groupId: 1 }, null);
		expect(items.map((i) => i.json)).toEqual([{ success: true }]);
	});

	it('splits arrays into one item per element', async () => {
		const items = await run({ resource: 'course', operation: 'getCategories' }, [{ id: 1 }, { id: 2 }]);
		expect(items.map((i) => i.json)).toEqual([{ id: 1 }, { id: 2 }]);
	});

	it('wraps scalar answers so n8n always receives objects', async () => {
		const items = await run({ resource: 'file', operation: 'createDraft' }, 12345);
		expect(items.map((i) => i.json)).toEqual([{ result: 12345 }]);
	});

	it('reports delete operations with warnings as not successful', async () => {
		const warnings = [{ item: 'course', itemid: 9, warningcode: 'unknowncourseidnumber', message: 'Unknown course ID 9' }];
		const items = await run({ resource: 'course', operation: 'delete', courseId: 9 }, { warnings });
		expect(items[0].json).toEqual({ success: false, warnings });
	});

	it('returns the course object for "get"', async () => {
		const items = await run({ resource: 'course', operation: 'get', courseId: 2 }, { courses: [{ id: 2, shortname: 's' }], warnings: [] });
		expect(items[0].json).toEqual({ id: 2, shortname: 's' });
	});

	it('reports invalid JSON parameters with a clear error', async () => {
		const error = await run({ resource: 'user', operation: 'setPreferences', preferencesJson: '{oops' }, null).catch((e) => e);
		expect(error).toBeInstanceOf(NodeOperationError);
		expect(error.message).toContain('preferencesJson');
	});

	it('returns the error as an item when "Continue On Fail" is enabled', async () => {
		const items = await run({ resource: 'system', operation: 'getSiteInfo' }, { exception: 'x', errorcode: 'invalidtoken', message: 'Invalid token' }, true);
		expect(items[0].json).toMatchObject({ error: 'Invalid token' });
	});
});

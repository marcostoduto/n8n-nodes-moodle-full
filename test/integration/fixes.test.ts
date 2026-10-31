import { afterAll, describe, expect, it } from 'vitest';

import { credentials, isConfigured, uniqueSuffix } from './config';
import { runNode } from '../utils/n8nMock';

/**
 * Integration tests for operations that used to call non-existent Moodle
 * functions or send parameters Moodle rejects.
 */

const suffix = uniqueSuffix();
const run = (params: Record<string, unknown>) => runNode(params, credentials!);

let courseId: number | undefined;
let duplicateCourseId: number | undefined;
let userId: number | undefined;
let adminId: number | undefined;
let cohortId: number | undefined;

describe.skipIf(!isConfigured)('Previously broken operations', () => {
	it('prepares a course and a user', async () => {
		adminId = Number((await run({ resource: 'system', operation: 'getSiteInfo' })).userid);
		const [category] = await run({ resource: 'course', operation: 'getCategories' });
		const [course] = await run({
			resource: 'course',
			operation: 'create',
			fullname: `N8N Fixes ${suffix}`,
			shortname: `n8nfix_${suffix}`,
			categoryid: Number(category.id),
			courseAdditionalFields: { visible: true },
		});
		courseId = Number(course.id);
		const [user] = await run({
			resource: 'user',
			operation: 'create',
			username: `n8nfix_${suffix}`,
			password: 'TestPass!2026',
			firstname: 'Fix',
			lastname: 'Tester',
			email: `n8nfix_${suffix}@example.com`,
			additionalFields: {},
		});
		userId = Number(user.id);
		await run({ resource: 'enrollment', operation: 'enrol', enrollUserId: userId, enrollCourseId: courseId, roleId: 5 });
	});

	describe('course', () => {
		it('creates, renames and deletes a section', async () => {
			const created = await run({ resource: 'course', operation: 'createSection', courseId, sectionNumber: 0, sectionName: 'Week A' });
			expect(created).toHaveProperty('id');
			expect(created).toHaveProperty('name', 'Week A');

			await run({ resource: 'course', operation: 'updateSection', courseId, sectionId: created.id, sectionName: 'Week B' });
			let sections = await run({ resource: 'course', operation: 'getSections', courseId });
			expect(sections.find((s: any) => s.id === created.id)).toHaveProperty('name', 'Week B');

			expect(await run({ resource: 'course', operation: 'deleteSection', courseId, sectionId: created.id })).toHaveProperty('success', true);
			sections = await run({ resource: 'course', operation: 'getSections', courseId });
			expect(sections.find((s: any) => s.id === created.id)).toBeUndefined();
		});

		it('duplicates a course', async () => {
			const [category] = await run({ resource: 'course', operation: 'getCategories' });
			const result = await run({
				resource: 'course',
				operation: 'duplicate',
				courseId,
				fullname: `N8N Fixes copy ${suffix}`,
				shortname: `n8nfixcopy_${suffix}`,
				categoryid: Number(category.id),
			});
			expect(result).toHaveProperty('id');
			duplicateCourseId = Number(result.id);
		});

		it('reports a failed delete instead of a fake success', async () => {
			const result = await run({ resource: 'course', operation: 'delete', courseId: 999999 });
			expect(result).toHaveProperty('success', false);
		});
	});

	describe('enrollment', () => {
		it('lists users with a capability', async () => {
			const result = await run({ resource: 'enrollment', operation: 'getEnrolledWithCapability', enrollCourseId: courseId, capability: 'moodle/course:view' });
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe('cohort', () => {
		it('creates a cohort, adds/removes members and keeps the ID number on update', async () => {
			const [cohort] = await run({ resource: 'cohort', operation: 'create', cohortName: `Fix ${suffix}`, cohortIdNumber: `fix_${suffix}`, cohortCategoryId: 0, cohortDescription: '' });
			cohortId = Number(cohort.id);

			expect(await run({ resource: 'cohort', operation: 'addMembers', cohortId, cohortMemberIds: String(userId) })).toHaveProperty('success', true);
			let [members] = await run({ resource: 'cohort', operation: 'getMembers', cohortId });
			expect(members.userids).toContain(userId);

			await run({ resource: 'cohort', operation: 'update', cohortId, cohortName: `Fix renamed ${suffix}`, cohortIdNumber: '', cohortCategoryId: 0, cohortDescription: '' });
			const [updated] = await run({ resource: 'cohort', operation: 'get', cohortId });
			expect(updated).toMatchObject({ name: `Fix renamed ${suffix}`, idnumber: `fix_${suffix}` });

			await run({ resource: 'cohort', operation: 'deleteMembers', cohortId, cohortMemberIds: String(userId) });
			[members] = await run({ resource: 'cohort', operation: 'getMembers', cohortId });
			expect(members.userids).not.toContain(userId);
		});
	});

	describe('group', () => {
		it('updates a group description without losing its name, and manages groupings', async () => {
			const [group] = await run({ resource: 'group', operation: 'create', groupCourseId: courseId, groupName: `G ${suffix}`, groupDescription: '' });
			await run({ resource: 'group', operation: 'update', groupId: group.id, groupDescription: 'new description' });
			const [fetched] = await run({ resource: 'group', operation: 'get', groupId: group.id });
			expect(fetched).toMatchObject({ name: `G ${suffix}`, description: 'new description' });

			const [grouping] = await run({ resource: 'group', operation: 'createGrouping', groupCourseId: courseId, groupingName: `GR ${suffix}`, groupingDescription: '' });
			await run({ resource: 'group', operation: 'updateGrouping', groupingId: grouping.id, groupingDescription: 'grouping description' });
			await run({ resource: 'group', operation: 'assignGrouping', groupingId: grouping.id, groupId: group.id });
			const groups = await run({ resource: 'group', operation: 'getGroupingGroups', groupingId: grouping.id });
			expect(groups.map((g: any) => g.id)).toContain(group.id);

			expect(await run({ resource: 'group', operation: 'deleteGrouping', groupingId: grouping.id })).toHaveProperty('success', true);
		});
	});

	describe('calendar', () => {
		it('creates, lists and deletes a course event', async () => {
			const created = await run({
				resource: 'calendar',
				operation: 'create',
				eventName: `Event ${suffix}`,
				eventDescription: 'n8n',
				eventType: 'course',
				eventDate: new Date(Date.now() + 86400000).toISOString(),
				eventDuration: 3600,
				eventCourseId: courseId,
				eventGroupId: 0,
			});
			const eventId = Number(created.events[0].id);

			const listed = await run({ resource: 'calendar', operation: 'get', eventCourseId: courseId, eventsOptions: {} });
			expect(listed.events.map((e: any) => e.id)).toContain(eventId);

			const upcoming = await run({ resource: 'calendar', operation: 'getUpcoming', eventCourseId: courseId, eventsOptions: {} });
			expect(upcoming).toHaveProperty('events');
			expect(await run({ resource: 'calendar', operation: 'getMonthlyView', eventCourseId: courseId, calendarYear: 0, calendarMonth: 0 })).toHaveProperty('weeks');
			expect(await run({ resource: 'calendar', operation: 'getDayView', eventCourseId: courseId, calendarYear: 0, calendarMonth: 0, calendarDay: 0 })).toHaveProperty('events');

			expect(await run({ resource: 'calendar', operation: 'delete', eventId })).toHaveProperty('success', true);
		});
	});

	describe('note', () => {
		it('creates, reads and deletes a note', async () => {
			const [created] = await run({
				resource: 'note',
				operation: 'create',
				notesJson: JSON.stringify([{ userid: userId, publishstate: 'course', courseid: courseId, text: 'note from n8n', format: 1 }]),
			});
			expect(Number(created.noteid)).toBeGreaterThan(0);
			const fetched = await run({ resource: 'note', operation: 'get', noteIds: String(created.noteid) });
			expect(fetched.notes[0]).toHaveProperty('noteid', created.noteid);
			expect(await run({ resource: 'note', operation: 'delete', noteIds: String(created.noteid) })).toHaveProperty('success', true);
		});
	});

	describe('message', () => {
		it('sends a message and reads/deletes the conversation', async () => {
			const [sent] = await run({ resource: 'message', operation: 'send', messageToUserId: userId, messageText: 'hello from n8n' });
			expect(sent.msgid).toBeGreaterThan(0);
			const conversationId = Number(sent.conversationid);

			const messages = await run({ resource: 'message', operation: 'getConversationMessages', conversationId, messageUserId: adminId });
			expect(messages.messages.length).toBeGreaterThan(0);

			expect(await run({ resource: 'message', operation: 'deleteConversation', conversationId, messageUserId: adminId })).toHaveProperty('success', true);
		});
	});

	describe('grade', () => {
		it('reads grade items, the grade tree and the overview grades', async () => {
			expect(await run({ resource: 'grade', operation: 'getGradeItems', gradeCourseId: courseId })).toHaveProperty('usergrades');
			expect(await run({ resource: 'grade', operation: 'getGradeDefinitions', gradeCourseId: courseId })).toBeTypeOf('object');
			expect(await run({ resource: 'grade', operation: 'getUserCourseGrades', gradeUserId: userId, gradeCourseId: courseId })).toHaveProperty('grades');
		});
	});

	describe('file', () => {
		it('creates a draft area, uploads a file into it and deletes it', async () => {
			const draft = await run({ resource: 'file', operation: 'createDraft' });
			const itemid = Number(draft.itemid);
			expect(itemid).toBeGreaterThan(0);

			const uploaded = await run({
				resource: 'file',
				operation: 'upload',
				fileContent: Buffer.from('hello').toString('base64'),
				fileUploadComponent: 'user',
				fileUploadArea: 'draft',
				draftAreaId: itemid,
				fileContextId: 0,
				filePath: '/',
				fileName: `n8n_${suffix}.txt`,
			});
			expect(uploaded).toHaveProperty('filename', `n8n_${suffix}.txt`);

			expect(await run({ resource: 'file', operation: 'deleteDraft', fileItemId: itemid, filePath: '/', fileName: `n8n_${suffix}.txt` })).toHaveProperty('success', true);
		});
	});

	describe('competency', () => {
		it('lists learning plan templates', async () => {
			expect(Array.isArray(await run({ resource: 'competency', operation: 'listTemplates' }))).toBe(true);
		});
	});
});

afterAll(async () => {
	if (!isConfigured) return;
	const cleanup = async (params: Record<string, unknown>) => {
		try {
			await run(params);
		} catch {
			// ignore cleanup errors
		}
	};
	if (cohortId !== undefined) await cleanup({ resource: 'cohort', operation: 'delete', cohortId });
	if (duplicateCourseId !== undefined) await cleanup({ resource: 'course', operation: 'delete', courseId: duplicateCourseId });
	if (courseId !== undefined) await cleanup({ resource: 'course', operation: 'delete', courseId });
	if (userId !== undefined) await cleanup({ resource: 'user', operation: 'delete', userId });
});

describe.skipIf(!isConfigured)('Resource locator lists', () => {
	const ctxFor = async (params: Record<string, unknown>) => {
		const { createMockContext } = await import('../utils/n8nMock');
		return createMockContext(params, credentials!) as any;
	};

	it.each(['searchCourses', 'searchUsers', 'searchCategories', 'searchCohorts'])('%s returns options', async (method) => {
		const { Moodle } = await import('../../nodes/Moodle/Moodle.node');
		const result = await (new Moodle().methods.listSearch as any)[method].call(await ctxFor({}));
		expect(Array.isArray(result.results)).toBe(true);
	});
});

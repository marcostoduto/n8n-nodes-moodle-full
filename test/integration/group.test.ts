import { afterAll, describe, expect, it } from 'vitest';

import { credentials, isConfigured, uniqueSuffix } from './config';
import { runNode } from '../utils/n8nMock';

const suffix = uniqueSuffix();
const groupName = `n8ngroup_${suffix}`;
const courseShortname = `n8ngroupcourse_${suffix}`;

let testCourseId: number | undefined;
let createdGroupId: number | undefined;

describe.skipIf(!isConfigured)('Group resource', () => {
	it('prepares a course', async () => {
		const categories = await runNode(
			{ resource: 'course', operation: 'getCategories' },
			credentials!,
		);
		const categoryId = Number(categories[0].id);

		const result = await runNode(
			{
				resource: 'course',
				operation: 'create',
				fullname: `N8N Group Test ${suffix}`,
				shortname: courseShortname,
				categoryid: categoryId,
				courseAdditionalFields: {},
			},
			credentials!,
		);

		testCourseId = Number(result[0].id);
		expect(testCourseId).toBeGreaterThan(0);
	});

	it('creates a group in the course', async () => {
		expect(testCourseId).toBeDefined();

		const result = await runNode(
			{
				resource: 'group',
				operation: 'create',
				groupCourseId: testCourseId,
				groupName,
				groupDescription: 'Created by n8n integration tests',
			},
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toHaveProperty('id');
		createdGroupId = Number(result[0].id);
	});

	it('gets the created group by id', async () => {
		expect(createdGroupId).toBeDefined();

		const result = await runNode(
			{ resource: 'group', operation: 'get', groupId: createdGroupId },
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toHaveProperty('id', createdGroupId);
		expect(result[0]).toHaveProperty('name', groupName);
	});

	it('lists the groups of the course', async () => {
		expect(testCourseId).toBeDefined();

		const result = await runNode(
			{
				resource: 'group',
				operation: 'getCourseGroups',
				groupCourseId: testCourseId,
			},
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		const found = (result as any[]).find((g) => Number(g.id) === createdGroupId);
		expect(found).toBeDefined();
	});

	it('updates the group description', async () => {
		expect(createdGroupId).toBeDefined();

		await runNode(
			{
				resource: 'group',
				operation: 'update',
				groupId: createdGroupId,
				groupDescription: 'Updated by n8n integration tests',
			},
			credentials!,
		);

		const result = await runNode(
			{ resource: 'group', operation: 'get', groupId: createdGroupId },
			credentials!,
		);
		expect(result[0]).toHaveProperty('description', 'Updated by n8n integration tests');
	});

	it('deletes the created group', async () => {
		expect(createdGroupId).toBeDefined();

		const result = await runNode(
			{ resource: 'group', operation: 'delete', groupId: createdGroupId },
			credentials!,
		);

		expect(result).toHaveProperty('success', true);
	});
});

afterAll(async () => {
	if (!isConfigured) return;

	if (createdGroupId !== undefined) {
		try {
			await runNode(
				{ resource: 'group', operation: 'delete', groupId: createdGroupId },
				credentials!,
			);
		} catch {
			// ignore cleanup errors
		}
	}
	if (testCourseId !== undefined) {
		try {
			await runNode(
				{ resource: 'course', operation: 'delete', courseId: testCourseId },
				credentials!,
			);
		} catch {
			// ignore cleanup errors
		}
	}
});

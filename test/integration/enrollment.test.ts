import { afterAll, describe, expect, it } from 'vitest';

import { credentials, isConfigured, uniqueSuffix } from './config';
import { runNode } from '../utils/n8nMock';

const suffix = uniqueSuffix();
const username = `n8nenrol_${suffix}`;
const courseShortname = `n8nenrolcourse_${suffix}`;

let testUserId: number | undefined;
let testCourseId: number | undefined;
let manualInstanceId: number | undefined;

async function createTestUser(): Promise<number> {
	const result = await runNode(
		{
			resource: 'user',
			operation: 'create',
			username,
			password: 'TestPass!2026',
			firstname: 'Enrol',
			lastname: 'Test',
			email: `${username}@example.com`,
			additionalFields: {},
		},
		credentials!,
	);
	return Number(result[0].id);
}

async function createTestCourse(): Promise<number> {
	const categories = await runNode(
		{ resource: 'course', operation: 'getCategories' },
		credentials!,
	);
	const categoryId = Number(categories[0].id);

	const result = await runNode(
		{
			resource: 'course',
			operation: 'create',
			fullname: `N8N Enrol Test ${suffix}`,
			shortname: courseShortname,
			categoryid: categoryId,
			courseAdditionalFields: {},
		},
		credentials!,
	);
	return Number(result[0].id);
}

describe.skipIf(!isConfigured)('Enrollment resource', () => {
	it('prepares a user and a course', async () => {
		testUserId = await createTestUser();
		testCourseId = await createTestCourse();

		expect(testUserId).toBeGreaterThan(0);
		expect(testCourseId).toBeGreaterThan(0);
	});

	it('enrols the user in the course as student', async () => {
		expect(testUserId).toBeDefined();
		expect(testCourseId).toBeDefined();

		const result = await runNode(
			{
				resource: 'enrollment',
				operation: 'enrol',
				enrollUserId: testUserId,
				enrollCourseId: testCourseId,
				roleId: 5,
			},
			credentials!,
		);

		expect(result).toHaveProperty('success', true);
	});

	it('returns the user in the course user list', async () => {
		expect(testCourseId).toBeDefined();

		const result = await runNode(
			{
				resource: 'enrollment',
				operation: 'getCourseUsers',
				enrollCourseId: testCourseId,
			},
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		const found = (result as any[]).find((u) => Number(u.id) === testUserId);
		expect(found).toBeDefined();
	});

	it('returns the course in the user course list', async () => {
		expect(testUserId).toBeDefined();

		const result = await runNode(
			{
				resource: 'enrollment',
				operation: 'getUserCourses',
				enrollUserId: testUserId,
			},
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		const found = (result as any[]).find((c) => Number(c.id) === testCourseId);
		expect(found).toBeDefined();
	});

	it('resolves the manual enrolment instance id', async () => {
		expect(testCourseId).toBeDefined();

		const result = await runNode(
			{
				resource: 'course',
				operation: 'getEnrolmentMethods',
				courseId: testCourseId,
			},
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		const manual = (result as any[]).find((m) => m.type === 'manual');
		expect(manual).toBeDefined();
		manualInstanceId = Number(manual.id);
	});

	it('unenrols the user from the course', async () => {
		expect(testUserId).toBeDefined();
		expect(testCourseId).toBeDefined();
		expect(manualInstanceId).toBeDefined();

		const result = await runNode(
			{
				resource: 'enrollment',
				operation: 'unenrol',
				enrollUserId: testUserId,
				enrollCourseId: testCourseId,
				instanceId: manualInstanceId,
			},
			credentials!,
		);

		expect(result).toHaveProperty('success', true);
	});
});

afterAll(async () => {
	if (!isConfigured) return;

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
	if (testUserId !== undefined) {
		try {
			await runNode({ resource: 'user', operation: 'delete', userId: testUserId }, credentials!);
		} catch {
			// ignore cleanup errors
		}
	}
});

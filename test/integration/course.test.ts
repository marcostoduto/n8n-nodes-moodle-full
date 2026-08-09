import { afterAll, describe, expect, it } from 'vitest';

import { credentials, isConfigured, uniqueSuffix } from './config';
import { runNode } from '../utils/n8nMock';

const suffix = uniqueSuffix();
const shortname = `n8ncourse_${suffix}`;
const fullname = `N8N Test Course ${suffix}`;

let createdCourseId: number | undefined;
let createdCategoryId: number | undefined;
let categoryIdForCourse: number | undefined;

async function pickDefaultCategory(): Promise<number> {
	const categories = await runNode(
		{ resource: 'course', operation: 'getCategories' },
		credentials!,
	);
	expect(Array.isArray(categories)).toBe(true);
	expect(categories.length).toBeGreaterThan(0);
	return Number(categories[0].id);
}

describe.skipIf(!isConfigured)('Course resource', () => {
	it('creates a category to host the test course', async () => {
		const result = await runNode(
			{
				resource: 'course',
				operation: 'createCategory',
				categoryName: `N8N Test Category ${suffix}`,
				parentCategoryId: 0,
				categoryIdNumber: `n8ncat_${suffix}`,
				categoryDescription: 'Created by n8n integration tests',
			},
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toHaveProperty('id');
		createdCategoryId = Number(result[0].id);
		categoryIdForCourse = createdCategoryId;
	});

	it('creates a course in the test category', async () => {
		if (categoryIdForCourse === undefined) {
			categoryIdForCourse = await pickDefaultCategory();
		}

		const result = await runNode(
			{
				resource: 'course',
				operation: 'create',
				fullname,
				shortname,
				categoryid: categoryIdForCourse,
				courseAdditionalFields: { summary: 'Created by n8n integration tests' },
			},
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toHaveProperty('id');
		createdCourseId = Number(result[0].id);
	});

	it('gets the created course by id', async () => {
		expect(createdCourseId).toBeDefined();

		const result = await runNode(
			{ resource: 'course', operation: 'get', courseId: createdCourseId },
			credentials!,
		);

		expect(result).toHaveProperty('id', createdCourseId);
		expect(result).toHaveProperty('shortname', shortname);
		expect(result).toHaveProperty('fullname', fullname);
	});

	it('gets all courses and finds the created one', async () => {
		expect(createdCourseId).toBeDefined();

		const result = await runNode(
			{ resource: 'course', operation: 'getAll' },
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		const found = (result as any[]).find((c) => Number(c.id) === createdCourseId);
		expect(found).toBeDefined();
	});

	it('gets the course sections', async () => {
		expect(createdCourseId).toBeDefined();

		const result = await runNode(
			{ resource: 'course', operation: 'getSections', courseId: createdCourseId },
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
	});

	it('updates the course summary', async () => {
		expect(createdCourseId).toBeDefined();

		await runNode(
			{
				resource: 'course',
				operation: 'update',
				courseId: createdCourseId,
				courseAdditionalFields: { summary: 'Updated by n8n integration tests' },
			},
			credentials!,
		);

		const result = await runNode(
			{ resource: 'course', operation: 'get', courseId: createdCourseId },
			credentials!,
		);
		expect(result).toHaveProperty('summary', 'Updated by n8n integration tests');
	});

	it('deletes the created course', async () => {
		expect(createdCourseId).toBeDefined();

		const result = await runNode(
			{ resource: 'course', operation: 'delete', courseId: createdCourseId },
			credentials!,
		);

		expect(result).toHaveProperty('success', true);
	});

	it('deletes the test category', async () => {
		expect(createdCategoryId).toBeDefined();

		const result = await runNode(
			{ resource: 'course', operation: 'deleteCategory', categoryId: createdCategoryId },
			credentials!,
		);

		expect(result).toHaveProperty('success', true);
	});
});

afterAll(async () => {
	if (!isConfigured) return;

	if (createdCourseId !== undefined) {
		try {
			await runNode(
				{ resource: 'course', operation: 'delete', courseId: createdCourseId },
				credentials!,
			);
		} catch {
			// ignore cleanup errors
		}
	}
	if (createdCategoryId !== undefined) {
		try {
			await runNode(
				{ resource: 'course', operation: 'deleteCategory', categoryId: createdCategoryId },
				credentials!,
			);
		} catch {
			// ignore cleanup errors
		}
	}
});

import { afterAll, describe, expect, it } from 'vitest';

import { credentials, isConfigured, uniqueSuffix } from './config';
import { runNode } from '../utils/n8nMock';

const suffix = uniqueSuffix();
const cohortName = `N8N Cohort ${suffix}`;
const cohortIdNumber = `n8ncohort_${suffix}`;

let createdCohortId: number | undefined;

describe.skipIf(!isConfigured)('Cohort resource', () => {
	it('creates a cohort in the system context', async () => {
		const result = await runNode(
			{
				resource: 'cohort',
				operation: 'create',
				cohortName,
				cohortIdNumber,
				cohortContextId: 1,
				cohortDescription: 'Created by n8n integration tests',
			},
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toHaveProperty('id');
		createdCohortId = Number(result[0].id);
	});

	it('gets the created cohort by id', async () => {
		expect(createdCohortId).toBeDefined();

		const result = await runNode(
			{ resource: 'cohort', operation: 'get', cohortId: createdCohortId },
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toHaveProperty('id', createdCohortId);
		expect(result[0]).toHaveProperty('name', cohortName);
		expect(result[0]).toHaveProperty('idnumber', cohortIdNumber);
	});

	it('updates the cohort name', async () => {
		expect(createdCohortId).toBeDefined();
		const updatedName = `${cohortName} updated`;

		await runNode(
			{
				resource: 'cohort',
				operation: 'update',
				cohortId: createdCohortId,
				cohortName: updatedName,
				cohortIdNumber,
				cohortContextId: 1,
				cohortDescription: 'Updated by n8n integration tests',
			},
			credentials!,
		);

		const result = await runNode(
			{ resource: 'cohort', operation: 'get', cohortId: createdCohortId },
			credentials!,
		);
		expect(result[0]).toHaveProperty('name', updatedName);
	});

	it('deletes the created cohort', async () => {
		expect(createdCohortId).toBeDefined();

		const result = await runNode(
			{ resource: 'cohort', operation: 'delete', cohortId: createdCohortId },
			credentials!,
		);

		expect(result).toHaveProperty('success', true);
	});
});

afterAll(async () => {
	if (!isConfigured) return;

	if (createdCohortId !== undefined) {
		try {
			await runNode(
				{ resource: 'cohort', operation: 'delete', cohortId: createdCohortId },
				credentials!,
			);
		} catch {
			// ignore cleanup errors
		}
	}
});

import { afterAll, describe, expect, it } from 'vitest';

import { credentials, isConfigured, uniqueSuffix } from './config';
import { runNode } from '../utils/n8nMock';

const suffix = uniqueSuffix();
const username = `n8ntest_${suffix}`;
const email = `n8ntest_${suffix}@example.com`;

let createdUserId: number | undefined;

describe.skipIf(!isConfigured)('User resource', () => {
	it('creates a user', async () => {
		const result = await runNode(
			{
				resource: 'user',
				operation: 'create',
				username,
				password: 'TestPass!2026',
				firstname: 'Test',
				lastname: 'N8n',
				email,
				additionalFields: {},
			},
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toHaveProperty('id');
		createdUserId = Number(result[0].id);
	});

	it('gets the created user by id', async () => {
		expect(createdUserId).toBeDefined();

		const result = await runNode(
			{ resource: 'user', operation: 'get', userId: createdUserId },
			credentials!,
		);

		expect(result).toHaveProperty('id', createdUserId);
		expect(result).toHaveProperty('username', username);
		expect(result).toHaveProperty('email', email);
	});

	it('gets the created user by field', async () => {
		const result = await runNode(
			{ resource: 'user', operation: 'getByField', field: 'username', fieldValue: username },
			credentials!,
		);

		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toHaveProperty('username', username);
	});

	it('gets user preferences', async () => {
		expect(createdUserId).toBeDefined();

		const result = await runNode(
			{ resource: 'user', operation: 'getPreferences', userId: createdUserId },
			credentials!,
		);

		expect(result).toHaveProperty('preferences');
	});

	it('updates the user firstname', async () => {
		expect(createdUserId).toBeDefined();

		await runNode(
			{
				resource: 'user',
				operation: 'update',
				userId: createdUserId,
				additionalFields: { firstname: 'Updated' },
			},
			credentials!,
		);

		const result = await runNode(
			{ resource: 'user', operation: 'get', userId: createdUserId },
			credentials!,
		);
		expect(result).toHaveProperty('firstname', 'Updated');
	});

	it('deletes the created user', async () => {
		expect(createdUserId).toBeDefined();

		const result = await runNode(
			{ resource: 'user', operation: 'delete', userId: createdUserId },
			credentials!,
		);

		expect(result).toHaveProperty('success', true);
	});
});

afterAll(async () => {
	if (!isConfigured) return;
	if (createdUserId === undefined) return;

	try {
		await runNode({ resource: 'user', operation: 'delete', userId: createdUserId }, credentials!);
	} catch {
		// ignore cleanup errors
	}
});

import { describe, expect, it } from 'vitest';

import { credentials, isConfigured } from './config';
import { runNode } from '../utils/n8nMock';

describe.skipIf(!isConfigured)('System resource', () => {
	it('getSiteInfo returns the connected Moodle site', async () => {
		const result = await runNode(
			{ resource: 'system', operation: 'getSiteInfo' },
			credentials!,
		);

		expect(result).toBeDefined();
		expect(result).toHaveProperty('sitename');
		expect(result).toHaveProperty('username');
		expect(typeof result.sitename).toBe('string');
	});

	it('getAuthPlugins does not throw', async () => {
		const result = await runNode(
			{ resource: 'system', operation: 'getAuthPlugins', authPluginsOptions: {} },
			credentials!,
		);

		expect(result).toBeDefined();
	});

	it('getSiteFeatures does not throw', async () => {
		const result = await runNode(
			{ resource: 'system', operation: 'getSiteFeatures' },
			credentials!,
		);

		expect(result).toBeDefined();
	});
});

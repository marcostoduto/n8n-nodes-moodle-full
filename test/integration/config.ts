import { config as loadEnv } from 'dotenv';
import * as path from 'path';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

export const MOODLE_URL = process.env.MOODLE_URL?.replace(/\/+$/, '') || '';
export const MOODLE_TOKEN = process.env.MOODLE_TOKEN || '';

export const credentials =
	MOODLE_URL && MOODLE_TOKEN
		? { url: MOODLE_URL, token: MOODLE_TOKEN }
		: null;

export const isConfigured = credentials !== null;

export function uniqueSuffix(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

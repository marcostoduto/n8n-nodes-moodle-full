import {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	JsonObject,
	NodeApiError,
} from 'n8n-workflow';

type MoodleContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions;

/**
 * Serializes a (possibly nested) parameter object into the flat PHP-style
 * form encoding expected by Moodle's REST server, e.g.
 * `{ users: [{ id: 1 }] }` -> `users[0][id]=1`.
 *
 * - `undefined` / `null` values are skipped, so optional parameters can be
 *   passed without sending the literal string "undefined" (which Moodle rejects).
 * - Booleans are sent as 1/0 (Moodle rejects "true"/"false" for PARAM_BOOL).
 * - Empty arrays/objects produce no keys (Moodle then applies its defaults).
 */
export function serializeMoodleParams(params: IDataObject): URLSearchParams {
	const form = new URLSearchParams();

	const append = (key: string, value: unknown): void => {
		if (value === undefined || value === null) {
			return;
		}
		if (typeof value === 'boolean') {
			form.append(key, value ? '1' : '0');
			return;
		}
		if (value instanceof Date) {
			form.append(key, String(Math.floor(value.getTime() / 1000)));
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((item, index) => append(`${key}[${index}]`, item));
			return;
		}
		if (typeof value === 'object') {
			for (const [childKey, childValue] of Object.entries(value as IDataObject)) {
				append(`${key}[${childKey}]`, childValue);
			}
			return;
		}
		if (typeof value === 'number' && !Number.isFinite(value)) {
			return;
		}
		form.append(key, String(value));
	};

	for (const [key, value] of Object.entries(params)) {
		append(key, value);
	}
	return form;
}

function getErrorCode(error: any): string | undefined {
	return error?.code ?? error?.cause?.code;
}

export async function moodleApiRequest(
	this: MoodleContext,
	method: IHttpRequestMethods,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<any> {
	const credentials = await this.getCredentials('moodleApi');
	const url = String(credentials.url ?? '').trim();
	const token = String(credentials.token ?? '').trim();

	const cleanUrl = url.replace(/\/+$/, '');
	const fullUrl = `${cleanUrl}/webservice/rest/server.php`;

	const formData = serializeMoodleParams({
		...qs,
		...body,
		wstoken: token,
		moodlewsrestformat: 'json',
	});
	const wsfunction = formData.get('wsfunction') ?? '';

	const options: IHttpRequestOptions = {
		method,
		url: fullUrl,
		body: formData.toString(),
		timeout: 60000,
		headers: {
			'User-Agent': 'n8n-nodes-moodle-full',
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json',
		},
		json: false,
	};

	let response: unknown;
	try {
		response = await this.helpers.httpRequest(options);
	} catch (error: any) {
		const code = getErrorCode(error);
		let message = error?.message || 'Unknown error occurred';
		let description = '';
		switch (code) {
			case 'ECONNREFUSED':
				message = 'Connection refused - Moodle server may be offline or unreachable';
				description = `Unable to connect to ${cleanUrl}`;
				break;
			case 'ENOTFOUND':
				message = 'Host not found - check the Moodle URL in the credentials';
				description = `Cannot resolve hostname of ${cleanUrl}`;
				break;
			case 'ETIMEDOUT':
			case 'ECONNABORTED':
				message = 'Connection timeout - Moodle server is not responding';
				break;
			default:
				break;
		}
		const status = error?.response?.status ?? error?.httpCode ?? error?.statusCode;
		if (status) {
			message = `HTTP ${status} calling ${wsfunction}: ${error?.response?.statusText || message}`;
			if (status === 404) {
				description = `The Moodle REST endpoint was not found at ${fullUrl}. Check the Moodle URL and that the REST protocol is enabled.`;
			}
		}
		throw new NodeApiError(this.getNode(), (error ?? {}) as JsonObject, {
			message,
			description: description || undefined,
			httpCode: status ? String(status) : undefined,
		});
	}

	let parsed: any = response;
	if (typeof response === 'string') {
		const text = response.trim();
		if (text === '' || text === 'null') {
			return null;
		}
		try {
			parsed = JSON.parse(text);
		} catch {
			throw new NodeApiError(this.getNode(), { message: text } as JsonObject, {
				message: `Moodle returned a non-JSON response for ${wsfunction}`,
				description: text.slice(0, 2000),
			});
		}
	} else if (Buffer.isBuffer(response)) {
		const text = response.toString('utf8').trim();
		parsed = text === '' || text === 'null' ? null : JSON.parse(text);
	}

	if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed.exception || parsed.errorcode)) {
		const details = [
			parsed.errorcode ? `Error code: ${parsed.errorcode}` : '',
			parsed.debuginfo ? `Debug info: ${parsed.debuginfo}` : '',
			wsfunction ? `Function: ${wsfunction}` : '',
		]
			.filter(Boolean)
			.join('\n');
		throw new NodeApiError(this.getNode(), parsed as JsonObject, {
			message: parsed.message || `Moodle API error (${parsed.errorcode || 'unknown'})`,
			description: details,
		});
	}

	return parsed;
}

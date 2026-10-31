import {
    IExecuteFunctions,
    IHookFunctions,
    ILoadOptionsFunctions,
    IWebhookFunctions,
} from 'n8n-workflow';

import {
    IDataObject,
    IHttpRequestOptions,
    IHttpRequestMethods,
    NodeApiError,
} from 'n8n-workflow';

/**
 * Flattens an arbitrarily nested object into the bracket notation expected by the
 * Moodle REST server (`users[0][customfields][1][value]=...`).
 *
 * - `undefined` and `null` values are dropped, so optional parameters can be passed
 *   as `undefined` without sending the literal string "undefined" to Moodle.
 * - Booleans are sent as `1` / `0`, the only boolean encoding every Moodle
 *   version accepts.
 * - Arrays and objects at any depth (including the top level) are expanded.
 */
export function encodeMoodleParams(params: IDataObject, prefix = ''): Array<[string, string]> {
    const pairs: Array<[string, string]> = [];
    const add = (key: string, value: unknown) => {
        if (value === undefined || value === null) {
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item, index) => add(`${key}[${index}]`, item));
            return;
        }
        if (value instanceof Date) {
            pairs.push([key, String(Math.floor(value.getTime() / 1000))]);
            return;
        }
        if (typeof value === 'object') {
            for (const [childKey, childValue] of Object.entries(value as IDataObject)) {
                add(`${key}[${childKey}]`, childValue);
            }
            return;
        }
        if (typeof value === 'boolean') {
            pairs.push([key, value ? '1' : '0']);
            return;
        }
        pairs.push([key, String(value)]);
    };
    for (const [key, value] of Object.entries(params)) {
        add(prefix ? `${prefix}[${key}]` : key, value);
    }
    return pairs;
}

export function buildMoodleRequestBody(token: string, body: IDataObject = {}, qs: IDataObject = {}): string {
    const formData = new URLSearchParams();
    const pairs = encodeMoodleParams({
        ...qs,
        ...body,
    });
    formData.append('wstoken', token);
    formData.append('moodlewsrestformat', 'json');
    for (const [key, value] of pairs) {
        if (key === 'wstoken' || key === 'moodlewsrestformat') continue;
        formData.append(key, value);
    }
    return formData.toString();
}

export async function moodleApiRequest(
    this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions,
    method: IHttpRequestMethods,
    body: IDataObject = {},
    qs: IDataObject = {},
): Promise<any> {
    const credentials = await this.getCredentials('moodleApi');
    const url = String(credentials.url ?? '').trim();
    const token = String(credentials.token ?? '').trim();

    const cleanUrl = url.replace(/\/+$/, '');
    const fullUrl = `${cleanUrl}/webservice/rest/server.php`;

    const bodyString = buildMoodleRequestBody(token, body, qs);

    const options: IHttpRequestOptions = {
        method,
        url: fullUrl,
        body: bodyString,
        timeout: 30000,
        headers: {
            'User-Agent': 'n8n-moodle-node/1.0.0',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        json: false,
    };
    try {
        const response = await this.helpers.httpRequest(options);

        let parsedResponse;
        try {
            if (typeof response === 'string') {
                // Moodle answers void functions with an empty body or the literal "null".
                parsedResponse = response.trim() === '' ? null : JSON.parse(response);
            } else {
                parsedResponse = response;
            }
        } catch (parseError) {
            if (typeof response === 'string' && response.includes('is already used for another')) {
                throw new NodeApiError(this.getNode(), {
                    message: 'Moodle API Error',
                    description: response,
                });
            }

            throw new NodeApiError(this.getNode(), {
                message: 'Failed to parse Moodle API response',
                description: `Response was not valid JSON (check the Moodle URL and that the REST protocol is enabled): ${String(response).slice(0, 500)}`,
            });
        }

        if (parsedResponse === null || parsedResponse === undefined) {
            return parsedResponse;
        }

        if (parsedResponse && typeof parsedResponse === 'object' && parsedResponse.exception) {
            throw new NodeApiError(this.getNode(), {
                message: parsedResponse.message || 'Moodle API Error',
                description: `${parsedResponse.debuginfo || ''}\nErrorcode: ${parsedResponse.errorcode || 'Unknown'}`,
                httpCode: parsedResponse.httpCode,
            });
        }

        return parsedResponse;
    } catch (error: any) {
        if (error instanceof NodeApiError) {
            throw error;
        }

        let errorMessage = 'Unknown error occurred';
        let errorDescription = '';

        if (error.code) {
            switch (error.code) {
                case 'ECONNREFUSED':
                    errorMessage = 'Connection refused - Moodle server may be offline or unreachable';
                    errorDescription = `Unable to connect to ${fullUrl}`;
                    break;
                case 'ENOTFOUND':
                    errorMessage = 'Host not found - Invalid URL or DNS issue';
                    errorDescription = `Cannot resolve hostname: ${fullUrl}`;
                    break;
                case 'ETIMEDOUT':
                    errorMessage = 'Connection timeout - Server is not responding';
                    errorDescription = 'Request timed out after 30 seconds';
                    break;
                default:
                    errorMessage = error.message || errorMessage;
                    errorDescription = `Error code: ${error.code}`;
            }
        } else if (error.response) {
            errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
            errorDescription = `Response: ${JSON.stringify(error.response.data, null, 2)}`;
        } else {
            errorMessage = error.message || errorMessage;
        }

        throw new NodeApiError(this.getNode(), {
            message: errorMessage,
            description: errorDescription,
            httpCode: error.response?.status,
        });
    }
}

export async function moodleApiRequestAllItems(
    this: IExecuteFunctions | ILoadOptionsFunctions,
    method: IHttpRequestMethods,
    body: IDataObject = {},
    qs: IDataObject = {},
): Promise<any> {
    return moodleApiRequest.call(this, method, body, qs);
}

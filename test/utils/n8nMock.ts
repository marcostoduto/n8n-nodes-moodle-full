import {
	IExecuteFunctions,
	IDataObject,
	IHttpRequestOptions,
	INode,
	INodeExecutionData,
	INodeProperties,
	INodePropertyValue,
} from 'n8n-workflow';

import { Moodle } from '../../nodes/Moodle/Moodle.node';

type DisplayRules = Record<string, unknown[] | undefined>;

function currentValue(name: string, params: Record<string, unknown>, properties: INodeProperties[]): unknown {
	if (name in params) return params[name];
	return properties.find((p) => p.name === name)?.default;
}

/** Evaluates a property's `displayOptions` (show/hide) the way the n8n editor does. */
export function isDisplayed(prop: INodeProperties, params: Record<string, unknown>): boolean {
	const properties = new Moodle().description.properties;
	const show = prop.displayOptions?.show as DisplayRules | undefined;
	const hide = prop.displayOptions?.hide as DisplayRules | undefined;
	for (const [key, values] of Object.entries(show ?? {})) {
		if (!values?.includes(currentValue(key, params, properties))) return false;
	}
	for (const [key, values] of Object.entries(hide ?? {})) {
		if (values?.includes(currentValue(key, params, properties))) return false;
	}
	return true;
}

export interface MockCredentials {
	url: string;
	token: string;
}

/**
 * Builds a minimal n8n `IExecuteFunctions` context that lets the Moodle node's
 * `execute()` run against a real Moodle instance. Parameters not supplied
 * explicitly fall back to the defaults declared in the node description.
 */
export interface MockContextState {
	/** Every value the node passed to `helpers.returnJsonArray`, in call order. */
	emitted: unknown[];
	/** Every HTTP request the node sent, in call order. */
	requests: IHttpRequestOptions[];
}

export type MockHttpHandler = (options: IHttpRequestOptions) => Promise<any>;

export function createMockContext(
	params: Record<string, unknown>,
	credentials: MockCredentials,
	state: MockContextState = { emitted: [], requests: [] },
	httpHandler?: MockHttpHandler,
	options: { continueOnFail?: boolean; inputItems?: INodeExecutionData[] } = {},
): IExecuteFunctions {
	const nodeInstance = new Moodle();
	const properties = nodeInstance.description.properties;

	const context = {
		getMode: () => 'manual' as const,
		getInputData: (): INodeExecutionData[] => options.inputItems ?? [{ json: {} }],
		getNodeParameter: (name: string, _itemIndex: number, fallback?: unknown): any => {
			if (name in params) {
				// Real n8n hands out copies, so mutations by the node never leak back.
				return structuredClone(params[name]);
			}
			// Like n8n, parameters hidden by `displayOptions` are not available: reading
			// one without a fallback throws instead of silently returning its default.
			const prop = properties.find((p) => p.name === name && isDisplayed(p, params));
			if (prop) return structuredClone(prop.default as INodePropertyValue);
			if (fallback !== undefined) return fallback;
			throw new Error(`Could not get parameter "${name}"`);
		},
		getCredentials: async (): Promise<MockCredentials> => credentials,
		getNode: (): INode => ({
			id: 'test-moodle-node',
			name: 'Moodle Full',
			type: 'n8n-nodes-base.moodleFull',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		continueOnFail: () => options.continueOnFail ?? false,
		helpers: {
			httpRequest: async (options: IHttpRequestOptions): Promise<any> => {
				state.requests.push(options);
				if (httpHandler) return httpHandler(options);
				const url = options.url ?? '';
				const method = options.method ?? 'GET';
				const headers: Record<string, string> = {
					...(options.headers as Record<string, string> | undefined),
				};
				delete headers['Content-Length'];
				delete headers['Host'];

				let response: Response;
				try {
					response = await fetch(url, {
						method,
						headers,
						body: typeof options.body === 'string' ? options.body : undefined,
						signal: AbortSignal.timeout(options.timeout ?? 30000),
					});
				} catch (err) {
					throw err;
				}

				const text = await response.text();
				if (!response.ok) {
					const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
					error.response = {
						status: response.status,
						statusText: response.statusText,
						data: text,
					};
					throw error;
				}
				return text;
			},
			returnJsonArray: (jsonData: IDataObject | IDataObject[]): INodeExecutionData[] => {
				state.emitted.push(jsonData);
				const arr = Array.isArray(jsonData) ? jsonData : [jsonData];
				return arr.map((j) => ({ json: j }));
			},
			constructExecutionMetaData: (
				inputData: INodeExecutionData[],
				options: { itemData: { item: number } },
			) =>
				inputData.map((d) => ({
					...d,
					pairedItem: { item: options.itemData.item },
				})),
			normalizeItems: (items: INodeExecutionData | INodeExecutionData[]) =>
				Array.isArray(items) ? items : [items],
		} as unknown as IExecuteFunctions['helpers'],
	} as unknown as IExecuteFunctions;

	return context;
}

/**
 * Runs the Moodle node's `execute()` with the given parameters against the real
 * Moodle instance and returns the response the node emitted for the (single)
 * input item, before n8n splits arrays into separate output items.
 */
export async function runNode(
	params: Record<string, unknown>,
	credentials: MockCredentials,
): Promise<any> {
	const state: MockContextState = { emitted: [], requests: [] };
	const nodeInstance = new Moodle();
	const context = createMockContext(params, credentials, state);
	await nodeInstance.execute.call(context);
	return state.emitted[0];
}

/**
 * Runs the node and returns the n8n output items (one array entry per item).
 */
export async function runNodeItems(
	params: Record<string, unknown>,
	credentials: MockCredentials,
): Promise<INodeExecutionData[]> {
	const nodeInstance = new Moodle();
	const context = createMockContext(params, credentials);
	const result = await nodeInstance.execute.call(context);
	return result[0] ?? [];
}

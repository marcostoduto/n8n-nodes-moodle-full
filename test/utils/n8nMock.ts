import {
	IExecuteFunctions,
	IDataObject,
	IHttpRequestOptions,
	INode,
	INodeExecutionData,
	INodePropertyValue,
} from 'n8n-workflow';

import { Moodle } from '../../nodes/Moodle/Moodle.node';

export interface MockCredentials {
	url: string;
	token: string;
}

/**
 * Builds a minimal n8n `IExecuteFunctions` context that lets the Moodle node's
 * `execute()` run against a real Moodle instance. Parameters not supplied
 * explicitly fall back to the defaults declared in the node description.
 */
export function createMockContext(
	params: Record<string, unknown>,
	credentials: MockCredentials,
): IExecuteFunctions {
	const nodeInstance = new Moodle();
	const properties = nodeInstance.description.properties;

	const context = {
		getMode: () => 'manual' as const,
		getInputData: (): INodeExecutionData[] => [{ json: {} }],
		getNodeParameter: (name: string, _itemIndex: number): any => {
			if (name in params) {
				return params[name];
			}
			const prop = properties.find((p) => p.name === name);
			return prop ? (prop.default as INodePropertyValue) : undefined;
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
		continueOnFail: () => false,
		helpers: {
			httpRequest: async (options: IHttpRequestOptions): Promise<any> => {
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
 * Moodle instance and returns the first output item's `json` payload.
 */
export async function runNode(
	params: Record<string, unknown>,
	credentials: MockCredentials,
): Promise<any> {
	const nodeInstance = new Moodle();
	const context = createMockContext(params, credentials);
	const result = await nodeInstance.execute.call(context);
	const output = result[0]?.[0];
	return (output as INodeExecutionData | undefined)?.json as IDataObject | undefined;
}

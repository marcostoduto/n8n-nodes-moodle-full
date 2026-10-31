import { IDataObject, INode, INodeParameters, INodeProperties, NodeHelpers } from 'n8n-workflow';
import { Moodle } from '../../nodes/Moodle/Moodle.node';

export interface CapturedCall {
	params: Record<string, string>;
	raw: string;
	headers: Record<string, string>;
}

const node = new Moodle();
export const properties = node.description.properties as INodeProperties[];

export function listOperations(): Array<{ resource: string; operation: string }> {
	const resources = (properties.find((p) => p.name === 'resource')!.options as any[]).map((o) => o.value as string);
	const out: Array<{ resource: string; operation: string }> = [];
	for (const resource of resources) {
		const opProp = properties.find(
			(p) =>
				p.name === 'operation' &&
				(p.displayOptions?.show?.resource as string[] | undefined)?.includes(resource),
		);
		const ops = opProp ? (opProp.options as any[]).map((o) => o.value as string) : ['__none__'];
		for (const operation of ops) out.push({ resource, operation });
	}
	return out;
}

/** Resolves the parameters n8n would actually store for this node configuration. */
export function resolveParameters(overrides: INodeParameters): INodeParameters {
	const nodeStub = { name: 'Moodle', type: 'moodleFull', typeVersion: 1, parameters: overrides } as unknown as INode;
	return NodeHelpers.getNodeParameters(
		properties,
		overrides,
		true,
		false,
		nodeStub,
		node.description,
	) as INodeParameters;
}

export async function runOperation(
	userParams: INodeParameters,
	respond: (call: CapturedCall) => unknown = () => ({}),
	options: { continueOnFail?: boolean } = {},
) {
	const parameters = resolveParameters(userParams);
	const calls: CapturedCall[] = [];
	const ctx = {
		getInputData: () => [{ json: {} }],
		getNode: () => ({ name: 'Moodle', type: 'moodleFull', typeVersion: 1, parameters }),
		getNodeParameter: (name: string, _i: number, fallback?: unknown) => {
			const value = (parameters as IDataObject)[name];
			if (value === undefined) {
				if (fallback !== undefined) return fallback;
				throw new Error(`Could not get parameter "${name}"`);
			}
			return JSON.parse(JSON.stringify(value));
		},
		getCredentials: async () => ({ url: 'https://moodle.example.com/', token: 'tok' }),
		continueOnFail: () => !!options.continueOnFail,
		helpers: {
			httpRequest: async (opts: any) => {
				const raw = typeof opts.body === 'string' ? opts.body : '';
				const params: Record<string, string> = {};
				for (const [k, v] of new URLSearchParams(raw)) params[k] = v;
				const call = { params, raw, headers: opts.headers ?? {} };
				calls.push(call);
				const r = respond(call);
				return typeof r === 'string' ? r : JSON.stringify(r);
			},
			returnJsonArray: (data: any) => {
				const arr = Array.isArray(data) ? data : [data];
				return arr.map((json) => {
					if (json === null || typeof json !== 'object' || Array.isArray(json)) {
						throw new Error(`returnJsonArray received a non-object item: ${JSON.stringify(json)}`);
					}
					return { json };
				});
			},
			constructExecutionMetaData: (items: any[], o: any) =>
				items.map((d) => ({ ...d, pairedItem: { item: o.itemData.item } })),
		},
	};
	const output = await node.execute.call(ctx as any);
	return { output: output[0], calls, parameters };
}

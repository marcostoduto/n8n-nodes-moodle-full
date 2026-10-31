import {
	IExecuteFunctions,
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchItems,
	INodeListSearchResult,
	INodeParameterResourceLocator,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { moodleApiRequest } from './GenericFunctions';

/** Converts an n8n dateTime value (ISO string, Date, or unix seconds) to a unix timestamp in seconds. */
export function toTimestamp(value: unknown): number | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	if (typeof value === 'number') {
		return Number.isFinite(value) ? Math.floor(value) : undefined;
	}
	if (value instanceof Date) {
		return Math.floor(value.getTime() / 1000);
	}
	const str = String(value).trim();
	if (/^\d+$/.test(str)) {
		return parseInt(str, 10);
	}
	const ms = new Date(str).getTime();
	return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

/** Parses a comma separated list of numeric IDs. Accepts arrays and numbers too. */
export function parseIdList(value: unknown): number[] {
	if (value === undefined || value === null || value === '') {
		return [];
	}
	const parts = Array.isArray(value) ? value : String(value).split(',');
	return parts.map((id) => parseInt(String(id).trim(), 10)).filter((id) => !Number.isNaN(id));
}

/** Reads a numeric ID from a resourceLocator (or plain number/string) parameter. */
function getRLValue(ctx: IExecuteFunctions, i: number, name: string, defaultVal = 0): number {
	const param = ctx.getNodeParameter(name, i, defaultVal) as unknown;
	let raw: unknown = param;
	if (param !== null && typeof param === 'object' && '__rl' in (param as IDataObject)) {
		raw = (param as INodeParameterResourceLocator).value;
	}
	if (typeof raw === 'number') {
		return Number.isFinite(raw) ? raw : defaultVal;
	}
	const parsed = parseInt(String(raw ?? '').trim(), 10);
	return Number.isNaN(parsed) ? defaultVal : parsed;
}

/** Parses a JSON parameter, accepting already-parsed values, with a helpful error message. */
function parseJsonParam(ctx: IExecuteFunctions, i: number, name: string, fallback: unknown): any {
	const value = ctx.getNodeParameter(name, i, fallback) as unknown;
	if (typeof value !== 'string') {
		return value ?? fallback;
	}
	if (value.trim() === '') {
		return fallback;
	}
	try {
		return JSON.parse(value);
	} catch (error) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Parameter "${name}" is not valid JSON: ${(error as Error).message}`,
			{
				itemIndex: i,
			},
		);
	}
}

/** Converts `{ a: 1 }` or `[{ name: 'a', value: 1 }]` into `[{ name: 'a', value: '1' }]`. */
function toNameValueList(data: unknown, keyName = 'name'): IDataObject[] {
	if (Array.isArray(data)) {
		return data as IDataObject[];
	}
	if (data && typeof data === 'object') {
		return Object.entries(data as IDataObject).map(([key, value]) => ({
			[keyName]: key,
			value: typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value),
		}));
	}
	return [];
}

/** Removes keys with empty-string / undefined / null values. */
function compact(obj: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== '' && value !== undefined && value !== null) {
			out[key] = value;
		}
	}
	return out;
}

/** Normalizes a Moodle response into n8n JSON items. */
export function toJsonItems(data: unknown): IDataObject[] {
	if (data === null || data === undefined) {
		return [{ success: true }];
	}
	if (Array.isArray(data)) {
		return data.map((entry) =>
			entry !== null && typeof entry === 'object' && !Array.isArray(entry)
				? (entry as IDataObject)
				: { value: entry as any },
		);
	}
	if (typeof data === 'object') {
		return [data as IDataObject];
	}
	return [{ result: data as any }];
}

function filterResults(results: INodeListSearchItems[], filter?: string): INodeListSearchItems[] {
	const sorted = results.sort((a, b) => a.name.localeCompare(b.name));
	if (!filter) {
		return sorted;
	}
	const needle = filter.toLowerCase();
	return sorted.filter((r) => r.name.toLowerCase().includes(needle) || String(r.value) === filter);
}

function getLoadOptionsCourseId(ctx: ILoadOptionsFunctions, name: string): number {
	let param: unknown;
	try {
		param = ctx.getNodeParameter(name);
	} catch {
		return 0;
	}
	const raw =
		param && typeof param === 'object' && '__rl' in (param as IDataObject)
			? (param as INodeParameterResourceLocator).value
			: param;
	const id = parseInt(String(raw ?? ''), 10);
	return Number.isNaN(id) ? 0 : id;
}

export class Moodle implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Moodle Full',
		name: 'moodleFull',
		icon: 'file:moodleFull.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["resource"] + " - " + $parameter["operation"] }}',
		description: 'Access Moodle LMS API',
		defaults: {
			name: 'Moodle',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'moodleApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Assignment', value: 'assignment' },
					{ name: 'Badge', value: 'badge' },
					{ name: 'Book', value: 'book' },
					{ name: 'Calendar', value: 'calendar' },
					{ name: 'Chat', value: 'chat' },
					{ name: 'Choice', value: 'choice' },
					{ name: 'Cohort', value: 'cohort' },
					{ name: 'Custom Certificate', value: 'customcert' },
					{ name: 'Comment', value: 'comment' },
					{ name: 'Competency', value: 'competency' },
					{ name: 'Course', value: 'course' },
					{ name: 'Data (Database)', value: 'data' },
					{ name: 'Enrollment', value: 'enrollment' },
					{ name: 'Feedback', value: 'feedback' },
					{ name: 'File', value: 'file' },
					{ name: 'Folder', value: 'folder' },
					{ name: 'Forum', value: 'forum' },
					{ name: 'Glossary', value: 'glossary' },
					{ name: 'Grade', value: 'grade' },
					{ name: 'Group', value: 'group' },
					{ name: 'Joomdle', value: 'joomdle' },
					{ name: 'Lesson', value: 'lesson' },
					{ name: 'Message', value: 'message' },
					{ name: 'Note', value: 'note' },
					{ name: 'Page', value: 'page' },
					{ name: 'Quiz', value: 'quiz' },
					{ name: 'Rating', value: 'rating' },
					{ name: 'Resource', value: 'resource' },
					{ name: 'SCORM', value: 'scorm' },
					{ name: 'Survey', value: 'survey' },
					{ name: 'System', value: 'system' },
					{ name: 'URL Resource', value: 'url' },
					{ name: 'User', value: 'user' },
					{ name: 'Wiki', value: 'wiki' },
					{ name: 'Workshop', value: 'workshop' },
				],
				default: 'user',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['user'] } },
				options: [
					{ name: 'Create', value: 'create', description: 'Create a new user', action: 'Create a user' },
					{ name: 'Get', value: 'get', description: 'Get user by ID', action: 'Get a user' },
					{
						name: 'Get By Field',
						value: 'getByField',
						description: 'Get users by field',
						action: 'Get users by field',
					},
					{ name: 'Get All', value: 'getAll', description: 'Get many users', action: 'Get many users' },
					{ name: 'Update', value: 'update', description: 'Update a user', action: 'Update a user' },
					{ name: 'Delete', value: 'delete', description: 'Delete a user', action: 'Delete a user' },
					{
						name: 'Get Preferences',
						value: 'getPreferences',
						description: 'Get user preferences',
						action: 'Get user preferences',
					},
					{
						name: 'Set Preferences',
						value: 'setPreferences',
						description: 'Set user preferences',
						action: 'Set user preferences',
					},
					{
						name: 'Agree Site Policy',
						value: 'agreeSitePolicy',
						description: 'Agree to site policy',
						action: 'Agree to site policy',
					},
					{
						name: 'Add Device',
						value: 'addDevice',
						description: 'Add a mobile device',
						action: 'Add a mobile device',
					},
				],
				default: 'create',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['course'] } },
				options: [
					{ name: 'Create', value: 'create', description: 'Create a new course', action: 'Create a course' },
					{ name: 'Get', value: 'get', description: 'Get course by ID', action: 'Get a course' },
					{ name: 'Get All', value: 'getAll', description: 'Get many courses', action: 'Get many courses' },
					{ name: 'Search', value: 'search', description: 'Search courses', action: 'Search courses' },
					{ name: 'Update', value: 'update', description: 'Update a course', action: 'Update a course' },
					{ name: 'Delete', value: 'delete', description: 'Delete a course', action: 'Delete a course' },
					{
						name: 'Duplicate',
						value: 'duplicate',
						description: 'Duplicate a course',
						action: 'Duplicate a course',
					},
					{
						name: 'Get Categories',
						value: 'getCategories',
						description: 'Get course categories',
						action: 'Get course categories',
					},
					{
						name: 'Get Category',
						value: 'getCategory',
						description: 'Get a single category',
						action: 'Get a course category',
					},
					{
						name: 'Create Category',
						value: 'createCategory',
						description: 'Create a category',
						action: 'Create a course category',
					},
					{
						name: 'Update Category',
						value: 'updateCategory',
						description: 'Update a category',
						action: 'Update a course category',
					},
					{
						name: 'Delete Category',
						value: 'deleteCategory',
						description: 'Delete a category',
						action: 'Delete a course category',
					},
					{
						name: 'Get Contents',
						value: 'getContents',
						description: 'Get course contents',
						action: 'Get course contents',
					},
					{
						name: 'Get Sections',
						value: 'getSections',
						description: 'Get course sections',
						action: 'Get course sections',
					},
					{
						name: 'Create Section',
						value: 'createSection',
						description: 'Create a section',
						action: 'Create a course section',
					},
					{
						name: 'Update Section',
						value: 'updateSection',
						description: 'Update a section',
						action: 'Update a course section',
					},
					{
						name: 'Delete Section',
						value: 'deleteSection',
						description: 'Delete a section',
						action: 'Delete a course section',
					},
					{ name: 'Get Enrolled Users', value: 'getEnrolledUsers', action: 'Get enrolled users' },
					{ name: 'Get Enrolment Methods', value: 'getEnrolmentMethods', action: 'Get enrolment methods' },
					{
						name: 'Get Module',
						value: 'getModule',
						description: 'Get course module by ID',
						action: 'Get course module',
					},
				],
				default: 'get',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['enrollment'] } },
				options: [
					{ name: 'Enrol', value: 'enrol', description: 'Enrol a user', action: 'Enrol a user' },
					{ name: 'Unenrol', value: 'unenrol', description: 'Unenrol a user', action: 'Unenrol a user' },
					{ name: 'Get User Courses', value: 'getUserCourses', action: 'Get user courses' },
					{ name: 'Get Course Users', value: 'getCourseUsers', action: 'Get course users' },
					{ name: 'Self Enrol', value: 'selfEnrol', action: 'Self enrol' },
					{
						name: 'Get Self Enrol Instance',
						value: 'getSelfEnrolInstance',
						description: 'Get self enrolment instance',
						action: 'Get self enrolment instance',
					},
					{
						name: 'Get Enrolled With Capability',
						value: 'getEnrolledWithCapability',
						description: 'Get enrolled users with capability',
						action: 'Get enrolled with capability',
					},
					{ name: 'Get Potential Users', value: 'getPotentialUsers', action: 'Get potential users' },
					{
						name: 'Get Enrolment',
						value: 'getEnrolment',
						description: 'Get the enrolment of a user in a course',
						action: 'Get the enrolment of a user in a course',
					},
				],
				default: 'enrol',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['grade'] } },
				options: [
					{ name: 'Get User Course Grades', value: 'getUserCourseGrades', action: 'Get user course grades' },
					{ name: 'View Grade Report', value: 'viewGradeReport', action: 'View grade report' },
					{ name: 'Get Grades Table', value: 'getGradesTable', action: 'Get grades table' },
					{ name: 'Get Grade Items', value: 'getGradeItems', action: 'Get grade items' },
					{
						name: 'Get Grade Tree',
						value: 'getGradeDefinitions',
						description: 'Get the grade tree (categories and items) of a course',
						action: 'Get grade tree',
					},
					{ name: 'Get Gradable Users', value: 'getGradableUsers', action: 'Get gradable users' },
					{ name: 'Update Grades', value: 'updateGrades', action: 'Update grades' },
				],
				default: 'getUserCourseGrades',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['message'] } },
				options: [
					{ name: 'Send', value: 'send', description: 'Send an instant message', action: 'Send a message' },
					{ name: 'Get Messages', value: 'getMessages', action: 'Get messages' },
					{ name: 'Get Conversations', value: 'getConversations', action: 'Get conversations' },
					{
						name: 'Get Conversation Messages',
						value: 'getConversationMessages',
						action: 'Get conversation messages',
					},
					{
						name: 'Delete Conversation',
						value: 'deleteConversation',
						description: 'Delete a conversation',
						action: 'Delete a conversation',
					},
					{
						name: 'Mark Message Read',
						value: 'markMessageRead',
						description: 'Mark message as read',
						action: 'Mark a message as read',
					},
					{
						name: 'Delete Message',
						value: 'deleteMessage',
						description: 'Delete a message',
						action: 'Delete a message',
					},
					{
						name: 'Send To Conversation',
						value: 'sendToConversation',
						description: 'Send message to conversation',
						action: 'Send message to conversation',
					},
				],
				default: 'send',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['system'] } },
				options: [
					{
						name: 'Get Site Info',
						value: 'getSiteInfo',
						description: 'Get site information',
						action: 'Get site info',
					},
					{
						name: 'Get Auth Plugins',
						value: 'getAuthPlugins',
						description: 'Get the site info and the web service functions available to the token',
						action: 'Get auth plugins',
					},
					{ name: 'Get Site Features', value: 'getSiteFeatures', action: 'Get site features' },
				],
				default: 'getSiteInfo',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['cohort'] } },
				options: [
					{ name: 'Create', value: 'create', description: 'Create a cohort', action: 'Create a cohort' },
					{ name: 'Get', value: 'get', description: 'Get cohorts', action: 'Get cohorts' },
					{ name: 'Update', value: 'update', description: 'Update a cohort', action: 'Update a cohort' },
					{ name: 'Delete', value: 'delete', description: 'Delete a cohort', action: 'Delete a cohort' },
					{
						name: 'Add Members',
						value: 'addMembers',
						description: 'Add members to cohort',
						action: 'Add cohort members',
					},
					{
						name: 'Delete Members',
						value: 'deleteMembers',
						description: 'Delete members from cohort',
						action: 'Delete cohort members',
					},
					{
						name: 'Get Members',
						value: 'getMembers',
						description: 'Get cohort members',
						action: 'Get cohort members',
					},
				],
				default: 'get',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['group'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create a group', description: 'Create a group' },
					{ name: 'Get', value: 'get', action: 'Get groups', description: 'Get groups' },
					{ name: 'Update', value: 'update', action: 'Update a group', description: 'Update a group' },
					{ name: 'Delete', value: 'delete', action: 'Delete a group', description: 'Delete a group' },
					{ name: 'Get Course Groups', value: 'getCourseGroups', action: 'Get course groups' },
					{
						name: 'Add Member',
						value: 'addMember',
						action: 'Add a group member',
						description: 'Add a group member',
					},
					{
						name: 'Delete Member',
						value: 'deleteMember',
						action: 'Delete a group member',
						description: 'Delete a group member',
					},
					{
						name: 'Get Members',
						value: 'getMembers',
						action: 'Get group members',
						description: 'Get group members',
					},
					{
						name: 'Create Grouping',
						value: 'createGrouping',
						action: 'Create a grouping',
						description: 'Create a grouping',
					},
					{ name: 'Get Groupings', value: 'getGroupings', action: 'Get groupings' },
					{
						name: 'Update Grouping',
						value: 'updateGrouping',
						action: 'Update a grouping',
						description: 'Update a grouping',
					},
					{
						name: 'Delete Grouping',
						value: 'deleteGrouping',
						action: 'Delete a grouping',
						description: 'Delete a grouping',
					},
					{
						name: 'Assign Grouping',
						value: 'assignGrouping',
						action: 'Assign groups to grouping',
						description: 'Assign groups to grouping',
					},
					{
						name: 'Unassign Grouping',
						value: 'unassignGrouping',
						action: 'Unassign groups from grouping',
						description: 'Unassign groups from grouping',
					},
					{
						name: 'Get Groups in Grouping',
						value: 'getGroupingGroups',
						action: 'Get groups in a grouping',
						description: 'Get groups in a grouping',
					},
					{
						name: 'Get Grouping by Group',
						value: 'getGroupingOfGroup',
						action: 'Get the grouping of a group',
						description: 'Get the grouping of a group',
					},
				],
				default: 'get',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['calendar'] } },
				options: [
					{ name: 'Get', value: 'get', action: 'Get calendar events', description: 'Get calendar events' },
					{
						name: 'Create',
						value: 'create',
						action: 'Create a calendar event',
						description: 'Create a calendar event',
					},
					{
						name: 'Delete',
						value: 'delete',
						action: 'Delete calendar events',
						description: 'Delete calendar events',
					},
					{
						name: 'Get Upcoming',
						value: 'getUpcoming',
						action: 'Get upcoming events',
						description: 'Get upcoming events',
					},
					{ name: 'Get Monthly View', value: 'getMonthlyView', action: 'Get monthly calendar view' },
					{ name: 'Get Day View', value: 'getDayView', action: 'Get daily calendar view' },
				],
				default: 'get',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['note'] } },
				options: [
					{ name: 'Create', value: 'create', action: 'Create notes', description: 'Create notes' },
					{ name: 'Get', value: 'get', action: 'Get notes', description: 'Get notes' },
					{ name: 'Update', value: 'update', action: 'Update notes', description: 'Update notes' },
					{ name: 'Delete', value: 'delete', action: 'Delete notes', description: 'Delete notes' },
				],
				default: 'get',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['badge'] } },
				options: [{ name: 'Get User Badges', value: 'getUserBadges', action: 'Get user badges' }],
				default: 'getUserBadges',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['file'] } },
				options: [
					{ name: 'Get', value: 'get', action: 'Get files', description: 'Get files' },
					{ name: 'Upload', value: 'upload', action: 'Upload a file', description: 'Upload a file' },
					{ name: 'Delete Draft Files', value: 'deleteDraft', action: 'Delete draft files' },
					{
						name: 'Create Draft Area',
						value: 'createDraft',
						action: 'Create a draft area',
						description: 'Create a draft area',
					},
				],
				default: 'get',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['competency'] } },
				options: [
					{
						name: 'Create Template',
						value: 'createTemplate',
						action: 'Create a competency template',
						description: 'Create a competency template',
					},
					{
						name: 'Get Template',
						value: 'getTemplate',
						action: 'Get a competency template',
						description: 'Get a competency template',
					},
					{
						name: 'List Templates',
						value: 'listTemplates',
						action: 'List competency templates',
						description: 'List competency templates',
					},
					{
						name: 'Update Template',
						value: 'updateTemplate',
						action: 'Update a competency template',
						description: 'Update a competency template',
					},
					{
						name: 'Delete Template',
						value: 'deleteTemplate',
						action: 'Delete a competency template',
						description: 'Delete a competency template',
					},
					{
						name: 'Create Competency',
						value: 'createCompetency',
						action: 'Create a competency',
						description: 'Create a competency',
					},
					{
						name: 'Get Competency',
						value: 'getCompetency',
						action: 'Get a competency',
						description: 'Get a competency',
					},
					{ name: 'List Competencies', value: 'listCompetencies', action: 'List competencies' },
					{
						name: 'Update Competency',
						value: 'updateCompetency',
						action: 'Update a competency',
						description: 'Update a competency',
					},
					{
						name: 'Delete Competency',
						value: 'deleteCompetency',
						action: 'Delete a competency',
						description: 'Delete a competency',
					},
					{
						name: 'Get User Competencies',
						value: 'getUserCompetencies',
						action: 'Get user competencies in course',
						description: 'Get user competencies in course',
					},
					{
						name: 'Get User Competency',
						value: 'getUserCompetency',
						action: 'Get a user competency',
						description: 'Get a user competency',
					},
				],
				default: 'listTemplates',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['quiz'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get quizzes by course',
						description: 'Get quizzes by course',
					},
					{
						name: 'Start Attempt',
						value: 'startAttempt',
						action: 'Start a quiz attempt',
						description: 'Start a quiz attempt',
					},
					{ name: 'Get Attempt Data', value: 'getAttemptData', action: 'Get attempt data' },
					{ name: 'Get Attempt Summary', value: 'getAttemptSummary', action: 'Get attempt summary' },
					{ name: 'Get Attempt Review', value: 'getAttemptReview', action: 'Get attempt review' },
					{
						name: 'Process Attempt',
						value: 'processAttempt',
						action: 'Process an attempt',
						description: 'Process an attempt',
					},
					{
						name: 'Save Attempt',
						value: 'saveAttempt',
						action: 'Save an attempt',
						description: 'Save an attempt',
					},
					{ name: 'Get User Best Grade', value: 'getUserBestGrade', action: 'Get user best grade' },
					{ name: 'Get User Attempts', value: 'getUserAttempts', action: 'Get user attempts' },
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['assignment'] } },
				options: [
					{ name: 'Get', value: 'get', action: 'Get assignments', description: 'Get assignments' },
					{ name: 'Get Submissions', value: 'getSubmissions', action: 'Get submissions' },
					{ name: 'Get Submission Status', value: 'getSubmissionStatus', action: 'Get submission status' },
					{
						name: 'Save Submission',
						value: 'saveSubmission',
						action: 'Save a submission',
						description: 'Save a submission',
					},
					{ name: 'Submit For Grading', value: 'submitForGrading', action: 'Submit for grading' },
					{ name: 'Save Grade', value: 'saveGrade', action: 'Save a grade', description: 'Save a grade' },
					{
						name: 'Get Grades',
						value: 'getGrades',
						action: 'Get assignment grades',
						description: 'Get assignment grades',
					},
					{ name: 'List Participants', value: 'listParticipants', action: 'List participants' },
					{ name: 'Lock', value: 'lock', action: 'Lock a submission', description: 'Lock a submission' },
					{
						name: 'Unlock',
						value: 'unlock',
						action: 'Unlock a submission',
						description: 'Unlock a submission',
					},
					{
						name: 'Revert To Draft',
						value: 'revertToDraft',
						action: 'Revert submission to draft',
						description: 'Revert submission to draft',
					},
					{ name: 'Get User Flags', value: 'getUserFlags', action: 'Get user flags' },
					{ name: 'Set User Flags', value: 'setUserFlags', action: 'Set user flags' },
				],
				default: 'get',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['forum'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get forums by course',
						description: 'Get forums by course',
					},
					{
						name: 'Add Discussion',
						value: 'addDiscussion',
						action: 'Add a discussion',
						description: 'Add a discussion',
					},
					{ name: 'Add Post', value: 'addPost', action: 'Add a post', description: 'Add a post' },
					{
						name: 'Get Posts',
						value: 'getPosts',
						action: 'Get discussion posts',
						description: 'Get discussion posts',
					},
					{
						name: 'Can Add Discussion',
						value: 'canAddDiscussion',
						action: 'Check if can add discussion',
						description: 'Check if can add discussion',
					},
					{
						name: 'Set Pin State',
						value: 'setPinState',
						action: 'Set discussion pin state',
						description: 'Set discussion pin state',
					},
					{
						name: 'Toggle Favourite',
						value: 'toggleFavourite',
						action: 'Toggle favourite state',
						description: 'Toggle favourite state',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['glossary'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get glossaries by course',
						description: 'Get glossaries by course',
					},
					{ name: 'Get Entries By Author', value: 'getEntriesByAuthor', action: 'Get entries by author' },
					{
						name: 'Get Entries By Category',
						value: 'getEntriesByCategory',
						action: 'Get entries by category',
					},
					{ name: 'Get Entries By Date', value: 'getEntriesByDate', action: 'Get entries by date' },
					{ name: 'Get Entry By ID', value: 'getEntryById', action: 'Get entry by ID' },
					{
						name: 'Add Entry',
						value: 'addEntry',
						action: 'Add a glossary entry',
						description: 'Add a glossary entry',
					},
					{
						name: 'Update Entry',
						value: 'updateEntry',
						action: 'Update a glossary entry',
						description: 'Update a glossary entry',
					},
					{
						name: 'Delete Entry',
						value: 'deleteEntry',
						action: 'Delete a glossary entry',
						description: 'Delete a glossary entry',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['lesson'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get lessons by course',
						description: 'Get lessons by course',
					},
					{
						name: 'Get Pages',
						value: 'getPages',
						action: 'Get lesson pages',
						description: 'Get lesson pages',
					},
					{
						name: 'Get Page Data',
						value: 'getPageData',
						action: 'Get lesson page data',
						description: 'Get lesson page data',
					},
					{
						name: 'Launch Attempt',
						value: 'launchAttempt',
						action: 'Launch a lesson attempt',
						description: 'Launch a lesson attempt',
					},
					{
						name: 'Process Page',
						value: 'processPage',
						action: 'Process a lesson page',
						description: 'Process a lesson page',
					},
					{ name: 'Get User Attempt', value: 'getUserAttempt', action: 'Get user attempt' },
					{
						name: 'Get User Grade',
						value: 'getUserGrade',
						action: 'Get user lesson grade',
						description: 'Get user lesson grade',
					},
					{ name: 'Get Questions Attempts', value: 'getQuestionsAttempts', action: 'Get questions attempts' },
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['scorm'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get SCORM by course',
						description: 'Get SCORM by course',
					},
					{
						name: 'Get Tracks',
						value: 'getTracks',
						action: 'Get SCORM tracks',
						description: 'Get SCORM tracks',
					},
					{
						name: 'Insert Tracks',
						value: 'insertTracks',
						action: 'Insert SCORM tracks',
						description: 'Insert SCORM tracks',
					},
					{ name: 'Get Attempt Count', value: 'getAttemptCount', action: 'Get attempt count' },
					{
						name: 'Get User Data',
						value: 'getUserData',
						action: 'Get SCORM user data',
						description: 'Get SCORM user data',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['workshop'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get workshops by course',
						description: 'Get workshops by course',
					},
					{
						name: 'Get Phases',
						value: 'getPhases',
						action: 'Get workshop phases',
						description: 'Get the workshop phases (user plan)',
					},
					{
						name: 'Get Assessment Form',
						value: 'getAssessmentForm',
						action: 'Get assessment form definition',
					},
					{
						name: 'Get Submissions',
						value: 'getSubmissions',
						action: 'Get workshop submissions',
						description: 'Get workshop submissions',
					},
					{
						name: 'Get Grades',
						value: 'getGrades',
						action: 'Get workshop grades',
						description: 'Get workshop grades',
					},
					{ name: 'View', value: 'view', action: 'View workshop', description: 'View workshop' },
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['data'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get databases by course',
						description: 'Get databases by course',
					},
					{
						name: 'Get Fields',
						value: 'getFields',
						action: 'Get database fields',
						description: 'Get database fields',
					},
					{
						name: 'Get Entries',
						value: 'getEntries',
						action: 'Get database entries',
						description: 'Get database entries',
					},
					{ name: 'Search Entries', value: 'searchEntries', action: 'Search entries' },
					{
						name: 'Add Entry',
						value: 'addEntry',
						action: 'Add a database entry',
						description: 'Add a database entry',
					},
					{
						name: 'Update Entry',
						value: 'updateEntry',
						action: 'Update a database entry',
						description: 'Update a database entry',
					},
					{
						name: 'Delete Entry',
						value: 'deleteEntry',
						action: 'Delete a database entry',
						description: 'Delete a database entry',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['survey'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get surveys by course',
						description: 'Get surveys by course',
					},
					{
						name: 'Get Questions',
						value: 'getQuestions',
						action: 'Get survey questions',
						description: 'Get survey questions',
					},
					{
						name: 'Submit Answers',
						value: 'submitAnswers',
						action: 'Submit survey answers',
						description: 'Submit survey answers',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['choice'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get choices by course',
						description: 'Get choices by course',
					},
					{
						name: 'Get Results',
						value: 'getResults',
						action: 'Get choice results',
						description: 'Get choice results',
					},
					{
						name: 'Get Options',
						value: 'getOptions',
						action: 'Get choice options',
						description: 'Get choice options',
					},
					{
						name: 'Submit Response',
						value: 'submitResponse',
						action: 'Submit a choice response',
						description: 'Submit a choice response',
					},
					{
						name: 'Delete Response',
						value: 'deleteResponse',
						action: 'Delete choice responses',
						description: 'Delete choice responses',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['feedback'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get feedbacks by course',
						description: 'Get feedbacks by course',
					},
					{
						name: 'Get Items',
						value: 'getItems',
						action: 'Get feedback items',
						description: 'Get feedback items',
					},
					{
						name: 'Get Analysis',
						value: 'getAnalysis',
						action: 'Get feedback analysis',
						description: 'Get feedback analysis',
					},
					{ name: 'Get Responses Analysis', value: 'getResponsesAnalysis', action: 'Get responses analysis' },
					{ name: 'Get Last Completed', value: 'getLastCompleted', action: 'Get last completed feedback' },
					{
						name: 'Get Current Completed',
						value: 'getCurrentCompleted',
						action: 'Get current completed feedback',
						description: 'Get the current (unfinished) completed feedback of the user',
					},
					{
						name: 'Process Page',
						value: 'processPage',
						action: 'Process a feedback page',
						description: 'Process a feedback page',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['wiki'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get wikis by course',
						description: 'Get wikis by course',
					},
					{ name: 'Get Subwikis', value: 'getSubwikis', action: 'Get subwikis' },
					{ name: 'Get Pages', value: 'getPages', action: 'Get wiki pages', description: 'Get wiki pages' },
					{ name: 'Get Page Contents', value: 'getPageContents', action: 'Get page contents' },
					{
						name: 'Edit Page',
						value: 'editPage',
						action: 'Edit a wiki page',
						description: 'Edit a wiki page',
					},
					{
						name: 'New Page',
						value: 'newPage',
						action: 'Create a new wiki page',
						description: 'Create a new wiki page',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['chat'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get chats by course',
						description: 'Get chats by course',
					},
					{ name: 'Get Users', value: 'getUsers', action: 'Get chat users', description: 'Get chat users' },
					{ name: 'Get Latest Messages', value: 'getLatestMessages', action: 'Get latest messages' },
					{
						name: 'Send Message',
						value: 'sendMessage',
						action: 'Send a chat message',
						description: 'Send a chat message',
					},
					{
						name: 'Login User',
						value: 'loginUser',
						action: 'Login a user to chat',
						description: 'Login a user to chat',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['book'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get books by course',
						description: 'Get books by course',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['page'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get pages by course',
						description: 'Get pages by course',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['url'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get URLs by course',
						description: 'Get URLs by course',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['resource'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get resources by course',
						description: 'Get resources by course',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['folder'] } },
				options: [
					{
						name: 'Get By Course',
						value: 'getByCourse',
						action: 'Get folders by course',
						description: 'Get folders by course',
					},
				],
				default: 'getByCourse',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['customcert'] } },
				options: [
					{
						name: 'Delete Issue',
						value: 'deleteIssue',
						action: 'Delete certificate issue',
						description: 'Delete a certificate issue',
					},
					{
						name: 'Get Element HTML',
						value: 'getElementHtml',
						action: 'Get element HTML',
						description: 'Returns the HTML to display for an element',
					},
					{
						name: 'Save Element',
						value: 'saveElement',
						action: 'Save element data',
						description: 'Saves data for an element',
					},
				],
				default: 'deleteIssue',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['joomdle'] } },
				options: [
					{
						name: 'Get Group Members',
						value: 'getGroupMembers',
						action: 'Get group members',
						description: 'Get group members via Joomdle',
					},
				],
				default: 'getGroupMembers',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['rating'] } },
				options: [
					{ name: 'Get', value: 'get', action: 'Get item ratings', description: 'Get item ratings' },
					{ name: 'Add', value: 'add', action: 'Add a rating', description: 'Add a rating' },
				],
				default: 'get',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['comment'] } },
				options: [
					{ name: 'Get', value: 'get', action: 'Get comments', description: 'Get comments' },
					{ name: 'Add', value: 'add', action: 'Add a comment', description: 'Add a comment' },
					{ name: 'Delete', value: 'delete', action: 'Delete a comment', description: 'Delete a comment' },
				],
				default: 'get',
			},

			{
				displayName: 'User',
				name: 'userId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a user...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter user ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: { resource: ['user'], operation: ['get', 'update', 'delete', 'getPreferences'] },
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Field',
				name: 'field',
				type: 'options',
				displayOptions: { show: { resource: ['user'], operation: ['getByField'] } },
				options: [
					{ name: 'ID', value: 'id' },
					{ name: 'ID Number', value: 'idnumber' },
					{ name: 'Username', value: 'username' },
					{ name: 'Email', value: 'email' },
				],
				default: 'id',
				description: 'The field to search by',
			},
			{
				displayName: 'Field Value',
				name: 'fieldValue',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['user'], operation: ['getByField'] } },
				description: 'The value to search for',
			},
			{
				displayName: 'Username',
				name: 'username',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['user'], operation: ['create'] } },
				description: 'Username for the user',
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['user'], operation: ['create'] } },
				description: 'Password for the user',
			},
			{
				displayName: 'First Name',
				name: 'firstname',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['user'], operation: ['create'] } },
				description: 'First name of the user',
			},
			{
				displayName: 'Last Name',
				name: 'lastname',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['user'], operation: ['create'] } },
				description: 'Last name of the user',
			},
			{
				displayName: 'Email',
				name: 'email',
				placeholder: 'name@email.com',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['user'], operation: ['create'] } },
				description: 'Email address of the user',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['user'], operation: ['create', 'update'] } },
				options: [
					{
						displayName: 'Auth Method',
						name: 'auth',
						type: 'string',
						default: 'manual',
						description: 'Authentication plugin (only used on create)',
					},
					{
						displayName: 'Create Password',
						name: 'createpassword',
						type: 'boolean',
						default: false,
						description:
							'Whether to generate a password and email it to the user (only used on create, password is then ignored)',
					},
					{
						displayName: 'ID Number',
						name: 'idnumber',
						type: 'string',
						default: '',
						description: 'An arbitrary ID code',
					},
					{
						displayName: 'Institution',
						name: 'institution',
						type: 'string',
						default: '',
						description: 'Institution',
					},
					{
						displayName: 'Department',
						name: 'department',
						type: 'string',
						default: '',
						description: 'Department',
					},
					{
						displayName: 'Address',
						name: 'address',
						type: 'string',
						default: '',
						description: 'Postal address',
					},
					{ displayName: 'City', name: 'city', type: 'string', default: '', description: 'City' },
					{
						displayName: 'Country',
						name: 'country',
						type: 'string',
						default: '',
						description: 'Country code (e.g. US)',
					},
					{ displayName: 'Phone', name: 'phone1', type: 'string', default: '', description: 'Phone number' },
					{
						displayName: 'Mobile Phone',
						name: 'phone2',
						type: 'string',
						default: '',
						description: 'Mobile phone number',
					},
					{
						displayName: 'Timezone',
						name: 'timezone',
						type: 'string',
						default: '',
						description: 'Timezone (e.g. America/New_York)',
					},
					{
						displayName: 'Language',
						name: 'lang',
						type: 'string',
						default: '',
						description: 'Language code (e.g. en)',
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						description: 'User description',
					},
					{ displayName: 'Theme', name: 'theme', type: 'string', default: '', description: 'Theme' },
					{
						displayName: 'Mail Display',
						name: 'maildisplay',
						type: 'options',
						options: [
							{ name: 'Hide', value: 0 },
							{ name: 'Allow', value: 1 },
							{ name: 'Allow Course', value: 2 },
						],
						default: 2,
						description: 'Email display',
					},
					{
						displayName: 'Mail Format',
						name: 'mailformat',
						type: 'options',
						options: [
							{ name: 'Plain Text', value: 0 },
							{ name: 'HTML', value: 1 },
						],
						default: 1,
						description: 'Email format',
					},
					{
						displayName: 'Suspended',
						name: 'suspended',
						type: 'boolean',
						default: false,
						description: 'Suspend the user account',
					},
					{
						displayName: 'Custom Fields (JSON)',
						name: 'customfields',
						type: 'string',
						typeOptions: { rows: 4 },
						default: '',
						description:
							'Custom profile fields as JSON array. Example: [{"type":"biografia","value":"Testo"},{"type":"telefono_uff","value":"12345"}]',
					},
				],
			},
			{
				displayName: 'Update Fields',
				name: 'userUpdateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['user'], operation: ['update'] } },
				options: [
					{ displayName: 'Username', name: 'username', type: 'string', default: '' },
					{
						displayName: 'Password',
						name: 'password',
						type: 'string',
						typeOptions: { password: true },
						default: '',
					},
					{ displayName: 'First Name', name: 'firstname', type: 'string', default: '' },
					{ displayName: 'Last Name', name: 'lastname', type: 'string', default: '' },
					{ displayName: 'Email', name: 'email', type: 'string', placeholder: 'name@email.com', default: '' },
					{ displayName: 'Auth Method', name: 'auth', type: 'string', default: 'manual' },
				],
			},
			{
				displayName: 'Preferences JSON',
				name: 'preferencesJson',
				type: 'string',
				default: '[]',
				required: true,
				displayOptions: { show: { resource: ['user'], operation: ['setPreferences'] } },
				description: 'JSON array of preferences',
			},
			{
				displayName: 'Add Device Parameters JSON',
				name: 'addDeviceParams',
				type: 'string',
				default: '{}',
				required: true,
				displayOptions: { show: { resource: ['user'], operation: ['addDevice'] } },
				description: 'JSON object with appid, name, model, platform, version, pushid, uuid',
			},
			{
				displayName: 'Course',
				name: 'courseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter course ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['course'],
						operation: [
							'get',
							'update',
							'delete',
							'duplicate',
							'getContents',
							'getSections',
							'getEnrolledUsers',
							'getEnrolmentMethods',
							'createSection',
							'updateSection',
							'deleteSection',
						],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Full Name',
				name: 'fullname',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['create'] } },
				description: 'Full name of the course',
			},
			{
				displayName: 'Short Name',
				name: 'shortname',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['create'] } },
				description: 'Short name of the course',
			},
			{
				displayName: 'Category',
				name: 'categoryid',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a category...',
						typeOptions: {
							searchListMethod: 'searchCategories',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter category ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['course'], operation: ['create'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'New Course Full Name',
				name: 'duplicateFullname',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['duplicate'] } },
				description: 'Full name of the duplicated course',
			},
			{
				displayName: 'New Course Short Name',
				name: 'duplicateShortname',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['duplicate'] } },
				description: 'Short name of the duplicated course (must be unique)',
			},
			{
				displayName: 'New Course Category',
				name: 'duplicateCategoryId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a category...',
						typeOptions: {
							searchListMethod: 'searchCategories',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter category ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['course'], operation: ['duplicate'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Duplicate Options',
				name: 'duplicateOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['course'], operation: ['duplicate'] } },
				options: [
					{
						displayName: 'Visible',
						name: 'visible',
						type: 'boolean',
						default: true,
						description: 'Whether the new course is visible',
					},
					{
						displayName: 'Include Users',
						name: 'users',
						type: 'boolean',
						default: false,
						description: 'Whether to include enrolled users',
					},
					{
						displayName: 'Include Activities',
						name: 'activities',
						type: 'boolean',
						default: true,
						description: 'Whether to include activities and resources',
					},
					{
						displayName: 'Include Blocks',
						name: 'blocks',
						type: 'boolean',
						default: true,
						description: 'Whether to include blocks',
					},
					{
						displayName: 'Include Filters',
						name: 'filters',
						type: 'boolean',
						default: true,
						description: 'Whether to include filters',
					},
				],
			},
			{
				displayName: 'Search Value',
				name: 'searchValue',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['search'] } },
				description: 'Search value for courses',
			},
			{
				displayName: 'Search Criteria',
				name: 'fieldName',
				type: 'options',
				displayOptions: { show: { resource: ['course'], operation: ['search'] } },
				options: [
					{ name: 'Text Search', value: 'search' },
					{ name: 'Tag ID', value: 'tagid' },
					{ name: 'Module List (Admins Only)', value: 'modulelist' },
					{ name: 'Block List (Admins Only)', value: 'blocklist' },
				],
				default: 'search',
				description: 'Search criteria to use',
			},
			{
				displayName: 'Course Additional Fields',
				name: 'courseAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['course'], operation: ['create', 'update'] } },
				options: [
					{
						displayName: 'ID Number',
						name: 'idnumber',
						type: 'string',
						default: '',
						description: 'Course ID number',
					},
					{
						displayName: 'Summary',
						name: 'summary',
						type: 'string',
						default: '',
						description: 'Course summary',
					},
					{
						displayName: 'Summary Format',
						name: 'summaryformat',
						type: 'options',
						options: [
							{ name: 'Moodle Auto', value: 0 },
							{ name: 'HTML', value: 1 },
							{ name: 'Plain', value: 2 },
							{ name: 'Markdown', value: 4 },
						],
						default: 1,
						description: 'Summary format',
					},
					{
						displayName: 'Format',
						name: 'format',
						type: 'string',
						default: '',
						description: 'Course format',
					},
					{
						displayName: 'Visible',
						name: 'visible',
						type: 'boolean',
						default: true,
						description: 'Course visibility',
					},
					{
						displayName: 'Start Date',
						name: 'startdate',
						type: 'dateTime',
						default: '',
						description: 'Course start date',
					},
					{
						displayName: 'End Date',
						name: 'enddate',
						type: 'dateTime',
						default: '',
						description: 'Course end date',
					},
					{
						displayName: 'Max Bytes',
						name: 'maxbytes',
						type: 'number',
						default: 0,
						description: 'Maximum upload size',
					},
					{
						displayName: 'News Items',
						name: 'newsitems',
						type: 'number',
						default: 5,
						description: 'News items to show',
					},
					{
						displayName: 'Show Grades',
						name: 'showgrades',
						type: 'boolean',
						default: true,
						description: 'Show grades',
					},
					{
						displayName: 'Enable Completion',
						name: 'enablecompletion',
						type: 'boolean',
						default: true,
						description: 'Enable completion tracking',
					},
					{
						displayName: 'Group Mode',
						name: 'groupmode',
						type: 'options',
						options: [
							{ name: 'No Groups', value: 0 },
							{ name: 'Separate Groups', value: 1 },
							{ name: 'Visible Groups', value: 2 },
						],
						default: 0,
						description: 'Group mode',
					},
				],
			},
			{
				displayName: 'Category',
				name: 'categoryId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a category...',
						typeOptions: {
							searchListMethod: 'searchCategories',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter category ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: { resource: ['course'], operation: ['getCategory', 'updateCategory', 'deleteCategory'] },
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Category Name',
				name: 'categoryName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['createCategory'] } },
				description: 'Name of the category',
			},
			{
				displayName: 'New Category Name',
				name: 'categoryNewName',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['course'], operation: ['updateCategory'] } },
				description: 'New name of the category. Leave empty to keep the current name.',
			},
			{
				displayName: 'Parent Category',
				name: 'parentCategoryId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				displayOptions: { show: { resource: ['course'], operation: ['createCategory'] } },
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a parent category...',
						typeOptions: {
							searchListMethod: 'searchCategories',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter parent category ID...',
						initType: 'number',
					},
				],
				description: 'Choose from the list, or specify an ID (0 for top-level)',
			},
			{
				displayName: 'Category ID Number',
				name: 'categoryIdNumber',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['course'], operation: ['createCategory', 'updateCategory'] } },
				description: 'ID number for the category',
			},
			{
				displayName: 'Category Description',
				name: 'categoryDescription',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['course'], operation: ['createCategory', 'updateCategory'] } },
				description: 'Description of the category',
			},
			{
				displayName: 'Section ID',
				name: 'sectionId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['updateSection', 'deleteSection'] } },
				description: 'The section ID (the "id" returned by Get Sections, not the section number)',
			},
			{
				displayName: 'After Section Number',
				name: 'sectionNumber',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['course'], operation: ['createSection'] } },
				description:
					'Insert the new section after the section with this number. Use 0 to append it at the end of the course.',
			},
			{
				displayName: 'Section Name',
				name: 'sectionName',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['course'], operation: ['createSection', 'updateSection'] } },
				description: 'Section name. Leave empty to keep the default/current name.',
			},
			{
				displayName: 'Module ID',
				name: 'moduleId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['getModule'] } },
				description: 'The ID of the course module',
			},
			{
				displayName: 'User',
				name: 'enrollUserId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a user...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter user ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['enrollment'],
						operation: ['enrol', 'unenrol', 'getUserCourses', 'getEnrolment'],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Course',
				name: 'enrollCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter course ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['enrollment'],
						operation: [
							'enrol',
							'unenrol',
							'getCourseUsers',
							'selfEnrol',
							'getEnrolledWithCapability',
							'getPotentialUsers',
							'getEnrolment',
						],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Role ID',
				name: 'roleId',
				type: 'number',
				default: 5,
				required: true,
				displayOptions: { show: { resource: ['enrollment'], operation: ['enrol'] } },
				description: 'Role ID (5=student, 3=teacher, 1=manager)',
			},
			{
				displayName: 'Enrolment Options',
				name: 'enrolOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['enrollment'], operation: ['enrol'] } },
				options: [
					{
						displayName: 'Start Date',
						name: 'timestart',
						type: 'dateTime',
						default: '',
						description: 'When the enrolment starts',
					},
					{
						displayName: 'End Date',
						name: 'timeend',
						type: 'dateTime',
						default: '',
						description: 'When the enrolment ends',
					},
					{
						displayName: 'Suspended',
						name: 'suspend',
						type: 'boolean',
						default: false,
						description: 'Whether the enrolment is suspended',
					},
				],
			},
			{
				displayName: 'Instance ID',
				name: 'instanceId',
				type: 'number',
				default: 0,
				displayOptions: {
					show: {
						resource: ['enrollment'],
						operation: ['selfEnrol', 'getSelfEnrolInstance', 'getPotentialUsers'],
					},
				},
				description:
					'Enrolment method instance ID (see Course > Get Enrolment Methods). For Self Enrol, 0 uses the first available self enrolment method.',
			},
			{
				displayName: 'Enrolment Key',
				name: 'enrolPassword',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				displayOptions: { show: { resource: ['enrollment'], operation: ['selfEnrol'] } },
				description: 'Enrolment key, if the self enrolment method requires one',
			},
			{
				displayName: 'Search Options',
				name: 'potentialUsersOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['enrollment'], operation: ['getPotentialUsers'] } },
				options: [
					{
						displayName: 'Search',
						name: 'search',
						type: 'string',
						default: '',
						description: 'Text to search for',
					},
					{
						displayName: 'Search Anywhere',
						name: 'searchanywhere',
						type: 'boolean',
						default: true,
						description: 'Whether to match anywhere in the name, or only at the beginning',
					},
					{
						displayName: 'Page',
						name: 'page',
						type: 'number',
						default: 0,
						description: 'Page number (0 based)',
					},
					{
						displayName: 'Per Page',
						name: 'perpage',
						type: 'number',
						default: 100,
						description: 'Number of users per page',
					},
				],
			},
			{
				displayName: 'Capability',
				name: 'capability',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['enrollment'], operation: ['getEnrolledWithCapability'] } },
				description: 'Capability to check (e.g. moodle/course:view)',
			},
			{
				displayName: 'User',
				name: 'gradeUserId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a user...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter user ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['grade'],
						operation: ['getUserCourseGrades', 'viewGradeReport', 'getGradesTable', 'updateGrades'],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Course',
				name: 'gradeCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter course ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['grade'],
						operation: [
							'getUserCourseGrades',
							'viewGradeReport',
							'getGradesTable',
							'getGradeItems',
							'getGradeDefinitions',
							'getGradableUsers',
							'updateGrades',
						],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Grade Component',
				name: 'gradeComponent',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['grade'], operation: ['updateGrades'] } },
				placeholder: 'mod_assign',
				description: 'Grade component (e.g. mod_assign)',
			},
			{
				displayName: 'Grade Activity ID',
				name: 'gradeActivityId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['grade'], operation: ['updateGrades'] } },
				description: 'Activity instance ID',
			},
			{
				displayName: 'Item Number',
				name: 'gradeItemNumber',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['grade'], operation: ['updateGrades'] } },
				description: 'The grade item number within the activity (usually 0)',
			},
			{
				displayName: 'Grade',
				name: 'gradeValue',
				type: 'number',
				typeOptions: { numberPrecision: 2 },
				default: 0,
				displayOptions: { show: { resource: ['grade'], operation: ['updateGrades'] } },
				description: 'Grade to set for the selected user (ignored if Grades JSON is provided)',
			},
			{
				displayName: 'Feedback',
				name: 'gradeFeedback',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['grade'], operation: ['updateGrades'] } },
				description: 'Optional feedback for the selected user',
			},
			{
				displayName: 'Grade Data JSON',
				name: 'gradeDataJson',
				type: 'string',
				default: '[]',
				displayOptions: { show: { resource: ['grade'], operation: ['updateGrades'] } },
				description: 'JSON array of grade data items',
			},
			{
				displayName: 'Recipient',
				name: 'messageToUserId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a user...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter user ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['message'], operation: ['send'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Message Text',
				name: 'messageText',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['send', 'sendToConversation'] } },
				description: 'The message text',
			},
			{
				displayName: 'User',
				name: 'messageUserId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a user...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter user ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [
							'getMessages',
							'getConversations',
							'getConversationMessages',
							'deleteConversation',
							'deleteMessage',
						],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Conversation ID',
				name: 'conversationId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['getConversationMessages', 'deleteConversation', 'sendToConversation'],
					},
				},
				description: 'The conversation ID',
			},
			{
				displayName: 'Message ID',
				name: 'messageId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['markMessageRead', 'deleteMessage'] } },
				description: 'The message ID',
			},
			{
				displayName: 'Message Filters',
				name: 'messageFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: { resource: ['message'], operation: ['getMessages', 'getConversations'] } },
				options: [
					{
						displayName: 'Limit From',
						name: 'limitfrom',
						type: 'number',
						default: 0,
						description: 'Start offset',
					},
					{
						displayName: 'Limit Num',
						name: 'limitnum',
						type: 'number',
						default: 0,
						description: 'Max results',
					},
					{
						displayName: 'Read',
						name: 'read',
						type: 'options',
						options: [
							{ name: 'All', value: -1 },
							{ name: 'Unread', value: 0 },
							{ name: 'Read', value: 1 },
						],
						default: -1,
						description: 'Filter by read status',
					},
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: [
							{ name: 'All', value: 'both' },
							{ name: 'Notifications', value: 'notifications' },
							{ name: 'Messages', value: 'messages' },
						],
						default: 'both',
						description: 'Message type',
					},
					{
						displayName: 'Newest First',
						name: 'newestfirst',
						type: 'boolean',
						default: true,
						description: 'Order by newest first',
					},
				],
			},
			{
				displayName: 'Cohort',
				name: 'cohortId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a cohort...',
						typeOptions: {
							searchListMethod: 'searchCohorts',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter cohort ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['cohort'],
						operation: ['get', 'update', 'delete', 'addMembers', 'deleteMembers', 'getMembers'],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Cohort Name',
				name: 'cohortName',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['cohort'], operation: ['create', 'update'] } },
				description: 'Name of the cohort',
			},
			{
				displayName: 'Cohort ID Number',
				name: 'cohortIdNumber',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['cohort'], operation: ['create', 'update'] } },
				description: 'ID number for the cohort',
			},
			{
				displayName: 'Cohort Context',
				name: 'cohortCategoryType',
				type: 'options',
				default: 'system',
				displayOptions: { show: { resource: ['cohort'], operation: ['create', 'update'] } },
				options: [
					{ name: 'System', value: 'system' },
					{ name: 'Course Category (by ID)', value: 'id' },
					{ name: 'Course Category (by ID Number)', value: 'idnumber' },
				],
				description: 'Where the cohort lives: system-wide or inside a course category',
			},
			{
				displayName: 'Category ID or ID Number',
				name: 'cohortCategoryValue',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['cohort'],
						operation: ['create', 'update'],
						cohortCategoryType: ['id', 'idnumber'],
					},
				},
				description: 'Course category ID or ID number',
			},
			{
				displayName: 'Cohort Description',
				name: 'cohortDescription',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['cohort'], operation: ['create', 'update'] } },
				description: 'Description of the cohort',
			},
			{
				displayName: 'Cohort Member IDs (comma-separated)',
				name: 'cohortMemberIds',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['cohort'], operation: ['addMembers', 'deleteMembers'] } },
				description: 'Comma-separated list of user IDs',
			},
			{
				displayName: 'Group',
				name: 'groupId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a group...',
						typeOptions: {
							searchListMethod: 'searchGroups',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter group ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['group'],
						operation: [
							'get',
							'update',
							'delete',
							'addMember',
							'deleteMember',
							'getMembers',
							'assignGrouping',
							'unassignGrouping',
							'getGroupingOfGroup',
						],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Course',
				name: 'groupCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter course ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['group'],
						operation: [
							'create',
							'getCourseGroups',
							'createGrouping',
							'getGroupings',
							'getGroupingOfGroup',
						],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Group Name',
				name: 'groupName',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['group'], operation: ['create', 'update'] } },
				description: 'Required on create. On update, leave empty to keep the current name. Name of the group',
			},
			{
				displayName: 'Group Description',
				name: 'groupDescription',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['group'], operation: ['create', 'update'] } },
				description: 'Description',
			},
			{
				displayName: 'Grouping',
				name: 'groupingId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a grouping...',
						typeOptions: {
							searchListMethod: 'searchGroupings',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter grouping ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['group'],
						operation: [
							'updateGrouping',
							'deleteGrouping',
							'assignGrouping',
							'unassignGrouping',
							'getGroupingGroups',
						],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Grouping Name',
				name: 'groupingName',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['group'], operation: ['createGrouping', 'updateGrouping'] } },
				description:
					'Required on create. On update, leave empty to keep the current name. Name of the grouping',
			},
			{
				displayName: 'Grouping Description',
				name: 'groupingDescription',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['group'], operation: ['createGrouping', 'updateGrouping'] } },
				description: 'Description',
			},
			{
				displayName: 'Group Member IDs (comma-separated)',
				name: 'groupMemberIds',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['group'], operation: ['addMember', 'deleteMember'] } },
				description: 'Comma-separated list of user IDs',
			},
			{
				displayName: 'Event ID',
				name: 'eventId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['calendar'], operation: ['delete'] } },
				description: 'The event ID',
			},
			{
				displayName: 'Event Name',
				name: 'eventName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['calendar'], operation: ['create'] } },
				description: 'Name of the event',
			},
			{
				displayName: 'Event Description',
				name: 'eventDescription',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['calendar'], operation: ['create'] } },
				description: 'Description of the event',
			},
			{
				displayName: 'Event Type',
				name: 'eventType',
				type: 'options',
				displayOptions: { show: { resource: ['calendar'], operation: ['create'] } },
				options: [
					{ name: 'Site', value: 'site' },
					{ name: 'Category', value: 'category' },
					{ name: 'Course', value: 'course' },
					{ name: 'Group', value: 'group' },
					{ name: 'User', value: 'user' },
				],
				default: 'user',
				description: 'Type of event',
			},
			{
				displayName: 'Event Date',
				name: 'eventDate',
				type: 'dateTime',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['calendar'], operation: ['create'] } },
				description: 'Event date and time',
			},
			{
				displayName: 'Event Duration (seconds)',
				name: 'eventDuration',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['calendar'], operation: ['create'] } },
				description: 'Event duration in seconds (0=no duration)',
			},
			{
				displayName: 'Course',
				name: 'eventCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				displayOptions: {
					show: {
						resource: ['calendar'],
						operation: ['create', 'get', 'getUpcoming', 'getMonthlyView', 'getDayView'],
					},
				},
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter course ID...',
						initType: 'number',
					},
				],
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Group',
				name: 'eventGroupId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				displayOptions: { show: { resource: ['calendar'], operation: ['create'] } },
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a group...',
						typeOptions: {
							searchListMethod: 'searchGroups',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter group ID...',
						initType: 'number',
					},
				],
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Calendar Year',
				name: 'calendarYear',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['calendar'], operation: ['getMonthlyView', 'getDayView'] } },
				description: 'Year (0 for current) (0 = current)',
			},
			{
				displayName: 'Calendar Month',
				name: 'calendarMonth',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['calendar'], operation: ['getMonthlyView', 'getDayView'] } },
				description: 'Month 1-12 (0 for current) (0 = current)',
			},
			{
				displayName: 'Calendar Day',
				name: 'calendarDay',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['calendar'], operation: ['getDayView'] } },
				description: 'Day of month (0 for current) (0 = current)',
			},
			{
				displayName: 'Events Options',
				name: 'eventsOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['calendar'], operation: ['get', 'getUpcoming'] } },
				options: [
					{
						displayName: 'Limit',
						name: 'limitnum',
						type: 'number',
						default: 0,
						description: 'Maximum number of events to return (0 = no limit)',
					},
					{
						displayName: 'From',
						name: 'timestart',
						type: 'dateTime',
						default: '',
						description: 'Only return events starting from this date (Get only)',
					},
					{
						displayName: 'To',
						name: 'timeend',
						type: 'dateTime',
						default: '',
						description: 'Only return events up to this date (Get only)',
					},
					{
						displayName: 'Include User Events',
						name: 'userevents',
						type: 'boolean',
						default: true,
						description: 'Whether to include the user events (Get only)',
					},
					{
						displayName: 'Include Site Events',
						name: 'siteevents',
						type: 'boolean',
						default: true,
						description: 'Whether to include site events (Get only)',
					},
				],
			},
			{
				displayName: 'Notes JSON',
				name: 'notesJson',
				type: 'string',
				default: '[]',
				required: true,
				displayOptions: { show: { resource: ['note'], operation: ['create'] } },
				description: 'JSON array of notes',
			},
			{
				displayName: 'Note IDs (comma-separated)',
				name: 'noteIds',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['note'], operation: ['get', 'delete'] } },
				description: 'Comma-separated note IDs',
			},
			{
				displayName: 'Notes Update JSON',
				name: 'notesUpdateJson',
				type: 'string',
				default: '[]',
				required: true,
				displayOptions: { show: { resource: ['note'], operation: ['update'] } },
				description: 'JSON array of notes to update',
			},
			{
				displayName: 'User',
				name: 'badgeUserId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a user...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter user ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['badge'], operation: ['getUserBadges'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Course',
				name: 'badgeCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				displayOptions: { show: { resource: ['badge'], operation: ['getUserBadges'] } },
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter course ID...',
						initType: 'number',
					},
				],
				description: 'Choose from the list, or specify an ID (leave empty for all)',
			},
			{
				displayName: 'File Context ID',
				name: 'fileContextId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['file'], operation: ['get', 'upload'] } },
				description: 'Context ID. For Upload, leave 0 to use the context of the current user. Context ID',
			},
			{
				displayName: 'File Component',
				name: 'fileComponent',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['file'], operation: ['get'] } },
				description: 'Component (e.g. user, course)',
			},
			{
				displayName: 'File Area',
				name: 'fileArea',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['file'], operation: ['get'] } },
				description: 'File area',
			},
			{
				displayName: 'File Item ID',
				name: 'fileItemId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['file'], operation: ['get', 'deleteDraft'] } },
				description: 'Item ID (0 for all)',
			},
			{
				displayName: 'File Path',
				name: 'filePath',
				type: 'string',
				default: '/',
				displayOptions: { show: { resource: ['file'], operation: ['get', 'upload', 'deleteDraft'] } },
				description: 'File path',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['file'], operation: ['get', 'upload', 'deleteDraft'] } },
				description: 'File name (empty for all)',
			},
			{
				displayName: 'File Content (Base64)',
				name: 'fileContent',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['file'], operation: ['upload'] } },
				description: 'Base64-encoded file content. Base64-encoded file content',
			},
			{
				displayName: 'Upload Component',
				name: 'fileUploadComponent',
				type: 'string',
				default: 'user',
				required: true,
				displayOptions: { show: { resource: ['file'], operation: ['upload'] } },
				description: 'Component to upload to',
			},
			{
				displayName: 'Upload File Area',
				name: 'fileUploadArea',
				type: 'string',
				default: 'draft',
				required: true,
				displayOptions: { show: { resource: ['file'], operation: ['upload'] } },
				description: 'File area to upload to',
			},
			{
				displayName: 'Draft Area ID',
				name: 'draftAreaId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['file'], operation: ['upload'] } },
				description: 'Draft item ID (0 = create a new draft area). Draft area ID (0 for new)',
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: { resource: ['competency'], operation: ['getTemplate', 'updateTemplate', 'deleteTemplate'] },
				},
				description: 'The competency template ID',
			},
			{
				displayName: 'Template Name',
				name: 'templateName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['competency'], operation: ['createTemplate'] } },
				description: 'Name of the template',
			},
			{
				displayName: 'Competency ID',
				name: 'competencyId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: {
						resource: ['competency'],
						operation: ['getCompetency', 'updateCompetency', 'deleteCompetency', 'getUserCompetency'],
					},
				},
				description: 'The competency ID',
			},
			{
				displayName: 'Competency Short Name',
				name: 'competencyShortName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['competency'], operation: ['createCompetency'] } },
				description: 'Short name of the competency',
			},
			{
				displayName: 'Competency Description',
				name: 'competencyDescription',
				type: 'string',
				default: '',
				displayOptions: {
					show: { resource: ['competency'], operation: ['createCompetency', 'updateCompetency'] },
				},
				description: 'Description of the competency',
			},
			{
				displayName: 'Competency ID Number',
				name: 'competencyIdNumber',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['competency'], operation: ['createCompetency'] } },
				description: 'Unique ID number of the competency within the framework',
			},
			{
				displayName: 'Competency Framework ID',
				name: 'competencyFrameworkId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: { resource: ['competency'], operation: ['createCompetency', 'listCompetencies'] },
				},
				description: 'ID of the competency framework',
			},
			{
				displayName: 'Course',
				name: 'compCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['competency'], operation: ['getUserCompetencies'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'User',
				name: 'compUserId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a user...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter user ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: { resource: ['competency'], operation: ['getUserCompetencies', 'getUserCompetency'] },
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Quiz Course ID',
				name: 'quizCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['quiz'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Quiz ID',
				name: 'quizId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: { resource: ['quiz'], operation: ['startAttempt', 'getUserBestGrade', 'getUserAttempts'] },
				},
				description: 'The quiz ID',
			},
			{
				displayName: 'Attempt ID',
				name: 'attemptId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: {
						resource: ['quiz'],
						operation: [
							'getAttemptData',
							'getAttemptSummary',
							'getAttemptReview',
							'processAttempt',
							'saveAttempt',
						],
					},
				},
				description: 'The attempt ID',
			},
			{
				displayName: 'Quiz User ID',
				name: 'quizUserId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a User...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter User ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['quiz'], operation: ['getUserBestGrade', 'getUserAttempts'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Quiz Data JSON',
				name: 'quizDataJson',
				type: 'string',
				default: '[]',
				displayOptions: { show: { resource: ['quiz'], operation: ['processAttempt', 'saveAttempt'] } },
				description: 'JSON array of {"name": ..., "value": ...} pairs. JSON data for the attempt',
			},
			{
				displayName: 'Quiz Finish',
				name: 'quizFinish',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['quiz'], operation: ['processAttempt'] } },
				description: 'Whether to finish the attempt',
			},
			{
				displayName: 'Force New Attempt',
				name: 'quizForceNew',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['quiz'], operation: ['startAttempt'] } },
				description: 'Whether to force a new attempt',
			},
			{
				displayName: 'Page',
				name: 'quizPage',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['quiz'], operation: ['getAttemptData', 'getAttemptReview'] } },
				description: 'Page number (0 based). For Get Attempt Review, -1 returns all pages.',
			},
			{
				displayName: 'Assign Course ID',
				name: 'assignCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['assignment'], operation: ['get'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Assign ID',
				name: 'assignId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: {
						resource: ['assignment'],
						operation: [
							'getSubmissions',
							'getSubmissionStatus',
							'saveSubmission',
							'submitForGrading',
							'saveGrade',
							'getGrades',
							'listParticipants',
							'lock',
							'unlock',
							'revertToDraft',
							'getUserFlags',
							'setUserFlags',
						],
					},
				},
				description: 'The assignment ID',
			},
			{
				displayName: 'Assign User ID',
				name: 'assignUserId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a User...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter User ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['assignment'],
						operation: [
							'getSubmissionStatus',
							'saveGrade',
							'lock',
							'unlock',
							'revertToDraft',
							'getUserFlags',
							'setUserFlags',
						],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Accept Submission Statement',
				name: 'assignAcceptStatement',
				type: 'boolean',
				default: true,
				displayOptions: { show: { resource: ['assignment'], operation: ['submitForGrading'] } },
				description: 'Whether the submission statement is accepted',
			},
			{
				displayName: 'Assign Plugindata JSON',
				name: 'assignPlugindataJson',
				type: 'string',
				default: '{}',
				displayOptions: { show: { resource: ['assignment'], operation: ['saveSubmission', 'saveGrade'] } },
				description: 'JSON plugin data',
			},
			{
				displayName: 'Assign Grade Data JSON',
				name: 'assignGradeDataJson',
				type: 'string',
				default: '{}',
				displayOptions: { show: { resource: ['assignment'], operation: ['saveGrade'] } },
				description: 'Advanced grading data (JSON object). JSON grade data',
			},
			{
				displayName: 'Assign Flags JSON',
				name: 'assignFlagsJson',
				type: 'string',
				default: '{}',
				displayOptions: { show: { resource: ['assignment'], operation: ['setUserFlags'] } },
				description:
					'JSON object with any of: locked, mailed, extensionduedate, workflowstate, allocatedmarker. JSON flags data',
			},
			{
				displayName: 'Assign Grade',
				name: 'assignGrade',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['assignment'], operation: ['saveGrade'] } },
				description: 'Grade value',
			},
			{
				displayName: 'Assign Attempt Number',
				name: 'assignAttemptNumber',
				type: 'number',
				default: -1,
				displayOptions: { show: { resource: ['assignment'], operation: ['saveGrade'] } },
				description: 'Attempt number (-1 for latest)',
			},
			{
				displayName: 'Assign Group ID',
				name: 'assignGroupId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				displayOptions: { show: { resource: ['assignment'], operation: ['listParticipants'] } },
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Group...',
						typeOptions: {
							searchListMethod: 'searchGroups',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Group ID...',
						initType: 'number',
					},
				],
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Search Filter',
				name: 'assignFilter',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['assignment'], operation: ['listParticipants'] } },
				description: 'Search string to filter the participants',
			},
			{
				displayName: 'Forum Course ID',
				name: 'forumCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['forum'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Forum ID',
				name: 'forumId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['forum'], operation: ['addDiscussion', 'canAddDiscussion'] } },
				description: 'The forum ID',
			},
			{
				displayName: 'Forum Discussion ID',
				name: 'forumDiscussionId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: { resource: ['forum'], operation: ['getPosts', 'setPinState', 'toggleFavourite'] },
				},
				description: 'The discussion ID',
			},
			{
				displayName: 'Reply To Post ID',
				name: 'forumPostId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['forum'], operation: ['addPost'] } },
				description: 'ID of the post to reply to (e.g. the first post of the discussion)',
			},
			{
				displayName: 'Discussion Title',
				name: 'forumDiscussionTitle',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['forum'], operation: ['addDiscussion'] } },
				description: 'Title of the discussion',
			},
			{
				displayName: 'Discussion Message',
				name: 'forumDiscussionMessage',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['forum'], operation: ['addDiscussion'] } },
				description: 'Message body of the discussion',
			},
			{
				displayName: 'Post Subject',
				name: 'forumPostSubject',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['forum'], operation: ['addPost'] } },
				description: 'Subject of the post',
			},
			{
				displayName: 'Post Message',
				name: 'forumPostMessage',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['forum'], operation: ['addPost'] } },
				description: 'Message body of the post',
			},
			{
				displayName: 'Forum Pin State',
				name: 'forumPinState',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['forum'], operation: ['setPinState'] } },
				description: 'Whether the discussion is pinned',
			},
			{
				displayName: 'Forum Favourite State',
				name: 'forumFavouriteState',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['forum'], operation: ['toggleFavourite'] } },
				description: 'Whether the discussion is favourited',
			},
			{
				displayName: 'Glossary Course ID',
				name: 'glossaryCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['glossary'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Glossary ID',
				name: 'glossaryId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: {
						resource: ['glossary'],
						operation: ['getEntriesByAuthor', 'getEntriesByCategory', 'getEntriesByDate', 'addEntry'],
					},
				},
				description: 'The glossary ID',
			},
			{
				displayName: 'Glossary Entry ID',
				name: 'glossaryEntryId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: { resource: ['glossary'], operation: ['getEntryById', 'updateEntry', 'deleteEntry'] },
				},
				description: 'The entry ID',
			},
			{
				displayName: 'Glossary Author ID',
				name: 'glossaryAuthorId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a User...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter User ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['glossary'], operation: ['getEntriesByAuthor'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Glossary Category ID',
				name: 'glossaryCategoryId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Category...',
						typeOptions: {
							searchListMethod: 'searchCategories',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Category ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['glossary'], operation: ['getEntriesByCategory'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Entry Concept',
				name: 'glossaryEntryConcept',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['glossary'], operation: ['addEntry', 'updateEntry'] } },
				description: 'The entry concept (title)',
			},
			{
				displayName: 'Entry Definition',
				name: 'glossaryEntryDefinition',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['glossary'], operation: ['addEntry', 'updateEntry'] } },
				description: 'The entry definition (body)',
			},
			{
				displayName: 'Limit',
				name: 'glossaryLimit',
				type: 'number',
				default: 20,
				displayOptions: {
					show: {
						resource: ['glossary'],
						operation: ['getEntriesByAuthor', 'getEntriesByCategory', 'getEntriesByDate'],
					},
				},
				description: 'Max number of entries to return',
			},
			{
				displayName: 'Offset',
				name: 'glossaryFrom',
				type: 'number',
				default: 0,
				displayOptions: {
					show: {
						resource: ['glossary'],
						operation: ['getEntriesByAuthor', 'getEntriesByCategory', 'getEntriesByDate'],
					},
				},
				description: 'Number of entries to skip',
			},
			{
				displayName: 'Lesson Course ID',
				name: 'lessonCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['lesson'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Lesson ID',
				name: 'lessonId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: {
						resource: ['lesson'],
						operation: [
							'getPages',
							'getPageData',
							'launchAttempt',
							'processPage',
							'getUserAttempt',
							'getUserGrade',
							'getQuestionsAttempts',
						],
					},
				},
				description: 'The lesson ID',
			},
			{
				displayName: 'Lesson Page ID',
				name: 'lessonPageId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['lesson'], operation: ['getPageData', 'processPage'] } },
				description: 'The page ID',
			},
			{
				displayName: 'Lesson User ID',
				name: 'lessonUserId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a User...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter User ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: {
						resource: ['lesson'],
						operation: ['getUserAttempt', 'getUserGrade', 'getQuestionsAttempts'],
					},
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Lesson Attempt',
				name: 'lessonAttempt',
				type: 'number',
				default: 0,
				displayOptions: {
					show: { resource: ['lesson'], operation: ['getUserAttempt', 'getQuestionsAttempts'] },
				},
				description: 'Attempt number',
			},
			{
				displayName: 'Lesson Data JSON',
				name: 'lessonDataJson',
				type: 'string',
				default: '{}',
				displayOptions: { show: { resource: ['lesson'], operation: ['processPage'] } },
				description:
					'JSON array of {"name": ..., "value": ...} pairs (or a JSON object of name/value). JSON data for the page',
			},
			{
				displayName: 'Password',
				name: 'lessonPassword',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				displayOptions: {
					show: {
						resource: ['lesson'],
						operation: ['getPages', 'getPageData', 'launchAttempt', 'processPage'],
					},
				},
				description: 'Lesson password, if the lesson is protected',
			},
			{
				displayName: 'SCORM Course ID',
				name: 'scormCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['scorm'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'SCORM ID',
				name: 'scormId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['scorm'], operation: ['getAttemptCount', 'getUserData'] } },
				description: 'The SCORM ID',
			},
			{
				displayName: 'SCO ID',
				name: 'scormScoId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['scorm'], operation: ['getTracks', 'insertTracks'] } },
				description: 'ID of the SCO (Sharable Content Object)',
			},
			{
				displayName: 'SCORM User ID',
				name: 'scormUserId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a User...',
						typeOptions: {
							searchListMethod: 'searchUsers',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter User ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['scorm'], operation: ['getTracks', 'getAttemptCount'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'SCORM Attempt',
				name: 'scormAttempt',
				type: 'number',
				default: 1,
				displayOptions: {
					show: { resource: ['scorm'], operation: ['getTracks', 'insertTracks', 'getUserData'] },
				},
				description: 'Attempt number',
			},
			{
				displayName: 'SCORM Tracks JSON',
				name: 'scormTracksJson',
				type: 'string',
				default: '[]',
				required: true,
				displayOptions: { show: { resource: ['scorm'], operation: ['insertTracks'] } },
				description: 'JSON array of {"element": ..., "value": ...}. JSON array of tracks',
			},
			{
				displayName: 'Workshop Course ID',
				name: 'workshopCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['workshop'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Workshop ID',
				name: 'workshopId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: { resource: ['workshop'], operation: ['getPhases', 'getSubmissions', 'getGrades', 'view'] },
				},
				description: 'The workshop ID',
			},
			{
				displayName: 'Assessment ID',
				name: 'workshopAssessmentId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['workshop'], operation: ['getAssessmentForm'] } },
				description: 'ID of the assessment',
			},
			{
				displayName: 'Data Course ID',
				name: 'dataCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['data'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Data ID',
				name: 'dataId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: { resource: ['data'], operation: ['getFields', 'getEntries', 'searchEntries', 'addEntry'] },
				},
				description: 'The database activity ID',
			},
			{
				displayName: 'Data Entry ID',
				name: 'dataEntryId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['data'], operation: ['updateEntry', 'deleteEntry'] } },
				description: 'The entry ID',
			},
			{
				displayName: 'Data Search Query',
				name: 'dataSearchQuery',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['data'], operation: ['searchEntries'] } },
				description: 'Search query string',
			},
			{
				displayName: 'Data Entry JSON',
				name: 'dataEntryJson',
				type: 'string',
				default: '{}',
				required: true,
				displayOptions: { show: { resource: ['data'], operation: ['addEntry', 'updateEntry'] } },
				description: 'JSON object with entry data',
			},
			{
				displayName: 'Survey Course ID',
				name: 'surveyCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['survey'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Survey ID',
				name: 'surveyId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['survey'], operation: ['getQuestions', 'submitAnswers'] } },
				description: 'The survey ID',
			},
			{
				displayName: 'Survey Answers JSON',
				name: 'surveyAnswersJson',
				type: 'string',
				default: '[]',
				required: true,
				displayOptions: { show: { resource: ['survey'], operation: ['submitAnswers'] } },
				description: 'JSON array of answers',
			},
			{
				displayName: 'Choice Course ID',
				name: 'choiceCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['choice'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Choice ID',
				name: 'choiceId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: {
						resource: ['choice'],
						operation: ['getResults', 'getOptions', 'submitResponse', 'deleteResponse'],
					},
				},
				description: 'The choice ID',
			},
			{
				displayName: 'Choice Option IDs (comma-separated)',
				name: 'choiceOptionIds',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['choice'], operation: ['submitResponse'] } },
				description: 'Comma-separated list of option IDs',
			},
			{
				displayName: 'Feedback Course ID',
				name: 'feedbackCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['feedback'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Feedback ID',
				name: 'feedbackId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: {
						resource: ['feedback'],
						operation: [
							'getItems',
							'getAnalysis',
							'getResponsesAnalysis',
							'getLastCompleted',
							'getCurrentCompleted',
							'processPage',
						],
					},
				},
				description: 'The feedback ID',
			},
			{
				displayName: 'Group ID',
				name: 'feedbackGroupId',
				type: 'number',
				default: 0,
				description: 'Group id, 0 means that the function will determine the user group',
				displayOptions: { show: { resource: ['feedback'], operation: ['getResponsesAnalysis'] } },
			},
			{
				displayName: 'Page',
				name: 'feedbackAnalysisPage',
				type: 'number',
				default: 0,
				description: 'The page of records to return',
				displayOptions: { show: { resource: ['feedback'], operation: ['getResponsesAnalysis'] } },
			},
			{
				displayName: 'Per Page',
				name: 'feedbackPerPage',
				type: 'number',
				default: 0,
				description: 'The number of records to return per page',
				displayOptions: { show: { resource: ['feedback'], operation: ['getResponsesAnalysis'] } },
			},
			{
				displayName: 'Feedback Page',
				name: 'feedbackPage',
				type: 'number',
				default: -1,
				displayOptions: { show: { resource: ['feedback'], operation: ['processPage'] } },
				description: 'Page number (-1 for all)',
			},
			{
				displayName: 'Feedback Responses JSON',
				name: 'feedbackResponsesJson',
				type: 'string',
				default: '[]',
				required: true,
				displayOptions: { show: { resource: ['feedback'], operation: ['processPage'] } },
				description: 'JSON array of responses',
			},
			{
				displayName: 'Wiki Course ID',
				name: 'wikiCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['wiki'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Wiki ID',
				name: 'wikiId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['wiki'], operation: ['getSubwikis', 'getPages', 'newPage'] } },
				description: 'The wiki ID',
			},
			{
				displayName: 'Wiki Page ID',
				name: 'wikiPageId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['wiki'], operation: ['getPageContents', 'editPage'] } },
				description: 'The page ID',
			},
			{
				displayName: 'Wiki Subwiki ID',
				name: 'wikiSubwikiId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['wiki'], operation: ['newPage'] } },
				description: 'Subwiki ID (0 for all)',
			},
			{
				displayName: 'Wiki Page Title',
				name: 'wikiPageTitle',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['wiki'], operation: ['newPage'] } },
				description: 'Title of the new page',
			},
			{
				displayName: 'Wiki Page Content',
				name: 'wikiPageContent',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['wiki'], operation: ['editPage', 'newPage'] } },
				description: 'Content of the page',
			},
			{
				displayName: 'Chat Course ID',
				name: 'chatCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['chat'], operation: ['getByCourse'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['chat'], operation: ['loginUser'] } },
				description: 'The chat activity ID',
			},
			{
				displayName: 'Chat Session ID',
				name: 'chatSessionId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['chat'], operation: ['getUsers', 'getLatestMessages', 'sendMessage'] },
				},
				description: 'Chat session ID (chatsid) returned by the Login User operation',
			},
			{
				displayName: 'Chat Message',
				name: 'chatMessage',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['chat'], operation: ['sendMessage'] } },
				description: 'The message text',
			},
			{
				displayName: 'Certificate Issue ID',
				name: 'certificateIssueId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['customcert'], operation: ['deleteIssue'] } },
				description: 'The certificate issue ID to delete',
			},
			{
				displayName: 'Certificate ID',
				name: 'certificateId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: { resource: ['customcert'], operation: ['deleteIssue', 'getElementHtml', 'saveElement'] },
				},
				description: 'The certificate ID',
			},
			{
				displayName: 'Element ID',
				name: 'certificateElementId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['customcert'], operation: ['getElementHtml', 'saveElement'] } },
				description: 'The element ID',
			},
			{
				displayName: 'Element Data (JSON)',
				name: 'certificateElementData',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '{}',
				required: true,
				displayOptions: { show: { resource: ['customcert'], operation: ['saveElement'] } },
				description: 'JSON object with element data',
			},
			{
				displayName: 'Joomdle Group ID',
				name: 'joomdleGroupId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Group...',
						typeOptions: {
							searchListMethod: 'searchGroups',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Group ID...',
						initType: 'number',
					},
				],
				displayOptions: { show: { resource: ['joomdle'], operation: ['getGroupMembers'] } },
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Simple Course ID',
				name: 'simpleCourseId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'By List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a Course...',
						typeOptions: {
							searchListMethod: 'searchCourses',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter Course ID...',
						initType: 'number',
					},
				],
				displayOptions: {
					show: { resource: ['book', 'page', 'url', 'resource', 'folder'], operation: ['getByCourse'] },
				},
				description: 'Choose from the list, or specify an ID',
			},
			{
				displayName: 'Rating Component',
				name: 'ratingComponent',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['rating'], operation: ['get', 'add'] } },
				description: 'Component (e.g. mod_forum)',
			},
			{
				displayName: 'Rating Area',
				name: 'ratingArea',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['rating'], operation: ['get', 'add'] } },
				description: 'Rating area',
			},
			{
				displayName: 'Rating Context Level',
				name: 'ratingContextLevel',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['rating'], operation: ['get', 'add'] } },
				description: 'Context level',
			},
			{
				displayName: 'Rating Item ID',
				name: 'ratingItemId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['rating'], operation: ['get', 'add'] } },
				description: 'The item ID',
			},
			{
				displayName: 'Rating Scale ID',
				name: 'ratingScaleId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['rating'], operation: ['get', 'add'] } },
				description: 'Scale ID',
			},
			{
				displayName: 'Rating Value',
				name: 'ratingValue',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['rating'], operation: ['add'] } },
				description: 'Rating value',
			},
			{
				displayName: 'Rated User ID',
				name: 'ratingRatedUserId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['rating'], operation: ['add'] } },
				description: 'ID of the user who is being rated',
			},
			{
				displayName: 'Sort',
				name: 'ratingSort',
				type: 'options',
				default: 'time',
				displayOptions: { show: { resource: ['rating'], operation: ['get'] } },
				options: [
					{ name: 'Time', value: 'time' },
					{ name: 'First Name', value: 'firstname' },
					{ name: 'Rating', value: 'rating' },
				],
				description: 'Sort order',
			},
			{
				displayName: 'Rating Instance ID',
				name: 'ratingInstanceId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['rating'], operation: ['get', 'add'] } },
				description:
					'Instance ID of the context (e.g. the course module ID for contextlevel module). Instance ID (0 for all)',
			},
			{
				displayName: 'Comment Component',
				name: 'commentComponent',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['get', 'add'] } },
				description: 'Component (e.g. mod_forum)',
			},
			{
				displayName: 'Comment Area',
				name: 'commentArea',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['get', 'add'] } },
				description: 'Comment area',
			},
			{
				displayName: 'Comment Item ID',
				name: 'commentItemId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['get', 'add'] } },
				description: 'The item ID',
			},
			{
				displayName: 'Context Level',
				name: 'commentContextLevel',
				type: 'options',
				default: 'module',
				displayOptions: { show: { resource: ['comment'], operation: ['get', 'add'] } },
				options: [
					{ name: 'System', value: 'system' },
					{ name: 'User', value: 'user' },
					{ name: 'Course Category', value: 'coursecat' },
					{ name: 'Course', value: 'course' },
					{ name: 'Module', value: 'module' },
					{ name: 'Block', value: 'block' },
				],
				description: 'Context level of the commented item',
			},
			{
				displayName: 'Instance ID',
				name: 'commentInstanceId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['get', 'add'] } },
				description: 'ID of the instance for the context level (e.g. course module ID)',
			},
			{
				displayName: 'Comment Delete ID',
				name: 'commentDeleteId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['delete'] } },
				description: 'The comment ID to delete',
			},
			{
				displayName: 'Comment Content',
				name: 'commentContent',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['add'] } },
				description: 'The comment text',
			},
		],
	};

	methods = {
		listSearch: {
			async searchCourses(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const courses = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_get_courses' });
				const results = ((courses || []) as IDataObject[])
					.filter((c) => c.format !== 'site')
					.map((c) => ({
						name: String(c.fullname || c.shortname || `Course #${c.id}`),
						value: String(c.id),
					}));
				return { results: filterResults(results, filter) };
			},
			async searchUsers(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const users = await moodleApiRequest.call(this, 'POST', {
					wsfunction: 'core_user_get_users',
					criteria: [{ key: 'email', value: '%' }],
				});
				const results = (((users?.users as IDataObject[]) || []) as IDataObject[]).map((u) => {
					const fullName = `${u.firstname || ''} ${u.lastname || ''}`.trim();
					return {
						name: fullName
							? `${fullName}${u.email ? ` (${u.email})` : ''}`
							: String(u.username || `User #${u.id}`),
						value: String(u.id),
					};
				});
				return { results: filterResults(results, filter) };
			},
			async searchCategories(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const categories = await moodleApiRequest.call(this, 'POST', {
					wsfunction: 'core_course_get_categories',
				});
				const results = ((categories || []) as IDataObject[]).map((c) => ({
					name: String(c.name || `Category #${c.id}`),
					value: String(c.id),
				}));
				return { results: filterResults(results, filter) };
			},
			async searchGroups(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const courseId = getLoadOptionsCourseId(this, 'groupCourseId');
				if (!courseId) {
					return { results: [] };
				}
				const groups = await moodleApiRequest.call(this, 'POST', {
					wsfunction: 'core_group_get_course_groups',
					courseid: courseId,
				});
				const results = ((groups || []) as IDataObject[]).map((g) => ({
					name: String(g.name || `Group #${g.id}`),
					value: String(g.id),
				}));
				return { results: filterResults(results, filter) };
			},
			async searchGroupings(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const courseId = getLoadOptionsCourseId(this, 'groupCourseId');
				if (!courseId) {
					return { results: [] };
				}
				const groupings = await moodleApiRequest.call(this, 'POST', {
					wsfunction: 'core_group_get_course_groupings',
					courseid: courseId,
				});
				const results = ((groupings || []) as IDataObject[]).map((g) => ({
					name: String(g.name || `Grouping #${g.id}`),
					value: String(g.id),
				}));
				return { results: filterResults(results, filter) };
			},
			async searchCohorts(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				// Without cohortids Moodle returns all the cohorts.
				const cohorts = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_cohort_get_cohorts' });
				const results = ((cohorts || []) as IDataObject[]).map((c) => ({
					name: String(c.name || `Cohort #${c.id}`),
					value: String(c.id),
				}));
				return { results: filterResults(results, filter) };
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const api = async (params: IDataObject): Promise<any> => moodleApiRequest.call(this, 'POST', params);

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const unsupported = (): never => {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for resource "${resource}"`,
						{
							itemIndex: i,
						},
					);
				};
				let responseData: any;

				if (resource === 'user') {
					if (operation === 'create') {
						const additionalFields = {
							...(this.getNodeParameter('additionalFields', i, {}) as IDataObject),
						};
						const customfieldsStr = (additionalFields.customfields as string) || '';
						delete additionalFields.customfields;
						const userData: IDataObject = {
							username: this.getNodeParameter('username', i) as string,
							password: this.getNodeParameter('password', i) as string,
							firstname: this.getNodeParameter('firstname', i) as string,
							lastname: this.getNodeParameter('lastname', i) as string,
							email: this.getNodeParameter('email', i) as string,
							...additionalFields,
						};
						if (userData.createpassword) {
							delete userData.password;
						} else {
							delete userData.createpassword;
						}
						if (customfieldsStr) {
							userData.customfields = parseCustomFields(this, i, customfieldsStr);
						}
						responseData = await api({ wsfunction: 'core_user_create_users', users: [userData] });
					} else if (operation === 'get') {
						const userId = getRLValue(this, i, 'userId');
						const users = await api({
							wsfunction: 'core_user_get_users_by_field',
							field: 'id',
							values: [userId],
						});
						if (!Array.isArray(users) || users.length === 0) {
							throw new NodeOperationError(this.getNode(), `User with ID ${userId} not found`, {
								itemIndex: i,
							});
						}
						responseData = users[0];
					} else if (operation === 'getByField') {
						const field = this.getNodeParameter('field', i) as string;
						const fieldValue = this.getNodeParameter('fieldValue', i) as string;
						responseData = await api({
							wsfunction: 'core_user_get_users_by_field',
							field,
							values: [fieldValue],
						});
					} else if (operation === 'getAll') {
						const res = await api({
							wsfunction: 'core_user_get_users',
							criteria: [{ key: 'email', value: '%' }],
						});
						responseData = (res && res.users) || [];
					} else if (operation === 'update') {
						const userId = getRLValue(this, i, 'userId');
						const additionalFields = {
							...(this.getNodeParameter('additionalFields', i, {}) as IDataObject),
						};
						const updateFields = compact(this.getNodeParameter('userUpdateFields', i, {}) as IDataObject);
						const customfieldsStr = (additionalFields.customfields as string) || '';
						delete additionalFields.customfields;
						delete additionalFields.createpassword;
						const userData: IDataObject = { id: userId, ...additionalFields, ...updateFields };
						if (customfieldsStr) {
							userData.customfields = parseCustomFields(this, i, customfieldsStr);
						}
						responseData = await api({ wsfunction: 'core_user_update_users', users: [userData] });
					} else if (operation === 'delete') {
						const userId = getRLValue(this, i, 'userId');
						responseData = await api({ wsfunction: 'core_user_delete_users', userids: [userId] });
					} else if (operation === 'getPreferences') {
						const userId = getRLValue(this, i, 'userId');
						responseData = await api({ wsfunction: 'core_user_get_user_preferences', userid: userId });
					} else if (operation === 'setPreferences') {
						const preferences = parseJsonParam(this, i, 'preferencesJson', []);
						responseData = await api({
							wsfunction: 'core_user_set_user_preferences',
							preferences: toNameValueList(preferences),
						});
					} else if (operation === 'agreeSitePolicy') {
						// Always applies to the user that owns the web service token.
						responseData = await api({ wsfunction: 'core_user_agree_site_policy' });
					} else if (operation === 'addDevice') {
						const deviceData = parseJsonParam(this, i, 'addDeviceParams', {});
						responseData = await api({
							wsfunction: 'core_user_add_user_device',
							...(deviceData as IDataObject),
						});
					} else {
						unsupported();
					}
				} else if (resource === 'course') {
					if (operation === 'create' || operation === 'update') {
						const additionalFields = {
							...(this.getNodeParameter('courseAdditionalFields', i, {}) as IDataObject),
						};
						for (const dateField of ['startdate', 'enddate']) {
							if (additionalFields[dateField] !== undefined) {
								const ts = toTimestamp(additionalFields[dateField]);
								if (ts === undefined) {
									delete additionalFields[dateField];
								} else {
									additionalFields[dateField] = ts;
								}
							}
						}
						if (additionalFields.format === '') {
							delete additionalFields.format;
						}
						let courseData: IDataObject;
						if (operation === 'create') {
							courseData = {
								fullname: this.getNodeParameter('fullname', i) as string,
								shortname: this.getNodeParameter('shortname', i) as string,
								categoryid: getRLValue(this, i, 'categoryid'),
								...additionalFields,
							};
							responseData = await api({
								wsfunction: 'core_course_create_courses',
								courses: [courseData],
							});
						} else {
							courseData = { id: getRLValue(this, i, 'courseId'), ...additionalFields };
							responseData = await api({
								wsfunction: 'core_course_update_courses',
								courses: [courseData],
							});
						}
					} else if (operation === 'get') {
						const courseId = getRLValue(this, i, 'courseId');
						const res = await api({
							wsfunction: 'core_course_get_courses_by_field',
							field: 'id',
							value: courseId,
						});
						const courses = (res && res.courses) || [];
						if (courses.length === 0) {
							throw new NodeOperationError(this.getNode(), `Course with ID ${courseId} not found`, {
								itemIndex: i,
							});
						}
						responseData = courses[0];
					} else if (operation === 'getAll') {
						responseData = await api({ wsfunction: 'core_course_get_courses' });
					} else if (operation === 'search') {
						const searchValue = this.getNodeParameter('searchValue', i) as string;
						let criteriaName = this.getNodeParameter('fieldName', i, 'search') as string;
						if (!['search', 'modulelist', 'blocklist', 'tagid'].includes(criteriaName)) {
							criteriaName = 'search';
						}
						responseData = await api({
							wsfunction: 'core_course_search_courses',
							criterianame: criteriaName,
							criteriavalue: searchValue,
						});
					} else if (operation === 'delete') {
						const courseId = getRLValue(this, i, 'courseId');
						responseData = await api({ wsfunction: 'core_course_delete_courses', courseids: [courseId] });
						if (
							responseData &&
							Array.isArray(responseData.warnings) &&
							responseData.warnings.length === 0
						) {
							responseData = { success: true };
						}
					} else if (operation === 'duplicate') {
						const options = this.getNodeParameter('duplicateOptions', i, {}) as IDataObject;
						const backupOptions = ['users', 'activities', 'blocks', 'filters']
							.filter((name) => options[name] !== undefined)
							.map((name) => ({ name, value: options[name] ? 1 : 0 }));
						responseData = await api({
							wsfunction: 'core_course_duplicate_course',
							courseid: getRLValue(this, i, 'courseId'),
							fullname: this.getNodeParameter('duplicateFullname', i) as string,
							shortname: this.getNodeParameter('duplicateShortname', i) as string,
							categoryid: getRLValue(this, i, 'duplicateCategoryId'),
							visible: options.visible === undefined ? 1 : options.visible ? 1 : 0,
							options: backupOptions,
						});
					} else if (operation === 'getCategories') {
						responseData = await api({ wsfunction: 'core_course_get_categories' });
					} else if (operation === 'getCategory') {
						const categoryId = getRLValue(this, i, 'categoryId');
						const categories = await api({
							wsfunction: 'core_course_get_categories',
							criteria: [{ key: 'id', value: categoryId }],
							addsubcategories: 0,
						});
						if (!Array.isArray(categories) || categories.length === 0) {
							throw new NodeOperationError(this.getNode(), `Category with ID ${categoryId} not found`, {
								itemIndex: i,
							});
						}
						responseData = categories[0];
					} else if (operation === 'createCategory') {
						const catData: IDataObject = {
							name: this.getNodeParameter('categoryName', i) as string,
							parent: getRLValue(this, i, 'parentCategoryId'),
						};
						const idnumber = this.getNodeParameter('categoryIdNumber', i, '') as string;
						const description = this.getNodeParameter('categoryDescription', i, '') as string;
						if (idnumber) catData.idnumber = idnumber;
						if (description) catData.description = description;
						responseData = await api({
							wsfunction: 'core_course_create_categories',
							categories: [catData],
						});
					} else if (operation === 'updateCategory') {
						const catData: IDataObject = { id: getRLValue(this, i, 'categoryId') };
						const name = this.getNodeParameter('categoryNewName', i, '') as string;
						const idnumber = this.getNodeParameter('categoryIdNumber', i, '') as string;
						const description = this.getNodeParameter('categoryDescription', i, '') as string;
						if (name) catData.name = name;
						if (idnumber) catData.idnumber = idnumber;
						if (description) catData.description = description;
						responseData = await api({
							wsfunction: 'core_course_update_categories',
							categories: [catData],
						});
					} else if (operation === 'deleteCategory') {
						const categoryId = getRLValue(this, i, 'categoryId');
						responseData = await api({
							wsfunction: 'core_course_delete_categories',
							categories: [{ id: categoryId, recursive: 0 }],
						});
					} else if (operation === 'getContents') {
						const courseId = getRLValue(this, i, 'courseId');
						responseData = await api({ wsfunction: 'core_course_get_contents', courseid: courseId });
					} else if (operation === 'getSections') {
						const courseId = getRLValue(this, i, 'courseId');
						responseData = await getCourseSections(api, courseId);
					} else if (operation === 'createSection') {
						const courseId = getRLValue(this, i, 'courseId');
						const afterSection = this.getNodeParameter('sectionNumber', i, 0) as number;
						const sectionName = this.getNodeParameter('sectionName', i, '') as string;
						const before = await getCourseSections(api, courseId);
						const target =
							afterSection > 0
								? before.find((s: IDataObject) => Number(s.section) === Number(afterSection))
								: undefined;
						if (afterSection > 0 && !target) {
							throw new NodeOperationError(
								this.getNode(),
								`Section number ${afterSection} not found in course ${courseId}`,
								{ itemIndex: i },
							);
						}
						await api({
							wsfunction: 'core_courseformat_update_course',
							action: 'section_add',
							courseid: courseId,
							targetsectionid: target ? target.id : undefined,
						});
						const after = await getCourseSections(api, courseId);
						const knownIds = new Set(before.map((s: IDataObject) => Number(s.id)));
						let created = after.find((s: IDataObject) => !knownIds.has(Number(s.id)));
						if (created && sectionName) {
							await renameSection(api, courseId, Number(created.id), sectionName);
							created = { ...created, name: sectionName };
						}
						responseData = created || { success: true };
					} else if (operation === 'updateSection') {
						const courseId = getRLValue(this, i, 'courseId');
						const sectionId = this.getNodeParameter('sectionId', i) as number;
						const sectionName = this.getNodeParameter('sectionName', i, '') as string;
						if (!sectionName) {
							throw new NodeOperationError(
								this.getNode(),
								'Section Name is required to update a section',
								{ itemIndex: i },
							);
						}
						responseData = await renameSection(api, courseId, sectionId, sectionName);
					} else if (operation === 'deleteSection') {
						const courseId = getRLValue(this, i, 'courseId');
						const sectionId = this.getNodeParameter('sectionId', i) as number;
						await api({
							wsfunction: 'core_courseformat_update_course',
							action: 'section_delete',
							courseid: courseId,
							ids: [sectionId],
						});
						responseData = { success: true, courseid: courseId, sectionid: sectionId };
					} else if (operation === 'getEnrolledUsers') {
						const courseId = getRLValue(this, i, 'courseId');
						responseData = await api({ wsfunction: 'core_enrol_get_enrolled_users', courseid: courseId });
					} else if (operation === 'getEnrolmentMethods') {
						const courseId = getRLValue(this, i, 'courseId');
						responseData = await api({
							wsfunction: 'core_enrol_get_course_enrolment_methods',
							courseid: courseId,
						});
					} else if (operation === 'getModule') {
						const moduleId = this.getNodeParameter('moduleId', i) as number;
						responseData = await api({ wsfunction: 'core_course_get_course_module', cmid: moduleId });
					} else {
						unsupported();
					}
				} else if (resource === 'enrollment') {
					if (operation === 'enrol') {
						const options = this.getNodeParameter('enrolOptions', i, {}) as IDataObject;
						const enrolment: IDataObject = {
							roleid: this.getNodeParameter('roleId', i) as number,
							userid: getRLValue(this, i, 'enrollUserId'),
							courseid: getRLValue(this, i, 'enrollCourseId'),
							timestart: toTimestamp(options.timestart),
							timeend: toTimestamp(options.timeend),
							suspend: options.suspend === undefined ? undefined : options.suspend ? 1 : 0,
						};
						responseData = await api({ wsfunction: 'enrol_manual_enrol_users', enrolments: [enrolment] });
					} else if (operation === 'unenrol') {
						responseData = await api({
							wsfunction: 'enrol_manual_unenrol_users',
							enrolments: [
								{
									userid: getRLValue(this, i, 'enrollUserId'),
									courseid: getRLValue(this, i, 'enrollCourseId'),
								},
							],
						});
					} else if (operation === 'getUserCourses') {
						responseData = await api({
							wsfunction: 'core_enrol_get_users_courses',
							userid: getRLValue(this, i, 'enrollUserId'),
						});
					} else if (operation === 'getCourseUsers') {
						responseData = await api({
							wsfunction: 'core_enrol_get_enrolled_users',
							courseid: getRLValue(this, i, 'enrollCourseId'),
						});
					} else if (operation === 'selfEnrol') {
						const instanceId = this.getNodeParameter('instanceId', i, 0) as number;
						const password = this.getNodeParameter('enrolPassword', i, '') as string;
						responseData = await api({
							wsfunction: 'enrol_self_enrol_user',
							courseid: getRLValue(this, i, 'enrollCourseId'),
							instanceid: instanceId || undefined,
							password: password || undefined,
						});
					} else if (operation === 'getSelfEnrolInstance') {
						responseData = await api({
							wsfunction: 'enrol_self_get_instance_info',
							instanceid: this.getNodeParameter('instanceId', i) as number,
						});
					} else if (operation === 'getEnrolledWithCapability') {
						const capabilities = String(this.getNodeParameter('capability', i) as string)
							.split(',')
							.map((c) => c.trim())
							.filter(Boolean);
						responseData = await api({
							wsfunction: 'core_enrol_get_enrolled_users_with_capability',
							coursecapabilities: [{ courseid: getRLValue(this, i, 'enrollCourseId'), capabilities }],
						});
					} else if (operation === 'getPotentialUsers') {
						const options = this.getNodeParameter('potentialUsersOptions', i, {}) as IDataObject;
						responseData = await api({
							wsfunction: 'core_enrol_get_potential_users',
							courseid: getRLValue(this, i, 'enrollCourseId'),
							enrolid: this.getNodeParameter('instanceId', i) as number,
							search: (options.search as string) ?? '',
							searchanywhere: options.searchanywhere ?? true,
							page: (options.page as number) ?? 0,
							perpage: (options.perpage as number) ?? 100,
						});
					} else if (operation === 'getEnrolment') {
						const enrollUserId = getRLValue(this, i, 'enrollUserId');
						const enrollCourseId = getRLValue(this, i, 'enrollCourseId');
						const userCourses = await api({
							wsfunction: 'core_enrol_get_users_courses',
							userid: enrollUserId,
						});
						const course = (Array.isArray(userCourses) ? userCourses : []).find(
							(c: IDataObject) => Number(c.id) === Number(enrollCourseId),
						);
						if (!course) {
							responseData = { userid: enrollUserId, courseid: enrollCourseId, enrolled: false };
						} else {
							const methods = await api({
								wsfunction: 'core_enrol_get_course_enrolment_methods',
								courseid: enrollCourseId,
							});
							responseData = {
								userid: enrollUserId,
								courseid: enrollCourseId,
								enrolled: true,
								course,
								enrolmentmethods: methods || [],
							};
						}
					} else {
						unsupported();
					}
				} else if (resource === 'grade') {
					if (operation === 'getUserCourseGrades') {
						const gradeUserId = getRLValue(this, i, 'gradeUserId');
						const gradeCourseId = getRLValue(this, i, 'gradeCourseId');
						const res = await api({
							wsfunction: 'gradereport_overview_get_course_grades',
							userid: gradeUserId,
						});
						if (gradeCourseId && res && Array.isArray(res.grades)) {
							res.grades = res.grades.filter((g: IDataObject) => Number(g.courseid) === gradeCourseId);
						}
						responseData = res;
					} else if (operation === 'viewGradeReport') {
						responseData = await api({
							wsfunction: 'gradereport_overview_view_grade_report',
							courseid: getRLValue(this, i, 'gradeCourseId'),
							userid: getRLValue(this, i, 'gradeUserId'),
						});
					} else if (operation === 'getGradesTable') {
						responseData = await api({
							wsfunction: 'gradereport_user_get_grades_table',
							courseid: getRLValue(this, i, 'gradeCourseId'),
							userid: getRLValue(this, i, 'gradeUserId'),
						});
					} else if (operation === 'getGradeItems') {
						responseData = await api({
							wsfunction: 'core_grades_get_gradeitems',
							courseid: getRLValue(this, i, 'gradeCourseId'),
						});
					} else if (operation === 'getGradeDefinitions') {
						const res = await api({
							wsfunction: 'core_grades_get_grade_tree',
							courseid: getRLValue(this, i, 'gradeCourseId'),
						});
						responseData = typeof res === 'string' ? JSON.parse(res) : res;
					} else if (operation === 'getGradableUsers') {
						responseData = await api({
							wsfunction: 'core_grades_get_gradable_users',
							courseid: getRLValue(this, i, 'gradeCourseId'),
						});
					} else if (operation === 'updateGrades') {
						const gradesJson = parseJsonParam(this, i, 'gradeDataJson', []);
						let grades: IDataObject[] = Array.isArray(gradesJson) ? gradesJson : [];
						if (grades.length === 0) {
							const feedback = this.getNodeParameter('gradeFeedback', i, '') as string;
							grades = [
								{
									studentid: getRLValue(this, i, 'gradeUserId'),
									grade: this.getNodeParameter('gradeValue', i, 0) as number,
									str_feedback: feedback || undefined,
								},
							];
						}
						responseData = await api({
							wsfunction: 'core_grades_update_grades',
							source: 'n8n',
							courseid: getRLValue(this, i, 'gradeCourseId'),
							component: this.getNodeParameter('gradeComponent', i) as string,
							activityid: this.getNodeParameter('gradeActivityId', i) as number,
							itemnumber: this.getNodeParameter('gradeItemNumber', i, 0) as number,
							grades,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'message') {
					if (operation === 'send') {
						responseData = await api({
							wsfunction: 'core_message_send_instant_messages',
							messages: [
								{
									touserid: getRLValue(this, i, 'messageToUserId'),
									text: this.getNodeParameter('messageText', i) as string,
									textformat: 1,
								},
							],
						});
					} else if (operation === 'getMessages') {
						const filters = this.getNodeParameter('messageFilters', i, {}) as IDataObject;
						responseData = await api({
							wsfunction: 'core_message_get_messages',
							useridto: getRLValue(this, i, 'messageUserId'),
							limitfrom: filters.limitfrom || undefined,
							limitnum: filters.limitnum || undefined,
							read:
								filters.read !== undefined && filters.read !== -1 && filters.read !== ''
									? filters.read
									: undefined,
							type: filters.type || undefined,
							newestfirst: filters.newestfirst,
						});
					} else if (operation === 'getConversations') {
						const filters = this.getNodeParameter('messageFilters', i, {}) as IDataObject;
						responseData = await api({
							wsfunction: 'core_message_get_conversations',
							userid: getRLValue(this, i, 'messageUserId'),
							limitfrom: filters.limitfrom || undefined,
							limitnum: filters.limitnum || undefined,
						});
					} else if (operation === 'getConversationMessages') {
						responseData = await api({
							wsfunction: 'core_message_get_conversation_messages',
							currentuserid: getRLValue(this, i, 'messageUserId'),
							convid: this.getNodeParameter('conversationId', i) as number,
						});
					} else if (operation === 'deleteConversation') {
						responseData = await api({
							wsfunction: 'core_message_delete_conversations_by_id',
							userid: getRLValue(this, i, 'messageUserId'),
							conversationids: [this.getNodeParameter('conversationId', i) as number],
						});
					} else if (operation === 'markMessageRead') {
						responseData = await api({
							wsfunction: 'core_message_mark_message_read',
							messageid: this.getNodeParameter('messageId', i) as number,
						});
					} else if (operation === 'deleteMessage') {
						responseData = await api({
							wsfunction: 'core_message_delete_message',
							messageid: this.getNodeParameter('messageId', i) as number,
							userid: getRLValue(this, i, 'messageUserId'),
						});
					} else if (operation === 'sendToConversation') {
						responseData = await api({
							wsfunction: 'core_message_send_messages_to_conversation',
							conversationid: this.getNodeParameter('conversationId', i) as number,
							messages: [{ text: this.getNodeParameter('messageText', i) as string, textformat: 1 }],
						});
					} else {
						unsupported();
					}
				} else if (resource === 'system') {
					if (operation === 'getSiteInfo' || operation === 'getSiteFeatures') {
						responseData = await api({ wsfunction: 'core_webservice_get_site_info' });
					} else if (operation === 'getAuthPlugins') {
						const siteInfo = await api({ wsfunction: 'core_webservice_get_site_info' });
						responseData = {
							sitename: siteInfo?.sitename,
							siteurl: siteInfo?.siteurl,
							userid: siteInfo?.userid,
							username: siteInfo?.username,
							functions: siteInfo?.functions,
						};
					} else {
						unsupported();
					}
				} else if (resource === 'cohort') {
					const buildCohort = (): IDataObject => {
						const categoryType = this.getNodeParameter('cohortCategoryType', i, 'system') as string;
						const categoryValue =
							categoryType === 'system'
								? ''
								: (this.getNodeParameter('cohortCategoryValue', i, '') as string);
						const description = this.getNodeParameter('cohortDescription', i, '') as string;
						return {
							categorytype: { type: categoryType, value: String(categoryValue) },
							name: this.getNodeParameter('cohortName', i, '') as string,
							idnumber: (this.getNodeParameter('cohortIdNumber', i, '') as string) || '',
							description: description || undefined,
						};
					};
					if (operation === 'create') {
						const cohort = buildCohort();
						if (!cohort.name) {
							throw new NodeOperationError(this.getNode(), 'Cohort Name is required', { itemIndex: i });
						}
						responseData = await api({ wsfunction: 'core_cohort_create_cohorts', cohorts: [cohort] });
					} else if (operation === 'get') {
						responseData = await api({
							wsfunction: 'core_cohort_get_cohorts',
							cohortids: [getRLValue(this, i, 'cohortId')],
						});
					} else if (operation === 'update') {
						const cohortId = getRLValue(this, i, 'cohortId');
						const cohort = buildCohort();
						if (!cohort.name || !cohort.idnumber || cohort.description === undefined) {
							const existing = await api({
								wsfunction: 'core_cohort_get_cohorts',
								cohortids: [cohortId],
							});
							const current = Array.isArray(existing) && existing[0] ? existing[0] : undefined;
							if (!current) {
								throw new NodeOperationError(this.getNode(), `Cohort with ID ${cohortId} not found`, {
									itemIndex: i,
								});
							}
							cohort.name = cohort.name || current.name;
							cohort.idnumber = cohort.idnumber || current.idnumber || '';
						}
						responseData = await api({
							wsfunction: 'core_cohort_update_cohorts',
							cohorts: [{ id: cohortId, ...cohort }],
						});
					} else if (operation === 'delete') {
						responseData = await api({
							wsfunction: 'core_cohort_delete_cohorts',
							cohortids: [getRLValue(this, i, 'cohortId')],
						});
					} else if (operation === 'addMembers') {
						const cohortId = getRLValue(this, i, 'cohortId');
						const memberIds = parseIdList(this.getNodeParameter('cohortMemberIds', i));
						responseData = await api({
							wsfunction: 'core_cohort_add_cohort_members',
							members: memberIds.map((uid) => ({
								cohorttype: { type: 'id', value: String(cohortId) },
								usertype: { type: 'id', value: String(uid) },
							})),
						});
					} else if (operation === 'deleteMembers') {
						const cohortId = getRLValue(this, i, 'cohortId');
						const memberIds = parseIdList(this.getNodeParameter('cohortMemberIds', i));
						responseData = await api({
							wsfunction: 'core_cohort_delete_cohort_members',
							members: memberIds.map((uid) => ({ cohortid: cohortId, userid: uid })),
						});
					} else if (operation === 'getMembers') {
						responseData = await api({
							wsfunction: 'core_cohort_get_cohort_members',
							cohortids: [getRLValue(this, i, 'cohortId')],
						});
					} else {
						unsupported();
					}
				} else if (resource === 'group') {
					if (operation === 'create') {
						const name = this.getNodeParameter('groupName', i, '') as string;
						if (!name) {
							throw new NodeOperationError(this.getNode(), 'Group Name is required', { itemIndex: i });
						}
						responseData = await api({
							wsfunction: 'core_group_create_groups',
							groups: [
								{
									courseid: getRLValue(this, i, 'groupCourseId'),
									name,
									description: (this.getNodeParameter('groupDescription', i, '') as string) || '',
								},
							],
						});
					} else if (operation === 'get') {
						responseData = await api({
							wsfunction: 'core_group_get_groups',
							groupids: [getRLValue(this, i, 'groupId')],
						});
					} else if (operation === 'update') {
						const groupId = getRLValue(this, i, 'groupId');
						let name = this.getNodeParameter('groupName', i, '') as string;
						if (!name) {
							const existing = await api({ wsfunction: 'core_group_get_groups', groupids: [groupId] });
							name = Array.isArray(existing) && existing[0] ? existing[0].name : '';
						}
						const description = this.getNodeParameter('groupDescription', i, '') as string;
						responseData = await api({
							wsfunction: 'core_group_update_groups',
							groups: [{ id: groupId, name, description: description || undefined }],
						});
					} else if (operation === 'delete') {
						responseData = await api({
							wsfunction: 'core_group_delete_groups',
							groupids: [getRLValue(this, i, 'groupId')],
						});
					} else if (operation === 'getCourseGroups') {
						responseData = await api({
							wsfunction: 'core_group_get_course_groups',
							courseid: getRLValue(this, i, 'groupCourseId'),
						});
					} else if (operation === 'addMember' || operation === 'deleteMember') {
						const groupId = getRLValue(this, i, 'groupId');
						const memberIds = parseIdList(this.getNodeParameter('groupMemberIds', i));
						responseData = await api({
							wsfunction:
								operation === 'addMember'
									? 'core_group_add_group_members'
									: 'core_group_delete_group_members',
							members: memberIds.map((uid) => ({ groupid: groupId, userid: uid })),
						});
					} else if (operation === 'getMembers') {
						responseData = await api({
							wsfunction: 'core_group_get_group_members',
							groupids: [getRLValue(this, i, 'groupId')],
						});
					} else if (operation === 'createGrouping') {
						const name = this.getNodeParameter('groupingName', i, '') as string;
						if (!name) {
							throw new NodeOperationError(this.getNode(), 'Grouping Name is required', { itemIndex: i });
						}
						responseData = await api({
							wsfunction: 'core_group_create_groupings',
							groupings: [
								{
									courseid: getRLValue(this, i, 'groupCourseId'),
									name,
									description: (this.getNodeParameter('groupingDescription', i, '') as string) || '',
								},
							],
						});
					} else if (operation === 'getGroupings') {
						responseData = await api({
							wsfunction: 'core_group_get_course_groupings',
							courseid: getRLValue(this, i, 'groupCourseId'),
						});
					} else if (operation === 'updateGrouping') {
						const groupingId = getRLValue(this, i, 'groupingId');
						let name = this.getNodeParameter('groupingName', i, '') as string;
						let description = this.getNodeParameter('groupingDescription', i, '') as string;
						if (!name || !description) {
							const existing = await api({
								wsfunction: 'core_group_get_groupings',
								groupingids: [groupingId],
							});
							const current = Array.isArray(existing) && existing[0] ? existing[0] : {};
							name = name || current.name || '';
							description = description || current.description || '';
						}
						responseData = await api({
							wsfunction: 'core_group_update_groupings',
							groupings: [{ id: groupingId, name, description }],
						});
					} else if (operation === 'deleteGrouping') {
						responseData = await api({
							wsfunction: 'core_group_delete_groupings',
							groupingids: [getRLValue(this, i, 'groupingId')],
						});
					} else if (operation === 'assignGrouping' || operation === 'unassignGrouping') {
						const groupingId = getRLValue(this, i, 'groupingId');
						const groupId = getRLValue(this, i, 'groupId');
						const key = operation === 'assignGrouping' ? 'assignments' : 'unassignments';
						await api({
							wsfunction: `core_group_${operation === 'assignGrouping' ? 'assign' : 'unassign'}_grouping`,
							[key]: [{ groupingid: groupingId, groupid: groupId }],
						});
						responseData = { success: true, groupingid: groupingId, groupid: groupId };
					} else if (operation === 'getGroupingGroups') {
						const groupingId = getRLValue(this, i, 'groupingId');
						const groupings = await api({
							wsfunction: 'core_group_get_groupings',
							groupingids: [groupingId],
							returngroups: 1,
						});
						responseData = (Array.isArray(groupings) && groupings[0] && groupings[0].groups) || [];
					} else if (operation === 'getGroupingOfGroup') {
						const groupCourseId = getRLValue(this, i, 'groupCourseId');
						const groupId = getRLValue(this, i, 'groupId');
						const groupings = await api({
							wsfunction: 'core_group_get_course_groupings',
							courseid: groupCourseId,
						});
						const groupingIds = (Array.isArray(groupings) ? groupings : [])
							.map((g: IDataObject) => g.id)
							.filter(Boolean);
						let found: IDataObject | undefined;
						if (groupingIds.length > 0) {
							const details = await api({
								wsfunction: 'core_group_get_groupings',
								groupingids: groupingIds,
								returngroups: 1,
							});
							found = (Array.isArray(details) ? details : []).find((g: IDataObject) =>
								((g.groups as IDataObject[]) || []).some((grp) => Number(grp.id) === Number(groupId)),
							);
						}
						responseData = found || { success: false, message: 'Group not assigned to any grouping' };
					} else {
						unsupported();
					}
				} else if (resource === 'calendar') {
					if (operation === 'get') {
						const eventCourseId = getRLValue(this, i, 'eventCourseId');
						const options = this.getNodeParameter('eventsOptions', i, {}) as IDataObject;
						const res = await api({
							wsfunction: 'core_calendar_get_calendar_events',
							events: eventCourseId ? { courseids: [eventCourseId] } : undefined,
							options: {
								userevents: options.userevents,
								siteevents: options.siteevents,
								timestart: toTimestamp(options.timestart),
								timeend: toTimestamp(options.timeend),
							},
						});
						const events = (res && res.events) || [];
						responseData = options.limitnum ? events.slice(0, Number(options.limitnum)) : events;
					} else if (operation === 'create') {
						const eventDate = this.getNodeParameter('eventDate', i) as string;
						const timestart = toTimestamp(eventDate);
						if (timestart === undefined) {
							throw new NodeOperationError(
								this.getNode(),
								'Event Date is required and must be a valid date',
								{ itemIndex: i },
							);
						}
						const eventDuration = this.getNodeParameter('eventDuration', i, 0) as number;
						const eventCourseId = getRLValue(this, i, 'eventCourseId');
						const eventGroupId = getRLValue(this, i, 'eventGroupId');
						responseData = await api({
							wsfunction: 'core_calendar_create_calendar_events',
							events: [
								{
									name: this.getNodeParameter('eventName', i) as string,
									description:
										(this.getNodeParameter('eventDescription', i, '') as string) || undefined,
									format: 1,
									eventtype: this.getNodeParameter('eventType', i, 'user') as string,
									timestart,
									timeduration: eventDuration > 0 ? eventDuration : undefined,
									courseid: eventCourseId || undefined,
									groupid: eventGroupId || undefined,
								},
							],
						});
					} else if (operation === 'delete') {
						responseData = await api({
							wsfunction: 'core_calendar_delete_calendar_events',
							events: [{ eventid: this.getNodeParameter('eventId', i) as number, repeat: 0 }],
						});
					} else if (operation === 'getUpcoming') {
						const eventCourseId = getRLValue(this, i, 'eventCourseId');
						const options = this.getNodeParameter('eventsOptions', i, {}) as IDataObject;
						const res = await api({
							wsfunction: 'core_calendar_get_calendar_upcoming_view',
							courseid: eventCourseId || undefined,
						});
						const events = (res && res.events) || [];
						responseData = options.limitnum ? events.slice(0, Number(options.limitnum)) : events;
					} else if (operation === 'getMonthlyView' || operation === 'getDayView') {
						const now = new Date();
						const eventCourseId = getRLValue(this, i, 'eventCourseId');
						const year = (this.getNodeParameter('calendarYear', i, 0) as number) || now.getFullYear();
						const month = (this.getNodeParameter('calendarMonth', i, 0) as number) || now.getMonth() + 1;
						if (operation === 'getMonthlyView') {
							responseData = await api({
								wsfunction: 'core_calendar_get_calendar_monthly_view',
								year,
								month,
								courseid: eventCourseId || undefined,
							});
						} else {
							const day = (this.getNodeParameter('calendarDay', i, 0) as number) || now.getDate();
							responseData = await api({
								wsfunction: 'core_calendar_get_calendar_day_view',
								year,
								month,
								day,
								courseid: eventCourseId || undefined,
							});
						}
					} else {
						unsupported();
					}
				} else if (resource === 'note') {
					if (operation === 'create') {
						const notes = parseJsonParam(this, i, 'notesJson', []);
						responseData = await api({
							wsfunction: 'core_notes_create_notes',
							notes: Array.isArray(notes) ? notes : [notes],
						});
					} else if (operation === 'get') {
						responseData = await api({
							wsfunction: 'core_notes_get_notes',
							notes: parseIdList(this.getNodeParameter('noteIds', i)),
						});
					} else if (operation === 'update') {
						const notes = parseJsonParam(this, i, 'notesUpdateJson', []);
						responseData = await api({
							wsfunction: 'core_notes_update_notes',
							notes: Array.isArray(notes) ? notes : [notes],
						});
					} else if (operation === 'delete') {
						responseData = await api({
							wsfunction: 'core_notes_delete_notes',
							notes: parseIdList(this.getNodeParameter('noteIds', i)),
						});
					} else {
						unsupported();
					}
				} else if (resource === 'badge') {
					if (operation === 'getUserBadges') {
						const badgeCourseId = getRLValue(this, i, 'badgeCourseId');
						responseData = await api({
							wsfunction: 'core_badges_get_user_badges',
							userid: getRLValue(this, i, 'badgeUserId'),
							courseid: badgeCourseId || undefined,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'file') {
					if (operation === 'get') {
						responseData = await api({
							wsfunction: 'core_files_get_files',
							contextid: this.getNodeParameter('fileContextId', i) as number,
							component: this.getNodeParameter('fileComponent', i) as string,
							filearea: this.getNodeParameter('fileArea', i) as string,
							itemid: this.getNodeParameter('fileItemId', i, 0) as number,
							filepath: (this.getNodeParameter('filePath', i, '/') as string) || '/',
							filename: this.getNodeParameter('fileName', i, '') as string,
						});
					} else if (operation === 'upload') {
						const contextId = this.getNodeParameter('fileContextId', i, 0) as number;
						const fileName = this.getNodeParameter('fileName', i, '') as string;
						if (!fileName) {
							throw new NodeOperationError(this.getNode(), 'File Name is required to upload a file', {
								itemIndex: i,
							});
						}
						const params: IDataObject = {
							wsfunction: 'core_files_upload',
							component: this.getNodeParameter('fileUploadComponent', i) as string,
							filearea: this.getNodeParameter('fileUploadArea', i) as string,
							itemid: this.getNodeParameter('draftAreaId', i, 0) as number,
							filepath: (this.getNodeParameter('filePath', i, '/') as string) || '/',
							filename: fileName,
							filecontent: this.getNodeParameter('fileContent', i) as string,
						};
						if (contextId) {
							params.contextid = contextId;
						} else {
							const siteInfo = await api({ wsfunction: 'core_webservice_get_site_info' });
							params.contextlevel = 'user';
							params.instanceid = siteInfo.userid;
						}
						responseData = await api(params);
					} else if (operation === 'deleteDraft') {
						const fileName = this.getNodeParameter('fileName', i, '') as string;
						responseData = await api({
							wsfunction: 'core_files_delete_draft_files',
							draftitemid: this.getNodeParameter('fileItemId', i) as number,
							files: [
								{
									filepath: (this.getNodeParameter('filePath', i, '/') as string) || '/',
									filename: fileName,
								},
							],
						});
					} else if (operation === 'createDraft') {
						responseData = await api({ wsfunction: 'core_files_get_unused_draft_itemid' });
					} else {
						unsupported();
					}
				} else if (resource === 'competency') {
					if (operation === 'createTemplate') {
						responseData = await api({
							wsfunction: 'core_competency_create_template',
							template: { shortname: this.getNodeParameter('templateName', i) as string, contextid: 1 },
						});
					} else if (operation === 'getTemplate') {
						responseData = await api({
							wsfunction: 'core_competency_read_template',
							id: this.getNodeParameter('templateId', i) as number,
						});
					} else if (operation === 'listTemplates') {
						responseData = await api({
							wsfunction: 'core_competency_list_templates',
							context: { contextid: 1 },
							includes: 'children',
						});
					} else if (operation === 'updateTemplate') {
						const templateName = this.getNodeParameter('templateName', i, '') as string;
						responseData = await api({
							wsfunction: 'core_competency_update_template',
							template: {
								id: this.getNodeParameter('templateId', i) as number,
								shortname: templateName || undefined,
							},
						});
					} else if (operation === 'deleteTemplate') {
						responseData = await api({
							wsfunction: 'core_competency_delete_template',
							id: this.getNodeParameter('templateId', i) as number,
							deleteplans: 1,
						});
					} else if (operation === 'createCompetency') {
						const description = this.getNodeParameter('competencyDescription', i, '') as string;
						responseData = await api({
							wsfunction: 'core_competency_create_competency',
							competency: {
								shortname: this.getNodeParameter('competencyShortName', i) as string,
								idnumber: this.getNodeParameter('competencyIdNumber', i) as string,
								competencyframeworkid: this.getNodeParameter('competencyFrameworkId', i) as number,
								description: description || undefined,
							},
						});
					} else if (operation === 'getCompetency') {
						responseData = await api({
							wsfunction: 'core_competency_read_competency',
							id: this.getNodeParameter('competencyId', i) as number,
						});
					} else if (operation === 'listCompetencies') {
						responseData = await api({
							wsfunction: 'core_competency_list_competencies',
							filters: [
								{
									column: 'competencyframeworkid',
									value: String(this.getNodeParameter('competencyFrameworkId', i) as number),
								},
							],
						});
					} else if (operation === 'updateCompetency') {
						const description = this.getNodeParameter('competencyDescription', i, '') as string;
						responseData = await api({
							wsfunction: 'core_competency_update_competency',
							competency: {
								id: this.getNodeParameter('competencyId', i) as number,
								description: description || undefined,
							},
						});
					} else if (operation === 'deleteCompetency') {
						responseData = await api({
							wsfunction: 'core_competency_delete_competency',
							id: this.getNodeParameter('competencyId', i) as number,
						});
					} else if (operation === 'getUserCompetencies') {
						const courseId = getRLValue(this, i, 'compCourseId');
						const userId = getRLValue(this, i, 'compUserId');
						const courseCompetencies = await api({
							wsfunction: 'core_competency_list_course_competencies',
							id: courseId,
						});
						const results: IDataObject[] = [];
						for (const entry of (Array.isArray(courseCompetencies)
							? courseCompetencies
							: []) as IDataObject[]) {
							const competency = entry.competency as IDataObject;
							const summary = await api({
								wsfunction: 'tool_lp_data_for_user_competency_summary_in_course',
								userid: userId,
								competencyid: competency.id,
								courseid: courseId,
							});
							results.push({
								competency,
								coursecompetency: entry.coursecompetency,
								usercompetencysummary: summary,
							});
						}
						responseData = results;
					} else if (operation === 'getUserCompetency') {
						responseData = await api({
							wsfunction: 'tool_lp_data_for_user_competency_summary',
							userid: getRLValue(this, i, 'compUserId'),
							competencyid: this.getNodeParameter('competencyId', i) as number,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'quiz') {
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_quiz_get_quizzes_by_courses',
							courseids: [getRLValue(this, i, 'quizCourseId')],
						});
					} else if (operation === 'startAttempt') {
						responseData = await api({
							wsfunction: 'mod_quiz_start_attempt',
							quizid: this.getNodeParameter('quizId', i) as number,
							forcenew: this.getNodeParameter('quizForceNew', i, false) as boolean,
						});
					} else if (operation === 'getAttemptData') {
						responseData = await api({
							wsfunction: 'mod_quiz_get_attempt_data',
							attemptid: this.getNodeParameter('attemptId', i) as number,
							page: Math.max(0, this.getNodeParameter('quizPage', i, 0) as number),
						});
					} else if (operation === 'getAttemptSummary') {
						responseData = await api({
							wsfunction: 'mod_quiz_get_attempt_summary',
							attemptid: this.getNodeParameter('attemptId', i) as number,
						});
					} else if (operation === 'getAttemptReview') {
						responseData = await api({
							wsfunction: 'mod_quiz_get_attempt_review',
							attemptid: this.getNodeParameter('attemptId', i) as number,
							page: this.getNodeParameter('quizPage', i, -1) as number,
						});
					} else if (operation === 'processAttempt' || operation === 'saveAttempt') {
						const data = toNameValueList(parseJsonParam(this, i, 'quizDataJson', []));
						responseData = await api({
							wsfunction:
								operation === 'processAttempt' ? 'mod_quiz_process_attempt' : 'mod_quiz_save_attempt',
							attemptid: this.getNodeParameter('attemptId', i) as number,
							data,
							finishattempt:
								operation === 'processAttempt'
									? (this.getNodeParameter('quizFinish', i, false) as boolean)
									: undefined,
						});
					} else if (operation === 'getUserBestGrade') {
						responseData = await api({
							wsfunction: 'mod_quiz_get_user_best_grade',
							quizid: this.getNodeParameter('quizId', i) as number,
							userid: getRLValue(this, i, 'quizUserId'),
						});
					} else if (operation === 'getUserAttempts') {
						responseData = await api({
							wsfunction: 'mod_quiz_get_user_attempts',
							quizid: this.getNodeParameter('quizId', i) as number,
							userid: getRLValue(this, i, 'quizUserId'),
							status: 'all',
						});
					} else {
						unsupported();
					}
				} else if (resource === 'assignment') {
					const assignId = (): number => this.getNodeParameter('assignId', i) as number;
					if (operation === 'get') {
						responseData = await api({
							wsfunction: 'mod_assign_get_assignments',
							courseids: [getRLValue(this, i, 'assignCourseId')],
						});
					} else if (operation === 'getSubmissions') {
						responseData = await api({
							wsfunction: 'mod_assign_get_submissions',
							assignmentids: [assignId()],
						});
					} else if (operation === 'getSubmissionStatus') {
						responseData = await api({
							wsfunction: 'mod_assign_get_submission_status',
							assignid: assignId(),
							userid: getRLValue(this, i, 'assignUserId'),
						});
					} else if (operation === 'saveSubmission') {
						responseData = await api({
							wsfunction: 'mod_assign_save_submission',
							assignmentid: assignId(),
							plugindata: parseJsonParam(this, i, 'assignPlugindataJson', {}),
						});
					} else if (operation === 'submitForGrading') {
						responseData = await api({
							wsfunction: 'mod_assign_submit_for_grading',
							assignmentid: assignId(),
							acceptsubmissionstatement: this.getNodeParameter(
								'assignAcceptStatement',
								i,
								true,
							) as boolean,
						});
					} else if (operation === 'saveGrade') {
						const advancedGradingData = parseJsonParam(this, i, 'assignGradeDataJson', {});
						const pluginData = parseJsonParam(this, i, 'assignPlugindataJson', {});
						responseData = await api({
							wsfunction: 'mod_assign_save_grade',
							assignmentid: assignId(),
							userid: getRLValue(this, i, 'assignUserId'),
							grade: this.getNodeParameter('assignGrade', i, 0) as number,
							attemptnumber: this.getNodeParameter('assignAttemptNumber', i, -1) as number,
							addattempt: 0,
							workflowstate: '',
							applytoall: 0,
							plugindata: pluginData,
							advancedgradingdata: advancedGradingData,
						});
					} else if (operation === 'getGrades') {
						responseData = await api({ wsfunction: 'mod_assign_get_grades', assignmentids: [assignId()] });
					} else if (operation === 'listParticipants') {
						const filter = this.getNodeParameter('assignFilter', i, '') as unknown;
						responseData = await api({
							wsfunction: 'mod_assign_list_participants',
							assignid: assignId(),
							groupid: getRLValue(this, i, 'assignGroupId'),
							filter: typeof filter === 'string' ? filter : '',
						});
					} else if (operation === 'lock' || operation === 'unlock' || operation === 'revertToDraft') {
						const wsfunction = {
							lock: 'mod_assign_lock_submissions',
							unlock: 'mod_assign_unlock_submissions',
							revertToDraft: 'mod_assign_revert_submissions_to_draft',
						}[operation];
						responseData = await api({
							wsfunction,
							assignmentid: assignId(),
							userids: [getRLValue(this, i, 'assignUserId')],
						});
					} else if (operation === 'getUserFlags') {
						const userId = getRLValue(this, i, 'assignUserId');
						const res = await api({ wsfunction: 'mod_assign_get_user_flags', assignmentids: [assignId()] });
						if (userId && res && Array.isArray(res.assignments)) {
							for (const assignment of res.assignments as IDataObject[]) {
								assignment.userflags = ((assignment.userflags as IDataObject[]) || []).filter(
									(f) => Number(f.userid) === userId,
								);
							}
						}
						responseData = res;
					} else if (operation === 'setUserFlags') {
						const flags = parseJsonParam(this, i, 'assignFlagsJson', {});
						const userflags = Array.isArray(flags)
							? flags
							: [{ userid: getRLValue(this, i, 'assignUserId'), ...(flags as IDataObject) }];
						responseData = await api({
							wsfunction: 'mod_assign_set_user_flags',
							assignmentid: assignId(),
							userflags,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'forum') {
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_forum_get_forums_by_courses',
							courseids: [getRLValue(this, i, 'forumCourseId')],
						});
					} else if (operation === 'addDiscussion') {
						responseData = await api({
							wsfunction: 'mod_forum_add_discussion',
							forumid: this.getNodeParameter('forumId', i) as number,
							subject: this.getNodeParameter('forumDiscussionTitle', i) as string,
							message: this.getNodeParameter('forumDiscussionMessage', i) as string,
						});
					} else if (operation === 'addPost') {
						responseData = await api({
							wsfunction: 'mod_forum_add_discussion_post',
							postid: this.getNodeParameter('forumPostId', i) as number,
							subject: this.getNodeParameter('forumPostSubject', i) as string,
							message: this.getNodeParameter('forumPostMessage', i) as string,
						});
					} else if (operation === 'getPosts') {
						responseData = await api({
							wsfunction: 'mod_forum_get_discussion_posts',
							discussionid: this.getNodeParameter('forumDiscussionId', i) as number,
						});
					} else if (operation === 'canAddDiscussion') {
						responseData = await api({
							wsfunction: 'mod_forum_can_add_discussion',
							forumid: this.getNodeParameter('forumId', i) as number,
						});
					} else if (operation === 'setPinState') {
						responseData = await api({
							wsfunction: 'mod_forum_set_pin_state',
							discussionid: this.getNodeParameter('forumDiscussionId', i) as number,
							targetstate: (this.getNodeParameter('forumPinState', i, false) as boolean) ? 1 : 0,
						});
					} else if (operation === 'toggleFavourite') {
						responseData = await api({
							wsfunction: 'mod_forum_toggle_favourite_state',
							discussionid: this.getNodeParameter('forumDiscussionId', i) as number,
							targetstate: this.getNodeParameter('forumFavouriteState', i, false) as boolean,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'glossary') {
					const paging = (): IDataObject => ({
						from: this.getNodeParameter('glossaryFrom', i, 0) as number,
						limit: this.getNodeParameter('glossaryLimit', i, 20) as number,
					});
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_glossary_get_glossaries_by_courses',
							courseids: [getRLValue(this, i, 'glossaryCourseId')],
						});
					} else if (operation === 'getEntriesByAuthor') {
						responseData = await api({
							wsfunction: 'mod_glossary_get_entries_by_author_id',
							id: this.getNodeParameter('glossaryId', i) as number,
							authorid: getRLValue(this, i, 'glossaryAuthorId'),
							...paging(),
						});
					} else if (operation === 'getEntriesByCategory') {
						responseData = await api({
							wsfunction: 'mod_glossary_get_entries_by_category',
							id: this.getNodeParameter('glossaryId', i) as number,
							categoryid: getRLValue(this, i, 'glossaryCategoryId'),
							...paging(),
						});
					} else if (operation === 'getEntriesByDate') {
						responseData = await api({
							wsfunction: 'mod_glossary_get_entries_by_date',
							id: this.getNodeParameter('glossaryId', i) as number,
							order: 'UPDATE',
							sort: 'DESC',
							...paging(),
						});
					} else if (operation === 'getEntryById') {
						responseData = await api({
							wsfunction: 'mod_glossary_get_entry_by_id',
							id: this.getNodeParameter('glossaryEntryId', i) as number,
						});
					} else if (operation === 'addEntry') {
						responseData = await api({
							wsfunction: 'mod_glossary_add_entry',
							glossaryid: this.getNodeParameter('glossaryId', i) as number,
							concept: this.getNodeParameter('glossaryEntryConcept', i) as string,
							definition: this.getNodeParameter('glossaryEntryDefinition', i) as string,
							definitionformat: 1,
						});
					} else if (operation === 'updateEntry') {
						responseData = await api({
							wsfunction: 'mod_glossary_update_entry',
							entryid: this.getNodeParameter('glossaryEntryId', i) as number,
							concept: this.getNodeParameter('glossaryEntryConcept', i) as string,
							definition: this.getNodeParameter('glossaryEntryDefinition', i) as string,
							definitionformat: 1,
						});
					} else if (operation === 'deleteEntry') {
						responseData = await api({
							wsfunction: 'mod_glossary_delete_entry',
							entryid: this.getNodeParameter('glossaryEntryId', i) as number,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'lesson') {
					const lessonId = (): number => this.getNodeParameter('lessonId', i) as number;
					const password = (): string | undefined =>
						(this.getNodeParameter('lessonPassword', i, '') as string) || undefined;
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_lesson_get_lessons_by_courses',
							courseids: [getRLValue(this, i, 'lessonCourseId')],
						});
					} else if (operation === 'getPages') {
						responseData = await api({
							wsfunction: 'mod_lesson_get_pages',
							lessonid: lessonId(),
							password: password(),
						});
					} else if (operation === 'getPageData') {
						responseData = await api({
							wsfunction: 'mod_lesson_get_page_data',
							lessonid: lessonId(),
							pageid: this.getNodeParameter('lessonPageId', i) as number,
							password: password(),
							returncontents: 1,
						});
					} else if (operation === 'launchAttempt') {
						responseData = await api({
							wsfunction: 'mod_lesson_launch_attempt',
							lessonid: lessonId(),
							password: password(),
						});
					} else if (operation === 'processPage') {
						responseData = await api({
							wsfunction: 'mod_lesson_process_page',
							lessonid: lessonId(),
							pageid: this.getNodeParameter('lessonPageId', i) as number,
							data: toNameValueList(parseJsonParam(this, i, 'lessonDataJson', [])),
							password: password(),
						});
					} else if (operation === 'getUserAttempt') {
						responseData = await api({
							wsfunction: 'mod_lesson_get_user_attempt',
							lessonid: lessonId(),
							userid: getRLValue(this, i, 'lessonUserId'),
							lessonattempt: this.getNodeParameter('lessonAttempt', i, 0) as number,
						});
					} else if (operation === 'getUserGrade') {
						responseData = await api({
							wsfunction: 'mod_lesson_get_user_grade',
							lessonid: lessonId(),
							userid: getRLValue(this, i, 'lessonUserId'),
						});
					} else if (operation === 'getQuestionsAttempts') {
						responseData = await api({
							wsfunction: 'mod_lesson_get_questions_attempts',
							lessonid: lessonId(),
							attempt: this.getNodeParameter('lessonAttempt', i, 0) as number,
							userid: getRLValue(this, i, 'lessonUserId') || undefined,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'scorm') {
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_scorm_get_scorms_by_courses',
							courseids: [getRLValue(this, i, 'scormCourseId')],
						});
					} else if (operation === 'getTracks') {
						responseData = await api({
							wsfunction: 'mod_scorm_get_scorm_sco_tracks',
							scoid: this.getNodeParameter('scormScoId', i) as number,
							userid: getRLValue(this, i, 'scormUserId'),
							attempt: this.getNodeParameter('scormAttempt', i, 0) as number,
						});
					} else if (operation === 'insertTracks') {
						responseData = await api({
							wsfunction: 'mod_scorm_insert_scorm_tracks',
							scoid: this.getNodeParameter('scormScoId', i) as number,
							attempt: this.getNodeParameter('scormAttempt', i, 1) as number,
							tracks: toNameValueList(parseJsonParam(this, i, 'scormTracksJson', []), 'element'),
						});
					} else if (operation === 'getAttemptCount') {
						responseData = await api({
							wsfunction: 'mod_scorm_get_scorm_attempt_count',
							scormid: this.getNodeParameter('scormId', i) as number,
							userid: getRLValue(this, i, 'scormUserId'),
						});
					} else if (operation === 'getUserData') {
						responseData = await api({
							wsfunction: 'mod_scorm_get_scorm_user_data',
							scormid: this.getNodeParameter('scormId', i) as number,
							attempt: this.getNodeParameter('scormAttempt', i, 1) as number,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'workshop') {
					const workshopId = (): number => this.getNodeParameter('workshopId', i) as number;
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_workshop_get_workshops_by_courses',
							courseids: [getRLValue(this, i, 'workshopCourseId')],
						});
					} else if (operation === 'getPhases') {
						responseData = await api({
							wsfunction: 'mod_workshop_get_user_plan',
							workshopid: workshopId(),
						});
					} else if (operation === 'getAssessmentForm') {
						responseData = await api({
							wsfunction: 'mod_workshop_get_assessment_form_definition',
							assessmentid: this.getNodeParameter('workshopAssessmentId', i) as number,
						});
					} else if (operation === 'getSubmissions') {
						responseData = await api({
							wsfunction: 'mod_workshop_get_submissions',
							workshopid: workshopId(),
						});
					} else if (operation === 'getGrades') {
						responseData = await api({ wsfunction: 'mod_workshop_get_grades', workshopid: workshopId() });
					} else if (operation === 'view') {
						responseData = await api({
							wsfunction: 'mod_workshop_view_workshop',
							workshopid: workshopId(),
						});
					} else {
						unsupported();
					}
				} else if (resource === 'data') {
					const buildEntryData = (): IDataObject[] => {
						const entryData = parseJsonParam(this, i, 'dataEntryJson', {});
						if (Array.isArray(entryData)) {
							return entryData as IDataObject[];
						}
						// Moodle expects every field value to be JSON encoded.
						return Object.entries(entryData as IDataObject).map(([field, value]) => ({
							fieldid: parseInt(field, 10),
							value: JSON.stringify(value),
						}));
					};
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_data_get_databases_by_courses',
							courseids: [getRLValue(this, i, 'dataCourseId')],
						});
					} else if (operation === 'getFields') {
						responseData = await api({
							wsfunction: 'mod_data_get_fields',
							databaseid: this.getNodeParameter('dataId', i) as number,
						});
					} else if (operation === 'getEntries') {
						responseData = await api({
							wsfunction: 'mod_data_get_entries',
							databaseid: this.getNodeParameter('dataId', i) as number,
							returncontents: 1,
						});
					} else if (operation === 'searchEntries') {
						responseData = await api({
							wsfunction: 'mod_data_search_entries',
							databaseid: this.getNodeParameter('dataId', i) as number,
							search: this.getNodeParameter('dataSearchQuery', i, '') as string,
							returncontents: 1,
						});
					} else if (operation === 'addEntry') {
						responseData = await api({
							wsfunction: 'mod_data_add_entry',
							databaseid: this.getNodeParameter('dataId', i) as number,
							data: buildEntryData(),
						});
					} else if (operation === 'updateEntry') {
						responseData = await api({
							wsfunction: 'mod_data_update_entry',
							entryid: this.getNodeParameter('dataEntryId', i) as number,
							data: buildEntryData(),
						});
					} else if (operation === 'deleteEntry') {
						responseData = await api({
							wsfunction: 'mod_data_delete_entry',
							entryid: this.getNodeParameter('dataEntryId', i) as number,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'survey') {
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_survey_get_surveys_by_courses',
							courseids: [getRLValue(this, i, 'surveyCourseId')],
						});
					} else if (operation === 'getQuestions') {
						responseData = await api({
							wsfunction: 'mod_survey_get_questions',
							surveyid: this.getNodeParameter('surveyId', i) as number,
						});
					} else if (operation === 'submitAnswers') {
						responseData = await api({
							wsfunction: 'mod_survey_submit_answers',
							surveyid: this.getNodeParameter('surveyId', i) as number,
							answers: toNameValueList(parseJsonParam(this, i, 'surveyAnswersJson', []), 'key'),
						});
					} else {
						unsupported();
					}
				} else if (resource === 'choice') {
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_choice_get_choices_by_courses',
							courseids: [getRLValue(this, i, 'choiceCourseId')],
						});
					} else if (operation === 'getResults') {
						responseData = await api({
							wsfunction: 'mod_choice_get_choice_results',
							choiceid: this.getNodeParameter('choiceId', i) as number,
						});
					} else if (operation === 'getOptions') {
						responseData = await api({
							wsfunction: 'mod_choice_get_choice_options',
							choiceid: this.getNodeParameter('choiceId', i) as number,
						});
					} else if (operation === 'submitResponse') {
						responseData = await api({
							wsfunction: 'mod_choice_submit_choice_response',
							choiceid: this.getNodeParameter('choiceId', i) as number,
							responses: parseIdList(this.getNodeParameter('choiceOptionIds', i)),
						});
					} else if (operation === 'deleteResponse') {
						responseData = await api({
							wsfunction: 'mod_choice_delete_choice_responses',
							choiceid: this.getNodeParameter('choiceId', i) as number,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'feedback') {
					const feedbackId = (): number => this.getNodeParameter('feedbackId', i) as number;
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_feedback_get_feedbacks_by_courses',
							courseids: [getRLValue(this, i, 'feedbackCourseId')],
						});
					} else if (operation === 'getItems') {
						responseData = await api({ wsfunction: 'mod_feedback_get_items', feedbackid: feedbackId() });
					} else if (operation === 'getAnalysis') {
						responseData = await api({ wsfunction: 'mod_feedback_get_analysis', feedbackid: feedbackId() });
					} else if (operation === 'getResponsesAnalysis') {
						const groupId = this.getNodeParameter('feedbackGroupId', i, 0) as number;
						const page = this.getNodeParameter('feedbackAnalysisPage', i, 0) as number;
						const perPage = this.getNodeParameter('feedbackPerPage', i, 0) as number;
						responseData = await api({
							wsfunction: 'mod_feedback_get_responses_analysis',
							feedbackid: feedbackId(),
							groupid: groupId || undefined,
							page: page || undefined,
							perpage: perPage || undefined,
						});
					} else if (operation === 'getLastCompleted') {
						responseData = await api({
							wsfunction: 'mod_feedback_get_last_completed',
							feedbackid: feedbackId(),
						});
					} else if (operation === 'getCurrentCompleted') {
						responseData = await api({
							wsfunction: 'mod_feedback_get_current_completed_tmp',
							feedbackid: feedbackId(),
						});
					} else if (operation === 'processPage') {
						responseData = await api({
							wsfunction: 'mod_feedback_process_page',
							feedbackid: feedbackId(),
							page: this.getNodeParameter('feedbackPage', i, 0) as number,
							responses: toNameValueList(parseJsonParam(this, i, 'feedbackResponsesJson', [])),
						});
					} else {
						unsupported();
					}
				} else if (resource === 'wiki') {
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_wiki_get_wikis_by_courses',
							courseids: [getRLValue(this, i, 'wikiCourseId')],
						});
					} else if (operation === 'getSubwikis') {
						responseData = await api({
							wsfunction: 'mod_wiki_get_subwikis',
							wikiid: this.getNodeParameter('wikiId', i) as number,
						});
					} else if (operation === 'getPages') {
						responseData = await api({
							wsfunction: 'mod_wiki_get_subwiki_pages',
							wikiid: this.getNodeParameter('wikiId', i) as number,
						});
					} else if (operation === 'getPageContents') {
						responseData = await api({
							wsfunction: 'mod_wiki_get_page_contents',
							pageid: this.getNodeParameter('wikiPageId', i) as number,
						});
					} else if (operation === 'editPage') {
						responseData = await api({
							wsfunction: 'mod_wiki_edit_page',
							pageid: this.getNodeParameter('wikiPageId', i) as number,
							content: this.getNodeParameter('wikiPageContent', i) as string,
						});
					} else if (operation === 'newPage') {
						const wikiSubwikiId = this.getNodeParameter('wikiSubwikiId', i, 0) as number;
						responseData = await api({
							wsfunction: 'mod_wiki_new_page',
							title: this.getNodeParameter('wikiPageTitle', i) as string,
							content: this.getNodeParameter('wikiPageContent', i) as string,
							subwikiid: wikiSubwikiId || undefined,
							wikiid: wikiSubwikiId ? undefined : (this.getNodeParameter('wikiId', i) as number),
						});
					} else {
						unsupported();
					}
				} else if (resource === 'chat') {
					const chatsid = (): string => String(this.getNodeParameter('chatSessionId', i) ?? '');
					if (operation === 'getByCourse') {
						responseData = await api({
							wsfunction: 'mod_chat_get_chats_by_courses',
							courseids: [getRLValue(this, i, 'chatCourseId')],
						});
					} else if (operation === 'loginUser') {
						responseData = await api({
							wsfunction: 'mod_chat_login_user',
							chatid: this.getNodeParameter('chatId', i) as number,
						});
					} else if (operation === 'getUsers') {
						responseData = await api({ wsfunction: 'mod_chat_get_chat_users', chatsid: chatsid() });
					} else if (operation === 'getLatestMessages') {
						responseData = await api({
							wsfunction: 'mod_chat_get_chat_latest_messages',
							chatsid: chatsid(),
						});
					} else if (operation === 'sendMessage') {
						responseData = await api({
							wsfunction: 'mod_chat_send_chat_message',
							chatsid: chatsid(),
							messagetext: this.getNodeParameter('chatMessage', i) as string,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'customcert') {
					if (operation === 'deleteIssue') {
						responseData = await api({
							wsfunction: 'mod_customcert_delete_issue',
							certificateid: this.getNodeParameter('certificateId', i, 0) as number,
							issueid: this.getNodeParameter('certificateIssueId', i) as number,
						});
					} else if (operation === 'getElementHtml') {
						responseData = await api({
							wsfunction: 'mod_customcert_get_element_html',
							templateid: this.getNodeParameter('certificateId', i) as number,
							elementid: this.getNodeParameter('certificateElementId', i) as number,
						});
					} else if (operation === 'saveElement') {
						const elementData = parseJsonParam(this, i, 'certificateElementData', {});
						responseData = await api({
							wsfunction: 'mod_customcert_save_element',
							templateid: this.getNodeParameter('certificateId', i) as number,
							elementid: this.getNodeParameter('certificateElementId', i) as number,
							values: toNameValueList(elementData, 'name').map((v) => ({ name: v.name, value: v.value })),
						});
					} else {
						unsupported();
					}
				} else if (resource === 'joomdle') {
					responseData = await api({
						wsfunction: 'joomdle_get_group_members',
						groupid: getRLValue(this, i, 'joomdleGroupId'),
					});
				} else if (['book', 'page', 'url', 'resource', 'folder'].includes(resource)) {
					const wsFunctions: Record<string, string> = {
						book: 'mod_book_get_books_by_courses',
						page: 'mod_page_get_pages_by_courses',
						url: 'mod_url_get_urls_by_courses',
						resource: 'mod_resource_get_resources_by_courses',
						folder: 'mod_folder_get_folders_by_courses',
					};
					responseData = await api({
						wsfunction: wsFunctions[resource],
						courseids: [getRLValue(this, i, 'simpleCourseId')],
					});
				} else if (resource === 'rating') {
					const common = (): IDataObject => ({
						contextlevel: this.getNodeParameter('ratingContextLevel', i) as string,
						instanceid: this.getNodeParameter('ratingInstanceId', i, 0) as number,
						component: this.getNodeParameter('ratingComponent', i) as string,
						ratingarea: this.getNodeParameter('ratingArea', i) as string,
						itemid: this.getNodeParameter('ratingItemId', i) as number,
						scaleid: this.getNodeParameter('ratingScaleId', i, 0) as number,
					});
					if (operation === 'get') {
						responseData = await api({
							wsfunction: 'core_rating_get_item_ratings',
							...common(),
							sort: this.getNodeParameter('ratingSort', i, 'time') as string,
						});
					} else if (operation === 'add') {
						responseData = await api({
							wsfunction: 'core_rating_add_rating',
							...common(),
							rating: this.getNodeParameter('ratingValue', i, 0) as number,
							rateduserid: this.getNodeParameter('ratingRatedUserId', i) as number,
						});
					} else {
						unsupported();
					}
				} else if (resource === 'comment') {
					const common = (): IDataObject => ({
						contextlevel: this.getNodeParameter('commentContextLevel', i, 'module') as string,
						instanceid: this.getNodeParameter('commentInstanceId', i) as number,
						component: this.getNodeParameter('commentComponent', i) as string,
						itemid: this.getNodeParameter('commentItemId', i) as number,
						area: (this.getNodeParameter('commentArea', i, '') as string) || undefined,
					});
					if (operation === 'get') {
						responseData = await api({ wsfunction: 'core_comment_get_comments', ...common() });
					} else if (operation === 'add') {
						responseData = await api({
							wsfunction: 'core_comment_add_comments',
							comments: [{ ...common(), content: this.getNodeParameter('commentContent', i) as string }],
						});
					} else if (operation === 'delete') {
						responseData = await api({
							wsfunction: 'core_comment_delete_comments',
							comments: [this.getNodeParameter('commentDeleteId', i) as number],
						});
					} else {
						unsupported();
					}
				} else {
					throw new NodeOperationError(this.getNode(), `The resource "${resource}" is not supported`, {
						itemIndex: i,
					});
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(toJsonItems(responseData)),
					{
						itemData: { item: i },
					},
				);
				returnData.push(...executionData);
			} catch (error: any) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error.message, description: error.description },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeOperationError || error?.name === 'NodeApiError') {
					if (error.context && error.context.itemIndex === undefined) {
						error.context.itemIndex = i;
					}
					throw error;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [returnData];
	}
}

function parseCustomFields(ctx: IExecuteFunctions, i: number, value: string): IDataObject[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch (error) {
		throw new NodeOperationError(ctx.getNode(), `Custom Fields is not valid JSON: ${(error as Error).message}`, {
			itemIndex: i,
		});
	}
	if (!Array.isArray(parsed)) {
		if (parsed && typeof parsed === 'object') {
			return Object.entries(parsed as IDataObject).map(([type, v]) => ({ type, value: v as string }));
		}
		throw new NodeOperationError(
			ctx.getNode(),
			'Custom Fields must be a JSON array like [{"type":"shortname","value":"..."}]',
			{ itemIndex: i },
		);
	}
	return parsed as IDataObject[];
}

type ApiCall = (params: IDataObject) => Promise<any>;

async function getCourseSections(api: ApiCall, courseId: number): Promise<IDataObject[]> {
	const sections = await api({
		wsfunction: 'core_course_get_contents',
		courseid: courseId,
		options: [{ name: 'excludemodules', value: 1 }],
	});
	return Array.isArray(sections) ? sections : [];
}

async function renameSection(api: ApiCall, courseId: number, sectionId: number, name: string): Promise<any> {
	const res = await api({ wsfunction: 'core_course_get_courses_by_field', field: 'id', value: courseId });
	const format = (res && res.courses && res.courses[0] && res.courses[0].format) || 'topics';
	return api({
		wsfunction: 'core_update_inplace_editable',
		component: `format_${format}`,
		itemtype: 'sectionname',
		itemid: String(sectionId),
		value: name,
	});
}

import {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { moodleApiRequest } from './GenericFunctions';

function flattenObject(obj: IDataObject, prefix: string = ''): IDataObject {
	const result: IDataObject = {};
	for (const [key, value] of Object.entries(obj)) {
		const newKey = prefix ? `${prefix}[${key}]` : key;
		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			Object.assign(result, flattenObject(value as IDataObject, newKey));
		} else if (Array.isArray(value)) {
			(value as IDataObject[]).forEach((item, index) => {
				if (item !== null && typeof item === 'object') {
					Object.assign(result, flattenObject(item as IDataObject, `${newKey}[${index}]`));
				} else {
					result[`${newKey}[${index}]`] = item as IDataObject;
				}
			});
		} else {
			result[newKey] = value;
		}
	}
	return result;
}

function dateToTimestamp(dateStr: string): number {
	return Math.floor(new Date(dateStr).getTime() / 1000);
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
					{ name: 'Get By Field', value: 'getByField', description: 'Get users by field', action: 'Get users by field' },
					{ name: 'Get All', value: 'getAll', description: 'Get all users', action: 'Get all users' },
					{ name: 'Update', value: 'update', description: 'Update a user', action: 'Update a user' },
					{ name: 'Delete', value: 'delete', description: 'Delete a user', action: 'Delete a user' },
					{ name: 'Get Preferences', value: 'getPreferences', description: 'Get user preferences', action: 'Get user preferences' },
					{ name: 'Set Preferences', value: 'setPreferences', description: 'Set user preferences', action: 'Set user preferences' },
					{ name: 'Agree Site Policy', value: 'agreeSitePolicy', description: 'Agree to site policy', action: 'Agree to site policy' },
					{ name: 'Add Device', value: 'addDevice', description: 'Add a mobile device', action: 'Add a mobile device' },
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
					{ name: 'Get All', value: 'getAll', description: 'Get all courses', action: 'Get all courses' },
					{ name: 'Search', value: 'search', description: 'Search courses', action: 'Search courses' },
					{ name: 'Update', value: 'update', description: 'Update a course', action: 'Update a course' },
					{ name: 'Delete', value: 'delete', description: 'Delete a course', action: 'Delete a course' },
					{ name: 'Duplicate', value: 'duplicate', description: 'Duplicate a course', action: 'Duplicate a course' },
					{ name: 'Get Categories', value: 'getCategories', description: 'Get course categories', action: 'Get course categories' },
					{ name: 'Get Category', value: 'getCategory', description: 'Get a single category', action: 'Get a course category' },
					{ name: 'Create Category', value: 'createCategory', description: 'Create a category', action: 'Create a course category' },
					{ name: 'Update Category', value: 'updateCategory', description: 'Update a category', action: 'Update a course category' },
					{ name: 'Delete Category', value: 'deleteCategory', description: 'Delete a category', action: 'Delete a course category' },
					{ name: 'Get Contents', value: 'getContents', description: 'Get course contents', action: 'Get course contents' },
					{ name: 'Get Sections', value: 'getSections', description: 'Get course sections', action: 'Get course sections' },
					{ name: 'Create Section', value: 'createSection', description: 'Create a section', action: 'Create a course section' },
					{ name: 'Update Section', value: 'updateSection', description: 'Update a section', action: 'Update a course section' },
					{ name: 'Delete Section', value: 'deleteSection', description: 'Delete a section', action: 'Delete a course section' },
					{ name: 'Get Enrolled Users', value: 'getEnrolledUsers', description: 'Get enrolled users', action: 'Get enrolled users' },
					{ name: 'Get Enrolment Methods', value: 'getEnrolmentMethods', description: 'Get enrolment methods', action: 'Get enrolment methods' },
					{ name: 'Get Module', value: 'getModule', description: 'Get course module by ID', action: 'Get course module' },
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
					{ name: 'Get User Courses', value: 'getUserCourses', description: 'Get user courses', action: 'Get user courses' },
					{ name: 'Get Course Users', value: 'getCourseUsers', description: 'Get course users', action: 'Get course users' },
					{ name: 'Self Enrol', value: 'selfEnrol', description: 'Self enrol', action: 'Self enrol' },
					{ name: 'Get Self Enrol Instance', value: 'getSelfEnrolInstance', description: 'Get self enrolment instance', action: 'Get self enrolment instance' },
					{ name: 'Get Enrolled With Capability', value: 'getEnrolledWithCapability', description: 'Get enrolled users with capability', action: 'Get enrolled with capability' },
					{ name: 'Get Potential Users', value: 'getPotentialUsers', description: 'Get potential users', action: 'Get potential users' },
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
					{ name: 'Get User Course Grades', value: 'getUserCourseGrades', description: 'Get user course grades', action: 'Get user course grades' },
					{ name: 'View Grade Report', value: 'viewGradeReport', description: 'View grade report', action: 'View grade report' },
					{ name: 'Get Grades Table', value: 'getGradesTable', description: 'Get grades table', action: 'Get grades table' },
					{ name: 'Get Grade Items', value: 'getGradeItems', description: 'Get grade items', action: 'Get grade items' },
					{ name: 'Get Grade Definitions', value: 'getGradeDefinitions', description: 'Get grade definitions', action: 'Get grade definitions' },
					{ name: 'Get Gradable Users', value: 'getGradableUsers', description: 'Get gradable users', action: 'Get gradable users' },
					{ name: 'Update Grades', value: 'updateGrades', description: 'Update grades', action: 'Update grades' },
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
					{ name: 'Get Messages', value: 'getMessages', description: 'Get messages', action: 'Get messages' },
					{ name: 'Get Conversations', value: 'getConversations', description: 'Get conversations', action: 'Get conversations' },
					{ name: 'Get Conversation Messages', value: 'getConversationMessages', description: 'Get conversation messages', action: 'Get conversation messages' },
					{ name: 'Create Conversation', value: 'createConversation', description: 'Create a conversation', action: 'Create a conversation' },
					{ name: 'Delete Conversation', value: 'deleteConversation', description: 'Delete a conversation', action: 'Delete a conversation' },
					{ name: 'Mark Message Read', value: 'markMessageRead', description: 'Mark message as read', action: 'Mark a message as read' },
					{ name: 'Delete Message', value: 'deleteMessage', description: 'Delete a message', action: 'Delete a message' },
					{ name: 'Send To Conversation', value: 'sendToConversation', description: 'Send message to conversation', action: 'Send message to conversation' },
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
					{ name: 'Get Site Info', value: 'getSiteInfo', description: 'Get site information', action: 'Get site info' },
					{ name: 'Get Auth Plugins', value: 'getAuthPlugins', description: 'Get auth plugins', action: 'Get auth plugins' },
					{ name: 'Get Site Features', value: 'getSiteFeatures', description: 'Get site features', action: 'Get site features' },
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
					{ name: 'Add Members', value: 'addMembers', description: 'Add members to cohort', action: 'Add cohort members' },
					{ name: 'Delete Members', value: 'deleteMembers', description: 'Delete members from cohort', action: 'Delete cohort members' },
					{ name: 'Get Members', value: 'getMembers', description: 'Get cohort members', action: 'Get cohort members' },
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
					{ name: 'Get Course Groups', value: 'getCourseGroups', action: 'Get course groups', description: 'Get course groups' },
					{ name: 'Add Member', value: 'addMember', action: 'Add a group member', description: 'Add a group member' },
					{ name: 'Delete Member', value: 'deleteMember', action: 'Delete a group member', description: 'Delete a group member' },
					{ name: 'Get Members', value: 'getMembers', action: 'Get group members', description: 'Get group members' },
					{ name: 'Create Grouping', value: 'createGrouping', action: 'Create a grouping', description: 'Create a grouping' },
					{ name: 'Get Groupings', value: 'getGroupings', action: 'Get groupings', description: 'Get groupings' },
					{ name: 'Update Grouping', value: 'updateGrouping', action: 'Update a grouping', description: 'Update a grouping' },
					{ name: 'Delete Grouping', value: 'deleteGrouping', action: 'Delete a grouping', description: 'Delete a grouping' },
					{ name: 'Assign Grouping', value: 'assignGrouping', action: 'Assign groups to grouping', description: 'Assign groups to grouping' },
					{ name: 'Unassign Grouping', value: 'unassignGrouping', action: 'Unassign groups from grouping', description: 'Unassign groups from grouping' },
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
					{ name: 'Create', value: 'create', action: 'Create a calendar event', description: 'Create a calendar event' },
					{ name: 'Update', value: 'update', action: 'Update a calendar event', description: 'Update a calendar event' },
					{ name: 'Delete', value: 'delete', action: 'Delete calendar events', description: 'Delete calendar events' },
					{ name: 'Get Upcoming', value: 'getUpcoming', action: 'Get upcoming events', description: 'Get upcoming events' },
					{ name: 'Get Monthly View', value: 'getMonthlyView', action: 'Get monthly calendar view', description: 'Get monthly view' },
					{ name: 'Get Day View', value: 'getDayView', action: 'Get daily calendar view', description: 'Get day view' },
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
				options: [
					{ name: 'Get User Badges', value: 'getUserBadges', action: 'Get user badges', description: 'Get user badges' },
					{ name: 'Issue', value: 'issue', action: 'Issue a badge', description: 'Issue a badge' },
					{ name: 'Revoke', value: 'revoke', action: 'Revoke a badge', description: 'Revoke a badge' },
				],
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
					{ name: 'Delete Draft Files', value: 'deleteDraft', action: 'Delete draft files', description: 'Delete draft files' },
					{ name: 'Create Draft Area', value: 'createDraft', action: 'Create a draft area', description: 'Create a draft area' },
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
					{ name: 'Create Template', value: 'createTemplate', action: 'Create a competency template', description: 'Create a competency template' },
					{ name: 'Get Template', value: 'getTemplate', action: 'Get a competency template', description: 'Get a competency template' },
					{ name: 'List Templates', value: 'listTemplates', action: 'List competency templates', description: 'List competency templates' },
					{ name: 'Update Template', value: 'updateTemplate', action: 'Update a competency template', description: 'Update a competency template' },
					{ name: 'Delete Template', value: 'deleteTemplate', action: 'Delete a competency template', description: 'Delete a competency template' },
					{ name: 'Create Competency', value: 'createCompetency', action: 'Create a competency', description: 'Create a competency' },
					{ name: 'Get Competency', value: 'getCompetency', action: 'Get a competency', description: 'Get a competency' },
					{ name: 'List Competencies', value: 'listCompetencies', action: 'List competencies', description: 'List competencies' },
					{ name: 'Update Competency', value: 'updateCompetency', action: 'Update a competency', description: 'Update a competency' },
					{ name: 'Delete Competency', value: 'deleteCompetency', action: 'Delete a competency', description: 'Delete a competency' },
					{ name: 'Get User Competencies', value: 'getUserCompetencies', action: 'Get user competencies in course', description: 'Get user competencies in course' },
					{ name: 'Get User Competency', value: 'getUserCompetency', action: 'Get a user competency', description: 'Get a user competency' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get quizzes by course', description: 'Get quizzes by course' },
					{ name: 'Start Attempt', value: 'startAttempt', action: 'Start a quiz attempt', description: 'Start a quiz attempt' },
					{ name: 'Get Attempt Data', value: 'getAttemptData', action: 'Get attempt data', description: 'Get attempt data' },
					{ name: 'Get Attempt Summary', value: 'getAttemptSummary', action: 'Get attempt summary', description: 'Get attempt summary' },
					{ name: 'Get Attempt Review', value: 'getAttemptReview', action: 'Get attempt review', description: 'Get attempt review' },
					{ name: 'Process Attempt', value: 'processAttempt', action: 'Process an attempt', description: 'Process an attempt' },
					{ name: 'Save Attempt', value: 'saveAttempt', action: 'Save an attempt', description: 'Save an attempt' },
					{ name: 'Get User Best Grade', value: 'getUserBestGrade', action: 'Get user best grade', description: 'Get user best grade' },
					{ name: 'Get User Attempts', value: 'getUserAttempts', action: 'Get user attempts', description: 'Get user attempts' },
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
					{ name: 'Get Submissions', value: 'getSubmissions', action: 'Get submissions', description: 'Get submissions' },
					{ name: 'Get Submission Status', value: 'getSubmissionStatus', action: 'Get submission status', description: 'Get submission status' },
					{ name: 'Save Submission', value: 'saveSubmission', action: 'Save a submission', description: 'Save a submission' },
					{ name: 'Submit For Grading', value: 'submitForGrading', action: 'Submit for grading', description: 'Submit for grading' },
					{ name: 'Save Grade', value: 'saveGrade', action: 'Save a grade', description: 'Save a grade' },
					{ name: 'Get Grades', value: 'getGrades', action: 'Get assignment grades', description: 'Get assignment grades' },
					{ name: 'List Participants', value: 'listParticipants', action: 'List participants', description: 'List participants' },
					{ name: 'Lock', value: 'lock', action: 'Lock a submission', description: 'Lock a submission' },
					{ name: 'Unlock', value: 'unlock', action: 'Unlock a submission', description: 'Unlock a submission' },
					{ name: 'Revert To Draft', value: 'revertToDraft', action: 'Revert submission to draft', description: 'Revert submission to draft' },
					{ name: 'Get User Flags', value: 'getUserFlags', action: 'Get user flags', description: 'Get user flags' },
					{ name: 'Set User Flags', value: 'setUserFlags', action: 'Set user flags', description: 'Set user flags' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get forums by course', description: 'Get forums by course' },
					{ name: 'Add Discussion', value: 'addDiscussion', action: 'Add a discussion', description: 'Add a discussion' },
					{ name: 'Add Post', value: 'addPost', action: 'Add a post', description: 'Add a post' },
					{ name: 'Get Posts', value: 'getPosts', action: 'Get discussion posts', description: 'Get discussion posts' },
					{ name: 'Can Add Discussion', value: 'canAddDiscussion', action: 'Check if can add discussion', description: 'Check if can add discussion' },
					{ name: 'Set Pin State', value: 'setPinState', action: 'Set discussion pin state', description: 'Set discussion pin state' },
					{ name: 'Toggle Favourite', value: 'toggleFavourite', action: 'Toggle favourite state', description: 'Toggle favourite state' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get glossaries by course', description: 'Get glossaries by course' },
					{ name: 'Get Entries By Author', value: 'getEntriesByAuthor', action: 'Get entries by author', description: 'Get entries by author' },
					{ name: 'Get Entries By Category', value: 'getEntriesByCategory', action: 'Get entries by category', description: 'Get entries by category' },
					{ name: 'Get Entries By Date', value: 'getEntriesByDate', action: 'Get entries by date', description: 'Get entries by date' },
					{ name: 'Get Entry By ID', value: 'getEntryById', action: 'Get entry by ID', description: 'Get entry by ID' },
					{ name: 'Add Entry', value: 'addEntry', action: 'Add a glossary entry', description: 'Add a glossary entry' },
					{ name: 'Update Entry', value: 'updateEntry', action: 'Update a glossary entry', description: 'Update a glossary entry' },
					{ name: 'Delete Entry', value: 'deleteEntry', action: 'Delete a glossary entry', description: 'Delete a glossary entry' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get lessons by course', description: 'Get lessons by course' },
					{ name: 'Get Pages', value: 'getPages', action: 'Get lesson pages', description: 'Get lesson pages' },
					{ name: 'Get Page Data', value: 'getPageData', action: 'Get lesson page data', description: 'Get lesson page data' },
					{ name: 'Launch Attempt', value: 'launchAttempt', action: 'Launch a lesson attempt', description: 'Launch a lesson attempt' },
					{ name: 'Process Page', value: 'processPage', action: 'Process a lesson page', description: 'Process a lesson page' },
					{ name: 'Get User Attempt', value: 'getUserAttempt', action: 'Get user attempt', description: 'Get user attempt' },
					{ name: 'Get User Grade', value: 'getUserGrade', action: 'Get user lesson grade', description: 'Get user lesson grade' },
					{ name: 'Get Questions Attempts', value: 'getQuestionsAttempts', action: 'Get questions attempts', description: 'Get questions attempts' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get SCORM by course', description: 'Get SCORM by course' },
					{ name: 'Get Tracks', value: 'getTracks', action: 'Get SCORM tracks', description: 'Get SCORM tracks' },
					{ name: 'Insert Tracks', value: 'insertTracks', action: 'Insert SCORM tracks', description: 'Insert SCORM tracks' },
					{ name: 'Get Attempt Count', value: 'getAttemptCount', action: 'Get attempt count', description: 'Get attempt count' },
					{ name: 'Get User Data', value: 'getUserData', action: 'Get SCORM user data', description: 'Get SCORM user data' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get workshops by course', description: 'Get workshops by course' },
					{ name: 'Get Phases', value: 'getPhases', action: 'Get workshop phases', description: 'Get workshop phases' },
					{ name: 'Get Assessment Form', value: 'getAssessmentForm', action: 'Get assessment form definition', description: 'Get assessment form' },
					{ name: 'Get Submissions', value: 'getSubmissions', action: 'Get workshop submissions', description: 'Get workshop submissions' },
					{ name: 'Get Grades', value: 'getGrades', action: 'Get workshop grades', description: 'Get workshop grades' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get databases by course', description: 'Get databases by course' },
					{ name: 'Get Fields', value: 'getFields', action: 'Get database fields', description: 'Get database fields' },
					{ name: 'Get Entries', value: 'getEntries', action: 'Get database entries', description: 'Get database entries' },
					{ name: 'Search Entries', value: 'searchEntries', action: 'Search entries', description: 'Search entries' },
					{ name: 'Add Entry', value: 'addEntry', action: 'Add a database entry', description: 'Add a database entry' },
					{ name: 'Update Entry', value: 'updateEntry', action: 'Update a database entry', description: 'Update a database entry' },
					{ name: 'Delete Entry', value: 'deleteEntry', action: 'Delete a database entry', description: 'Delete a database entry' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get surveys by course', description: 'Get surveys by course' },
					{ name: 'Get Questions', value: 'getQuestions', action: 'Get survey questions', description: 'Get survey questions' },
					{ name: 'Submit Answers', value: 'submitAnswers', action: 'Submit survey answers', description: 'Submit survey answers' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get choices by course', description: 'Get choices by course' },
					{ name: 'Get Results', value: 'getResults', action: 'Get choice results', description: 'Get choice results' },
					{ name: 'Get Options', value: 'getOptions', action: 'Get choice options', description: 'Get choice options' },
					{ name: 'Submit Response', value: 'submitResponse', action: 'Submit a choice response', description: 'Submit a choice response' },
					{ name: 'Delete Response', value: 'deleteResponse', action: 'Delete choice responses', description: 'Delete choice responses' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get feedbacks by course', description: 'Get feedbacks by course' },
					{ name: 'Get Items', value: 'getItems', action: 'Get feedback items', description: 'Get feedback items' },
					{ name: 'Get Analysis', value: 'getAnalysis', action: 'Get feedback analysis', description: 'Get feedback analysis' },
					{ name: 'Get Responses Analysis', value: 'getResponsesAnalysis', action: 'Get responses analysis', description: 'Get responses analysis' },
					{ name: 'Get Last Completed', value: 'getLastCompleted', action: 'Get last completed feedback', description: 'Get last completed' },
					{ name: 'Get Current Completed', value: 'getCurrentCompleted', action: 'Get current completed feedback', description: 'Get current completed' },
					{ name: 'Process Page', value: 'processPage', action: 'Process a feedback page', description: 'Process a feedback page' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get wikis by course', description: 'Get wikis by course' },
					{ name: 'Get Subwikis', value: 'getSubwikis', action: 'Get subwikis', description: 'Get subwikis' },
					{ name: 'Get Pages', value: 'getPages', action: 'Get wiki pages', description: 'Get wiki pages' },
					{ name: 'Get Page Contents', value: 'getPageContents', action: 'Get page contents', description: 'Get page contents' },
					{ name: 'Edit Page', value: 'editPage', action: 'Edit a wiki page', description: 'Edit a wiki page' },
					{ name: 'New Page', value: 'newPage', action: 'Create a new wiki page', description: 'Create a new wiki page' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get chats by course', description: 'Get chats by course' },
					{ name: 'Get Users', value: 'getUsers', action: 'Get chat users', description: 'Get chat users' },
					{ name: 'Get Latest Messages', value: 'getLatestMessages', action: 'Get latest messages', description: 'Get latest messages' },
					{ name: 'Send Message', value: 'sendMessage', action: 'Send a chat message', description: 'Send a chat message' },
					{ name: 'Login User', value: 'loginUser', action: 'Login a user to chat', description: 'Login a user to chat' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get books by course', description: 'Get books by course' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get pages by course', description: 'Get pages by course' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get URLs by course', description: 'Get URLs by course' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get resources by course', description: 'Get resources by course' },
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
					{ name: 'Get By Course', value: 'getByCourse', action: 'Get folders by course', description: 'Get folders by course' },
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
					{ name: 'Delete Issue', value: 'deleteIssue', action: 'Delete certificate issue', description: 'Delete a certificate issue' },
					{ name: 'Get Element HTML', value: 'getElementHtml', action: 'Get element HTML', description: 'Returns the HTML to display for an element' },
					{ name: 'Save Element', value: 'saveElement', action: 'Save element data', description: 'Saves data for an element' },
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
					{ name: 'Get Group Members', value: 'getGroupMembers', action: 'Get group members', description: 'Get group members via Joomdle' },
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
				displayName: 'User ID',
				name: 'userId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['user'], operation: ['get', 'update', 'delete', 'getPreferences', 'agreeSitePolicy'] } },
				description: 'The ID of the user',
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
				type: 'string',
				typeOptions: { password: true },
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
					{ displayName: 'ID Number', name: 'idnumber', type: 'string', default: '', description: 'An arbitrary ID code' },
					{ displayName: 'Institution', name: 'institution', type: 'string', default: '', description: 'Institution' },
					{ displayName: 'Department', name: 'department', type: 'string', default: '', description: 'Department' },
					{ displayName: 'Address', name: 'address', type: 'string', default: '', description: 'Postal address' },
					{ displayName: 'City', name: 'city', type: 'string', default: '', description: 'City' },
					{ displayName: 'Country', name: 'country', type: 'string', default: '', description: 'Country code (e.g. US)' },
					{ displayName: 'Phone', name: 'phone1', type: 'string', default: '', description: 'Phone number' },
					{ displayName: 'Mobile Phone', name: 'phone2', type: 'string', default: '', description: 'Mobile phone number' },
					{ displayName: 'Timezone', name: 'timezone', type: 'string', default: '', description: 'Timezone (e.g. America/New_York)' },
					{ displayName: 'Language', name: 'lang', type: 'string', default: '', description: 'Language code (e.g. en)' },
					{ displayName: 'Description', name: 'description', type: 'string', default: '', description: 'User description' },
					{ displayName: 'Theme', name: 'theme', type: 'string', default: '', description: 'Theme' },
					{ displayName: 'Mail Display', name: 'maildisplay', type: 'options', options: [{ name: 'Hide', value: 0 }, { name: 'Allow', value: 1 }, { name: 'Allow Course', value: 2 }], default: 2, description: 'Email display' },
					{ displayName: 'Mail Format', name: 'mailformat', type: 'options', options: [{ name: 'Plain Text', value: 0 }, { name: 'HTML', value: 1 }], default: 1, description: 'Email format' },
					{ displayName: 'Suspended', name: 'suspended', type: 'boolean', default: false, description: 'Suspend the user account' },
					{ displayName: 'Custom Fields (JSON)', name: 'customfields', type: 'string', typeOptions: { rows: 4 }, default: '', description: 'Custom profile fields as JSON array. Example: [{"type":"biografia","value":"Testo"},{"type":"telefono_uff","value":"12345"}]' },
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
				displayName: 'Course ID',
				name: 'courseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['get', 'update', 'delete', 'duplicate', 'getContents', 'getSections', 'getEnrolledUsers', 'getEnrolmentMethods', 'createSection', 'updateSection', 'deleteSection'] } },
				description: 'The ID of the course',
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
				displayName: 'Category ID',
				name: 'categoryid',
				type: 'number',
				default: 1,
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['create'] } },
				description: 'Category ID for the course',
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
				displayName: 'Search Field Name',
				name: 'fieldName',
				type: 'options',
				displayOptions: { show: { resource: ['course'], operation: ['search'] } },
				options: [
					{ name: 'All', value: '' },
					{ name: 'Full Name', value: 'fullname' },
					{ name: 'Short Name', value: 'shortname' },
					{ name: 'Summary', value: 'summary' },
				],
				default: '',
				description: 'Field to search in',
			},
			{
				displayName: 'Course Additional Fields',
				name: 'courseAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['course'], operation: ['create', 'update'] } },
				options: [
					{ displayName: 'ID Number', name: 'idnumber', type: 'string', default: '', description: 'Course ID number' },
					{ displayName: 'Summary', name: 'summary', type: 'string', default: '', description: 'Course summary' },
					{ displayName: 'Summary Format', name: 'summaryformat', type: 'options', options: [{ name: 'Moodle Auto', value: 0 }, { name: 'HTML', value: 1 }, { name: 'Plain', value: 2 }, { name: 'Markdown', value: 4 }], default: 1, description: 'Summary format' },
					{ displayName: 'Format', name: 'format', type: 'string', default: '', description: 'Course format' },
					{ displayName: 'Visible', name: 'visible', type: 'boolean', default: true, description: 'Course visibility' },
					{ displayName: 'Start Date', name: 'startdate', type: 'dateTime', default: '', description: 'Course start date' },
					{ displayName: 'End Date', name: 'enddate', type: 'dateTime', default: '', description: 'Course end date' },
					{ displayName: 'Max Bytes', name: 'maxbytes', type: 'number', default: 0, description: 'Maximum upload size' },
					{ displayName: 'News Items', name: 'newsitems', type: 'number', default: 5, description: 'News items to show' },
					{ displayName: 'Show Grades', name: 'showgrades', type: 'boolean', default: true, description: 'Show grades' },
					{ displayName: 'Enable Completion', name: 'enablecompletion', type: 'boolean', default: true, description: 'Enable completion tracking' },
					{ displayName: 'Group Mode', name: 'groupmode', type: 'options', options: [{ name: 'No Groups', value: 0 }, { name: 'Separate Groups', value: 1 }, { name: 'Visible Groups', value: 2 }], default: 0, description: 'Group mode' },
				],
			},
			{
				displayName: 'Category ID',
				name: 'categoryId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['getCategory', 'updateCategory', 'deleteCategory'] } },
				description: 'The category ID',
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
				displayName: 'Parent Category ID',
				name: 'parentCategoryId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['course'], operation: ['createCategory'] } },
				description: 'Parent category ID (0 for top-level)',
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
				description: 'The section ID',
			},
			{
				displayName: 'Section Number',
				name: 'sectionNumber',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['course'], operation: ['createSection'] } },
				description: 'Section number',
			},
			{
				displayName: 'Section Name',
				name: 'sectionName',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['course'], operation: ['createSection', 'updateSection'] } },
				description: 'Section name',
			},
			{
				displayName: 'Section Summary',
				name: 'sectionSummary',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['course'], operation: ['createSection', 'updateSection'] } },
				description: 'Section summary',
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
				displayName: 'Enrol User ID',
				name: 'enrollUserId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['enrollment'], operation: ['enrol', 'unenrol', 'getUserCourses'] } },
				description: 'The user ID',
			},
			{
				displayName: 'Enrol Course ID',
				name: 'enrollCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['enrollment'], operation: ['enrol', 'unenrol', 'getCourseUsers', 'getSelfEnrolInstance', 'getEnrolledWithCapability', 'getPotentialUsers'] } },
				description: 'The course ID',
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
				displayName: 'Instance ID',
				name: 'instanceId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['enrollment'], operation: ['unenrol', 'selfEnrol', 'getSelfEnrolInstance'] } },
				description: 'Enrolment instance ID',
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
				displayName: 'Grade User ID',
				name: 'gradeUserId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['grade'], operation: ['getUserCourseGrades', 'getGradesTable', 'getGradableUsers', 'updateGrades'] } },
				description: 'The user ID',
			},
			{
				displayName: 'Grade Course ID',
				name: 'gradeCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['grade'], operation: ['getUserCourseGrades', 'viewGradeReport', 'getGradesTable', 'getGradeItems', 'getGradeDefinitions', 'getGradableUsers', 'updateGrades'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Grade Component',
				name: 'gradeComponent',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['grade'], operation: ['updateGrades'] } },
				description: 'Grade component (e.g. mod_assign)',
			},
			{
				displayName: 'Grade Activity ID',
				name: 'gradeActivityId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['grade'], operation: ['updateGrades'] } },
				description: 'Activity instance ID',
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
				displayName: 'Message To User ID',
				name: 'messageToUserId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['send'] } },
				description: 'The recipient user ID',
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
				displayName: 'Message User ID',
				name: 'messageUserId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['getMessages', 'getConversations', 'getConversationMessages', 'markMessageRead', 'deleteMessage'] } },
				description: 'The user ID',
			},
			{
				displayName: 'Conversation ID',
				name: 'conversationId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['getConversationMessages', 'deleteConversation', 'sendToConversation'] } },
				description: 'The conversation ID',
			},
			{
				displayName: 'Current User ID',
				name: 'currentUserId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['createConversation'] } },
				description: 'The creator user ID',
			},
			{
				displayName: 'Member IDs (comma-separated)',
				name: 'memberIds',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['createConversation'] } },
				description: 'Comma-separated list of member user IDs',
			},
			{
				displayName: 'Conversation Type',
				name: 'conversationType',
				type: 'options',
				displayOptions: { show: { resource: ['message'], operation: ['createConversation'] } },
				options: [
					{ name: 'Individual', value: 1 },
					{ name: 'Group', value: 2 },
					{ name: 'Public', value: 3 },
				],
				default: 2,
				description: 'Conversation type',
			},
			{
				displayName: 'Conversation Name',
				name: 'conversationName',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['message'], operation: ['createConversation'] } },
				description: 'Conversation name (for group conversations)',
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
					{ displayName: 'Limit From', name: 'limitfrom', type: 'number', default: 0, description: 'Start offset' },
					{ displayName: 'Limit Num', name: 'limitnum', type: 'number', default: 0, description: 'Max results' },
					{ displayName: 'Read', name: 'read', type: 'options', options: [{ name: 'All', value: -1 }, { name: 'Unread', value: 0 }, { name: 'Read', value: 1 }], default: -1, description: 'Filter by read status' },
					{ displayName: 'Type', name: 'type', type: 'options', options: [{ name: 'All', value: 'both' }, { name: 'Notifications', value: 'notifications' }, { name: 'Messages', value: 'messages' }], default: 'both', description: 'Message type' },
					{ displayName: 'Newest First', name: 'newestfirst', type: 'boolean', default: true, description: 'Order by newest first' },
				],
			},
			{
				displayName: 'Cohort ID',
				name: 'cohortId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['cohort'], operation: ['get', 'update', 'delete', 'addMembers', 'deleteMembers', 'getMembers'] } },
				description: 'The cohort ID',
			},
			{
				displayName: 'Cohort Name',
				name: 'cohortName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['cohort'], operation: ['create'] } },
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
				displayName: 'Cohort Context ID',
				name: 'cohortContextId',
				type: 'number',
				default: 1,
				displayOptions: { show: { resource: ['cohort'], operation: ['create', 'update'] } },
				description: 'Context ID (1=system)',
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
				displayName: 'Group ID',
				name: 'groupId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['group'], operation: ['get', 'update', 'delete', 'addMember', 'deleteMember', 'getMembers', 'assignGrouping', 'unassignGrouping'] } },
				description: 'The group ID',
			},
			{
				displayName: 'Group Course ID',
				name: 'groupCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['group'], operation: ['create', 'getCourseGroups', 'createGrouping', 'getGroupings'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Group Name',
				name: 'groupName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['group'], operation: ['create'] } },
				description: 'Name of the group',
			},
			{
				displayName: 'Group Description',
				name: 'groupDescription',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['group'], operation: ['create', 'update', 'createGrouping', 'updateGrouping'] } },
				description: 'Description',
			},
			{
				displayName: 'Grouping ID',
				name: 'groupingId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['group'], operation: ['updateGrouping', 'deleteGrouping'] } },
				description: 'The grouping ID',
			},
			{
				displayName: 'Grouping Name',
				name: 'groupingName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['group'], operation: ['createGrouping'] } },
				description: 'Name of the grouping',
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
				displayOptions: { show: { resource: ['calendar'], operation: ['update', 'delete'] } },
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
				displayOptions: { show: { resource: ['calendar'], operation: ['create', 'update'] } },
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
				displayOptions: { show: { resource: ['calendar'], operation: ['create', 'update'] } },
				description: 'Event duration in seconds (0=no duration)',
			},
			{
				displayName: 'Event Category ID',
				name: 'eventCategoryId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['calendar'], operation: ['create', 'update'] } },
				description: 'Category ID (for category events)',
			},
			{
				displayName: 'Event Course ID',
				name: 'eventCourseId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['calendar'], operation: ['create', 'update', 'get', 'getUpcoming', 'getMonthlyView', 'getDayView'] } },
				description: 'Course ID',
			},
			{
				displayName: 'Event Group ID',
				name: 'eventGroupId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['calendar'], operation: ['create', 'update'] } },
				description: 'Group ID (for group events)',
			},
			{
				displayName: 'Calendar Year',
				name: 'calendarYear',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['calendar'], operation: ['getMonthlyView', 'getDayView'] } },
				description: 'Year (0 for current)',
			},
			{
				displayName: 'Calendar Month',
				name: 'calendarMonth',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['calendar'], operation: ['getMonthlyView'] } },
				description: 'Month 1-12 (0 for current)',
			},
			{
				displayName: 'Calendar Day',
				name: 'calendarDay',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['calendar'], operation: ['getDayView'] } },
				description: 'Day of month (0 for current)',
			},
			{
				displayName: 'Events Options',
				name: 'eventsOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['calendar'], operation: ['get', 'getUpcoming'] } },
				options: [
					{ displayName: 'Event Types', name: 'eventtypes', type: 'string', default: '', description: 'Comma-separated event types' },
					{ displayName: 'Limit Num', name: 'limitnum', type: 'number', default: 20, description: 'Max results' },
					{ displayName: 'User ID', name: 'usersid', type: 'number', default: 0, description: 'User ID filter' },
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
				displayName: 'Badge User ID',
				name: 'badgeUserId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['badge'], operation: ['getUserBadges', 'issue', 'revoke'] } },
				description: 'The user ID',
			},
			{
				displayName: 'Badge ID',
				name: 'badgeId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['badge'], operation: ['issue', 'revoke'] } },
				description: 'The badge ID',
			},
			{
				displayName: 'Badge Course ID',
				name: 'badgeCourseId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['badge'], operation: ['getUserBadges'] } },
				description: 'Course ID (0 for all)',
			},
			{
				displayName: 'File Context ID',
				name: 'fileContextId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['file'], operation: ['get', 'deleteDraft', 'createDraft'] } },
				description: 'Context ID',
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
				displayOptions: { show: { resource: ['file'], operation: ['get', 'deleteDraft'] } },
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
				displayOptions: { show: { resource: ['file'], operation: ['get'] } },
				description: 'File path',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['file'], operation: ['get'] } },
				description: 'File name (empty for all)',
			},
			{
				displayName: 'File Content (Base64)',
				name: 'fileContent',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['file'], operation: ['upload'] } },
				description: 'Base64-encoded file content',
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
				description: 'Draft area ID (0 for new)',
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['competency'], operation: ['getTemplate', 'updateTemplate', 'deleteTemplate'] } },
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
				displayOptions: { show: { resource: ['competency'], operation: ['getCompetency', 'updateCompetency', 'deleteCompetency', 'getUserCompetency'] } },
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
				displayOptions: { show: { resource: ['competency'], operation: ['createCompetency', 'updateCompetency'] } },
				description: 'Description of the competency',
			},
			{
				displayName: 'Comp Course ID',
				name: 'compCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['competency'], operation: ['getUserCompetencies'] } },
				description: 'Course ID',
			},
			{
				displayName: 'Comp User ID',
				name: 'compUserId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['competency'], operation: ['getUserCompetencies', 'getUserCompetency'] } },
				description: 'User ID',
			},
			{
				displayName: 'Quiz Course ID',
				name: 'quizCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['quiz'], operation: ['getByCourse'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Quiz ID',
				name: 'quizId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['quiz'], operation: ['startAttempt', 'getAttemptData', 'getAttemptSummary', 'getAttemptReview', 'processAttempt', 'saveAttempt', 'getUserBestGrade', 'getUserAttempts'] } },
				description: 'The quiz ID',
			},
			{
				displayName: 'Attempt ID',
				name: 'attemptId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['quiz'], operation: ['getAttemptData', 'getAttemptSummary', 'getAttemptReview', 'processAttempt', 'saveAttempt'] } },
				description: 'The attempt ID',
			},
			{
				displayName: 'Quiz User ID',
				name: 'quizUserId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['quiz'], operation: ['startAttempt', 'getUserBestGrade', 'getUserAttempts'] } },
				description: 'The user ID',
			},
			{
				displayName: 'Quiz Data JSON',
				name: 'quizDataJson',
				type: 'string',
				default: '[]',
				displayOptions: { show: { resource: ['quiz'], operation: ['processAttempt', 'saveAttempt'] } },
				description: 'JSON data for the attempt',
			},
			{
				displayName: 'Quiz Finish',
				name: 'quizFinish',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['quiz'], operation: ['startAttempt', 'processAttempt'] } },
				description: 'Whether to finish the attempt',
			},
			{
				displayName: 'Assign Course ID',
				name: 'assignCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['assignment'], operation: ['get', 'getSubmissions', 'getSubmissionStatus', 'saveSubmission', 'submitForGrading', 'saveGrade', 'getGrades', 'listParticipants', 'lock', 'unlock', 'revertToDraft', 'getUserFlags', 'setUserFlags'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Assign ID',
				name: 'assignId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['assignment'], operation: ['getSubmissions', 'getSubmissionStatus', 'saveSubmission', 'submitForGrading', 'saveGrade', 'getGrades', 'lock', 'unlock', 'revertToDraft', 'getUserFlags', 'setUserFlags'] } },
				description: 'The assignment ID',
			},
			{
				displayName: 'Assign User ID',
				name: 'assignUserId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['assignment'], operation: ['getSubmissionStatus', 'saveGrade', 'getGrades', 'lock', 'unlock', 'revertToDraft', 'getUserFlags', 'setUserFlags'] } },
				description: 'The user ID',
			},
			{
				displayName: 'Assign Plugindata JSON',
				name: 'assignPlugindataJson',
				type: 'string',
				default: '{}',
				displayOptions: { show: { resource: ['assignment'], operation: ['saveSubmission', 'submitForGrading'] } },
				description: 'JSON plugin data',
			},
			{
				displayName: 'Assign Grade Data JSON',
				name: 'assignGradeDataJson',
				type: 'string',
				default: '{}',
				displayOptions: { show: { resource: ['assignment'], operation: ['saveGrade'] } },
				description: 'JSON grade data',
			},
			{
				displayName: 'Assign Flags JSON',
				name: 'assignFlagsJson',
				type: 'string',
				default: '{}',
				displayOptions: { show: { resource: ['assignment'], operation: ['setUserFlags'] } },
				description: 'JSON flags data',
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
				displayOptions: { show: { resource: ['assignment'], operation: ['saveGrade', 'getSubmissionStatus', 'getUserFlags', 'setUserFlags'] } },
				description: 'Attempt number (-1 for latest)',
			},
			{
				displayName: 'Assign Group ID',
				name: 'assignGroupId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['assignment'], operation: ['listParticipants'] } },
				description: 'Group ID (0 for all)',
			},
			{
				displayName: 'Assign Filter',
				name: 'assignFilter',
				type: 'options',
				displayOptions: { show: { resource: ['assignment'], operation: ['listParticipants'] } },
				options: [
					{ name: 'All', value: 0 },
					{ name: 'Not Submitted', value: 1 },
					{ name: 'Submitted', value: 2 },
					{ name: 'Requires Grading', value: 3 },
					{ name: 'Graded', value: 4 },
				],
				default: 0,
				description: 'Filter for participants',
			},
			{
				displayName: 'Forum Course ID',
				name: 'forumCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['forum'], operation: ['getByCourse', 'addDiscussion', 'canAddDiscussion'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Forum ID',
				name: 'forumId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['forum'], operation: ['addDiscussion', 'addPost', 'getPosts', 'canAddDiscussion', 'setPinState', 'toggleFavourite'] } },
				description: 'The forum ID',
			},
			{
				displayName: 'Forum Discussion ID',
				name: 'forumDiscussionId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['forum'], operation: ['addPost', 'getPosts', 'setPinState', 'toggleFavourite'] } },
				description: 'The discussion ID',
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
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['glossary'], operation: ['getByCourse'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Glossary ID',
				name: 'glossaryId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['glossary'], operation: ['getEntriesByAuthor', 'getEntriesByCategory', 'getEntriesByDate', 'addEntry', 'updateEntry', 'deleteEntry'] } },
				description: 'The glossary ID',
			},
			{
				displayName: 'Glossary Entry ID',
				name: 'glossaryEntryId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['glossary'], operation: ['getEntryById', 'updateEntry', 'deleteEntry'] } },
				description: 'The entry ID',
			},
			{
				displayName: 'Glossary Author ID',
				name: 'glossaryAuthorId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['glossary'], operation: ['getEntriesByAuthor'] } },
				description: 'The author user ID',
			},
			{
				displayName: 'Glossary Category ID',
				name: 'glossaryCategoryId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['glossary'], operation: ['getEntriesByCategory'] } },
				description: 'The category ID',
			},
			{
				displayName: 'Entry Concept',
				name: 'glossaryEntryConcept',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['glossary'], operation: ['addEntry'] } },
				description: 'The entry concept (title)',
			},
			{
				displayName: 'Entry Definition',
				name: 'glossaryEntryDefinition',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['glossary'], operation: ['addEntry'] } },
				description: 'The entry definition (body)',
			},
			{
				displayName: 'Glossary From Date',
				name: 'glossaryFromDate',
				type: 'dateTime',
				default: '',
				displayOptions: { show: { resource: ['glossary'], operation: ['getEntriesByDate'] } },
				description: 'Start date for date filter',
			},
			{
				displayName: 'Glossary To Date',
				name: 'glossaryToDate',
				type: 'dateTime',
				default: '',
				displayOptions: { show: { resource: ['glossary'], operation: ['getEntriesByDate'] } },
				description: 'End date for date filter',
			},
			{
				displayName: 'Lesson Course ID',
				name: 'lessonCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['lesson'], operation: ['getByCourse'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Lesson ID',
				name: 'lessonId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['lesson'], operation: ['getPages', 'getPageData', 'launchAttempt', 'processPage', 'getUserAttempt', 'getUserGrade', 'getQuestionsAttempts'] } },
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
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['lesson'], operation: ['launchAttempt', 'getUserAttempt', 'getUserGrade', 'getQuestionsAttempts'] } },
				description: 'The user ID',
			},
			{
				displayName: 'Lesson Attempt',
				name: 'lessonAttempt',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['lesson'], operation: ['getPageData', 'processPage', 'getUserAttempt'] } },
				description: 'Attempt number',
			},
			{
				displayName: 'Lesson Data JSON',
				name: 'lessonDataJson',
				type: 'string',
				default: '{}',
				displayOptions: { show: { resource: ['lesson'], operation: ['processPage'] } },
				description: 'JSON data for the page',
			},
			{
				displayName: 'SCORM Course ID',
				name: 'scormCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['scorm'], operation: ['getByCourse'] } },
				description: 'The course ID',
			},
			{
				displayName: 'SCORM ID',
				name: 'scormId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['scorm'], operation: ['getTracks', 'insertTracks', 'getAttemptCount', 'getUserData'] } },
				description: 'The SCORM ID',
			},
			{
				displayName: 'SCORM User ID',
				name: 'scormUserId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['scorm'], operation: ['getTracks', 'insertTracks', 'getUserData'] } },
				description: 'The user ID',
			},
			{
				displayName: 'SCORM Attempt',
				name: 'scormAttempt',
				type: 'number',
				default: 1,
				displayOptions: { show: { resource: ['scorm'], operation: ['getTracks', 'insertTracks'] } },
				description: 'Attempt number',
			},
			{
				displayName: 'SCORM Tracks JSON',
				name: 'scormTracksJson',
				type: 'string',
				default: '[]',
				required: true,
				displayOptions: { show: { resource: ['scorm'], operation: ['insertTracks'] } },
				description: 'JSON array of tracks',
			},
			{
				displayName: 'Workshop Course ID',
				name: 'workshopCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['workshop'], operation: ['getByCourse'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Workshop ID',
				name: 'workshopId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['workshop'], operation: ['getPhases', 'getAssessmentForm', 'getSubmissions', 'getGrades', 'view'] } },
				description: 'The workshop ID',
			},
			{
				displayName: 'Data Course ID',
				name: 'dataCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['data'], operation: ['getByCourse'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Data ID',
				name: 'dataId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['data'], operation: ['getFields', 'getEntries', 'searchEntries', 'addEntry', 'updateEntry', 'deleteEntry'] } },
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
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['survey'], operation: ['getByCourse'] } },
				description: 'The course ID',
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
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['choice'], operation: ['getByCourse'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Choice ID',
				name: 'choiceId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['choice'], operation: ['getResults', 'getOptions', 'submitResponse', 'deleteResponse'] } },
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
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['feedback'], operation: ['getByCourse'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Feedback ID',
				name: 'feedbackId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['feedback'], operation: ['getItems', 'getAnalysis', 'getResponsesAnalysis', 'getLastCompleted', 'getCurrentCompleted', 'processPage'] } },
				description: 'The feedback ID',
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
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['wiki'], operation: ['getByCourse'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Wiki ID',
				name: 'wikiId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['wiki'], operation: ['getSubwikis', 'getPages', 'getPageContents', 'editPage', 'newPage'] } },
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
				displayOptions: { show: { resource: ['wiki'], operation: ['getPages', 'getPageContents', 'newPage'] } },
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
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['chat'], operation: ['getByCourse'] } },
				description: 'The course ID',
			},
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['chat'], operation: ['getUsers', 'getLatestMessages', 'sendMessage', 'loginUser'] } },
				description: 'The chat activity ID',
			},
			{
				displayName: 'Chat Session ID',
				name: 'chatSessionId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['chat'], operation: ['getLatestMessages'] } },
				description: 'Session ID (0 for all recent)',
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
				displayOptions: { show: { resource: ['customcert'], operation: ['getElementHtml', 'saveElement'] } },
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
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['joomdle'], operation: ['getGroupMembers'] } },
				description: 'The group ID to get members for',
			},
			{
				displayName: 'Simple Course ID',
				name: 'simpleCourseId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['book', 'page', 'url', 'resource', 'folder'], operation: ['getByCourse'] } },
				description: 'The course ID',
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
				displayOptions: { show: { resource: ['rating'], operation: ['add'] } },
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
				displayName: 'Rating Instance ID',
				name: 'ratingInstanceId',
				type: 'number',
				default: 0,
				displayOptions: { show: { resource: ['rating'], operation: ['get'] } },
				description: 'Instance ID (0 for all)',
			},
			{
				displayName: 'Comment Component',
				name: 'commentComponent',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['get', 'add', 'delete'] } },
				description: 'Component (e.g. mod_forum)',
			},
			{
				displayName: 'Comment Area',
				name: 'commentArea',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['get', 'add', 'delete'] } },
				description: 'Comment area',
			},
			{
				displayName: 'Comment Item ID',
				name: 'commentItemId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['get', 'add', 'delete'] } },
				description: 'The item ID',
			},
			{
				displayName: 'Comment Context ID',
				name: 'commentContextId',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: { show: { resource: ['comment'], operation: ['add', 'delete'] } },
				description: 'Context ID',
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
			{
				displayName: 'Auth Plugins Options',
				name: 'authPluginsOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['system'], operation: ['getAuthPlugins'] } },
				options: [
					{ displayName: 'Only Enabled', name: 'onlyenabled', type: 'boolean', default: true, description: 'Only return enabled plugins' },
					{ displayName: 'Include Orphaned', name: 'includeorphaned', type: 'boolean', default: false, description: 'Include orphaned plugins' },
				],
			},
			{
				displayName: 'Site Features Options',
				name: 'siteFeaturesOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['system'], operation: ['getSiteFeatures'] } },
				options: [
					{ displayName: 'Parameters Only', name: 'paramsonly', type: 'boolean', default: false, description: 'Return only parameters' },
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let responseData: any;

				if (resource === 'user') {
					if (operation === 'create') {
						const username = this.getNodeParameter('username', i) as string;
						const password = this.getNodeParameter('password', i) as string;
						const firstname = this.getNodeParameter('firstname', i) as string;
						const lastname = this.getNodeParameter('lastname', i) as string;
						const email = this.getNodeParameter('email', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						const customfieldsStr = additionalFields.customfields as string || '';
						delete additionalFields.customfields;
						const userData: IDataObject = { username, password, firstname, lastname, email, ...additionalFields };
						const flatParams: IDataObject = { wsfunction: 'core_user_create_users', ...flattenObject({ users: [userData] }) };
						if (customfieldsStr) {
							try {
								const customFields = JSON.parse(customfieldsStr);
								if (Array.isArray(customFields)) {
									customFields.forEach((cf: any, idx: number) => {
										flatParams[`users[0][customfields][${idx}][type]`] = cf.type;
										flatParams[`users[0][customfields][${idx}][value]`] = cf.value;
									});
								}
							} catch (e) { /* invalid JSON, skip custom fields */ }
						}
						responseData = await moodleApiRequest.call(this, 'POST', flatParams);
					} else if (operation === 'get') {
						const userId = this.getNodeParameter('userId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_user_get_users_by_field', field: 'id', 'values[0]': userId });
						responseData = Array.isArray(responseData) ? responseData[0] : responseData;
					} else if (operation === 'getByField') {
						const field = this.getNodeParameter('field', i) as string;
						const fieldValue = this.getNodeParameter('fieldValue', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_user_get_users_by_field', field, 'values[0]': fieldValue });
					} else if (operation === 'getAll') {
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_user_get_users', 'criteria[0][key]': 'id', 'criteria[0][value]': '0' });
					} else if (operation === 'update') {
						const userId = this.getNodeParameter('userId', i) as number;
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						const customfieldsStr = additionalFields.customfields as string || '';
						delete additionalFields.customfields;
						const userData: IDataObject = { id: userId, ...additionalFields };
						const flatParams: IDataObject = { wsfunction: 'core_user_update_users', ...flattenObject({ users: [userData] }) };
						if (customfieldsStr) {
							try {
								const customFields = JSON.parse(customfieldsStr);
								if (Array.isArray(customFields)) {
									customFields.forEach((cf: any, idx: number) => {
										flatParams[`users[0][customfields][${idx}][type]`] = cf.type;
										flatParams[`users[0][customfields][${idx}][value]`] = cf.value;
									});
								}
							} catch (e) { /* invalid JSON, skip custom fields */ }
						}
						responseData = await moodleApiRequest.call(this, 'POST', flatParams);
					} else if (operation === 'delete') {
						const userId = this.getNodeParameter('userId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_user_delete_users', 'userids[0]': userId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'getPreferences') {
						const userId = this.getNodeParameter('userId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_user_get_user_preferences', userid: userId });
					} else if (operation === 'setPreferences') {
						const preferencesJson = this.getNodeParameter('preferencesJson', i) as string;
						const preferences = JSON.parse(preferencesJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_user_set_user_preferences', ...flattenObject({ preferences }) });
					} else if (operation === 'agreeSitePolicy') {
						const userId = this.getNodeParameter('userId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_user_agree_site_policy', userid: userId });
					} else if (operation === 'addDevice') {
						const addDeviceParams = this.getNodeParameter('addDeviceParams', i) as string;
						const deviceData = JSON.parse(addDeviceParams);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_user_add_user_device', ...flattenObject(deviceData) });
					}
				} else if (resource === 'course') {
					if (operation === 'create') {
						const fullname = this.getNodeParameter('fullname', i) as string;
						const shortname = this.getNodeParameter('shortname', i) as string;
						const categoryid = this.getNodeParameter('categoryid', i) as number;
						const additionalFields = this.getNodeParameter('courseAdditionalFields', i) as IDataObject;
						if (additionalFields.startdate && typeof additionalFields.startdate === 'string') { additionalFields.startdate = dateToTimestamp(additionalFields.startdate as string); }
						if (additionalFields.enddate && typeof additionalFields.enddate === 'string') { additionalFields.enddate = dateToTimestamp(additionalFields.enddate as string); }
						if (additionalFields.visible !== undefined) { additionalFields.visible = additionalFields.visible ? 1 : 0; }
						const courseData: IDataObject = { fullname, shortname, categoryid, ...additionalFields };
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_create_courses', ...flattenObject({ courses: [courseData] }) });
					} else if (operation === 'get') {
						const courseId = this.getNodeParameter('courseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_get_courses_by_field', field: 'id', value: courseId });
					} else if (operation === 'getAll') {
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_get_courses' });
					} else if (operation === 'search') {
						const searchValue = this.getNodeParameter('searchValue', i) as string;
						const fieldName = this.getNodeParameter('fieldName', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_search_courses', criterianame: fieldName || 'search', 'criteriavalue': searchValue });
					} else if (operation === 'update') {
						const courseId = this.getNodeParameter('courseId', i) as number;
						const additionalFields = this.getNodeParameter('courseAdditionalFields', i) as IDataObject;
						const courseData: IDataObject = { id: courseId, ...additionalFields };
						if (courseData.visible !== undefined) { courseData.visible = courseData.visible ? 1 : 0; }
						if (courseData.startdate && typeof courseData.startdate === 'string') { courseData.startdate = dateToTimestamp(courseData.startdate as string); }
						if (courseData.enddate && typeof courseData.enddate === 'string') { courseData.enddate = dateToTimestamp(courseData.enddate as string); }
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_update_courses', ...flattenObject({ courses: [courseData] }) });
					} else if (operation === 'delete') {
						const courseId = this.getNodeParameter('courseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_delete_courses', 'courseids[0]': courseId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'duplicate') {
						const courseId = this.getNodeParameter('courseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_duplicate_course', courseid: courseId });
					} else if (operation === 'getCategories') {
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_get_categories' });
					} else if (operation === 'getCategory') {
						const categoryId = this.getNodeParameter('categoryId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_get_categories', 'criteria[0][key]': 'id', 'criteria[0][value]': categoryId });
						responseData = Array.isArray(responseData) ? responseData[0] : responseData;
					} else if (operation === 'createCategory') {
						const categoryName = this.getNodeParameter('categoryName', i) as string;
						const parentCategoryId = this.getNodeParameter('parentCategoryId', i) as number;
						const categoryIdNumber = this.getNodeParameter('categoryIdNumber', i) as string;
						const categoryDescription = this.getNodeParameter('categoryDescription', i) as string;
						const catData: IDataObject = { name: categoryName, parent: parentCategoryId };
						if (categoryIdNumber) catData.idnumber = categoryIdNumber;
						if (categoryDescription) catData.description = categoryDescription;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_create_categories', ...flattenObject({ categories: [catData] }) });
					} else if (operation === 'updateCategory') {
						const categoryId = this.getNodeParameter('categoryId', i) as number;
						const categoryIdNumber = this.getNodeParameter('categoryIdNumber', i) as string;
						const categoryDescription = this.getNodeParameter('categoryDescription', i) as string;
						const catData: IDataObject = { id: categoryId };
						if (categoryIdNumber) catData.idnumber = categoryIdNumber;
						if (categoryDescription) catData.description = categoryDescription;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_update_categories', ...flattenObject({ categories: [catData] }) });
					} else if (operation === 'deleteCategory') {
						const categoryId = this.getNodeParameter('categoryId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_delete_categories', 'categories[0][id]': categoryId, 'categories[0][recursive]': 0 });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'getContents') {
						const courseId = this.getNodeParameter('courseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_get_contents', courseid: courseId });
					} else if (operation === 'getSections') {
						const courseId = this.getNodeParameter('courseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_get_sections', courseid: courseId });
					} else if (operation === 'createSection') {
						const courseId = this.getNodeParameter('courseId', i) as number;
						const sectionNumber = this.getNodeParameter('sectionNumber', i) as number;
						const sectionName = this.getNodeParameter('sectionName', i) as string;
						const sectionSummary = this.getNodeParameter('sectionSummary', i) as string;
						const sectionData: IDataObject = { section: sectionNumber };
						if (sectionName) sectionData.name = sectionName;
						if (sectionSummary) sectionData.summary = sectionSummary;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_create_section', courseid: courseId, ...sectionData });
					} else if (operation === 'updateSection') {
						const courseId = this.getNodeParameter('courseId', i) as number;
						const sectionId = this.getNodeParameter('sectionId', i) as number;
						const sectionName = this.getNodeParameter('sectionName', i) as string;
						const sectionSummary = this.getNodeParameter('sectionSummary', i) as string;
						const sectionData: IDataObject = {};
						if (sectionName) sectionData.name = sectionName;
						if (sectionSummary) sectionData.summary = sectionSummary;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_update_section', courseid: courseId, sectionid: sectionId, ...sectionData });
					} else if (operation === 'deleteSection') {
						const courseId = this.getNodeParameter('courseId', i) as number;
						const sectionId = this.getNodeParameter('sectionId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_delete_section', courseid: courseId, sectionid: sectionId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'getEnrolledUsers') {
						const courseId = this.getNodeParameter('courseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_enrol_get_enrolled_users', courseid: courseId });
					} else if (operation === 'getEnrolmentMethods') {
						const courseId = this.getNodeParameter('courseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_enrol_get_course_enrolment_methods', courseid: courseId });
					} else if (operation === 'getModule') {
						const moduleId = this.getNodeParameter('moduleId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_course_get_course_module', moduleid: moduleId });
					}
				} else if (resource === 'enrollment') {
					if (operation === 'enrol') {
						const enrollUserId = this.getNodeParameter('enrollUserId', i) as number;
						const enrollCourseId = this.getNodeParameter('enrollCourseId', i) as number;
						const roleId = this.getNodeParameter('roleId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'enrol_manual_enrol_users', 'enrolments[0][userid]': enrollUserId, 'enrolments[0][courseid]': enrollCourseId, 'enrolments[0][roleid]': roleId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'unenrol') {
						const enrollUserId = this.getNodeParameter('enrollUserId', i) as number;
						const enrollCourseId = this.getNodeParameter('enrollCourseId', i) as number;
						const instanceId = this.getNodeParameter('instanceId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'enrol_manual_unenrol_users', 'enrolments[0][userid]': enrollUserId, 'enrolments[0][courseid]': enrollCourseId, 'enrolments[0][instanceid]': instanceId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'getUserCourses') {
						const enrollUserId = this.getNodeParameter('enrollUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_enrol_get_users_courses', userid: enrollUserId });
					} else if (operation === 'getCourseUsers') {
						const enrollCourseId = this.getNodeParameter('enrollCourseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_enrol_get_enrolled_users', courseid: enrollCourseId });
					} else if (operation === 'selfEnrol') {
						const enrollCourseId = this.getNodeParameter('enrollCourseId', i) as number;
						const instanceId = this.getNodeParameter('instanceId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'enrol_self_enrol_user', courseid: enrollCourseId, instanceid: instanceId });
					} else if (operation === 'getSelfEnrolInstance') {
						const enrollCourseId = this.getNodeParameter('enrollCourseId', i) as number;
						const instanceId = this.getNodeParameter('instanceId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'enrol_self_get_instance_info', courseid: enrollCourseId, instanceid: instanceId });
					} else if (operation === 'getEnrolledWithCapability') {
						const enrollCourseId = this.getNodeParameter('enrollCourseId', i) as number;
						const capability = this.getNodeParameter('capability', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_enrol_get_enrolled_users_with_capability', courseid: enrollCourseId, 'capabilities[0]': capability });
					} else if (operation === 'getPotentialUsers') {
						const enrollCourseId = this.getNodeParameter('enrollCourseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_enrol_get_potential_users', courseid: enrollCourseId });
					}
				} else if (resource === 'grade') {
					if (operation === 'getUserCourseGrades') {
						const gradeUserId = this.getNodeParameter('gradeUserId', i) as number;
						const gradeCourseId = this.getNodeParameter('gradeCourseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'gradereport_overview_get_course_grades', userid: gradeUserId, courseid: gradeCourseId });
					} else if (operation === 'viewGradeReport') {
						const gradeUserId = this.getNodeParameter('gradeUserId', i) as number;
						const gradeCourseId = this.getNodeParameter('gradeCourseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'gradereport_overview_view_grade_report', userid: gradeUserId, courseid: gradeCourseId });
					} else if (operation === 'getGradesTable') {
						const gradeUserId = this.getNodeParameter('gradeUserId', i) as number;
						const gradeCourseId = this.getNodeParameter('gradeCourseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'gradereport_user_get_grades_table', userid: gradeUserId, courseid: gradeCourseId });
					} else if (operation === 'getGradeItems') {
						const gradeCourseId = this.getNodeParameter('gradeCourseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_grades_get_grade_items', courseid: gradeCourseId });
					} else if (operation === 'getGradeDefinitions') {
						const gradeCourseId = this.getNodeParameter('gradeCourseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_grades_get_definitions', courseid: gradeCourseId });
					} else if (operation === 'getGradableUsers') {
						const gradeCourseId = this.getNodeParameter('gradeCourseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_grades_get_gradable_users', courseid: gradeCourseId });
					} else if (operation === 'updateGrades') {
						const gradeUserId = this.getNodeParameter('gradeUserId', i) as number;
						const gradeCourseId = this.getNodeParameter('gradeCourseId', i) as number;
						const gradeComponent = this.getNodeParameter('gradeComponent', i) as string;
						const gradeActivityId = this.getNodeParameter('gradeActivityId', i) as number;
						const gradeDataJson = this.getNodeParameter('gradeDataJson', i) as string;
						const gradeData = JSON.parse(gradeDataJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_grades_update_grades', userid: gradeUserId, courseid: gradeCourseId, component: gradeComponent, activityid: gradeActivityId, ...flattenObject({ gradeData }) });
					}
				} else if (resource === 'message') {
					if (operation === 'send') {
						const messageToUserId = this.getNodeParameter('messageToUserId', i) as number;
						const messageText = this.getNodeParameter('messageText', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_message_send_instant_messages', 'messages[0][touserid]': messageToUserId, 'messages[0][text]': messageText });
					} else if (operation === 'getMessages') {
						const messageUserId = this.getNodeParameter('messageUserId', i) as number;
						const filters = this.getNodeParameter('messageFilters', i) as IDataObject;
						const reqParams: IDataObject = { wsfunction: 'core_message_get_messages', useridto: messageUserId };
						if (filters.limitfrom) reqParams.limitfrom = filters.limitfrom;
						if (filters.limitnum) reqParams.limitnum = filters.limitnum;
						if (filters.read !== undefined && filters.read !== -1) reqParams.read = filters.read;
						if (filters.type) reqParams.type = filters.type;
						if (filters.newestfirst !== undefined) reqParams.newestfirst = filters.newestfirst ? 1 : 0;
						responseData = await moodleApiRequest.call(this, 'POST', {}, reqParams);
					} else if (operation === 'getConversations') {
						const messageUserId = this.getNodeParameter('messageUserId', i) as number;
						const filters = this.getNodeParameter('messageFilters', i) as IDataObject;
						const reqParams: IDataObject = { wsfunction: 'core_message_get_conversations', userid: messageUserId };
						if (filters.limitfrom) reqParams.limitfrom = filters.limitfrom;
						if (filters.limitnum) reqParams.limitnum = filters.limitnum;
						responseData = await moodleApiRequest.call(this, 'POST', {}, reqParams);
					} else if (operation === 'getConversationMessages') {
						const conversationId = this.getNodeParameter('conversationId', i) as number;
						const messageUserId = this.getNodeParameter('messageUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_message_get_conversation_messages', conversationid: conversationId, userid: messageUserId });
					} else if (operation === 'createConversation') {
						const currentUserId = this.getNodeParameter('currentUserId', i) as number;
						const memberIdsStr = this.getNodeParameter('memberIds', i) as string;
						const conversationType = this.getNodeParameter('conversationType', i) as number;
						const conversationName = this.getNodeParameter('conversationName', i) as string;
						const memberIds = memberIdsStr.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
						const reqParams: IDataObject = { wsfunction: 'core_message_create_conversation', type: conversationType, name: conversationName, currentuserid: currentUserId, ...flattenObject({ members: memberIds }) };
						if (conversationType === 1) delete reqParams.name;
						responseData = await moodleApiRequest.call(this, 'POST', {}, reqParams);
					} else if (operation === 'deleteConversation') {
						const conversationId = this.getNodeParameter('conversationId', i) as number;
						const messageUserId = this.getNodeParameter('messageUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_message_delete_conversations_by_id', conversationid: conversationId, userid: messageUserId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'markMessageRead') {
						const messageId = this.getNodeParameter('messageId', i) as number;
						const messageUserId = this.getNodeParameter('messageUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_message_mark_message_read', messageid: messageId, userid: messageUserId });
					} else if (operation === 'deleteMessage') {
						const messageId = this.getNodeParameter('messageId', i) as number;
						const messageUserId = this.getNodeParameter('messageUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_message_delete_message', messageid: messageId, userid: messageUserId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'sendToConversation') {
						const conversationId = this.getNodeParameter('conversationId', i) as number;
						const messageText = this.getNodeParameter('messageText', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_message_send_messages_to_conversation', conversationid: conversationId, 'messages[0][text]': messageText });
					}
				} else if (resource === 'system') {
					if (operation === 'getSiteInfo') {
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_webservice_get_site_info' });
					} else if (operation === 'getAuthPlugins') {
						const options = this.getNodeParameter('authPluginsOptions', i) as IDataObject;
						const reqParams: IDataObject = { wsfunction: 'core_webservice_get_site_info' };
						if (options.onlyenabled) reqParams.onlyenabled = options.onlyenabled ? 1 : 0;
						if (options.includeorphaned) reqParams.includeorphaned = options.includeorphaned ? 1 : 0;
						responseData = await moodleApiRequest.call(this, 'POST', {}, reqParams);
					} else if (operation === 'getSiteFeatures') {
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_webservice_get_site_info' });
					}
				} else if (resource === 'cohort') {
					if (operation === 'create') {
						const cohortName = this.getNodeParameter('cohortName', i) as string;
						const cohortIdNumber = this.getNodeParameter('cohortIdNumber', i) as string;
						const cohortContextId = this.getNodeParameter('cohortContextId', i) as number;
						const cohortDescription = this.getNodeParameter('cohortDescription', i) as string;
						const cohortData: IDataObject = { name: cohortName, contextid: cohortContextId };
						if (cohortIdNumber) cohortData.idnumber = cohortIdNumber;
						if (cohortDescription) cohortData.description = cohortDescription;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_cohort_create_cohorts', ...flattenObject({ cohorts: [cohortData] }) });
					} else if (operation === 'get') {
						const cohortId = this.getNodeParameter('cohortId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_cohort_get_cohorts', cohortids: [cohortId] });
					} else if (operation === 'update') {
						const cohortId = this.getNodeParameter('cohortId', i) as number;
						const cohortName = this.getNodeParameter('cohortName', i) as string;
						const cohortIdNumber = this.getNodeParameter('cohortIdNumber', i) as string;
						const cohortContextId = this.getNodeParameter('cohortContextId', i) as number;
						const cohortDescription = this.getNodeParameter('cohortDescription', i) as string;
						const cohortData: IDataObject = { id: cohortId, name: cohortName, contextid: cohortContextId };
						if (cohortIdNumber) cohortData.idnumber = cohortIdNumber;
						if (cohortDescription) cohortData.description = cohortDescription;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_cohort_update_cohorts', ...flattenObject({ cohorts: [cohortData] }) });
					} else if (operation === 'delete') {
						const cohortId = this.getNodeParameter('cohortId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_cohort_delete_cohorts', 'cohortids[0]': cohortId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'addMembers') {
						const cohortId = this.getNodeParameter('cohortId', i) as number;
						const cohortMemberIds = this.getNodeParameter('cohortMemberIds', i) as string;
						const memberIds = cohortMemberIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
						const members = memberIds.map(uid => ({ cohortid: cohortId, userid: uid }));
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_cohort_add_cohort_members', ...flattenObject({ members }) });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'deleteMembers') {
						const cohortId = this.getNodeParameter('cohortId', i) as number;
						const cohortMemberIds = this.getNodeParameter('cohortMemberIds', i) as string;
						const memberIds = cohortMemberIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
						const members = memberIds.map(uid => ({ cohortid: cohortId, userid: uid }));
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_cohort_delete_cohort_members', ...flattenObject({ members }) });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'getMembers') {
						const cohortId = this.getNodeParameter('cohortId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_cohort_get_cohort_members', 'cohortids[0]': cohortId });
					}
				} else if (resource === 'group') {
					if (operation === 'create') {
						const groupCourseId = this.getNodeParameter('groupCourseId', i) as number;
						const groupName = this.getNodeParameter('groupName', i) as string;
						const groupDescription = this.getNodeParameter('groupDescription', i) as string;
						const groupData: IDataObject = { courseid: groupCourseId, name: groupName };
						if (groupDescription) groupData.description = groupDescription;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_create_groups', ...flattenObject({ groups: [groupData] }) });
					} else if (operation === 'get') {
						const groupId = this.getNodeParameter('groupId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_get_groups', 'groupids[0]': groupId });
					} else if (operation === 'update') {
						const groupId = this.getNodeParameter('groupId', i) as number;
						const groupDescription = this.getNodeParameter('groupDescription', i) as string;
						const groupData: IDataObject = { id: groupId };
						if (groupDescription) groupData.description = groupDescription;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_update_groups', ...flattenObject({ groups: [groupData] }) });
					} else if (operation === 'delete') {
						const groupId = this.getNodeParameter('groupId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_delete_groups', 'groupids[0]': groupId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'getCourseGroups') {
						const groupCourseId = this.getNodeParameter('groupCourseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_get_course_groups', courseid: groupCourseId });
					} else if (operation === 'addMember') {
						const groupId = this.getNodeParameter('groupId', i) as number;
						const groupMemberIds = this.getNodeParameter('groupMemberIds', i) as string;
						const memberIds = groupMemberIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
						const members = memberIds.map(uid => ({ groupid: groupId, userid: uid }));
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_add_group_members', ...flattenObject({ members }) });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'deleteMember') {
						const groupId = this.getNodeParameter('groupId', i) as number;
						const groupMemberIds = this.getNodeParameter('groupMemberIds', i) as string;
						const memberIds = groupMemberIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
						const members = memberIds.map(uid => ({ groupid: groupId, userid: uid }));
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_delete_group_members', ...flattenObject({ members }) });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'getMembers') {
						const groupId = this.getNodeParameter('groupId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_get_group_members', 'groupids[0]': groupId });
					} else if (operation === 'createGrouping') {
						const groupCourseId = this.getNodeParameter('groupCourseId', i) as number;
						const groupingName = this.getNodeParameter('groupingName', i) as string;
						const groupingDescription = this.getNodeParameter('groupingDescription', i) as string;
						const groupingData: IDataObject = { courseid: groupCourseId, name: groupingName };
						if (groupingDescription) groupingData.description = groupingDescription;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_create_groupings', ...flattenObject({ groupings: [groupingData] }) });
					} else if (operation === 'getGroupings') {
						const groupCourseId = this.getNodeParameter('groupCourseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_get_groupings', 'groupingids[0]': 0, courseid: groupCourseId });
					} else if (operation === 'updateGrouping') {
						const groupingId = this.getNodeParameter('groupingId', i) as number;
						const groupingDescription = this.getNodeParameter('groupingDescription', i) as string;
						const groupingData: IDataObject = { id: groupingId };
						if (groupingDescription) groupingData.description = groupingDescription;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_update_groupings', ...flattenObject({ groupings: [groupingData] }) });
					} else if (operation === 'deleteGrouping') {
						const groupingId = this.getNodeParameter('groupingId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_delete_groupings', 'groupingids[0]': groupingId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'assignGrouping') {
						const groupingId = this.getNodeParameter('groupingId', i) as number;
						const groupId = this.getNodeParameter('groupId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_assign_grouping', 'assignments[0][groupingid]': groupingId, 'assignments[0][groupid]': groupId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'unassignGrouping') {
						const groupingId = this.getNodeParameter('groupingId', i) as number;
						const groupId = this.getNodeParameter('groupId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_group_unassign_grouping', 'unassignments[0][groupingid]': groupingId, 'unassignments[0][groupid]': groupId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					}
				} else if (resource === 'calendar') {
					if (operation === 'get') {
						const eventCourseId = this.getNodeParameter('eventCourseId', i) as number;
						const options = this.getNodeParameter('eventsOptions', i) as IDataObject;
						const eventData: IDataObject = { 'events[0][courseid]': eventCourseId };
						if (options.eventtypes) eventData['events[0][eventtype]'] = options.eventtypes;
						if (options.limitnum) eventData.options = JSON.stringify({ userevents: true, timestart: 0 });
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_calendar_get_calendar_events', ...eventData });
					} else if (operation === 'create') {
						const eventName = this.getNodeParameter('eventName', i) as string;
						const eventDescription = this.getNodeParameter('eventDescription', i) as string;
						const eventType = this.getNodeParameter('eventType', i) as string;
						const eventDate = this.getNodeParameter('eventDate', i) as string;
						const eventDuration = this.getNodeParameter('eventDuration', i) as number;
						const eventCategoryId = this.getNodeParameter('eventCategoryId', i) as number;
						const eventCourseId = this.getNodeParameter('eventCourseId', i) as number;
						const eventGroupId = this.getNodeParameter('eventGroupId', i) as number;
						const events: IDataObject = { name: eventName, description: eventDescription, eventtype: eventType, timestart: dateToTimestamp(eventDate) };
						if (eventDuration > 0) events.timeduration = eventDuration;
						if (eventCategoryId) events.categoryid = eventCategoryId;
						if (eventCourseId) events.courseid = eventCourseId;
						if (eventGroupId) events.groupid = eventGroupId;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_calendar_create_calendar_events', ...flattenObject({ events: [events] }) });
					} else if (operation === 'update') {
						const eventId = this.getNodeParameter('eventId', i) as number;
						const eventName = this.getNodeParameter('eventName', i) as string;
						const eventDescription = this.getNodeParameter('eventDescription', i) as string;
						const eventDuration = this.getNodeParameter('eventDuration', i) as number;
						const eventData: IDataObject = { id: eventId, name: eventName, description: eventDescription };
						if (eventDuration > 0) eventData.timeduration = eventDuration;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_calendar_update_event', ...eventData });
					} else if (operation === 'delete') {
						const eventId = this.getNodeParameter('eventId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_calendar_delete_calendar_events', 'events[0][eventid]': eventId, 'events[0][repeat]': 0 });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'getUpcoming') {
						const eventCourseId = this.getNodeParameter('eventCourseId', i) as number;
						const options = this.getNodeParameter('eventsOptions', i) as IDataObject;
						const reqParams: IDataObject = { wsfunction: 'core_calendar_get_calendar_upcoming', courseid: eventCourseId };
						if (options.limitnum) reqParams.limitnum = options.limitnum;
						responseData = await moodleApiRequest.call(this, 'POST', {}, reqParams);
					} else if (operation === 'getMonthlyView') {
						const eventCourseId = this.getNodeParameter('eventCourseId', i) as number;
						const calendarYear = this.getNodeParameter('calendarYear', i) as number;
						const calendarMonth = this.getNodeParameter('calendarMonth', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_calendar_get_calendar_monthly_view', year: calendarYear || undefined, month: calendarMonth || undefined, courseid: eventCourseId });
					} else if (operation === 'getDayView') {
						const eventCourseId = this.getNodeParameter('eventCourseId', i) as number;
						const calendarYear = this.getNodeParameter('calendarYear', i) as number;
						const calendarMonth = this.getNodeParameter('calendarMonth', i) as number;
						const calendarDay = this.getNodeParameter('calendarDay', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_calendar_get_calendar_day_view', year: calendarYear || undefined, month: calendarMonth || undefined, day: calendarDay || undefined, courseid: eventCourseId });
					}
				} else if (resource === 'note') {
					if (operation === 'create') {
						const notesJson = this.getNodeParameter('notesJson', i) as string;
						const notes = JSON.parse(notesJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_notes_create_notes', ...flattenObject({ notes }) });
					} else if (operation === 'get') {
						const noteIds = this.getNodeParameter('noteIds', i) as string;
						const ids = noteIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_notes_get_notes', ...flattenObject({ notes: ids.map(id => ({ id })) }) });
					} else if (operation === 'update') {
						const notesUpdateJson = this.getNodeParameter('notesUpdateJson', i) as string;
						const notes = JSON.parse(notesUpdateJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_notes_update_notes', ...flattenObject({ notes }) });
					} else if (operation === 'delete') {
						const noteIds = this.getNodeParameter('noteIds', i) as string;
						const ids = noteIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_notes_delete_notes', ...flattenObject({ notes: ids.map(id => ({ id })) }) });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					}
				} else if (resource === 'badge') {
					if (operation === 'getUserBadges') {
						const badgeUserId = this.getNodeParameter('badgeUserId', i) as number;
						const badgeCourseId = this.getNodeParameter('badgeCourseId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_badges_get_user_badges', userid: badgeUserId, courseid: badgeCourseId || undefined });
					} else if (operation === 'issue') {
						const badgeUserId = this.getNodeParameter('badgeUserId', i) as number;
						const badgeId = this.getNodeParameter('badgeId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_badges_issue_badge', userid: badgeUserId, badgeid: badgeId });
					} else if (operation === 'revoke') {
						const badgeUserId = this.getNodeParameter('badgeUserId', i) as number;
						const badgeId = this.getNodeParameter('badgeId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_badges_revoke_badge', userid: badgeUserId, badgeid: badgeId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					}
				} else if (resource === 'file') {
					if (operation === 'get') {
						const fileContextId = this.getNodeParameter('fileContextId', i) as number;
						const fileComponent = this.getNodeParameter('fileComponent', i) as string;
						const fileArea = this.getNodeParameter('fileArea', i) as string;
						const fileItemId = this.getNodeParameter('fileItemId', i) as number;
						const filePath = this.getNodeParameter('filePath', i) as string;
						const fileName = this.getNodeParameter('fileName', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_files_get_files', contextid: fileContextId, component: fileComponent, filearea: fileArea, itemid: fileItemId, filepath: filePath, filename: fileName });
					} else if (operation === 'upload') {
						const fileContent = this.getNodeParameter('fileContent', i) as string;
						const fileUploadComponent = this.getNodeParameter('fileUploadComponent', i) as string;
						const fileUploadArea = this.getNodeParameter('fileUploadArea', i) as string;
						const draftAreaId = this.getNodeParameter('draftAreaId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_files_upload', component: fileUploadComponent, filearea: fileUploadArea, itemid: draftAreaId, filecontent: fileContent });
					} else if (operation === 'deleteDraft') {
						const fileContextId = this.getNodeParameter('fileContextId', i) as number;
						const fileArea = this.getNodeParameter('fileArea', i) as string;
						const fileItemId = this.getNodeParameter('fileItemId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_files_delete_draft_files', contextid: fileContextId, component: 'user', filearea: fileArea, itemid: fileItemId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'createDraft') {
						const fileContextId = this.getNodeParameter('fileContextId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_files_create_draft_area', contextid: fileContextId, component: 'user', filearea: 'draft', itemid: 0 });
					}
				} else if (resource === 'competency') {
					if (operation === 'createTemplate') {
						const templateName = this.getNodeParameter('templateName', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_create_template', template: { shortname: templateName, contextid: 1 } });
					} else if (operation === 'getTemplate') {
						const templateId = this.getNodeParameter('templateId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_read_template', id: templateId });
					} else if (operation === 'listTemplates') {
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_list_templates', contextid: 1 });
					} else if (operation === 'updateTemplate') {
						const templateId = this.getNodeParameter('templateId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_update_template', template: { id: templateId } });
					} else if (operation === 'deleteTemplate') {
						const templateId = this.getNodeParameter('templateId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_delete_template', id: templateId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'createCompetency') {
						const competencyShortName = this.getNodeParameter('competencyShortName', i) as string;
						const competencyDescription = this.getNodeParameter('competencyDescription', i) as string;
						const compData: IDataObject = { shortname: competencyShortName };
						if (competencyDescription) compData.description = competencyDescription;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_create_competency', competency: compData });
					} else if (operation === 'getCompetency') {
						const competencyId = this.getNodeParameter('competencyId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_read_competency', id: competencyId });
					} else if (operation === 'listCompetencies') {
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_list_competencies', competencyframeworkid: 0 });
					} else if (operation === 'updateCompetency') {
						const competencyId = this.getNodeParameter('competencyId', i) as number;
						const competencyDescription = this.getNodeParameter('competencyDescription', i) as string;
						const compData: IDataObject = { id: competencyId };
						if (competencyDescription) compData.description = competencyDescription;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_update_competency', competency: compData });
					} else if (operation === 'deleteCompetency') {
						const competencyId = this.getNodeParameter('competencyId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_delete_competency', id: competencyId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'getUserCompetencies') {
						const compCourseId = this.getNodeParameter('compCourseId', i) as number;
						const compUserId = this.getNodeParameter('compUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_get_user_competencies_in_course', courseid: compCourseId, userid: compUserId });
					} else if (operation === 'getUserCompetency') {
						const competencyId = this.getNodeParameter('competencyId', i) as number;
						const compUserId = this.getNodeParameter('compUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_competency_get_user_competency', competencyid: competencyId, userid: compUserId });
					}
				} else if (resource === 'quiz') {
					if (operation === 'getByCourse') {
						const quizCourseId = this.getNodeParameter('quizCourseId', i) as number;
						const courseids = [quizCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_quiz_get_quizzes_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'startAttempt') {
						const quizId = this.getNodeParameter('quizId', i) as number;
						const quizUserId = this.getNodeParameter('quizUserId', i) as number;
						const quizFinish = this.getNodeParameter('quizFinish', i) as boolean;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_quiz_start_attempt', quizid: quizId, userid: quizUserId, preflightdata: [], finish: quizFinish ? 1 : 0 });
					} else if (operation === 'getAttemptData') {
						const attemptId = this.getNodeParameter('attemptId', i) as number;
						const quizId = this.getNodeParameter('quizId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_quiz_get_attempt_data', attemptid: attemptId, page: -1, quizid: quizId });
					} else if (operation === 'getAttemptSummary') {
						const attemptId = this.getNodeParameter('attemptId', i) as number;
						const quizId = this.getNodeParameter('quizId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_quiz_get_attempt_summary', attemptid: attemptId, quizid: quizId });
					} else if (operation === 'getAttemptReview') {
						const attemptId = this.getNodeParameter('attemptId', i) as number;
						const quizId = this.getNodeParameter('quizId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_quiz_get_attempt_review', attemptid: attemptId, page: -1, quizid: quizId });
					} else if (operation === 'processAttempt') {
						const attemptId = this.getNodeParameter('attemptId', i) as number;
						const quizId = this.getNodeParameter('quizId', i) as number;
						const quizDataJson = this.getNodeParameter('quizDataJson', i) as string;
						const quizFinish = this.getNodeParameter('quizFinish', i) as boolean;
						const data = JSON.parse(quizDataJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_quiz_process_attempt', attemptid: attemptId, quizid: quizId, finish: quizFinish ? 1 : 0, ...flattenObject({ data }) });
					} else if (operation === 'saveAttempt') {
						const attemptId = this.getNodeParameter('attemptId', i) as number;
						const quizId = this.getNodeParameter('quizId', i) as number;
						const quizDataJson = this.getNodeParameter('quizDataJson', i) as string;
						const data = JSON.parse(quizDataJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_quiz_save_attempt', attemptid: attemptId, quizid: quizId, ...flattenObject({ data }) });
					} else if (operation === 'getUserBestGrade') {
						const quizId = this.getNodeParameter('quizId', i) as number;
						const quizUserId = this.getNodeParameter('quizUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_quiz_get_user_best_grade', quizid: quizId, userid: quizUserId });
					} else if (operation === 'getUserAttempts') {
						const quizId = this.getNodeParameter('quizId', i) as number;
						const quizUserId = this.getNodeParameter('quizUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_quiz_get_user_attempts', quizid: quizId, userid: quizUserId });
					}
				} else if (resource === 'assignment') {
					if (operation === 'get') {
						const assignCourseId = this.getNodeParameter('assignCourseId', i) as number;
						const courseids = [assignCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_get_assignments', ...flattenObject({ courseids }) });
					} else if (operation === 'getSubmissions') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignIds = [assignId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_get_submissions', ...flattenObject({ assignmentids: assignIds }) });
					} else if (operation === 'getSubmissionStatus') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignUserId = this.getNodeParameter('assignUserId', i) as number;
						const assignAttemptNumber = this.getNodeParameter('assignAttemptNumber', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_get_submission_status', assignid: assignId, userid: assignUserId, attemptnumber: assignAttemptNumber >= 0 ? assignAttemptNumber : -1 });
					} else if (operation === 'saveSubmission') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignPlugindataJson = this.getNodeParameter('assignPlugindataJson', i) as string;
						const plugindata = JSON.parse(assignPlugindataJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_save_submission', assignmentid: assignId, plugindata: plugindata });
					} else if (operation === 'submitForGrading') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignPlugindataJson = this.getNodeParameter('assignPlugindataJson', i) as string;
						const plugindata = JSON.parse(assignPlugindataJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_submit_for_grading', assignmentid: assignId, acceptsubmissionstatement: true, ...flattenObject({ plugindata }) });
					} else if (operation === 'saveGrade') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignUserId = this.getNodeParameter('assignUserId', i) as number;
						const assignGrade = this.getNodeParameter('assignGrade', i) as number;
						const assignAttemptNumber = this.getNodeParameter('assignAttemptNumber', i) as number;
						const assignGradeDataJson = this.getNodeParameter('assignGradeDataJson', i) as string;
						const advanceddata = JSON.parse(assignGradeDataJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_save_grade', assignmentid: assignId, userid: assignUserId, grade: assignGrade, attemptnumber: assignAttemptNumber >= 0 ? assignAttemptNumber : -1, addattempt: 0, ...flattenObject({ advanceddata }) });
					} else if (operation === 'getGrades') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignIds = [assignId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_get_grades', ...flattenObject({ assignmentids: assignIds }) });
					} else if (operation === 'listParticipants') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignGroupId = this.getNodeParameter('assignGroupId', i) as number;
						const assignFilter = this.getNodeParameter('assignFilter', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_list_participants', assignid: assignId, groupid: assignGroupId, filter: assignFilter });
					} else if (operation === 'lock') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignUserId = this.getNodeParameter('assignUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_lock_submission', assignmentid: assignId, userid: assignUserId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'unlock') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignUserId = this.getNodeParameter('assignUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_unlock_submission', assignmentid: assignId, userid: assignUserId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'revertToDraft') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignUserId = this.getNodeParameter('assignUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_revert_submissions_to_draft', assignmentid: assignId, userid: assignUserId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'getUserFlags') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignUserId = this.getNodeParameter('assignUserId', i) as number;
						const assignAttemptNumber = this.getNodeParameter('assignAttemptNumber', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_get_user_flags', assignmentid: assignId, userid: assignUserId, attemptnumber: assignAttemptNumber >= 0 ? assignAttemptNumber : -1 });
					} else if (operation === 'setUserFlags') {
						const assignId = this.getNodeParameter('assignId', i) as number;
						const assignUserId = this.getNodeParameter('assignUserId', i) as number;
						const assignAttemptNumber = this.getNodeParameter('assignAttemptNumber', i) as number;
						const assignFlagsJson = this.getNodeParameter('assignFlagsJson', i) as string;
						const userflags = JSON.parse(assignFlagsJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_assign_set_user_flags', assignmentid: assignId, userid: assignUserId, attemptnumber: assignAttemptNumber >= 0 ? assignAttemptNumber : -1, ...flattenObject({ userflags }) });
					}
				} else if (resource === 'forum') {
					if (operation === 'getByCourse') {
						const forumCourseId = this.getNodeParameter('forumCourseId', i) as number;
						const courseids = [forumCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_forum_get_forums_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'addDiscussion') {
						const forumCourseId = this.getNodeParameter('forumCourseId', i) as number;
						const forumId = this.getNodeParameter('forumId', i) as number;
						const forumDiscussionTitle = this.getNodeParameter('forumDiscussionTitle', i) as string;
						const forumDiscussionMessage = this.getNodeParameter('forumDiscussionMessage', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_forum_add_discussion', courseid: forumCourseId, forumid: forumId, subject: forumDiscussionTitle, message: forumDiscussionMessage });
					} else if (operation === 'addPost') {
						const forumDiscussionId = this.getNodeParameter('forumDiscussionId', i) as number;
						const forumPostSubject = this.getNodeParameter('forumPostSubject', i) as string;
						const forumPostMessage = this.getNodeParameter('forumPostMessage', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_forum_add_discussion_post', postid: forumDiscussionId, subject: forumPostSubject, message: forumPostMessage });
					} else if (operation === 'getPosts') {
						const forumId = this.getNodeParameter('forumId', i) as number;
						const forumDiscussionId = this.getNodeParameter('forumDiscussionId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_forum_get_discussion_posts', forumid: forumId, discussionid: forumDiscussionId });
					} else if (operation === 'canAddDiscussion') {
						const forumCourseId = this.getNodeParameter('forumCourseId', i) as number;
						const forumId = this.getNodeParameter('forumId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_forum_can_add_discussion', courseid: forumCourseId, forumid: forumId });
					} else if (operation === 'setPinState') {
						const forumDiscussionId = this.getNodeParameter('forumDiscussionId', i) as number;
						const forumPinState = this.getNodeParameter('forumPinState', i) as boolean;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_forum_set_pin_state', discussionid: forumDiscussionId, state: forumPinState ? 1 : 0 });
					} else if (operation === 'toggleFavourite') {
						const forumDiscussionId = this.getNodeParameter('forumDiscussionId', i) as number;
						const forumFavouriteState = this.getNodeParameter('forumFavouriteState', i) as boolean;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_forum_toggle_favourite_state', discussionid: forumDiscussionId, targetstate: forumFavouriteState ? 1 : 0 });
					}
				} else if (resource === 'glossary') {
					if (operation === 'getByCourse') {
						const glossaryCourseId = this.getNodeParameter('glossaryCourseId', i) as number;
						const courseids = [glossaryCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_glossary_get_glossaries_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'getEntriesByAuthor') {
						const glossaryId = this.getNodeParameter('glossaryId', i) as number;
						const glossaryAuthorId = this.getNodeParameter('glossaryAuthorId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_glossary_get_entries_by_author', id: glossaryId, letter: '', field: 'author', sort: 'asc', from: 0, limit: 20, authorid: glossaryAuthorId });
					} else if (operation === 'getEntriesByCategory') {
						const glossaryId = this.getNodeParameter('glossaryId', i) as number;
						const glossaryCategoryId = this.getNodeParameter('glossaryCategoryId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_glossary_get_entries_by_category', id: glossaryId, categoryid: glossaryCategoryId, from: 0, limit: 20 });
					} else if (operation === 'getEntriesByDate') {
						const glossaryId = this.getNodeParameter('glossaryId', i) as number;
						const glossaryFromDate = this.getNodeParameter('glossaryFromDate', i) as string;
						const glossaryToDate = this.getNodeParameter('glossaryToDate', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_glossary_get_entries_by_date', id: glossaryId, order: 'UPDATE', sort: 'desc', from: glossaryFromDate ? dateToTimestamp(glossaryFromDate) : 0, to: glossaryToDate ? dateToTimestamp(glossaryToDate) : 0, limit: 20 });
					} else if (operation === 'getEntryById') {
						const glossaryEntryId = this.getNodeParameter('glossaryEntryId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_glossary_get_entry_by_id', id: glossaryEntryId });
					} else if (operation === 'addEntry') {
						const glossaryId = this.getNodeParameter('glossaryId', i) as number;
						const glossaryEntryConcept = this.getNodeParameter('glossaryEntryConcept', i) as string;
						const glossaryEntryDefinition = this.getNodeParameter('glossaryEntryDefinition', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_glossary_add_entry', glossaryid: glossaryId, concept: glossaryEntryConcept, definition: glossaryEntryDefinition, definitionformat: 1 });
					} else if (operation === 'updateEntry') {
						const glossaryId = this.getNodeParameter('glossaryId', i) as number;
						const glossaryEntryId = this.getNodeParameter('glossaryEntryId', i) as number;
						const glossaryEntryConcept = this.getNodeParameter('glossaryEntryConcept', i) as string;
						const glossaryEntryDefinition = this.getNodeParameter('glossaryEntryDefinition', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_glossary_update_entry', glossaryid: glossaryId, entryid: glossaryEntryId, concept: glossaryEntryConcept, definition: glossaryEntryDefinition, definitionformat: 1 });
					} else if (operation === 'deleteEntry') {
						const glossaryEntryId = this.getNodeParameter('glossaryEntryId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_glossary_delete_entry', entryid: glossaryEntryId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					}
				} else if (resource === 'lesson') {
					if (operation === 'getByCourse') {
						const lessonCourseId = this.getNodeParameter('lessonCourseId', i) as number;
						const courseids = [lessonCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_lesson_get_lessons_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'getPages') {
						const lessonId = this.getNodeParameter('lessonId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_lesson_get_pages', lessonid: lessonId });
					} else if (operation === 'getPageData') {
						const lessonId = this.getNodeParameter('lessonId', i) as number;
						const lessonPageId = this.getNodeParameter('lessonPageId', i) as number;
						const lessonAttempt = this.getNodeParameter('lessonAttempt', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_lesson_get_page_data', lessonid: lessonId, pageid: lessonPageId, attempt: lessonAttempt });
					} else if (operation === 'launchAttempt') {
						const lessonId = this.getNodeParameter('lessonId', i) as number;
						const lessonUserId = this.getNodeParameter('lessonUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_lesson_launch_attempt', lessonid: lessonId, userid: lessonUserId });
					} else if (operation === 'processPage') {
						const lessonId = this.getNodeParameter('lessonId', i) as number;
						const lessonPageId = this.getNodeParameter('lessonPageId', i) as number;
						const lessonUserId = this.getNodeParameter('lessonUserId', i) as number;
						const lessonAttempt = this.getNodeParameter('lessonAttempt', i) as number;
						const lessonDataJson = this.getNodeParameter('lessonDataJson', i) as string;
						const data = JSON.parse(lessonDataJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_lesson_process_page', lessonid: lessonId, pageid: lessonPageId, userid: lessonUserId, attempt: lessonAttempt, ...flattenObject({ data }) });
					} else if (operation === 'getUserAttempt') {
						const lessonId = this.getNodeParameter('lessonId', i) as number;
						const lessonUserId = this.getNodeParameter('lessonUserId', i) as number;
						const lessonAttempt = this.getNodeParameter('lessonAttempt', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_lesson_get_user_attempt', lessonid: lessonId, userid: lessonUserId, attempt: lessonAttempt });
					} else if (operation === 'getUserGrade') {
						const lessonId = this.getNodeParameter('lessonId', i) as number;
						const lessonUserId = this.getNodeParameter('lessonUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_lesson_get_user_grade', lessonid: lessonId, userid: lessonUserId });
					} else if (operation === 'getQuestionsAttempts') {
						const lessonId = this.getNodeParameter('lessonId', i) as number;
						const lessonUserId = this.getNodeParameter('lessonUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_lesson_get_questions_attempts', lessonid: lessonId, userid: lessonUserId });
					}
				} else if (resource === 'scorm') {
					if (operation === 'getByCourse') {
						const scormCourseId = this.getNodeParameter('scormCourseId', i) as number;
						const courseids = [scormCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_scorm_get_scorms_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'getTracks') {
						const scormId = this.getNodeParameter('scormId', i) as number;
						const scormUserId = this.getNodeParameter('scormUserId', i) as number;
						const scormAttempt = this.getNodeParameter('scormAttempt', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_scorm_get_scorm_tracks', scormid: scormId, userid: scormUserId, attempt: scormAttempt });
					} else if (operation === 'insertTracks') {
						const scormId = this.getNodeParameter('scormId', i) as number;
						const scormUserId = this.getNodeParameter('scormUserId', i) as number;
						const scormAttempt = this.getNodeParameter('scormAttempt', i) as number;
						const scormTracksJson = this.getNodeParameter('scormTracksJson', i) as string;
						const tracks = JSON.parse(scormTracksJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_scorm_insert_scorm_tracks', scormid: scormId, userid: scormUserId, attempt: scormAttempt, ...flattenObject({ tracks }) });
					} else if (operation === 'getAttemptCount') {
						const scormId = this.getNodeParameter('scormId', i) as number;
						const scormUserId = this.getNodeParameter('scormUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_scorm_get_scorm_attempt_count', scormid: scormId, userid: scormUserId });
					} else if (operation === 'getUserData') {
						const scormId = this.getNodeParameter('scormId', i) as number;
						const scormUserId = this.getNodeParameter('scormUserId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_scorm_get_scorm_user_data', scormid: scormId, userid: scormUserId });
					}
				} else if (resource === 'workshop') {
					if (operation === 'getByCourse') {
						const workshopCourseId = this.getNodeParameter('workshopCourseId', i) as number;
						const courseids = [workshopCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_workshop_get_workshops_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'getPhases') {
						const workshopId = this.getNodeParameter('workshopId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_workshop_get_workshop_phases', workshopid: workshopId });
					} else if (operation === 'getAssessmentForm') {
						const workshopId = this.getNodeParameter('workshopId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_workshop_get_assessment_form_definition', workshopid: workshopId });
					} else if (operation === 'getSubmissions') {
						const workshopId = this.getNodeParameter('workshopId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_workshop_get_submissions', workshopid: workshopId });
					} else if (operation === 'getGrades') {
						const workshopId = this.getNodeParameter('workshopId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_workshop_get_grades', workshopid: workshopId });
					} else if (operation === 'view') {
						const workshopId = this.getNodeParameter('workshopId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_workshop_view_workshop', workshopid: workshopId });
					}
				} else if (resource === 'data') {
					if (operation === 'getByCourse') {
						const dataCourseId = this.getNodeParameter('dataCourseId', i) as number;
						const courseids = [dataCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_data_get_databases_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'getFields') {
						const dataId = this.getNodeParameter('dataId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_data_get_fields', databaseid: dataId });
					} else if (operation === 'getEntries') {
						const dataId = this.getNodeParameter('dataId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_data_get_entries', databaseid: dataId, returncontents: 1 });
					} else if (operation === 'searchEntries') {
						const dataId = this.getNodeParameter('dataId', i) as number;
						const dataSearchQuery = this.getNodeParameter('dataSearchQuery', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_data_search_entries', databaseid: dataId, search: dataSearchQuery });
					} else if (operation === 'addEntry') {
						const dataId = this.getNodeParameter('dataId', i) as number;
						const dataEntryJson = this.getNodeParameter('dataEntryJson', i) as string;
						const entryData = JSON.parse(dataEntryJson);
						const data = [];
						for (const [field, value] of Object.entries(entryData)) {
							data.push({ fieldid: parseInt(field, 10), value: String(value) });
						}
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_data_add_entry', databaseid: dataId, ...flattenObject({ data }) });
					} else if (operation === 'updateEntry') {
						const dataId = this.getNodeParameter('dataId', i) as number;
						const dataEntryId = this.getNodeParameter('dataEntryId', i) as number;
						const dataEntryJson = this.getNodeParameter('dataEntryJson', i) as string;
						const entryData = JSON.parse(dataEntryJson);
						const data = [];
						for (const [field, value] of Object.entries(entryData)) {
							data.push({ fieldid: parseInt(field, 10), value: String(value) });
						}
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_data_update_entry', databaseid: dataId, entryid: dataEntryId, ...flattenObject({ data }) });
					} else if (operation === 'deleteEntry') {
						const dataEntryId = this.getNodeParameter('dataEntryId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_data_delete_entry', entryid: dataEntryId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					}
				} else if (resource === 'survey') {
					if (operation === 'getByCourse') {
						const surveyCourseId = this.getNodeParameter('surveyCourseId', i) as number;
						const courseids = [surveyCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_survey_get_surveys_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'getQuestions') {
						const surveyId = this.getNodeParameter('surveyId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_survey_get_questions', surveyid: surveyId });
					} else if (operation === 'submitAnswers') {
						const surveyId = this.getNodeParameter('surveyId', i) as number;
						const surveyAnswersJson = this.getNodeParameter('surveyAnswersJson', i) as string;
						const answers = JSON.parse(surveyAnswersJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_survey_submit_answers', surveyid: surveyId, ...flattenObject({ answers }) });
					}
				} else if (resource === 'choice') {
					if (operation === 'getByCourse') {
						const choiceCourseId = this.getNodeParameter('choiceCourseId', i) as number;
						const courseids = [choiceCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_choice_get_choices_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'getResults') {
						const choiceId = this.getNodeParameter('choiceId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_choice_get_choice_results', choiceid: choiceId });
					} else if (operation === 'getOptions') {
						const choiceId = this.getNodeParameter('choiceId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_choice_get_choice_options', choiceid: choiceId });
					} else if (operation === 'submitResponse') {
						const choiceId = this.getNodeParameter('choiceId', i) as number;
						const choiceOptionIds = this.getNodeParameter('choiceOptionIds', i) as string;
						const optionIds = choiceOptionIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_choice_submit_choice_response', choiceid: choiceId, ...flattenObject({ responses: optionIds.map(oid => ({ optionid: oid })) }) });
					} else if (operation === 'deleteResponse') {
						const choiceId = this.getNodeParameter('choiceId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_choice_delete_choice_responses', choiceid: choiceId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					}
				} else if (resource === 'feedback') {
					if (operation === 'getByCourse') {
						const feedbackCourseId = this.getNodeParameter('feedbackCourseId', i) as number;
						const courseids = [feedbackCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_feedback_get_feedbacks_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'getItems') {
						const feedbackId = this.getNodeParameter('feedbackId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_feedback_get_items', feedbackid: feedbackId });
					} else if (operation === 'getAnalysis') {
						const feedbackId = this.getNodeParameter('feedbackId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_feedback_get_analysis', feedbackid: feedbackId });
					} else if (operation === 'getResponsesAnalysis') {
						const feedbackId = this.getNodeParameter('feedbackId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_feedback_get_responses_analysis', feedbackid: feedbackId });
					} else if (operation === 'getLastCompleted') {
						const feedbackId = this.getNodeParameter('feedbackId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_feedback_get_last_completed', feedbackid: feedbackId });
					} else if (operation === 'getCurrentCompleted') {
						const feedbackId = this.getNodeParameter('feedbackId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_feedback_get_current_completed', feedbackid: feedbackId });
					} else if (operation === 'processPage') {
						const feedbackId = this.getNodeParameter('feedbackId', i) as number;
						const feedbackPage = this.getNodeParameter('feedbackPage', i) as number;
						const feedbackResponsesJson = this.getNodeParameter('feedbackResponsesJson', i) as string;
						const responses = JSON.parse(feedbackResponsesJson);
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_feedback_process_page', feedbackid: feedbackId, page: feedbackPage, ...flattenObject({ responses }) });
					}
				} else if (resource === 'wiki') {
					if (operation === 'getByCourse') {
						const wikiCourseId = this.getNodeParameter('wikiCourseId', i) as number;
						const courseids = [wikiCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_wiki_get_wikis_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'getSubwikis') {
						const wikiId = this.getNodeParameter('wikiId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_wiki_get_subwikis', wikiid: wikiId });
					} else if (operation === 'getPages') {
						const wikiId = this.getNodeParameter('wikiId', i) as number;
						const wikiSubwikiId = this.getNodeParameter('wikiSubwikiId', i) as number;
						const reqParams: IDataObject = { wsfunction: 'mod_wiki_get_pages', wikiid: wikiId };
						if (wikiSubwikiId) reqParams.subwikiid = wikiSubwikiId;
						responseData = await moodleApiRequest.call(this, 'POST', {}, reqParams);
					} else if (operation === 'getPageContents') {
						const wikiPageId = this.getNodeParameter('wikiPageId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_wiki_get_page_contents', pageid: wikiPageId });
					} else if (operation === 'editPage') {
						const wikiPageId = this.getNodeParameter('wikiPageId', i) as number;
						const wikiPageContent = this.getNodeParameter('wikiPageContent', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_wiki_edit_page', pageid: wikiPageId, content: wikiPageContent });
					} else if (operation === 'newPage') {
						const wikiId = this.getNodeParameter('wikiId', i) as number;
						const wikiSubwikiId = this.getNodeParameter('wikiSubwikiId', i) as number;
						const wikiPageTitle = this.getNodeParameter('wikiPageTitle', i) as string;
						const wikiPageContent = this.getNodeParameter('wikiPageContent', i) as string;
						const reqParams: IDataObject = { wsfunction: 'mod_wiki_new_page', title: wikiPageTitle, content: wikiPageContent, wikiid: wikiId };
						if (wikiSubwikiId) reqParams.subwikiid = wikiSubwikiId;
						responseData = await moodleApiRequest.call(this, 'POST', {}, reqParams);
					}
				} else if (resource === 'chat') {
					if (operation === 'getByCourse') {
						const chatCourseId = this.getNodeParameter('chatCourseId', i) as number;
						const courseids = [chatCourseId];
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_chat_get_chats_by_courses', ...flattenObject({ courseids }) });
					} else if (operation === 'getUsers') {
						const chatId = this.getNodeParameter('chatId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_chat_get_chat_users', chatid: chatId });
					} else if (operation === 'getLatestMessages') {
						const chatId = this.getNodeParameter('chatId', i) as number;
						const chatSessionId = this.getNodeParameter('chatSessionId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_chat_get_chat_latest_messages', chatid: chatId, chatsid: chatSessionId || undefined });
					} else if (operation === 'sendMessage') {
						const chatId = this.getNodeParameter('chatId', i) as number;
						const chatMessage = this.getNodeParameter('chatMessage', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_chat_send_chat_message', chatid: chatId, messagetext: chatMessage });
					} else if (operation === 'loginUser') {
						const chatId = this.getNodeParameter('chatId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_chat_login_user', chatid: chatId });
					}
				} else if (resource === 'customcert') {
					if (operation === 'deleteIssue') {
						const certificateIssueId = this.getNodeParameter('certificateIssueId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_customcert_delete_issue', issueid: certificateIssueId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					} else if (operation === 'getElementHtml') {
						const certificateId = this.getNodeParameter('certificateId', i) as number;
						const certificateElementId = this.getNodeParameter('certificateElementId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'mod_customcert_get_element_html', certificateid: certificateId, elementid: certificateElementId });
					} else if (operation === 'saveElement') {
						const certificateId = this.getNodeParameter('certificateId', i) as number;
						const certificateElementId = this.getNodeParameter('certificateElementId', i) as number;
						const elementDataJson = this.getNodeParameter('certificateElementData', i) as string;
						const elementData = JSON.parse(elementDataJson);
						const params: IDataObject = {
							wsfunction: 'mod_customcert_save_element',
							certificateid: certificateId,
							elementid: certificateElementId,
						};
						for (const [key, value] of Object.entries(elementData)) {
							params[`data[${key}]`] = value as IDataObject;
						}
						responseData = await moodleApiRequest.call(this, 'POST', params);
					}
				} else if (resource === 'joomdle') {
					const joomdleGroupId = this.getNodeParameter('joomdleGroupId', i) as number;
					responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'joomdle_get_group_members', groupid: joomdleGroupId });
				} else if (resource === 'book' || resource === 'page' || resource === 'url' || resource === 'resource' || resource === 'folder') {
					const simpleCourseId = this.getNodeParameter('simpleCourseId', i) as number;
					const courseids = [simpleCourseId];
					const wsFunctions: IDataObject = {
						book: 'mod_book_get_books_by_courses',
						page: 'mod_page_get_pages_by_courses',
						url: 'mod_url_get_urls_by_courses',
						resource: 'mod_resource_get_resources_by_courses',
						folder: 'mod_folder_get_folders_by_courses',
					};
					responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: wsFunctions[resource] as string, ...flattenObject({ courseids }) });
				} else if (resource === 'rating') {
					if (operation === 'get') {
						const ratingComponent = this.getNodeParameter('ratingComponent', i) as string;
						const ratingArea = this.getNodeParameter('ratingArea', i) as string;
						const ratingContextLevel = this.getNodeParameter('ratingContextLevel', i) as string;
						const ratingItemId = this.getNodeParameter('ratingItemId', i) as number;
						const ratingInstanceId = this.getNodeParameter('ratingInstanceId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_rating_get_item_ratings', component: ratingComponent, ratingarea: ratingArea, contextlevel: ratingContextLevel, itemid: ratingItemId, scaleid: ratingInstanceId });
					} else if (operation === 'add') {
						const ratingComponent = this.getNodeParameter('ratingComponent', i) as string;
						const ratingArea = this.getNodeParameter('ratingArea', i) as string;
						const ratingContextLevel = this.getNodeParameter('ratingContextLevel', i) as string;
						const ratingItemId = this.getNodeParameter('ratingItemId', i) as number;
						const ratingScaleId = this.getNodeParameter('ratingScaleId', i) as number;
						const ratingValue = this.getNodeParameter('ratingValue', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_rating_add_rating', component: ratingComponent, ratingarea: ratingArea, contextlevel: ratingContextLevel, itemid: ratingItemId, scaleid: ratingScaleId, rating: ratingValue });
					}
				} else if (resource === 'comment') {
					if (operation === 'get') {
						const commentComponent = this.getNodeParameter('commentComponent', i) as string;
						const commentArea = this.getNodeParameter('commentArea', i) as string;
						const commentItemId = this.getNodeParameter('commentItemId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_comment_get_comments', component: commentComponent, commentarea: commentArea, itemid: commentItemId });
					} else if (operation === 'add') {
						const commentComponent = this.getNodeParameter('commentComponent', i) as string;
						const commentArea = this.getNodeParameter('commentArea', i) as string;
						const commentItemId = this.getNodeParameter('commentItemId', i) as number;
						const commentContextId = this.getNodeParameter('commentContextId', i) as number;
						const commentContent = this.getNodeParameter('commentContent', i) as string;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_comment_add_comments', component: commentComponent, commentarea: commentArea, itemid: commentItemId, contextid: commentContextId, content: commentContent });
					} else if (operation === 'delete') {
						const commentComponent = this.getNodeParameter('commentComponent', i) as string;
						const commentArea = this.getNodeParameter('commentArea', i) as string;
						const commentItemId = this.getNodeParameter('commentItemId', i) as number;
						const commentContextId = this.getNodeParameter('commentContextId', i) as number;
						const commentDeleteId = this.getNodeParameter('commentDeleteId', i) as number;
						responseData = await moodleApiRequest.call(this, 'POST', { wsfunction: 'core_comment_delete_comments', component: commentComponent, commentarea: commentArea, itemid: commentItemId, contextid: commentContextId, commentid: commentDeleteId });
						if (responseData === null || responseData === undefined) { responseData = { success: true }; }
					}
				}

				if (responseData !== undefined) {
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray(responseData as IDataObject),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
				}
			} catch (error: any) {
				if (this.continueOnFail()) {
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: error.message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
					continue;
				}
				throw error;
			}
		}
		return [returnData];
	}
}

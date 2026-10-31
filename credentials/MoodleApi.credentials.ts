import { ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class MoodleApi implements ICredentialType {
	name = 'moodleApi';
	displayName = 'Moodle API';
	documentationUrl = 'https://github.com/marcostoduto/n8n-nodes-moodle-full#credentials';
	properties: INodeProperties[] = [
		{
			displayName: 'Moodle URL',
			name: 'url',
			type: 'string',
			default: '',
			placeholder: 'https://your-moodle-site.com',
			required: true,
			description: 'The base URL of your Moodle instance (without /webservice/...)',
		},
		{
			displayName: 'Web Service Token',
			name: 'token',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description:
				'Your Moodle Web Service token. You can create one in Site administration → Server → Web services → Manage tokens',
		},
	];

	// Moodle answers with HTTP 200 even when the token is wrong, so the error codes in the body must be checked.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.url.trim().replace(/\\/+$/, "")}}',
			url: '/webservice/rest/server.php',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: {
				wstoken: '={{$credentials.token.trim()}}',
				wsfunction: 'core_webservice_get_site_info',
				moodlewsrestformat: 'json',
			},
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'errorcode',
					value: 'invalidtoken',
					message: 'Invalid token: check the Web Service token',
				},
			},
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'errorcode',
					value: 'accessexception',
					message: 'Access denied: the token is not allowed to use core_webservice_get_site_info',
				},
			},
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'errorcode',
					value: 'servicerequireslogin',
					message: 'The web service is not enabled or the token does not belong to it',
				},
			},
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'errorcode',
					value: 'enablewsdescription',
					message: 'Web services are disabled on this Moodle site',
				},
			},
		],
	};
}

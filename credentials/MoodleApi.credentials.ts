import {
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class MoodleApi implements ICredentialType {
    name = 'moodleApi';
    displayName = 'Moodle API';
    documentationUrl = 'https://github.com/threatroute66/n8n-nodes-moodle';
    properties: INodeProperties[] = [
        {
            displayName: 'Moodle URL',
            name: 'url',
            type: 'string',
            default: '',
            placeholder: 'https://your-moodle-site.com',
            required: true,
            description: 'The URL of your Moodle instance',
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
            description: 'Your Moodle Web Service token. You can create one in Site administration → Server → Web services → Manage tokens',
        },
    ];

    test: ICredentialTestRequest = {
        request: {
            baseURL: '={{$credentials.url}}',
            url: '/webservice/rest/server.php',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: {
                wstoken: '={{$credentials.token}}',
                wsfunction: 'core_webservice_get_site_info',
                moodlewsrestformat: 'json',
            },
        },
    };
}

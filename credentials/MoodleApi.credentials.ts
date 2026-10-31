import {
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class MoodleApi implements ICredentialType {
    name = 'moodleApi';
    displayName = 'Moodle API';
    documentationUrl = 'https://github.com/marcostoduto/n8n-nodes-moodle-full';
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
            baseURL: '={{$credentials.url.replace(/\\/+$/, "")}}',
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
        // Moodle answers authentication problems with HTTP 200 and an error body,
        // so the credential test has to inspect the body to detect them.
        rules: [
            {
                type: 'responseSuccessBody',
                properties: {
                    key: 'errorcode',
                    value: 'invalidtoken',
                    message: 'Invalid token: check the Web Service Token',
                },
            },
            {
                type: 'responseSuccessBody',
                properties: {
                    key: 'errorcode',
                    value: 'accessexception',
                    message: 'Access denied: check that the token user and the external service are enabled',
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

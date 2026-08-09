# n8n-nodes-moodle-full

![n8n.io](https://img.shields.io/badge/n8n-community-blue) ![npm](https://img.shields.io/npm/v/n8n-nodes-moodle-full) ![License](https://img.shields.io/npm/l/n8n-nodes-moodle-full)

**n8n community node for comprehensive Moodle LMS integration** — exposes all major Moodle Web Service API routes as n8n operations.

## Installation

Follow the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

1. Go to **Settings → Community Nodes → Install**
2. Enter `n8n-nodes-moodle-full` and click **Install**

## Setup

Create a **Moodle API** credential in n8n with:

| Field | Description |
|---|---|
| **Moodle URL** | Base URL of your Moodle instance (e.g. `https://moodle.example.com`) |
| **Token** | A valid Web Service token from Moodle |

> **Moodle setup requirement:** The token user must have the `webservice/rest` protocol enabled and the relevant capabilities assigned to the web service.

## Resources & Operations

| Resource | Operations |
|---|---|
| **Assignment** | Get, Get Submissions, Get Submission Status, Save Submission, Submit For Grading, Save Grade, Get Grades, List Participants, Lock, Unlock, Revert To Draft, Get User Flags, Set User Flags |
| **Badge** | Get User Badges, Issue, Revoke |
| **Book** | Get By Course |
| **Calendar** | Get, Create, Update, Delete, Get Upcoming, Get Monthly View, Get Day View |
| **Chat** | Get By Course, Get Users, Get Latest Messages, Send Message, Login User |
| **Choice** | Get By Course, Get Results, Get Options, Submit Response, Delete Response |
| **Cohort** | Create, Get, Update, Delete, Add Members, Delete Members, Get Members |
| **Comment** | Get, Add, Delete |
| **Competency** | Create Template, Get Template, List Templates, Update Template, Delete Template, Create Competency, Get Competency, List Competencies, Update Competency, Delete Competency, Get User Competencies, Get User Competency |
| **Course** | Create, Get, Get All, Search, Update, Delete, Duplicate, Get Categories, Get Category, Create Category, Update Category, Delete Category, Get Contents, Get Sections, Create Section, Update Section, Delete Section, Get Enrolled Users, Get Enrolment Methods, Get Module |
| **Custom Certificate** | Delete Issue, Get Element HTML, Save Element |
| **Data (Database)** | Get By Course, Get Fields, Get Entries, Search Entries, Add Entry, Update Entry, Delete Entry |
| **Enrollment** | Enrol, Unenrol, Get User Courses, Get Course Users, Self Enrol, Get Self Enrol Instance, Get Enrolled With Capability, Get Potential Users |
| **Feedback** | Get By Course, Get Items, Get Analysis, Get Responses Analysis, Get Last Completed, Get Current Completed, Process Page |
| **File** | Get, Upload, Delete Draft Files, Create Draft Area |
| **Folder** | Get By Course |
| **Forum** | Get By Course, Add Discussion, Add Post, Get Posts, Can Add Discussion, Set Pin State, Toggle Favourite |
| **Glossary** | Get By Course, Get Entries By Author, Get Entries By Category, Get Entries By Date, Get Entry By ID, Add Entry, Update Entry, Delete Entry |
| **Grade** | Get User Course Grades, View Grade Report, Get Grades Table, Get Grade Items, Get Grade Definitions, Get Gradable Users, Update Grades |
| **Group** | Create, Get, Update, Delete, Get Course Groups, Add Member, Delete Member, Get Members, Create Grouping, Get Groupings, Update Grouping, Delete Grouping, Assign Grouping, Unassign Grouping |
| **Joomdle** | Get Group Members |
| **Lesson** | Get By Course, Get Pages, Get Page Data, Launch Attempt, Process Page, Get User Attempt, Get User Grade, Get Questions Attempts |
| **Message** | Send, Get Messages, Get Conversations, Get Conversation Messages, Create Conversation, Delete Conversation, Mark Message Read, Delete Message, Send To Conversation |
| **Note** | Create, Get, Update, Delete |
| **Page** | Get By Course |
| **Quiz** | Get By Course, Start Attempt, Get Attempt Data, Get Attempt Summary, Get Attempt Review, Process Attempt, Save Attempt, Get User Best Grade, Get User Attempts |
| **Rating** | Get, Add |
| **Resource** | Get By Course |
| **SCORM** | Get By Course, Get Tracks, Insert Tracks, Get Attempt Count, Get User Data |
| **Survey** | Get By Course, Get Questions, Submit Answers |
| **System** | Get Site Info, Get Auth Plugins, Get Site Features |
| **URL Resource** | Get By Course |
| **User** | Create, Get, Get By Field, Get All, Update, Delete, Get Preferences, Set Preferences, Agree Site Policy, Add Device |
| **Wiki** | Get By Course, Get Subwikis, Get Pages, Get Page Contents, Edit Page, New Page |
| **Workshop** | Get By Course, Get Phases, Get Assessment Form, Get Submissions, Get Grades, View |

## Requirements

- n8n (any version with community node support)
- Moodle 3.x+ with Web Services enabled
- Valid Moodle Web Service token

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Development mode (auto-compile on changes)
npm run dev

# Lint
npm run lint
```

## Testing

The project includes an integration test suite (vitest) that runs the node's
`execute()` against a **real Moodle instance**.

### Setup

1. Copy `.env.example` to `.env` and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |---|---|
   | `MOODLE_URL` | Base URL of your Moodle instance (no trailing slash) |
   | `MOODLE_TOKEN` | Web Service token with permissions for the operations under test |

   > `.env` is gitignored — never commit your token.

2. Run the tests:

   ```bash
   npm test                 # run all tests
   npm run test:integration # run only the integration suite
   npm run test:watch       # watch mode
   ```

If `.env` is missing, the integration tests are **skipped** (they don't fail).

### Covered resources

- **System** — getSiteInfo, getAuthPlugins, getSiteFeatures
- **User** — create, get, getByField, getPreferences, update, delete
- **Course** — createCategory, create, get, getAll, getSections, update, delete, deleteCategory
- **Enrollment** — enrol, getCourseUsers, getUserCourses, unenrol
- **Group** — create, get, getCourseGroups, update, delete
- **Cohort** — create, get, update, delete

Each test creates unique test data and cleans it up afterwards (`afterAll`).

### Requirements for a successful run

The web service token user needs the capabilities to run the tested functions
(`core_user_*`, `core_course_*`, `core_group_*`, `core_cohort_*`,
`core_enrol_*`, `enrol_manual_*`) and the standard **student** role id (`5`) must
exist for the enrollment tests.

## License

[MIT](LICENSE)

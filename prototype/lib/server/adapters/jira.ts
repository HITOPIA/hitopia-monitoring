/**
 * Jira Cloud REST adapter (read-only). Basic auth = base64(email:api_token),
 * from env/secret manager only (R8). Uses the enhanced JQL search endpoint
 * (/rest/api/3/search/jql) with nextPageToken pagination.
 */
import { getSecret } from "../env";

function base() {
  return getSecret("JIRA_BASE_URL").replace(/\/+$/, "");
}
function authHeader() {
  const token = Buffer.from(`${getSecret("JIRA_EMAIL")}:${getSecret("JIRA_API_TOKEN")}`).toString("base64");
  return `Basic ${token}`;
}

async function jira(pathQ: string, init?: RequestInit) {
  const res = await fetch(`${base()}${pathQ}`, {
    ...init,
    headers: { Authorization: authHeader(), "content-type": "application/json", Accept: "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Jira ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

export interface JiraUser {
  accountId: string;
  emailAddress?: string;
  displayName?: string;
}
export interface JiraChangelogItem {
  field: string;
  fromString?: string | null;
  toString?: string | null;
}
export interface JiraChangelogHistory {
  author?: JiraUser | null;
  created: string;
  items: JiraChangelogItem[];
}
export interface JiraIssue {
  key: string;
  fields: {
    assignee?: JiraUser | null;
    status?: { name: string; statusCategory?: { key: string } };
    issuetype?: { name?: string } | null;
    summary?: string | null;
    created?: string;
    resolutiondate?: string | null;
    duedate?: string | null;
  };
  changelog?: { histories: JiraChangelogHistory[] };
}

/** Search issues via the enhanced JQL endpoint, paginating with nextPageToken. */
export async function searchIssues(jql: string, fields: string[], expand?: string[]): Promise<JiraIssue[]> {
  const out: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  for (let i = 0; i < 100; i++) {
    const body: Record<string, unknown> = { jql, fields, maxResults: 100 };
    if (expand?.length) body.expand = expand.join(","); // /search/jql wants a string, not an array
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const data = await jira(`/rest/api/3/search/jql`, { method: "POST", body: JSON.stringify(body) });
    const issues = (data?.issues ?? []) as JiraIssue[];
    out.push(...issues);
    if (data?.isLast || !data?.nextPageToken || issues.length === 0) break;
    nextPageToken = data.nextPageToken;
  }
  return out;
}

export async function currentUser() {
  return jira(`/rest/api/3/myself`);
}

/** Per-issue changelog (fallback when the search endpoint omits inline changelog). */
export async function getIssueChangelog(key: string): Promise<JiraChangelogHistory[]> {
  const out: JiraChangelogHistory[] = [];
  let startAt = 0;
  for (let i = 0; i < 20; i++) {
    const data = await jira(`/rest/api/3/issue/${encodeURIComponent(key)}/changelog?startAt=${startAt}&maxResults=100`);
    const values = (data?.values ?? []) as any[];
    for (const v of values) {
      out.push({
        author: v.author ?? null,
        created: v.created,
        items: (v.items ?? []).map((x: any) => ({ field: x.field, fromString: x.fromString ?? null, toString: x.toString ?? null })),
      });
    }
    if (values.length < 100 || data?.isLast) break;
    startAt += values.length;
  }
  return out;
}

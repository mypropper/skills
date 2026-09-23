# OAuth scopes

Scopes are granted at consent. A tool whose scope the token lacks fails with
`Missing required scope: <scope>`. That is a consent problem, not a retry problem: name
the scope, ask the user to re-authorize with it, and stop.

## Core set

Request these for ordinary agreement work:

| Scope | Grants |
|---|---|
| `openid` | User identity |
| `offline_access` | Refresh tokens, so the session survives token expiry |
| `sign:read` | Read agreements, templates, documents, signing status |
| `sign:write` | Create and modify agreements, recipients, documents, templates; delete drafts |
| `sign:send` | Send agreements for signing, and void agreements in flight |
| `org:read` | Read the organization profile |
| `users:read` | Read organization members and roles |
| `users:write` | Invite, change, remove, and cancel invitations |
| `locker:read` | Read documents and extracted risks in Locker |

## Additional scopes

Needed only for the tools listed against them:

| Scope | Grants |
|---|---|
| `docgen:read` | Read document-generation templates and generated documents |
| `docgen:write` | Create and update document-generation templates; generate documents; preview HTML |
| `docgen:preview` | Platform-reserved PDF/URL preview scope, unavailable to MCP clients. Use HTML preview with `docgen:write` |
| `locker:write` | Upload, register, update and delete Locker documents; extract and update risks |

Organization entitlements are not an MCP tool. Salesforce clients use the REST API.

## Tool-to-scope map

| Scope | Tools |
|---|---|
| none | `get_current_user` |
| `org:read` | `get_organization` |
| `users:read` | `list_members` |
| `users:write` | `manage_members` |
| `sign:read` | `list_agreements`, `get_agreement`, `get_audit_trail`, `list_templates`, `get_template`, `manage_templates` `export`, `manage_documents` `get_download_url` |
| `sign:write` | `create_agreement`, `update_agreement`, `delete_agreement`, `manage_documents` `add` and `remove`, `manage_recipients`, `set_fields`, `manage_templates` `create` and `import` |
| `sign:send` | `send_agreement`, `void_agreement`, `gen_and_send_agreement`, `create_agreement_from_template` |
| `docgen:read` | `list_gen_templates`, `get_gen_template`, `list_gen_documents`, `get_gen_document` |
| `docgen:write` | `manage_gen_template` `preview` with `output: "html"` for HTML/Markdown templates |
| `docgen:write` | `manage_gen_template` `create`, `update`, `clone`, and `import_from_source`; `generate_gen_document` |
| `locker:read` | `ask_doc_question`, `locker_list_documents`, `locker_search_documents`, `locker_get_document`, `locker_list_risks`, `locker_get_risk` |
| `locker:write` | `locker_manage_document`, `locker_extract_risks`, `locker_update_risk` |

`delete_agreement` needs only `sign:write`, but `void_agreement` needs `sign:send`. A
token that can delete drafts may be unable to cancel a sent agreement.

For HTML/Markdown templates, use `manage_gen_template` with `action` `preview`, `{ id, data, output: "html" }`
with `docgen:write`. `docgen:read` alone does not authorize rendering. `output: "url"`
and DOCX-source previews require platform-reserved `docgen:preview`; do not ask an MCP
user to re-consent to it. For a PDF, generate a document, poll its status and retrieve it
through the document download path outside MCP. Review it before sending.

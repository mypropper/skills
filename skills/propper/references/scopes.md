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
| `locker:read` | Read documents, extracted risks and settings in Locker |

## Additional scopes

Needed only for the tools listed against them:

| Scope | Grants |
|---|---|
| `docgen:read` | Read document-generation templates and generated documents |
| `docgen:write` | Create and update document-generation templates; generate documents |
| `docgen:preview` | Render a template for review without generating a document. Standalone — not implied by `docgen:read`, `docgen:write` or `docgen:admin` |
| `locker:write` | Create, update and delete Locker documents and risks |
| `locker:admin` | Change Locker settings |
| `entitlements:read` | Read organization entitlements |

## Tool-to-scope map

| Scope | Tools |
|---|---|
| none | `get_current_user`, `ask_doc_question` |
| `org:read` | `organization_get_profile` |
| `users:read` | `organization_list_members` |
| `entitlements:read` | `organization_get_entitlements` |
| `sign:read` | `list_agreements`, `get_agreement`, `get_agreement_status`, `list_recipients`, `list_documents`, `get_document_url`, `list_templates`, `get_template`, `export_template` |
| `sign:write` | `create_agreement`, `update_agreement`, `delete_agreement`, `upload_document`, `remove_document`, `add_recipient`, `update_recipient`, `remove_recipient`, `add_annotations`, `create_sign_template`, `import_template` |
| `sign:send` | `send_agreement`, `void_agreement`, `gen_and_send_agreement` |
| `docgen:read` | `list_gen_templates`, `get_gen_template`, `list_gen_documents`, `get_gen_document`, `list_gen_delivery_configs`, `list_gen_template_delivery_configs`, `list_gen_delivery_logs` |
| `docgen:preview` | `preview_gen_template` |
| `docgen:write` | `create_gen_template`, `update_gen_template`, `clone_gen_template`, `import_gen_template_from_source`, `generate_gen_document`, `create_gen_delivery_config`, `update_gen_delivery_config`, `delete_gen_delivery_config` |
| `locker:read` | `locker_list_documents`, `locker_get_document`, `locker_list_risks`, `locker_get_risk`, `locker_get_risk_stats`, `locker_get_settings`, `locker_get_usage` |
| `locker:write` | `locker_create_document`, `locker_update_document`, `locker_delete_document`, `locker_upload_document`, `locker_extract_risks`, `locker_update_risk`, `locker_delete_risk` |
| `locker:admin` | `locker_update_settings` |

Two asymmetries worth warning users about.

`delete_agreement` needs only `sign:write`, but `void_agreement` needs `sign:send`. A
token that can delete drafts may be unable to cancel a sent agreement.

`preview_gen_template` needs `docgen:preview`, which nothing else implies — not
`docgen:read`, not `docgen:write`, not `docgen:admin`. A token that can generate documents
outright may be unable to preview one first, which is the wrong way round. Request
`docgen:preview` alongside `docgen:write` whenever generation is in scope.

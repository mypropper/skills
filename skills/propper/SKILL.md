---
name: propper
description: Foundation for every Propper agreement task — authenticate, route to the right tool, read the agreement status model, and triage scope and permission errors. Load this before creating, sending, tracking, voiding or importing anything in Propper, and whenever a Propper tool returns an authentication, scope or state error.
---

# Propper

Propper is an agreement platform: generate a document, place signature fields, route it
to signers, and track it to completion. This skill owns authentication, tool routing,
the status model and error triage. Every other Propper skill builds on it.

## Authenticate first

Call `get_current_user` before any other Propper tool. It requires no scopes, so it is
the cheapest probe for both "is the server connected" and "who am I".

Branch on the result:

**Authenticated** — the call returns a user with name, email, organization and roles.
Report the organization before acting on anything that writes. Proceed.

**Server connected, not authenticated** — the call fails with an authentication error.
The MCP server is reachable but no valid token is held. Tell the user to complete the
OAuth flow in their host, then retry. See [references/auth.md](references/auth.md).

**Server not available** — no Propper tools are present in the session at all. Do not
guess at Propper state or fabricate agreement data. Say the Propper MCP server is not
connected, give the one-line setup from [references/auth.md](references/auth.md), and
offer the work that needs no account: `signature-ready-check` to pre-flight a document,
`compare-contract-versions` to diff two drafts, `extract-contract-dates` to pull deadlines
out of a local file, `embed-signing-in-your-app` for integration work,
`migrate-from-docusign` to audit a DocuSign export, `agreement-starter-pack` to draft
template content locally.

Never retry a failed `get_current_user` more than once. Two failures means report and stop.

## Tool routing

| Goal | Tools |
|---|---|
| Identity, org, entitlements | `get_current_user`, `organization_get_profile`, `organization_list_members`, `organization_get_entitlements` (needs `view: "salesforce"`) |
| Manage members | `organization_get_member_capabilities`, `organization_get_member_settings`, `organization_update_member_settings`, `organization_update_member_role`, `organization_invite_member`, `organization_cancel_invitation`, `organization_remove_member` |
| Find an agreement | `list_agreements`, `get_agreement`, `get_agreement_status` |
| Build a draft | `create_agreement`, `upload_document`, `add_recipient`, `add_annotations` |
| Edit a draft | `update_agreement`, `update_recipient`, `remove_recipient`, `remove_document`, `list_documents`, `list_recipients` |
| Send | `send_agreement`, or `create_agreement` with `status: "SENT"` |
| Stop an agreement | `delete_agreement` (draft only), `void_agreement` (already sent) |
| Retrieve a file | `get_document_url` |
| Sign templates | `list_templates`, `get_template`, `create_sign_template`, `import_template`, `export_template` |
| Document generation | `list_gen_templates`, `get_gen_template`, `create_gen_template`, `update_gen_template`, `clone_gen_template`, `preview_gen_template`, `generate_gen_document`, `list_gen_documents`, `get_gen_document` |
| Generate and send in one call | `gen_and_send_agreement` |
| Import from DocuSign | `import_template`, `import_gen_template_from_source` |
| Generated-document delivery | `list_gen_delivery_configs`, `list_gen_template_delivery_configs`, `create_gen_delivery_config`, `update_gen_delivery_config`, `delete_gen_delivery_config`, `list_gen_delivery_logs` |
| Document repository and risk | `locker_list_documents`, `locker_search_documents`, `locker_get_document`, `locker_create_document`, `locker_update_document`, `locker_delete_document`, `locker_upload_document`, `locker_extract_risks`, `locker_list_risks`, `locker_get_risk`, `locker_get_risk_stats`, `locker_update_risk`, `locker_delete_risk`, `locker_get_settings`, `locker_update_settings`, `locker_get_usage` |
| Ask a question of a document | `ask_doc_question` — scope the question below |

Use only these names. If the task needs something not on this list, say so rather than
guessing at a tool.

For a question about one agreement, call `ask_doc_question { question, agreementId }`.
For particular Locker documents, use `documentIds`. Supplying both searches their union,
so use only the intended scope. Omit both only for an explicitly library-wide question.
The tool requires `locker:read`. Read its `Sources`, verify the documents and quote the
supporting text; a scoped answer still needs evidence.

`AGREEMENT_NOT_IN_LOCKER` means there are no linked signed-agreement documents for it in
this organization's Locker. The search does not widen to the library. Report that
limitation and retrieve the agreement's own document for direct reading if available;
never remove the id to get an answer from other agreements.

Tool arguments are strict: use the registered names and supported keys, without aliases
or copied response metadata. Preserve arbitrary merge-data keys inside `data`, where the
template's schema determines them.

Hosts namespace MCP tools differently. Match on the bare tool name above, whatever prefix
the host applies.

## Creating an agreement

`create_agreement` has three modes. Pick one and do not mix them.

**Document-based** — `name`, optional `recipients`, then `upload_document` for each file.
Use when the document is on disk or must be assembled first.

**Template-based** — `templateId` plus `templateRoles[]`, each entry
`{ roleName, name, email }`. `roleName` must match a role defined on the template.
Use when a Sign template already exists.

**Create-and-send** — inline `documents[]` plus `recipients[]` plus `status: "SENT"`.
This emails recipients immediately. Confirm before using it.

`type` sets signing order: `PARALLEL` (everyone at once) or `SEQUENTIAL` (in `order`).

## Status model

`CREATED` → `SENT` → `DELIVERED` → `IN_PROGRESS` → `COMPLETED`, with `DECLINED`,
`VOIDED` and `EXPIRED` as terminal exits.

Treat `CREATED` as the only status in which you add documents or annotations, or delete.
Once an agreement is `SENT` it can be voided, but not deleted.

`add_annotations` replaces the whole field set rather than merging into it, so it belongs
to the draft stage only. Place every field before `send_agreement`, and send the complete
set for every recipient in one call. To change fields on an agreement that has already gone
out, `void_agreement` and build a fresh draft — that is the supported correction path.

Full table in [references/status-model.md](references/status-model.md).

## Confirm before anything irreversible

`send_agreement`, `create_agreement` with `status: "SENT"`, `gen_and_send_agreement`,
`void_agreement` and `delete_agreement` either email real people or destroy data.

`add_annotations` emails nobody, so it is not on that list — but because it replaces the
whole field set rather than merging, treat any call that rewrites an existing set as
irreversible and confirm it the same way.

Before calling any of them, show the user:

- every recipient name and email
- every document name
- the signing order (`PARALLEL`, or the `SEQUENTIAL` sequence)
- what the call will do, in one line

Then wait for explicit approval. Do not treat an earlier approval in the conversation as
covering a changed recipient list, a changed document set or a second send.

## Errors

Read [references/errors.md](references/errors.md) for the triage table. In short:
a missing-scope error means re-consent with the scope named in
[references/scopes.md](references/scopes.md); a state error means check the agreement's
status before retrying. Read a `404` error code before diagnosing it: an unavailable
Locker document is different from a missing agreement or a wrong organization.

Every Propper API response carries an `x-request-id`. Quote it when reporting a failure.

## Not legal advice

Propper skills extract facts, place fields and route documents. They do not assess legal
risk, materiality or signing authority. Surface what a document says and flag what looks
unresolved; leave the decision to a person. Do not tell a user a contract is safe to sign.

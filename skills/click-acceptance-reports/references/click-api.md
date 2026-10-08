# Click API reads used by the reports

Base URL `https://api.propper.ai`. Token from `POST https://auth.propper.ai/oauth2/token`
with `grant_type=client_credentials`, the client id and secret, and `scope=click:read`.
Send it as `Authorization: Bearer <token>`. A token lasts about an hour; reuse it rather
than minting one per call.

Every route below needs `click:read` and nothing more.

## Routes

| Read | Route |
|---|---|
| Templates | `GET /v1/click/templates` |
| Published versions of a template, newest first | `GET /v1/click/templates/{templateId}/versions` |
| What changed between two versions | `GET /v1/click/templates/{templateId}/versions/{fromVersionId}/diff/{toVersionId}` |
| Deployments | `GET /v1/click/deployments` |
| Revisions of a deployment, newest first | `GET /v1/click/deployments/{id}/revisions` |
| Acceptances, newest first | `GET /v1/click/acceptances?templateId=&deploymentId=&createdAfter=&createdBefore=` |
| One receipt and its evidence record | `GET /v1/click/receipts/{receiptId}` |
| Re-verify one receipt's evidence | `GET /v1/click/evidence/verify/receipt/{receiptId}` |
| Whether one signer accepted the major a deployment serves | `POST /v1/click/deployments/{id}/signer-status` with `{ "userRef": "..." }`, or `GET` with `?userRef=` |

The receipt id is the acceptance id.

## Pagination and rate limits

List routes take `page` (from 1) and `limit` (1 to 100) and return
`pagination: { total, page, limit, hasMore }`. Read pages until `hasMore` is false;
`total` counts every match, not the page.

Responses carry `x-ratelimit-limit`, `x-ratelimit-remaining` and `x-ratelimit-reset`
(epoch seconds). On `429`, wait for `Retry-After` or the reset, then retry. Keep
concurrency low: four requests in flight is plenty.

Every response carries `x-request-id`. Quote it when reporting a failure.

## Fields the reports read

**Version** row: `id`, `version` (`MAJOR.MINOR.PATCH`), `major`, `level`, `label`,
`publishedAt`.

**Deployment** row: `id`, `templateId`, `environment` (`PRODUCTION`, `STAGING`,
`DEVELOPMENT`), `versionId` (the version it serves), `active`.

**Revision** row: `number`, `kind` (`CREATED`, `FOLLOWED`, `MOVED`, `SETTINGS`, `ROLLBACK`),
`version.number`, `reason`, `createdAt`.

**Acceptance** row: `id`, `receiptId`, `templateId`, `templateVersionId`, `deploymentId`,
`timestamp` (completion time, or start time if it never completed), `userRef`,
`consentMethod`, `locale`, `environment`.

**Receipt** (`data`): `evidenceStatus` (`pending`, `complete`, `failed`) and `evidence`,
whose `userRef`, `versionId` and `metadata.versionNumber` identify the signer and the
version served.

**Verification**: `valid`, `evidenceStatus`, `checks` and `environmentChecks`, each check
`{ valid, status, message }` with `status` one of `pass`, `fail`, `not_verifiable`,
`not_issued`, `not_applicable`; plus `errors`, `warnings` and `isTestEvidence`. `valid:
false` means only that the evidence failed verification. An id outside the organization
is a `404`, never a verification result.

## Version and signer for each acceptance

Read each from the acceptance row first, and from the receipt when the row lacks it:

| Value | Row | Receipt fallback |
|---|---|---|
| Version | `templateVersionId`, resolved through the template's versions | `evidence.metadata.versionNumber`, else `evidence.versionId` resolved the same way |
| Signer | `userRef` | `evidence.userRef` |

An acceptance with neither has no recorded signer. Count it; never attribute it to anyone.

## Re-acceptance

For a deployment serving major M (or the major of a version the user names), a signer
has re-accepted when any acceptance of the same template, through any deployment in the
same environment, is on major M. A signer still owes re-acceptance when they accepted
another major through this deployment and have no acceptance on M.

## Signer status

The signer-status route answers per signer: `status` is `current` or `stale`, with
`accepted` (their acceptance) and `served` (what the deployment serves). Send the signer
reference in a `POST` body. Where `POST` is not accepted, the route answers `GET` with
`?userRef=`, and a signer with no acceptance there answers `404` with
`CLICK_SIGNER_NOT_FOUND`. Treat that as "never accepted", not as an error. Use the route
to confirm individual signers, not to discover them: it needs a signer reference to ask
about.

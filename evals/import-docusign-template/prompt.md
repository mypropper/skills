---
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

We're looking at moving off DocuSign. Here's one of our exported templates — what would
actually carry over and what would we have to rebuild?

```json
{
  "templateId": "8f2c41ba-77d0-4e55-9a31-6b0e2d4c9a17",
  "name": "Vendor Onboarding Packet",
  "description": "Standard vendor onboarding agreement with W-9 attachment.",
  "shared": "true",
  "documents": [
    { "documentId": "1", "name": "Vendor Agreement.pdf", "order": "1", "pages": "4" },
    { "documentId": "2", "name": "W-9 Request.pdf", "order": "2", "pages": "1" }
  ],
  "recipients": {
    "signers": [
      {
        "recipientId": "1",
        "roleName": "Vendor",
        "routingOrder": "1",
        "tabs": {
          "signHereTabs": [
            { "documentId": "1", "pageNumber": "4", "recipientId": "1", "tabLabel": "VendorSignature", "anchorString": "Vendor Signature", "anchorXOffset": "0", "anchorYOffset": "-20", "anchorUnits": "pixels" }
          ],
          "dateSignedTabs": [
            { "documentId": "1", "pageNumber": "4", "recipientId": "1", "tabLabel": "VendorDate", "xPosition": "320", "yPosition": "648" }
          ],
          "textTabs": [
            { "documentId": "1", "pageNumber": "1", "recipientId": "1", "tabLabel": "LegalEntityName", "required": "true", "xPosition": "90", "yPosition": "240", "width": "220", "height": "22" },
            { "documentId": "2", "pageNumber": "1", "recipientId": "1", "tabLabel": "TaxID", "required": "true", "xPosition": "90", "yPosition": "300", "width": "160", "height": "22" }
          ],
          "checkboxTabs": [
            { "documentId": "1", "pageNumber": "2", "recipientId": "1", "tabLabel": "AcceptsACH", "required": "false", "xPosition": "72", "yPosition": "410" }
          ],
          "listTabs": [
            { "documentId": "1", "pageNumber": "1", "recipientId": "1", "tabLabel": "VendorCategory", "required": "true", "xPosition": "90", "yPosition": "360",
              "listItems": [
                { "text": "Goods", "value": "goods" },
                { "text": "Services", "value": "services" },
                { "text": "Both", "value": "both" }
              ] }
          ],
          "noteTabs": [
            { "documentId": "1", "pageNumber": "1", "tabLabel": "ReviewInstructions", "value": "Keep a copy for your records.", "xPosition": "72", "yPosition": "120" }
          ],
          "emailTabs": [
            { "documentId": "1", "pageNumber": "1", "tabLabel": "ContactEmail", "xPosition": "90", "yPosition": "390" }
          ],
          "drawTabs": [
            { "documentId": "1", "pageNumber": "2", "tabLabel": "SiteSketch", "xPosition": "72", "yPosition": "450", "width": "200", "height": "100" }
          ],
          "approveTabs": [
            { "documentId": "1", "pageNumber": "4", "recipientId": "1", "tabLabel": "VendorApprove", "xPosition": "420", "yPosition": "700" }
          ],
          "formulaTabs": [
            { "documentId": "1", "pageNumber": "3", "recipientId": "1", "tabLabel": "TotalAnnualSpend", "formula": "[UnitPrice] * [AnnualUnits]", "xPosition": "400", "yPosition": "500" }
          ]
        }
      },
      {
        "recipientId": "2",
        "roleName": "Procurement Approver",
        "routingOrder": "2",
        "tabs": {
          "signHereTabs": [
            { "documentId": "1", "pageNumber": "4", "recipientId": "2", "tabLabel": "ApproverSignature", "anchorString": "Procurement Approval", "anchorXOffset": "0", "anchorYOffset": "-20", "anchorUnits": "pixels" }
          ],
          "textTabs": [
            { "documentId": "1", "pageNumber": "4", "recipientId": "2", "tabLabel": "ApproverNotes", "required": "false", "conditionalParentLabel": "AcceptsACH", "conditionalParentValue": "on", "xPosition": "90", "yPosition": "560", "width": "400", "height": "60" }
          ]
        }
      }
    ],
    "carbonCopies": [
      { "recipientId": "3", "roleName": "AP Mailbox", "routingOrder": "3" }
    ]
  }
}
```

For later import verification, explain how to use structured issues and legacy warnings
without double-counting messages, and whether export_template can verify a draw field and
the signer role names. Do not perform an import or send.

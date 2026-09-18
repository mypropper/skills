---
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

I'm checking a Propper sending plan; do not send anything. Our saved native HTML template
has no linkedSignTemplateId. Its two signer slots are Buyer (order 1) and Seller (order 2),
with a signature field bound to each. The recipients payload I was given lists Seller
first and Buyer second, both with the matching roleName. Does this template have to be
imported before gen_and_send_agreement works, and does the array order reverse who signs
first? How would this differ for an imported template whose signer roles share one routing
order? What should we do if a later attempt returns TEMPLATE_HAS_NO_SIGNER_FIELDS or field
placement fails? Describe the checks before any email goes out.

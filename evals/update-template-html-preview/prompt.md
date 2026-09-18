---
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

Help me plan a Propper template edit; do not call the API. The template I read is an
HTML_MDX template with id <template-id>, templateType CUSTOM, version 3, settings containing
import metadata, and templateContent "<p>Hello {{customer.name}}</p>". I only want to change
the content to "<p>Welcome {{customer.name}}</p>" and add changeLog "Greeting update".
Should I submit the whole read response to update_gen_template? Show the supported argument
shape, then how to review the rendered HTML using docgen:write (my connection has no
separate preview scope). Also explain how the review path differs for a Word template.
Use merge data {"customer":{"name":"Harbor Example LLC"}}.

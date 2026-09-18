// The starter templates use merge paths, if/else and each/else. Reject other
// syntax explicitly so a new helper cannot silently evade these checks.
function parse(content) {
  const root = { children: [] };
  const stack = [{ node: root, children: root.children }];
  let position = 0;
  const text = (value) => {
    if (/{{|}}/.test(value)) throw new Error("unclosed merge expression");
    stack.at(-1).children.push({ type: "text", value });
  };
  for (const match of content.matchAll(/{{{([\s\S]*?)}}}|{{([\s\S]*?)}}/g)) {
    text(content.slice(position, match.index));
    position = match.index + match[0].length;
    const expression = (match[1] ?? match[2]).trim();
    if (expression.startsWith("!")) continue;
    if (expression.startsWith("/")) {
      if (stack.length === 1 || stack.at(-1).node.type !== expression.slice(1)) {
        throw new Error(`unbalanced block {{${expression}}}`);
      }
      stack.pop();
    } else if (expression === "else") {
      const frame = stack.at(-1);
      if (stack.length === 1 || frame.node.otherwise) throw new Error("unexpected {{else}}");
      frame.node.otherwise = [];
      frame.children = frame.node.otherwise;
    } else {
      const block = expression.match(/^#(if|each)\s+(\S+)$/);
      const reference = block ? block[2] : expression;
      if (!/^(?:(?:\.\.\/)*|@root\.)(?:this|[A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*)*$/.test(reference)) {
        throw new Error(`unsupported merge expression {{${expression}}}`);
      }
      const node = { type: block?.[1] ?? "value", reference, raw: match[1] !== undefined, children: [] };
      stack.at(-1).children.push(node);
      if (block) stack.push({ node, children: node.children });
    }
  }
  text(content.slice(position));
  if (stack.length !== 1) throw new Error(`unclosed {{#${stack.at(-1).node.type}}} block`);
  return root.children;
}

function locate(reference, frames) {
  let index = frames.length - 1;
  if (reference.startsWith("@root.")) {
    index = 0;
    reference = reference.slice(6);
  }
  while (reference.startsWith("../")) {
    index -= 1;
    reference = reference.slice(3);
  }
  const keys = reference.split(".");
  if (keys[0] === "this") keys.shift();
  return { frame: frames[index], keys };
}

function sample(schema) {
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return schema.enum[0];
  if (schema.type === "object") return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, value]) => [key, sample(value)]));
  if (schema.type === "array") return [sample(schema.items ?? {})];
  if (schema.type === "boolean") return true;
  if (["number", "integer"].includes(schema.type)) return 1;
  return schema.format === "date" ? "2026-01-01" : "Example value";
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

function render(nodes, frames, conditions) {
  return nodes.map((node) => {
    if (node.type === "text") return node.value;
    const { frame, keys } = locate(node.reference, frames);
    const value = keys.reduce((object, key) => object?.[key], frame);
    if (node.type === "value") return node.raw ? String(value ?? "") : escapeHtml(value);
    if (node.type === "if") {
      const enabled = conditions[node.path] ?? (Array.isArray(value) ? value.length > 0 : Boolean(value));
      return render(enabled ? node.children : (node.otherwise ?? []), frames, conditions);
    }
    return value?.length
      ? value.map((item) => render(node.children, [...frames, item], conditions)).join("")
      : render(node.otherwise ?? [], frames, conditions);
  }).join("");
}

export function checkTemplate(template, exampleData = {}) {
  const errors = [];
  const variants = [];
  if (typeof template?.templateContent !== "string" || template?.dataSchema?.type !== "object") {
    return { errors: ["genTemplate requires templateContent and an object dataSchema"], variants };
  }
  let nodes;
  try {
    nodes = parse(template.templateContent);
  } catch (error) {
    return { errors: [error.message], variants };
  }
  const used = new Set();
  const conditions = new Set();
  function inspect(children, frames) {
    for (const node of children) {
      if (node.type === "text") continue;
      const { frame, keys } = locate(node.reference, frames);
      let schema = frame?.schema;
      let path = frame?.path ?? "";
      for (const key of keys) {
        schema = schema?.properties?.[key];
        path = path ? `${path}.${key}` : key;
      }
      if (!schema) {
        errors.push(`undeclared merge field "${node.reference}" (${path})`);
        continue;
      }
      node.path = path;
      used.add(path);
      if (node.type === "if") conditions.add(path);
      if (node.type === "each" && schema.type !== "array") {
        errors.push(`{{#each ${node.reference}}} requires an array in dataSchema`);
        continue;
      }
      inspect(node.children, node.type === "each" ? [...frames, { schema: schema.items, path: `${path}[]` }] : frames);
      inspect(node.otherwise ?? [], frames);
    }
  }
  inspect(nodes, [{ schema: template.dataSchema, path: "" }]);

  function checkUsage(schema, prefix = "") {
    for (const [key, child] of Object.entries(schema?.properties ?? {})) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (![...used].some((field) => field === path || field.startsWith(`${path}.`) || field.startsWith(`${path}[]`))) {
        errors.push(`unused dataSchema property "${path}"`);
      }
      checkUsage(child.type === "array" ? child.items : child, child.type === "array" ? `${path}[]` : path);
    }
  }
  checkUsage(template.dataSchema);
  if (errors.length) return { errors, variants };

  const scenarios = [...conditions].reduce((previous, path) => previous.flatMap((scenario) => [
    { ...scenario, [path]: false }, { ...scenario, [path]: true },
  ]), [{}]);
  const data = { ...sample(template.dataSchema), ...template.defaultData, ...exampleData };
  for (const scenario of scenarios) {
    const html = render(nodes, [data], scenario);
    const numbers = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
      .map((match) => match[2].replace(/<[^>]*>/g, "").trim().match(/^(\d+)[.)]\s/))
      .filter(Boolean).map((match) => Number(match[1]));
    if (numbers.some((number, index) => number !== index + 1)) {
      errors.push(`non-contiguous section numbering (${numbers.join(", ")}) with optional clauses ${JSON.stringify(scenario)}`);
    }
    variants.push({ conditions: scenario, html });
  }
  return { errors, variants };
}

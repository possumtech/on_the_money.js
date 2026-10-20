import assert from "node:assert/strict";

// Execute the documented authoring path rather than a test-only implementation.
export default function contentExample(markdown) {
	const section = markdown
		.split("### Literal document content\n")[1]
		?.split(/\n#{1,3} /, 1)[0];
	assert.ok(section, "README must document literal document content");
	const html = section.match(/```html\n([\s\S]*?)```/)?.[1];
	const javascript = section.match(/```javascript\n([\s\S]*?)```/)?.[1];
	assert.ok(html, "content example must include its semantic HTML outlet");
	assert.ok(javascript, "content example must include its insertion code");
	return { html, javascript };
}

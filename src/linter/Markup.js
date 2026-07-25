import * as parse5 from "parse5";

export default class Markup {
	static source(file, source) {
		if (!file.endsWith(".ejs")) return source;
		return source.replace(/<%[\s\S]*?%>/g, (tag) =>
			tag.replace(/[^\r\n]/g, " "),
		);
	}

	static parse(file, source, options) {
		return parse5.parse(Markup.source(file, source), options);
	}
}

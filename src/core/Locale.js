export default class Locale {
	static compatible(left, right) {
		const a = new Intl.Locale(left).maximize();
		const b = new Intl.Locale(right).maximize();
		return a.language === b.language && a.script === b.script;
	}

	static chain(locale) {
		const full = new Intl.Locale(locale).baseName;
		const chain = [];
		let candidate = full;
		while (candidate) {
			// Lookup must not turn a script-specific request into another script.
			if (Locale.compatible(full, candidate)) chain.push(candidate);
			const end = candidate.lastIndexOf("-");
			candidate = end < 0 ? "" : candidate.slice(0, end);
		}
		return chain;
	}
}

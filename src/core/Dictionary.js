export default class Dictionary {
	static validate(value) {
		const isRecord = (item) =>
			item !== null && typeof item === "object" && !Array.isArray(item);
		if (!isRecord(value))
			throw new TypeError("i18n dictionary must be an object");
		for (const [key, entry] of Object.entries(value)) {
			if (typeof entry === "string") continue;
			if (
				isRecord(entry) &&
				Object.hasOwn(entry, "other") &&
				Object.keys(entry).every((form) =>
					["zero", "one", "two", "few", "many", "other"].includes(form),
				) &&
				Object.values(entry).every((form) => typeof form === "string")
			)
				continue;
			throw new TypeError(
				`i18n dictionary entry ${JSON.stringify(key)} must be a string or plural-form object of strings with an other form`,
			);
		}
		return value;
	}
}

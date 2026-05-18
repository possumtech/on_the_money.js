import { $, on, the } from "../../src/core/index.js";

const posts = [
	{
		id: "1",
		title: "Why state should live in the DOM",
		body: "Attributes are inspectable, searchable, and survive a refresh.",
		created_at: Date.now() - 86400000 * 3,
	},
	{
		id: "2",
		title: "Frameworks rot, conventions don't",
		body: "A small library of opinions tends to outlast a large library of code.",
		created_at: Date.now() - 86400000 * 2,
	},
	{
		id: "3",
		title: "The DOM is the database",
		body: "Single source of truth, no synchronization layer, zero glue code.",
		created_at: Date.now() - 86400000,
	},
];

const comments = new Map();

await the.boot({
	namespace: "blog",
	locales: "./locales",
});

const langSelect = $("#lang-select");
langSelect.value = the.locale.split("-")[0];

const renderPostList = () => {
	const list = $("#post-list");
	list.replaceChildren();
	for (const post of posts) {
		const el = $.clone("#post-list", "#post-list-item");
		the(el, "title", post.title);
		$(el, "a").setAttribute("href", `#/post/${post.id}`);
	}
	$('[data-i18n="post_count"]').setAttribute("data-i18n-qty", posts.length);
	the.t();
};

const renderPostView = (id) => {
	const post = posts.find((p) => p.id === id);
	if (!post) {
		window.location.hash = "#/";
		return;
	}
	the("post", post.id);
	the($("#post-view"), { title: post.title, body: post.body });
	$('#post-view [data-i18n="posted_at"]').setAttribute(
		"data-i18n-val",
		post.created_at,
	);
	const list = $("#comments-list");
	list.replaceChildren();
	const postComments = comments.get(id) || [];
	for (const text of postComments) {
		const el = $.clone("#comments-list", "#comment-item");
		the(el, "text", text);
	}
	$('#post-view [data-i18n="comments_count"]').setAttribute(
		"data-i18n-qty",
		postComments.length,
	);
	the.t();
};

the.route((_pathname, _search, hash) => {
	const route = hash || "#/";
	if (route === "#/") {
		the("page", "home");
		renderPostList();
	} else if (route === "#/about") {
		the("page", "about");
	} else if (route.startsWith("#/post/")) {
		the("page", "post");
		renderPostView(route.slice("#/post/".length));
	}
});

on("#comment-form", "submit", (e) => {
	e.preventDefault();
	const { text } = the.form(e.target);
	if (!text?.trim()) return;
	const id = the("post");
	const list = comments.get(id) || [];
	list.push(text.trim());
	comments.set(id, list);
	e.target.reset();
	renderPostView(id);
});

on(document.body, "change", "#lang-select", async (_e, select) => {
	const lang = select.value;
	the.locale = lang;
	const res = await fetch(`./locales/${lang}.json`);
	the.dictionary = await res.json();
	the.t();
});

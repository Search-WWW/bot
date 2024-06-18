'use strict';

import { getInfo } from './getInfo.mjs';
import { globalHeaders, config } from './global.mjs';
import { matchRobots } from './robots.mjs';
import { httpHeaderParse } from './httpHeaderParse.mjs';
import { XMLParser } from 'fast-xml-parser';

let crawlQueue = config.bot.crawlStart;
let crawled = {};
let failed = [];
let linkCount = 0;
for (let site of crawlQueue) {
    crawled[site] = { points: 1000 };
}

const headers = new Headers(globalHeaders);
const fetchOptions = {
    headers: headers
};

const parserOptions = {
    allowBooleanAttributes: true,
    alwaysCreateTextNode: true,
    atributesNamePrefix: "@_",
    htmlEntities: true,
    ignoreDeclaration: true,
    ignorePiTags: true,
    parseAttributeValue: true,
    parseTagValue: true,
    trimValues: true,
    ignoreAttributes: false,
    unpairedTags: ["hr", "br", "link", "meta"],
    stopNodes : [ "*.pre", "*.script"],
    processEntities: true,
    htmlEntities: true,
    isArray: (name, jpath, isLeafNode, isAttribute) => {
	if (isAttribute) return false;
	if (name === "html" || name === "head" || name === "body") return false;
	if (name === "meta" || name === "link") return true;
	if (jpath.startsWith("html.body")) return true;
	return false;
    }
};
const parser = new XMLParser(parserOptions);

function getTag(tags, data) {
    if (typeof tags === "string") tags = [ tags ];
    let result = {};

    for (let tag of tags) {
	result[tag] = [];

	if (((data ?? {})[tag] ?? []).length > 0) {
	    for (let value of data[tag]) {
		result[tag].push(value);
	    }
	}
    }

    for (let elems in data) {
	if (elems.startsWith("@_") || elems === "#text" || elems === "script" || elems === "style" || elems === "hr" || elems === "br") continue;
	for (let elem of data[elems]) {
	    try {
		const addRes = getTag(tags, elem);
		for (let tag of tags) {
		    for (let i of addRes[tag]) {
			result[tag].push(i);
		    }
		}
	    } catch (err) {
		console.error(err.message);
	    }
	}
    }

    return result;
}

while (crawlQueue.length > 0) {
    linkCount++;
    const site = crawlQueue.shift();
    const siteUrl = new URL(site);
    console.log(`#${linkCount}: ${site}`);
    
    let info;
    try {
	info = await getInfo(site);
    } catch (err) {
	console.error(err.message);
	failed.push(site);
	continue;
    }

    let isDisallowed = false;
    for (let disallowedSite of info.disallow) {
	if (!matchRobots(disallowedSite, site)) continue;

	let isAllowed = false;
	for (let allowedSite of info.allow) {
	    if (matchRobots(allowedSite, site) && allowedSite.length > disallowedSite.length) {
		isAllowed = true;
		break;
	    };
	}

	if (!isAllowed) isDisallowed = true;
	else isDisallowed = false;
    }

    if (isDisallowed) continue;

    let res;
    try {
	res = await fetch(site, fetchOptions);
	
	if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
	
	const contentType = httpHeaderParse(res.headers.get("Content-Type") ?? "");
	if (contentType[contentType.length - 1][0] !== "text/html") {
	    console.error("A non-HTML document");
	    failed.push(site);
	    continue;
	};
    } catch (err) {
	console.error(err.message);
	failed.push(site);
	continue;
    }

    let content;
    try {
	content = parser.parse(await res.text());
    } catch (err) {
	console.error(err.message);
	failed.push(site);
	continue;
    }

    crawled[site] = crawled[site] ?? { points: 0 }
    let metadata = crawled[site];
    metadata.keywords = metadata.keywords ?? [];
    metadata.author = metadata.author ?? { name: "", link: "" };
    metadata.creators = metadata.creators ?? [];

    let index = true;
    let follow = true;

    if (content.html !== undefined) {
	if (content.html.head !== undefined) {
	    metadata.title = (content.html.head.title ?? {"#text": ""})["#text"] ?? "";
	    for (let meta of content.html.head.meta ?? []) {
		const name = (meta["@_name"] ?? "").toString().toLowerCase();
		const content = (meta["@_content"] ?? "").toString();
		
		switch (name) {
		case 'author':
		    metadata.author.name = content;
		    break;
		case 'description':
		    metadata.description = content;
		    break;
		case 'keywords':
		    for (let keyword of content.split(",")) {
			metadata.keywords.push(keyword.trim());
		    }
		    break;
		case 'creator':
		    metadata.creator.push(content);
		    break;
		case 'publisher':
		    metadata.publisher = content;
		    break;
		case 'robots':
		    for (let value of content.split(",")) {
			switch (value.trim().toLowerCase()) {
			case 'index':
			    index = true;
			    break;
			case 'noindex':
			    index = false;
			    break;
			case 'follow':
			    follow = true;
			    break;
			case 'nofollow':
			    follow = false;
			    break;
			case 'all':
			    index = true;
			    follow = true;
			    break;
			case 'none':
			    index = false;
			    follow = false;
			    break;
			default:
			    break;
			}
		    }
		    break;
		default:
		    break;
		}
	    }
	    if (!index) continue;
	    for (let link of content.html.head.link ?? []) {
		const name = (link["@_rel"] ?? "").toString().trim().toLowerCase();
		const content = (link["@_href"] ?? "").toString();
		
		switch (name) {
		case 'made':
		    // pass
		case 'author':
		    metadata.author.link = (new URL(content, site)).href;
		    break;
		case 'icon':
		    metadata.icon = (new URL(content, site)).href;
		    break;
		case 'license':
		    metadata.license = (new URL(content, site)).href;
		    break;
		case 'privacy-policy':
		    metadata.privacyPolicy = (new URL(content, site)).href;
		    break;
		case 'terms-of-service':
		    metadata.termsOfService = (new URL(content, site)).href;
		    break;
		case 'img_src':
		    metadata.image = (new URL(content, site)).href;
		    break;
		default:
		    break;
		}
	    }
	}
	metadata.language = content.html["@_lang"];

	if (content.html.body !== undefined) {
	    let links = [];
	    for (let link of getTag("a", content.html.body).a ?? []) {
		const linkUrl = new URL(link["@_href"], site);
		
		let skip = false;

		linkUrl.search = "";
		linkUrl.hash = "";
		
		for (let rel of (link["@_rel"] ?? "").split(" ")) {
		    switch (rel.trim().toLowerCase()) {
		    case 'nofollow':
			skip = true;
			break;
		    default:
			break;
		    }
		}

		if (linkUrl.protocol !== "https:" && linkUrl.protocol !== "http:") continue;

		if (!skip) links.push(linkUrl.href);

		for (let futLink of crawlQueue) {
		    const futLinkUrl = new URL(futLink);
		    if (futLinkUrl.href === linkUrl.href) {
			skip = true;
			break;
		    }
		}
		for (let exLink in crawled) {
		    const exLinkUrl = new URL(exLink);
		    if (exLinkUrl.href === linkUrl.href) {
			skip = true;
			break;
		    }
		}
		for (let failLink of failed) {
		    const failLinkUrl = new URL(failLink);
		    if (failLinkUrl.href === linkUrl.href) {
			skip = true;
			break;
		    }
		}
		
		if (skip) continue;

		crawlQueue.push(linkUrl.href);
	    }

	    const linkPoints = metadata.points / links.length;
	    for (let link of links) {
		const linkUrl = new URL(link["@_href"], site);
		
		crawled[link] = crawled[link] ?? {};
		crawled[link].points = typeof crawled[link].points === "number" ? crawled[link].points : 0;
		crawled[link].points += Math.min(linkPoints * (siteUrl.origin === linkUrl.origin ? 2 : 1), metadata.points);
	    }
	    
	    const rawTexts = getTag([
		"b",
		"strong",
		"i",
		"em",
		"mark",
		"small",
		"del",
		"ins",
		"sub",
		"sup",
		"p",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"a"
	    ], content.html.body);
	    for (let elem in rawTexts) {
		for (let text of rawTexts[elem]) {
		    if (text["#text"] === undefined) continue;
		    text = (text["#text"] ?? "").toString().trim();
		    metadata.text += " " + text;
		}
	    }

	    metadata.text = (metadata.text ?? "").toString().replace(/\s+/g, " ");
	}
    }

    if (index) crawled[site] = metadata
    else failed.push(site);

    console.log(metadata);
}

console.log(linkCount);

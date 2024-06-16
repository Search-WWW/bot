'use strict';

import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";
import { URL } from "node:url";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import { globalHeaders } from "./global.mjs";
import { httpHeaderParse } from './httpHeaderParse.mjs';

const doGunzip = promisify(gunzip);

const alwaysArray = [
    "sitemapindex.sitemap",
    "sitemapindex.sitemap.xhtml:link",
    "urlset.url",
    "urlset.url.xhtml:link",
    "channel.item",
    "feed.entry"
];
const parserOpts = {
    ignoreAttributes: false,
    allowBooleanAttributes: true,
    attributeNamePrefix: "@_",
    isArray: (name, jpath, isLeafNode, isAttribute) => { return ((alwaysArray.indexOf(jpath) !== -1) ? true : false); }
};
const parser = new XMLParser(parserOpts);

function parseSitemap(text, type) {
    let result = [];
    
    switch (type) {
    case 'index':
	if (text.sitemapindex.sitemap.length > 50000) {
	    throw new RangeError("Sitemap is too large.");
	}
	for (let sitemap of text.sitemapindex.sitemap) {
	    let tempRes = {
		url: sitemap.loc,
		lastModified: sitemap.lastmod !== undefined ? Date.parse(sitemap.lastmod) : undefined,
		languages: {}
	    };
	    if (sitemap["xhtml:link"]) {
		for (let lang of sitemap["xhtml:link"]) {
		    tempRes.languages[lang["@_hreflang"]] = lang["@_href"];
		}
	    }
	    result.push(tempRes);
	}
	break;
    case 'xml':
	if (text.urlset.url.length > 50000) {
	    throw new RangeError("Sitemap is too large.");
	}
	for (let url of text.urlset.url) {
	    let tempRes = {
		url: url.loc,
		lastModified: url.lastmod !== undefined ? Date.parse(url.lastmod) : undefined,
		changeFrequency: url.changefreq !== undefined ? url.changefreq : undefined,
		priority: url.priority !== undefined ? url.priority : undefined,
		languages: {}
	    };
	    if (url["xhtml:link"]) {
		for (let lang of url["xhtml:link"]) {
		    tempRes.languages[lang["@_hreflang"]] = lang["@_href"];
		}
	    }
	    result.push(tempRes);
	}
	break;
    case 'rss':
	for (let item of text.channel.item) {
	    result.push({
		url: item.link,
		lastModified: item.pubdate !== undefined ? Date.parse(item.pubdate) : undefined
	    });
	}
	break;
    case 'atom':
	for (let entry of text.feed.entry) {
	    if (entry.link === undefined) {
		continue;
	    }
	    
	    result.push({
		url: entry.link,
		lastModified: Date.parse(entry.updated)
	    });
	}
	break;
    case 'text':
	for (let line of text.split("\n")) {
	    line = line.trim();

	    if (line !== "") {
		result.push({
		    url: line
		});
	    }
	}
	break;
    }

    return result;
}

async function getSitemap(url) {
    try {
	const headers = new Headers(globalHeaders);
	const options = {
	    headers: headers
	};
	
	const res = await fetch(url.href, options);

	const params = httpHeaderParse(res.headers.get("Content-Type") ?? "");
	const contentType = params[params.length - 1][0] ?? "application/xml";
	let charset = "utf-8";
	for (let line of params) {
	    for (let param of line) {
		if (param[0] === "charset" && param[1] !== undefined) charset = param[1];
	    }
	}

	let sitemap;
	let sitemapType;
	switch (contentType) {
	case 'application/gzip':
	    // pass
	case 'application/x-gzip':
	    const dec = new TextDecoder(charset);
	    sitemap = dec.decode(await doGunzip(await res.arrayBuffer()));
	    // pass
	case 'application/xml':
	    // pass
	case 'text/xml':
	    sitemap = sitemap !== undefined ? sitemap : await res.text();
	    
	    if (Buffer.byteLength(sitemap, charset) > 52428800) {
		throw new RangeError("Sitemap is too large.");
	    }
	    
	    sitemap = parser.parse(sitemap);
	    
	    if (sitemap.sitemapindex !== undefined) {
		sitemapType = "index";
	    } else if (sitemap.urlset !== undefined) {
		sitemapType = "xml";
	    } else if (sitemap.rss !== undefined) {
		sitemapType = "rss";
	    } else if (sitemap.feed !== undefined) {
		sitemapType = "atom";
	    } else {
		throw new RangeError("Unknown XML sitemap format");
	    }
	    
	    break;
	case 'text/plain':
	    sitemap = await res.text();
	    sitemapType = "text";
	    break;
	default:
	    throw new RangeError(`Unknown Content-Type "${contentType}"`);
	}

	let result = parseSitemap(sitemap, sitemapType);
	if (sitemapType === "index") {
	    for (let i = 0; i < result.length; i++) {
		result[i].content = await getSitemap(new URL(result[i].url));
	    }
	}
	result = sitemapBadUrls(url, result);
	return sitemapType === "index" ? getIndexContent(result) : result;
    } catch (err) {
	throw err;
    }
}

function sitemapBadUrls(url, sitemap) {
    let result = [];
    
    const siteBaseUrl = url.origin + dirname(url.pathname);
    for (let entry of sitemap) {
	const url = new URL(entry.url);
	
	const entryBaseUrl = url.origin + dirname(url.pathname);
	if (entryBaseUrl.startsWith(siteBaseUrl)) {
	    if (entry.content !== undefined) {
		entry.content = sitemapBadUrls(url, entry.content);
	    }
	    result.push(entry);
	} else {
	    // console.error(`Site-Wide base URL: ${siteBaseUrl}\nEntry base URL: ${entryBaseUrl}`);
	}
    }

    return result;
}

function getIndexContent(index) {
    let result = [];

    for (let sitemap of index) {
	for (let entry of sitemap.content) {
	    result.push(entry instanceof Array ? getIndexContent(entry) : entry);
	}
    }

    return result;
}

// console.log(await getSitemap(new URL("http://www.gnu.org/sitemap.xml")));

export { getIndexContent, sitemapBadUrls, getSitemap, parseSitemap };

import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";
import { URL } from "node:url";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import { globalHeaders } from "./global.mjs";
import { httpHeaderParse, parsedHTTPHeaders } from './httpHeaderParse.mjs';

type sitemapType = "index" | "xml" | "rss" | "atom" | "text";
interface parsedSitemapEntry {
  url : string,
  lastModified? : number | undefined,
  changeFrequency? : "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never" | undefined,
  priority? : number,
  languages? : Map<string, string>,
  content? : Array<parsedSitemapEntry>
};
type parsedSitemap = Array<parsedSitemapEntry>;

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
  isArray: (name : string, jpath : string, isLeafNode : boolean, isAttribute : boolean) : boolean => { return ((alwaysArray.indexOf(jpath) !== -1) ? true : false); }
};
const parser : XMLParser = new XMLParser(parserOpts);

function parseSitemapIndex(rawObject : {
  [key : string] : any
}) : parsedSitemap {
  let result : parsedSitemap = [];
  
  if (rawObject.sitemapindex.sitemap.length > 50000) {
    throw new RangeError("Sitemap is too large.");
  }
  for (let sitemap of rawObject.sitemapindex.sitemap) {
    let tempRes : parsedSitemapEntry = {
      url: sitemap.loc,
      lastModified: sitemap.lastmod !== undefined ? Date.parse(sitemap.lastmod) : undefined
    };
    if (sitemap["xhtml:link"]) {
      tempRes.languages = new Map<string, string>();
      for (let lang of sitemap["xhtml:link"]) {
	tempRes.languages.set(lang["@_hreflang"], lang["@_href"]);
      }
    }
    result.push(tempRes);
  }
  
  return result;
}
function parseXmlSitemap (rawObject : {
  [key : string] : any
}) : parsedSitemap {
  let result : parsedSitemap = [];

  if (rawObject.urlset.url.length > 50000) {
    throw new RangeError("Sitemap is too large.");
  }
  for (let url of rawObject.urlset.url) {
    let tempRes : parsedSitemapEntry = {
      url: url.loc,
      lastModified: url.lastmod !== undefined ? Date.parse(url.lastmod) : undefined,
      changeFrequency: url.changefreq !== undefined ? url.changefreq : undefined,
      priority: url.priority !== undefined ? url.priority : undefined
    };
    if (url["xhtml:link"]) {
      tempRes.languages = new Map<string, string>();
      for (let lang of url["xhtml:link"]) {
	tempRes.languages.set(lang["@_hreflang"], lang["@_href"]);
      }
    }
    result.push(tempRes);
  }
  
  return result;
}
function parseRssSitemap (rawObject : {
  [key : string] : any
}) : parsedSitemap {
  let result : parsedSitemap = [];

  if (rawObject.channel.entry.length > 50000) {
    throw new RangeError("Sitemap is too large.");
  }
  for (let item of rawObject.channel.item) {
    result.push({
      url: item.link,
      lastModified: item.pubdate !== undefined ? Date.parse(item.pubdate) : undefined
    });
  }

  return result;
}
function parseAtomSitemap (rawObject : {
  [key : string] : any
}) : parsedSitemap {
  let result : parsedSitemap = [];

  if (rawObject.feed.entry.length > 50000) {
    throw new RangeError("Sitemap is too large.");
  }
  for (let entry of rawObject.feed.entry) {
    if (entry.link === undefined) {
      continue;
    }
	    
    result.push({
      url: entry.link,
      lastModified: Date.parse(entry.updated)
    });
  }

  return result;
}
function parseTextSitemap (text : string) : parsedSitemap {
  let result : parsedSitemap = [];

  const lines = text.split("\n");
  if (lines.length > 50000) {
    throw new RangeError("Sitemap is too large.");
  }
  for (let line of lines) {
    line = line.trim();

    if (line !== "") {
      result.push({
	url: line
      });
    }
  }

  return result;
}

async function getSitemap(url : URL) : Promise<parsedSitemap> {
  try {
    const headers : Headers = new Headers(globalHeaders);
    const options = {
      headers: headers
    };
	
    const res = await fetch(url.href, options);

    const params : parsedHTTPHeaders = httpHeaderParse(res.headers.get("Content-Type") ?? "");
    const contentType = params[params.length - 1].mainParam ?? "application/xml";
    let charset : BufferEncoding = "utf-8";
    for (let line of params) {
      if (line.params.has("charset")) switch (line.params.get("charset") ?? "") {
	case 'ascii':
	  charset = "ascii";
	  break;
	case 'utf8': // pass
	case 'utf-8':
	  charset = "utf8";
	  break;
	case 'utf16le':
	  charset = "ascii";
	  break;
	case 'ucs2': // pass
	case 'ucs-2':
	  charset = "ucs2";
	  break;
	case 'base64':
	  charset = "base64";
	  break;
	case 'latin1':
	  charset = "ascii";
	  break;
	case 'binary':
	  charset = "binary";
	  break;
	case 'hex':
	  charset = "hex";
	  break;
      };
    }

    let result : parsedSitemap;

    let sitemap : {
      [key : string] : any
    };
    let rawSitemap : string = "";
    switch (contentType) {
      case 'application/gzip':
	    // pass
      case 'application/x-gzip':
	const dec = new TextDecoder(charset);
	const compressed : ArrayBuffer = await res.arrayBuffer();
	if (compressed.byteLength > 52428800) {
	  throw new RangeError("Sitemap is too large.");
	}
	rawSitemap = dec.decode(await doGunzip(compressed));
	    // pass
      case 'application/xml':
	    // pass
      case 'text/xml':
	rawSitemap = rawSitemap !== "" ? rawSitemap : await res.text();
	    
	if (Buffer.byteLength(rawSitemap, charset) > 52428800) {
	  throw new RangeError("Sitemap is too large.");
	}
	    
	sitemap = parser.parse(rawSitemap);
	    
	if (sitemap.sitemapindex !== undefined) {
	  result = parseSitemapIndex(sitemap);
	  for (let i = 0; i < result.length; i++) {
	    result[i].content = await getSitemap(new URL(result[i].url));
	  }
	  result = sitemapBadUrls(url, result);
	  result = getIndexContent(result);
	  return result;
	} else if (sitemap.urlset !== undefined) {
	  result = parseXmlSitemap(sitemap);
	} else if (sitemap.rss !== undefined) {
	  result = parseRssSitemap(sitemap);
	} else if (sitemap.feed !== undefined) {
	  result = parseAtomSitemap(sitemap);
	} else {
	  throw new RangeError("Unknown XML sitemap format");
	}
	    
	break;
      case 'text/plain':
	rawSitemap = await res.text();
	if (Buffer.byteLength(rawSitemap, charset) > 52428800) {
	  throw new RangeError("Sitemap is too large.");
	}
	result = parseTextSitemap(rawSitemap);
	break;
      default:
	throw new RangeError(`Unknown Content-Type "${contentType}"`);
    }

    result = sitemapBadUrls(url, result);
    return result;
  } catch (err) {
    throw err;
  }
}

function sitemapBadUrls(url : URL, sitemap : any) {
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

function getIndexContent(index : parsedSitemap) : parsedSitemap {
  let result : parsedSitemap = [];

  for (let sitemap of index) {
    for (let entry of sitemap.content ?? []) {
      if (entry instanceof Array) {
	for (let entry2 of getIndexContent(entry)) {
	  result.push(entry2);
	}
      } else result.push(entry);
    }
  }

  return result;
}

// console.log(await getSitemap(new URL("http://www.gnu.org/sitemap.xml")));

export { getIndexContent, sitemapBadUrls, getSitemap, parseSitemapIndex, parseXmlSitemap, parseRssSitemap, parseAtomSitemap, parseTextSitemap, sitemapType, parsedSitemapEntry, parsedSitemap };

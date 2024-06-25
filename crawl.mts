import { getInfo } from './getInfo.mjs';
import { globalHeaders, config } from './global.mjs';
import { matchRobots } from './robots.mjs';
import { httpHeaderParse } from './httpHeaderParse.mjs';
import { XMLParser, XMLValidator, X2jOptions } from 'fast-xml-parser';
import { Queue } from './queue.js';
import { URL } from 'node:url';

type optional<Type> = Type | undefined;
type overwriteOption = "old" | "new" | "merge";

interface Author {
  name? : optional<string>,
  link? : optional<URL>
}
interface SiteMetadata {
  title? : optional<string>,
  description? : optional<string>,
  icon? : optional<URL>,
  image? : optional<URL>,
  language? : optional<string>,
  author? : optional<Author>,
  creators? : optional<Array<string>>,
  publisher? : optional<string>,
  license? : optional<URL>,
  privacyPolicy? : optional<URL>,
  termsOfService? : optional<URL>,
  keywords? : optional<Array<string>>,
  text? : optional<string>,
  linkText? : optional<Array<string>>,
  points? : optional<number>,
  indexed? : optional<boolean>,
  failed? : optional<boolean>
}

class Site implements SiteMetadata {
  public title : string = "";
  public description : string = "";
  public icon : URL = new URL("file:///dev/null");
  public image : URL = new URL("file:///dev/null");
  public language : string = "";
  public author : Author = {
    name: "",
    link: new URL("file:///dev/null")
  };
  public creators : Array<string> = [];
  public publisher : string = "";
  public license : URL = new URL("file:///dev/null");
  public privacyPolicy : URL = new URL("file:///dev/null");
  public termsOfService : URL = new URL("file:///dev/null");
  public keywords : Array<string> = [];
  public text : string = "";
  public linkText : Array<string> = [];
  public points : number = 0;
  public indexed : boolean = true;
  public failed : boolean = false;

  constructor(oldMeta : SiteMetadata | undefined = undefined) {
    if (oldMeta === undefined) return;
    
    this.title = oldMeta.title ?? this.title;
    this.description = oldMeta.description ?? this.description;
    this.icon = oldMeta.icon ?? this.icon;
    this.image = oldMeta.image ?? this.image;
    this.language = oldMeta.language ?? this.language;
    this.author.name = (oldMeta.author ?? {}).name ?? this.author.name;
    this.author.link = (oldMeta.author ?? {}).link ?? this.author.link;
    for (let creator of oldMeta.creators ?? []) {
      this.creators.push(creator);
    }
    this.publisher = oldMeta.publisher ?? this.publisher;
    this.license = oldMeta.license ?? this.license;
    this.privacyPolicy = oldMeta.privacyPolicy ?? this.privacyPolicy;
    this.termsOfService = oldMeta.termsOfService ?? this.termsOfService;
    for (let keyword of oldMeta.keywords ?? []) {
      this.keywords.push(keyword);
    }
    this.text = oldMeta.text ?? this.text;
    for (let link of oldMeta.linkText ?? []) {
      this.linkText.push(link);
    }
    this.points = oldMeta.points ?? this.points;
    this.indexed = oldMeta.indexed ?? this.indexed;
    this.failed = oldMeta.failed ?? this.failed;
  }

  public Append(newMeta : SiteMetadata, options : {
    creators?: overwriteOption,
    keywords?: overwriteOption,
    linkText?: overwriteOption
  } | undefined = undefined) : SiteMetadata {
    let result : SiteMetadata = {};

    options = options ?? {};
    options.creators = options.creators ?? "merge";
    options.keywords = options.keywords ?? "merge";
    options.linkText = options.linkText ?? "merge";
    
    result.title = newMeta.title ?? this.title;
    result.description = newMeta.description ?? this.description;
    result.icon = newMeta.icon ?? this.icon;
    result.image = newMeta.image ?? this.image;
    result.language = newMeta.language ?? this.language;
    result.author = {};
    result.author.name = (newMeta.author ?? {}).name ?? this.author.name;
    result.author.link = (newMeta.author ?? {}).link ?? this.author.link;
    switch (options.creators) {
      case 'new':
	for (let creator of newMeta.creators ?? []) {
	  this.creators.push(creator);
	}
	break;
      case 'old':
	for (let creator of this.creators) {
	  this.creators.push(creator);
	}
	break;
      case 'merge':
	for (let creator of this.creators) {
	  this.creators.push(creator);
	}
	for (let creator of newMeta.creators ?? []) {
	  this.creators.push(creator);
	}
	break;
    }
    result.publisher = newMeta.publisher ?? this.publisher;
    result.license = newMeta.license ?? this.license;
    result.privacyPolicy = newMeta.privacyPolicy ?? this.privacyPolicy;
    result.termsOfService = newMeta.termsOfService ?? this.termsOfService;
    switch (options.keywords) {
      case 'new':
	for (let keyword of newMeta.keywords ?? []) {
	  this.keywords.push(keyword);
	}
	break;
      case 'old':
	for (let keyword of this.keywords) {
	  this.keywords.push(keyword);
	}
	break;
      case 'merge':
	for (let keyword of this.keywords) {
	  this.keywords.push(keyword);
	}
	for (let keyword of newMeta.keywords ?? []) {
	  this.keywords.push(keyword);
	}
	break;
    }
    result.text = newMeta.text ?? this.text;
    switch (options.linkText) {
      case 'new':
	for (let link of newMeta.linkText ?? []) {
	  this.linkText.push(link);
	}
	break;
      case 'old':
	for (let link of this.linkText) {
	  this.linkText.push(link);
	}
	break;
      case 'merge':
	for (let link of this.linkText) {
	  this.linkText.push(link);
	}
	for (let link of newMeta.linkText ?? []) {
	  this.linkText.push(link);
	}
	break;
    }
    result.points = newMeta.points ?? this.points;
    result.indexed = newMeta.indexed ?? this.indexed;
    result.failed = newMeta.failed ?? this.failed;

    return new Site(result);
  }
}

function parseHTML(content : {
  [key : string] : any
}, metadata : SiteMetadata, siteUrl : URL) : SiteMetadata {
  metadata.author = metadata.author ?? {};
  metadata.keywords = metadata.keywords ?? [];
  metadata.creators = metadata.creators ?? [];
  metadata.points = metadata.points ?? 0;

  let index = true;
  let follow = true;

  if (content.html !== undefined) {
    let links : Array<URL> = [];
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
	    metadata.creators.push(content);
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
      if (!index) {
	metadata.indexed = false;
	siteMeta.set(siteUrl, metadata);
      };
      for (let link of content.html.head.link ?? []) {
	const name : string = (link["@_rel"] ?? "").toString();
	const linkUrl : URL = sanitizeURL(new URL((link["@_href"] ?? "").toString().trim(), siteUrl.href));

	let follow : boolean = true;
		
	for (let param of name.split(" ")) {
	  switch (name.trim().toLowerCase()) {
	    case 'bookmark': // pass
	    case 'dns-prefetch': // pass
	    case 'manifest': // pass
	    case 'module-preload': // pass
	    case 'pingback': // pass
	    case 'preconnect': // pass
	    case 'prefetch': // pass
	    case 'preload': // pass
	    case 'prerender': // pass
	    case 'search': // pass
	    case 'stylesheet':
	      follow = false;
	      break;
	    case 'canonical':
	      if (linkUrl !== siteUrl) metadata.indexed = false;
	    case 'made': // pass
	    case 'author':
	      metadata.author.link = linkUrl;
	      break;
	    case 'icon':
	      follow = false;
	      metadata.icon = linkUrl;
	      break;
	    case 'license':
	      metadata.license = linkUrl;
	      break;
	    case 'privacy-policy':
	      metadata.privacyPolicy = linkUrl;
	      break;
	    case 'terms-of-service':
	      metadata.termsOfService = linkUrl;
	      break;
	    case 'img_src':
	      follow = false;
	      metadata.image = linkUrl;
	      break;
	    default:
	      break;
	  }
	}

	if (!follow) continue;

	links.push(linkUrl);
	addToQueue(linkUrl);
      }
    }
    metadata.language = content.html["@_lang"];

    if (content.html.body !== undefined) {
      if (follow) {
	let tags = getTag([
	  "a",
	  "area"
	], content.html.body);

	let allTags : Array<any> = [];

	for (let tag of tags) {
	  allTags = allTags.concat(tag);
	}
	
	for (let link of allTags) {
	  const name : string = (link["@_rel"] ?? "").toString();
	  const linkUrl : URL = sanitizeURL(new URL((link["@_href"] ?? "").toString().trim(), siteUrl.href));

	  const linkContent : string = (link["#text"] ?? "").toString().trim();
	  if (linkContent !== "") siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ linkText: [ linkContent ] }));
	  
	  let skip = false;
	  
	  for (let rel of name.split(" ")) {
	    switch (rel.trim().toLowerCase()) {
	      case 'bookmark': // pass
	      case 'nofollow':
		skip = true;
		break;
	      default:
		break;
	    }
	  }
		
	  if (skip) continue;
	    
	  links.push(linkUrl);
	  addToQueue(linkUrl);
	}
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
      for (let elem of rawTexts) {
	for (let tag of elem[1]) {
	  if (tag["@_hidden"] !== undefined) continue;
	  let text : string = (tag["#text"] ?? "").toString().trim();
	  if (text === "") continue;
	  metadata.text += text;
	}
      }

      metadata.text = (metadata.text ?? "").toString().replace(/\s+/g, " ");
    }
    
    const linkPoints = metadata.points / Math.max(links.length, 1);
    for (let linkUrl of links) {
      const isSameOrigin : boolean = siteUrl.origin === linkUrl.origin;

      const linkMeta = new Site(siteMeta.get(linkUrl));
      if (linkCount === 47) {
	console.log(`Shits going down: ${linkUrl.href}`);
      }
      siteMeta.set(linkUrl, linkMeta.Append({ points: linkMeta.points + Math.min((isSameOrigin ? (metadata.points / 10) : linkPoints), metadata.points) }));
    }
  }

  return metadata;
}

function parseXML(content : {
  [key : string] : any
}, metadata : SiteMetadata, siteUrl : URL) : SiteMetadata {
  metadata.author = metadata.author ?? {};
  metadata.keywords = metadata.keywords ?? [];
  metadata.creators = metadata.creators ?? [];
  metadata.points = metadata.points ?? 0;
  metadata.text = metadata.text ?? "";

  if (content.rss !== undefined) { // Really Simple Syndication
    const channel = content.rss.channel;
    switch (content.rss["@_version"]) {
      case '2.0':
	metadata.title = channel.title["#text"].trim();
	metadata.description = channel.description["#text"].trim();
	if (channel.language !== undefined) metadata.language = channel.language["#text"].trim();
	if (channel.image !== undefined) metadata.image = sanitizeURL(new URL(channel.image.url["#text"].trim()));

	addToQueue(new URL(channel.link["#text"].trim()));
	if (channel.docs !== undefined) addToQueue(new URL(channel.docs["#text"].trim()));

	for (let category of channel.category ?? []) {
	  metadata.keywords.push(category["#text"].trim());
	}

	for (let item of channel.item ?? []) {
	  if (item.title !== undefined) metadata.text += metadata.text.trim() === "" ? item.title["#text"].trim() : " " + item.title["#text"].trim();
	  if (item.description !== undefined) metadata.text += metadata.text.trim() === "" ? item.description["#text"].trim() : " " + item.description["#text"].trim();
	  
	  if (item.link !== undefined) addToQueue(new URL(item.link["#text"].trim(), siteUrl));
	}
	break;
      case '0.91': // pass, because all valid 0.91 RSS is also valid 0.92 RSS
      case '0.92':
	metadata.title = channel.title["#text"].trim();
	metadata.description = channel.description["#text"].trim();
	if (channel.language !== undefined) metadata.language = channel.language["#text"].trim();
	metadata.image = sanitizeURL(new URL(channel.image.url["#text"].trim()));

	addToQueue(new URL(channel.link["#text"].trim()));
	addToQueue(new URL(channel.image.link["#text"].trim()));
	if (channel.docs !== undefined) addToQueue(new URL(channel.docs["#text"].trim()));

	for (let item of channel.item ?? []) {
	  if (item.title !== undefined) metadata.text += metadata.text.trim() === "" ? item.title["#text"].trim() : " " + item.title["#text"].trim();
	  if (item.description !== undefined) metadata.text += metadata.text.trim() === "" ? item.description["#text"].trim() : " " + item.description["#text"].trim();

	  if (item.link !== undefined) addToQueue(new URL(item.link["#text"].trim(), siteUrl));
	}
	break;
      default:
	console.log(content.rss["@_version"]);
	throw new RangeError("Unknown version of RSS");
    }
  } else if (content.feed !== undefined) {
    const feed = content.feed;
    metadata.title = feed.title["#text"].trim();
    if (feed.author !== undefined) {
      const author = feed.author;
      metadata.author.name = author.name["#text"].trim();
      if (author.uri !== undefined) metadata.author.link = sanitizeURL(new URL(author.uri["#text"].trim(), siteUrl));
    };
    if (feed.icon !== undefined) metadata.icon = sanitizeURL(new URL(feed.icon["#text"].trim(), siteUrl));
    if (feed.logo !== undefined) metadata.image = sanitizeURL(new URL(feed.logo["#text"].trim(), siteUrl));
    if (feed.subtitle !== undefined) metadata.description = feed.subtitle["#text"].trim();

    addToQueue(sanitizeURL(new URL(feed.id["#text"].trim(), siteUrl)));
    
    if (feed.link !== undefined) {
      for (let link of feed.link) {
	const linkUrl = sanitizeURL(new URL(feed.link["@_href"].trim(), siteUrl));
	switch (link["@_rel"] ?? "") {
	  case 'alternate':
	    addToQueue(linkUrl);
	    if (link["@_hreflang"] !== undefined) siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ language: link["@_hreflang"] }));
	    if (link["@_title"] !== undefined) {
	      siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ linkText: link["@_hreflang"] }));
	      metadata.text += metadata.text.trim() === "" ? link.title.trim() : " " + link.title.trim();
	    }
	    break;
	  case 'enclosure':
	    break;
	  case 'related':
	    addToQueue(linkUrl);
	    if (link["@_hreflang"] !== undefined) siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ language: link["@_hreflang"] }));
	    if (link["@_title"] !== undefined) {
	      siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ linkText: link["@_hreflang"] }));
	      metadata.text += metadata.text.trim() === "" ? link.title.trim() : " " + link.title.trim();
	    }
	    break;
	  case 'self':
	    break;
	  case 'via':
	    addToQueue(linkUrl);
	    if (link["@_hreflang"] !== undefined) siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ language: link["@_hreflang"] }));
	    if (link["@_title"] !== undefined) {
	      siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ linkText: link["@_hreflang"] }));
	      metadata.text += metadata.text.trim() === "" ? link.title.trim() : " " + link.title.trim();
	    }
	    break;
	  default:
	    break;
	}
      }
    }
    for (let category of feed.category ?? []) {
      if (category["@_term"].trim() !== "") metadata.keywords.push(category["@_term"].trim());
      if (category["@_label"].trim() !== "") metadata.text.trim() === "" ? category["@_label"].trim() : " " + category["@_label"].trim();
    }
    for (let contributor of feed.contributor ?? []) {
      metadata.creators.push(contributor.name["#text"].trim());
    }

    for (let entry of feed.entry ?? []) {
      metadata.text += metadata.text.trim() === "" ? entry.title["#text"].trim() : " " + entry.title["#text"].trim();
      if (feed.summary !== undefined) metadata.text += metadata.text.trim() === "" ? entry.summary["#text"].trim() : " " + entry.summary["#text"].trim();
      if (feed.content !== undefined) metadata.text += metadata.text.trim() === "" ? entry.content["#text"].trim() : " " + entry.content["#text"].trim();

      addToQueue(sanitizeURL(new URL(entry.id["#text"].trim(), siteUrl)));

      if (feed.link !== undefined) {
	for (let link of feed.link) {
	  const linkUrl = sanitizeURL(new URL(feed.link["@_href"].trim(), siteUrl));
	  switch (link["@_rel"] ?? "") {
	    case 'alternate':
	      addToQueue(linkUrl);
	      if (link["@_hreflang"] !== undefined) siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ language: link["@_hreflang"] }));
	      if (link["@_title"] !== undefined) {
		siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ linkText: link["@_hreflang"] }));
		metadata.text += metadata.text.trim() === "" ? link.title.trim() : " " + link.title.trim();
	      }
	      break;
	    case 'enclosure':
	      break;
	    case 'related':
	      addToQueue(linkUrl);
	      if (link["@_hreflang"] !== undefined) siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ language: link["@_hreflang"] }));
	      if (link["@_title"] !== undefined) {
		siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ linkText: link["@_hreflang"] }));
		metadata.text += metadata.text.trim() === "" ? link.title.trim() : " " + link.title.trim();
	      }
	      break;
	    case 'self':
	      break;
	    case 'via':
	      addToQueue(linkUrl);
	      if (link["@_hreflang"] !== undefined) siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ language: link["@_hreflang"] }));
	      if (link["@_title"] !== undefined) {
		siteMeta.set(linkUrl, (new Site(siteMeta.get(linkUrl))).Append({ linkText: link["@_hreflang"] }));
		metadata.text += metadata.text.trim() === "" ? link.title.trim() : " " + link.title.trim();
	      }
	      break;
	    default:
	      break;
	  }
	}
      }
    }
  } else throw new RangeError("Unknown XML-based document format");
  
  return metadata;
}

let crawlQueue : Queue<URL> = new Queue<URL>();
let siteMeta : Map<URL, SiteMetadata> = new Map<URL, SiteMetadata>();
let sitemaps : Array<string> = new Array<string>();
let linkCount : number = 0;
for (let site of config.bot.crawlStart) {
  const siteUrl = sanitizeURL(new URL(site));
  crawlQueue.add(siteUrl);
  siteMeta.set(siteUrl, (new Site(siteMeta.get(siteUrl))).Append({ points: 1000 }));
}

const headers = new Headers(globalHeaders);
const fetchOptions = {
  headers: headers
};

type tag = {
  [key : string] : any
};

function getTag(tags : string | Array<string>, data : { [key : string] : any }) : Map<string, Array<tag>> {
  if (typeof tags === "string") tags = [ tags ];
  let result : Map<string, Array<tag>> = new Map<string, Array<tag>>();

  for (let tag of tags) {
    let tempRes : Array<tag> = [];

    if ((data[tag] ?? {}).length ?? 0 > 0) {
      for (let value of data[tag]) {
	tempRes.push(value);
      }
    } else if (data[tag] !== undefined) {
      tempRes.push(data[tag]);
    }

    result.set(tag, tempRes);
  }

  for (let elems in data) {
    if (elems.startsWith("@_") || elems === "#text" || elems === "script" || elems === "style" || elems === "hr" || elems === "br") continue;
    for (let elem of data[elems]) {
      try {
	const addRes : Map<string, Array<tag>> = getTag(tags, elem);
	for (let tag of addRes) {
	  let tempRes : Array<tag> = result.get(tag[0]) ?? [];
	  
	  for (let i of tag[1]) {
	    tempRes.push(i);
	  }
	  
	  result.set(tag[0], tempRes);
	}
      } catch (err : any) {
	console.error(err.message);
      }
    }
  }

  return result;
}

function sanitizeURL(url : URL) : URL {
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";

  return url;
}

async function addToQueue(url : URL) : Promise<void> {
  let urls : Array<URL> = [];
  url = sanitizeURL(url);

  if (url.protocol !== "https:" && url.protocol !== "http:") return;
  
  for (let link of crawlQueue) {
    link = sanitizeURL(link);
    if (urls.includes(link)) continue;
    urls.push(link);
  }
  for (let exLink of siteMeta) {
    const link : URL = sanitizeURL(exLink[0]);
    if (urls.includes(link)) continue;
    urls.push(link);
  }

  for (let link of urls) {
    if (url.href === link.href) return;
  }

  crawlQueue.add(url);
}

while (crawlQueue.length > 0) {
  const siteUrl : URL = crawlQueue.remove() ?? new URL("https://example.com");
  let metadata : SiteMetadata = new Site(siteMeta.get(siteUrl));
  linkCount++;
  console.log(`#${linkCount}: ${siteUrl.href}`);
  console.log(`prevMax: ${linkCount + crawlQueue.length}`);
    
  let info;
  try {
    info = await getInfo(siteUrl.href);
  } catch (err : any) {
    console.error("getInfo: " + err.message);
    metadata.failed = true;
    siteMeta.set(siteUrl, metadata);
    continue;
  }

  let isDisallowed = false;
  for (let disallowedSite of info.disallow) {
    if (!matchRobots(disallowedSite, siteUrl.pathname)) continue;

    let isAllowed = false;
    for (let allowedSite of info.allow) {
      if (matchRobots(allowedSite, siteUrl.pathname) && allowedSite.length > disallowedSite.length) {
	isAllowed = true;
	break;
      };
    }

    if (!isAllowed) isDisallowed = true;
    else isDisallowed = false;
  }

  if (isDisallowed) {
    metadata.indexed = false;
    siteMeta.set(siteUrl, metadata);
  };

  if (siteUrl.protocol === "http:") {
    let newSiteUrl = new URL(siteUrl.href);
    newSiteUrl.protocol = "https:";

    const originHttps = new URL(newSiteUrl.origin);
    if (siteMeta.has(originHttps)) {
      addToQueue(newSiteUrl);
      continue;
    }
    try {
      const res = await fetch(newSiteUrl.href, fetchOptions);

      if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);

      addToQueue(newSiteUrl);
      continue;
    } catch (err : any) {
      console.error(`HTTPS upgrade: ${err.message}`);
    }
  }

  if (!sitemaps.includes(siteUrl.origin)) {
    const startTime = Date.now();
    console.log("Adding links from sitemap.");
    let links : Array<string> = [];
    for (let url of info.sitemap) {
      const globLink = sanitizeURL(new URL(url.url));
      if (links.includes(globLink.href)) continue;
      links.push(globLink.href);
      
      for (let language of url.languages ?? []) {
      const langLink = sanitizeURL(new URL(language[1]));
	if (links.includes(langLink.href)) continue;
	links.push(langLink.href);
      }
    }

    for (let link of links) addToQueue(new URL(link));
    
    console.log(`Added links from sitemap. Time taken: ${(Date.now() - startTime) / 1000} s`);

    sitemaps.push(siteUrl.origin);
  }

  let res;
  let contentType : string;
  try {
    res = await fetch(siteUrl.href, fetchOptions);
	
    if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
	
    const contentTypes = httpHeaderParse(res.headers.get("Content-Type") ?? "");
    contentType = contentTypes[contentTypes.length - 1].mainParam;
  } catch (err : any) {
    console.error("Fetch: " + err.message);
    metadata.failed = true;
    siteMeta.set(siteUrl, metadata);
    continue;
  }
  try {
    let parserOptions : X2jOptions = {
      allowBooleanAttributes: true,
      alwaysCreateTextNode: true,
      attributeNamePrefix: "@_",
      ignoreDeclaration: true,
      ignorePiTags: true,
      parseAttributeValue: true,
      parseTagValue: true,
      ignoreAttributes: false,
      processEntities: true
    };
    let parser;
    switch (contentType) {
      case 'text/html': // pass
      case 'application/xhtml+xml':
	parserOptions.htmlEntities = true;
	parserOptions.unpairedTags = ["hr", "br", "link", "meta"];
	parserOptions.stopNodes = [ "*.pre", "*.script"];
	parserOptions.isArray = (name : string, jpath : string, isLeafNode : boolean, isAttribute : boolean) => {
	  if (isAttribute) return false;
	  if (name === "html" || name === "head" || name === "body") return false;
	  if (name === "meta" || name === "link") return true;
	  if (jpath.startsWith("html.body")) return true;
	  return false;
	};
	
	parser = new XMLParser(parserOptions);
	
	metadata = parseHTML(parser.parse(await res.text()), metadata, siteUrl);
	break;
      case 'application/rss+xml': // pass
      case 'application/atom+xml': // pass
      case 'text/xml': // pass
      case 'application/xml':
	parserOptions.parseAttributeValue = false;
	parserOptions.parseTagValue = false;
	parserOptions.isArray = (name : string, jpath : string, isLeafNode : boolean, isAttribute : boolean) => {
	  if (isAttribute) return false;
	  if (name === "rss" || name === "channel" || name === "category") return false;
	  if (name === "item" || name === "entry") return true;
	  if (jpath.startsWith("feed") && jpath.endsWith("link")) return true;
	  return false;
	};
	
	parser = new XMLParser(parserOptions);
	
	metadata = parseXML(parser.parse(await res.text()), metadata, siteUrl);
	break;
      case 'text/turtle': //pass
      case 'application/trig': // pass
      case 'application/n-triples': // pass
      case 'application/n-quads': // pass
      case 'application/ld+json': // pass
      case 'application/text/n3': // pass
      case 'application/rdf+xml': // pass
      case 'application/json':
	console.error("RDF");
	break;
      default:
	console.error("Unknown document type");
	metadata.failed = true;
	siteMeta.set(siteUrl, metadata);
	break;
    }
  } catch (err : any) {
    console.error("Parse: " + err.message);
    metadata.failed = true;
    siteMeta.set(siteUrl, metadata);
    continue;
  }

  siteMeta.set(siteUrl, metadata);
  console.log(`currentMax: ${linkCount + crawlQueue.length}`);
  // console.log(metadata);
}

console.log(linkCount);

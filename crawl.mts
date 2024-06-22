import { getInfo } from './getInfo.mjs';
import { globalHeaders, config } from './global.mjs';
import { matchRobots } from './robots.mjs';
import { httpHeaderParse } from './httpHeaderParse.mjs';
import { XMLParser } from 'fast-xml-parser';
import { Queue } from './queue.js';
import { URL } from 'node:url';

type optional<Type> = Type | undefined;
type overwriteOption = "old" | "new" | "merge";

interface Author {
  name? : optional<string>,
  link? : optional<string>
}
interface SiteMetadata {
  title? : optional<string>,
  description? : optional<string>,
  icon? : optional<string>,
  image? : optional<string>,
  language? : optional<string>,
  author? : optional<Author>,
  creators? : optional<Array<string>>,
  publisher? : optional<string>,
  license? : optional<string>,
  privacyPolicy? : optional<string>,
  termsOfService? : optional<string>,
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
  public icon : string = "";
  public image : string = "";
  public language : string = "";
  public author : Author = {
    name: "",
    link: ""
  };
  public creators : Array<string> = [];
  public publisher : string = "";
  public license : string = "";
  public privacyPolicy : string = "";
  public termsOfService : string = "";
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

let crawlQueue : Queue<string> = new Queue<string>();
let siteMeta : Map<string, SiteMetadata> = new Map<string, SiteMetadata>();
let linkCount : number = 0;
for (let site of config.bot.crawlStart) {
  crawlQueue.add(site);
  siteMeta.set(site, (new Site(siteMeta.get(site))).Append({ points: 1000 }));
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
  isArray: (name : string, jpath : string, isLeafNode : boolean, isAttribute : boolean) => {
    if (isAttribute) return false;
    if (name === "html" || name === "head" || name === "body") return false;
    if (name === "meta" || name === "link") return true;
    if (jpath.startsWith("html.body")) return true;
    return false;
  }
};
const parser = new XMLParser(parserOptions);

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

while (crawlQueue.length > 0) {
  const site : string = crawlQueue.remove() ?? "";
  const siteUrl : URL = new URL(site ?? "");
  if (site.trim() === "") {
    console.error(`crawl: site is empty`);
    continue;
  }
  let metadata : SiteMetadata = new Site(siteMeta.get(site));
  linkCount++;
  console.log(`#${linkCount}: ${site}`);
    
  let info;
  try {
    info = await getInfo(site);
  } catch (err : any) {
    console.error("getInfo: " + err.message);
    metadata.failed = true;
    siteMeta.set(site, metadata);
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

  if (isDisallowed) {
    metadata.indexed = false;
    siteMeta.set(site, metadata);
  };

  let res;
  try {
    res = await fetch(site, fetchOptions);
	
    if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
	
    const contentType = httpHeaderParse(res.headers.get("Content-Type") ?? "");
    if (contentType[contentType.length - 1].mainParam !== "text/html") {
      console.error("A non-HTML document");
      metadata.failed = true;
      siteMeta.set(site, metadata);
      continue;
    };
  } catch (err : any) {
    console.error("Fetch: " + err.message);
    metadata.failed = true;
    siteMeta.set(site, metadata);
    continue;
  }

  let content;
  try {
    content = parser.parse(await res.text());
  } catch (err : any) {
    console.error("Parse: " + err.message);
    metadata.failed = true;
    siteMeta.set(site, metadata);
    continue;
  }

  metadata.author = metadata.author ?? {};
  metadata.keywords = metadata.keywords ?? [];
  metadata.creators = metadata.creators ?? [];
  metadata.points = metadata.points ?? 0;

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
	siteMeta.set(site, metadata);
      };
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
      if (follow) {
	for (let link of getTag("a", content.html.body).get("a") ?? []) {
	  const linkUrl = new URL(link["@_href"], site);

	  if (linkUrl.protocol !== "https:" && linkUrl.protocol !== "http:") continue;

	  linkUrl.search = "";
	  linkUrl.hash = "";

	  const linkContent = (link["#text"] ?? "").toString().trim()
	  if (linkContent !== "") siteMeta.set(linkUrl.href, (new Site(siteMeta.get(linkUrl.href))).Append({ linkText: [ linkContent ] }));
	  
	  let skip = false;
				
	  for (let rel of (link["@_rel"] ?? "").split(" ")) {
	    switch (rel.trim().toLowerCase()) {
	      case 'nofollow':
		skip = true;
		break;
	      default:
		break;
	    }
	  }
		
	  if (!skip) links.push(linkUrl.href);
	  
	  for (let futLink of crawlQueue) {
	    let futLinkUrl : URL;
	    try {
	      futLinkUrl = new URL(futLink);
	    } catch (err : any) {
	      console.error(`Queued links check: ${err.message}`);
	      continue;
	    }
	    if (futLinkUrl.href === linkUrl.href) {
	      skip = true;
	      break;
	    }
	  }
	  for (let exLink of siteMeta) {
	    let exLinkUrl : URL;
	    try {
	      exLinkUrl = new URL(exLink[0]);
	    } catch (err : any) {
	      console.error(`Crawled links check: ${err.message}`);
	      continue;
	    }
	    if (exLinkUrl.href === linkUrl.href) {
	      skip = true;
	      break;
	    }
	  }
				
	  if (skip) continue;
		
	  crawlQueue.add(linkUrl.href);
	}
      }

      const linkPoints = metadata.points / Math.max(links.length, 1);
      for (let link of links) {
	const linkUrl : URL = new URL(link, site);
	const isSameOrigin : boolean = siteUrl.origin === linkUrl.origin;
	
	const linkMeta = new Site(siteMeta.get(link));
	siteMeta.set(link, linkMeta.Append({ points: linkMeta.points + Math.min((isSameOrigin ? (metadata.points / 10) : linkPoints), metadata.points) }));
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
  }

  siteMeta.set(site, metadata);
  console.log(metadata);
}

console.log(linkCount);

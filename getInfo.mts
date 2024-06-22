import { getRobotsRules, getRobots, robotsRules } from './robots.mjs';
import { getSitemap, parsedSitemap } from './sitemap.mjs';
import { config } from './global.mjs';
import { URL } from 'node:url';

interface siteInfo {
  allow : Array<string>,
  disallow : Array<string>,
  sitemap : parsedSitemap
};

let siteInfo : Map<string, siteInfo> = new Map<string, siteInfo>();

async function getInfo(url : string) : Promise<siteInfo> {
  const baseUrl : string = (new URL(url)).origin;
    
  if (!siteInfo.has(baseUrl)) {
    let robotsRules : robotsRules;
    try {
      robotsRules = getRobotsRules(config.bot.productToken, await getRobots(baseUrl));
    } catch (err : any) {
      console.error("Robots: " + err.message);
      robotsRules = {
	allow: [],
	disallow: [],
	sitemaps: []
      };
      if ((err.message ?? "").startsWith("HTTP Error")) {
	if (err.message[11] === "4") {
	  robotsRules.allow = [ "*" ];
	} else if (err.message[11] === "5") {
	  robotsRules.disallow = [ "*" ];
	}
      } else {
	robotsRules.allow = [ "*" ];
      }
    }

    let sitemap : parsedSitemap = [];
    if ((robotsRules.sitemaps.length ?? 0) > 0) {
      for (let sitemapUrl of robotsRules.sitemaps) {
	try {
	  for (let url of await getSitemap(new URL(sitemapUrl))) {
	    sitemap.push(url);
	  }
	} catch (err : any) {
	  console.error("Sitemaps: " + err.message);
	}
      }
    }

    siteInfo.set(baseUrl, {
      allow: robotsRules.allow,
      disallow: robotsRules.disallow,
      sitemap: sitemap
    });
  }

  return siteInfo.get(baseUrl) ?? {
    allow: [],
    disallow: [],
    sitemap: []
  };
}

// console.log(await getInfo("https://gnu.org"));

export { getInfo };

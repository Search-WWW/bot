'use strict';

import { getRobotsRules, getRobots } from './robots.mjs';
import { getSitemap } from './sitemap.mjs';
import { config } from './global.mjs';
import { URL } from 'node:url';

let siteInfo = {};

async function getInfo(url) {
    const baseUrl = (new URL(url)).origin;
    
    if (siteInfo[baseUrl] === undefined) {
	const robotsRules = getRobotsRules(config.bot.productToken, await getRobots(baseUrl));
	let sitemap = [];
	if (robotsRules.sitemaps.length > 0) {
	    for (let sitemapUrl of robotsRules.sitemaps) {
		for (let url of await getSitemap(new URL(sitemapUrl))) {
		    sitemap.push(url);
		}
	    }
	}

	siteInfo[baseUrl] = {
	    allow: robotsRules.allow,
	    disallow: robotsRules.disallow,
	    sitemap: sitemap
	};
    }

    return siteInfo[baseUrl];
}

// console.log(await getInfo("https://gnu.org"));

export { getInfo };

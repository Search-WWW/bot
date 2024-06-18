'use strict';

import { getRobotsRules, getRobots } from './robots.mjs';
import { getSitemap } from './sitemap.mjs';
import { config } from './global.mjs';
import { URL } from 'node:url';

let siteInfo = {};

async function getInfo(url) {
    const baseUrl = (new URL(url)).origin;
    
    if (siteInfo[baseUrl] === undefined) {
		let robotsRules;
		try {
			robotsRules = getRobotsRules(config.bot.productToken, await getRobots(baseUrl));
		} catch (err) {
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

		let sitemap = [];
		if ((robotsRules.sitemaps.length ?? 0) > 0) {
			for (let sitemapUrl of robotsRules.sitemaps) {
				try {
					for (let url of await getSitemap(new URL(sitemapUrl))) {
						sitemap.push(url);
					}
				} catch (err) {
					console.error("Sitemaps: " + err.message);
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
'use strict';

import { URL } from 'node:url';
import { globalHeaders } from './global.mjs';

function matchRobots(glob, str) {
    let j = 0;
    let matches = true;

    let any = false;
    
    for (let i = 0; i < str.length; i++) {
	const strChr = str[i];
	const strChrNext = str[i + 1];
	const globChr = glob[j];
	const globChrNext = glob[j + 1];

	/*
	  console.log(`i: ${i}, strChr: ${strChr}, strChrNext: ${strChrNext}`);
	  console.log(`j: ${j}, globChr: ${globChr}, globChrNext: ${globChrNext}`);
	*/

	if (globChr === "*") {
	    any = true;
	}

	if (globChr === "$") {
	    matches = false;
	    break;
	}

	if (any && strChrNext === globChrNext) {
	    if (strChrNext == undefined && globChrNext == undefined) {
		break;
	    }
	    any = false;
	}
	if (!any) {
	    if (strChr !== globChr) {
		matches = false;
		break;
	    }

	    j++;
	}
    }

    // console.log(`'${str}' ${matches ? "matches" : "doesn't match"} '${glob}'.`);
    return matches;
}

function getRobotsRules(productToken, robots) {
    let result = {
	allow: [],
	disallow: [],
	sitemaps: []
    };
    
    for (const agent in robots) {
	if (matchRobots(agent, productToken)) {
	    if (agent === "sitemaps") {
		continue;
	    }
	    
	    for (const allowUrl of robots[agent].allow ?? []) {
		result.allow.push(allowUrl);
	    }
	    for (const disallowUrl of robots[agent].disallow ?? []) {
		result.disallow.push(disallowUrl);
	    }
	    result.sitemaps = robots.sitemaps;
	}
    }

    return result;
}

function parseRobots(robots) {
    robots = robots.split("\n");
    let result = { sitemaps: [] };

    const record = (line, name) => line.toLowerCase().startsWith(`${name}:`);

    let currentUserAgents = [];
    for (let line of robots) {
	if (line.indexOf("#") != -1) {
	    line = line.substring(0, line.indexOf("#"));
	}

	if (line.trim() === "") {
	    currentUserAgents = [];
	    continue;
	} else if (record(line, "user-agent")) {
	    currentUserAgents.push(line.substring(12));

	    for (const currentUserAgent of currentUserAgents) {
			result[currentUserAgent] = typeof result[currentUserAgent] === "object" ? result[currentUserAgent] : {};
			result[currentUserAgent].allow = typeof result[currentUserAgent].allow === "array" ? result[currentUserAgent].allow : [];
			result[currentUserAgent].disallow = typeof result[currentUserAgent].disallow === "array" ? result[currentUserAgent].disallow : [];
	    }
	    
	    continue;
	}

	// Make sure to handle any errors
	if (currentUserAgents == undefined || currentUserAgents == []) {
	    continue;
	}

	if (record(line, "allow")) {
	    for (const currentUserAgent of currentUserAgents) {
		result[currentUserAgent].allow.push(line.substring(6).trim());
	    }
	} else if (record(line, "disallow")) {
	    for (const currentUserAgent of currentUserAgents) {
		result[currentUserAgent].disallow.push(line.substring(9).trim());
	    }
	} else if (record(line, "sitemap")) {
	    result.sitemaps.push(line.substring(8).trim());
	}

	continue;
    }

    return result;
}

async function getRobots(baseUrl) {
    const url = new URL("/robots.txt", baseUrl);

    const headers = new Headers(globalHeaders);
	const options = {
	    headers: headers
	};
	
	const res = await fetch(url.href, options);

	if (!res.ok) {
		throw new Error("HTTP Error " + res.status + ": " + res.statusText);
	}
	
	const robots = await res.text();

	return parseRobots(robots);
}

export { getRobots, getRobotsRules, parseRobots, matchRobots }

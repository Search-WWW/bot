import { URL } from 'node:url';
import { globalHeaders } from './global.mjs';

interface robots {
  agents : Map<string, {
    allow : Array<string>,
    disallow : Array<string>
  }>,
  sitemaps : Array<string>
};

interface robotsRules {
  allow : Array<string>,
  disallow : Array<string>,
  sitemaps : Array<string>
}

function matchRobots(glob : string, str : string) : boolean {
  let j : number = 0;
  let matches : boolean = true;

  let any : boolean = false;
    
  for (let i : number = 0; i < str.length; i++) {
    const strChr : string = str[i];
    const strChrNext : string = str[i + 1];
    const globChr : string = glob[j];
    const globChrNext : string = glob[j + 1];

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

function getRobotsRules(productToken : string, robots : robots) : robotsRules {
  let result : robotsRules = {
    allow: [],
    disallow: [],
    sitemaps: []
  };
    
  for (const agent of robots.agents) {
    if (matchRobots(agent[0], productToken)) {
      for (const allowUrl of agent[1].allow ?? []) {
	result.allow.push(allowUrl);
      }
      for (const disallowUrl of agent[1].disallow ?? []) {
	result.disallow.push(disallowUrl);
      }
      result.sitemaps = robots.sitemaps;
    }
  }

  return result;
}

function parseRobots(strRobots : string) : robots {
  let robots = strRobots.split("\n");
  let result : robots = {
    agents: new Map<string, {
      allow : Array<string>,
      disallow : Array<string>
    }>,
    sitemaps: []
  };

  const record = (line : string, name : string) : boolean => line.toLowerCase().startsWith(`${name}:`);

  let currentUserAgents : Array<string> = [];
  for (let line of robots) {
    if (line.indexOf("#") != -1) {
      line = line.substring(0, line.indexOf("#"));
    }

    if (line.trim() === "") {
      currentUserAgents = [];
      continue;
    } else if (record(line, "user-agent")) {
      currentUserAgents.push(line.substring(12));

      for (let currentUserAgent of currentUserAgents) {
	let value : undefined | {
	  allow : Array<string>,
	  disallow : Array<string>
	} = result.agents.get(currentUserAgent) ?? { allow: [], disallow: [] };
	value.allow = value.allow ?? [];
	value.disallow = value.disallow ?? [];
	result.agents.set(currentUserAgent, value);
      }

      continue;
    }

    if (record(line, "allow")) {
      for (const currentUserAgent of currentUserAgents) {
	let value = result.agents.get(currentUserAgent) ?? { allow: [], disallow: [] };
	value.allow.push(line.substring(6).trim());
	result.agents.set(currentUserAgent, value);
      }
    } else if (record(line, "disallow")) {
      for (const currentUserAgent of currentUserAgents) {
	let value = result.agents.get(currentUserAgent) ?? { allow: [], disallow: [] };
	value.disallow.push(line.substring(9).trim());
	result.agents.set(currentUserAgent, value);
      }
    } else if (record(line, "sitemap")) {
      result.sitemaps.push(line.substring(8).trim());
    }
  }

  return result;
}

async function getRobots(baseUrl : string) {
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

export { getRobots, getRobotsRules, parseRobots, matchRobots, robots, robotsRules }

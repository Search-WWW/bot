'use strict';

import { URL } from "node:url";

const instanceUrl = "https://search.duanin2.top";
const name = "SeWWW_Bot";
const version = "0.0.0";
const userAgent = `${name}/${version}; ${instanceUrl}/bot.html; Currently in development`;
const globalHeaders = new Headers();
globalHeaders.append("User-Agent", userAgent);

function parseRobots(robots) {
    robots = robots.split("\n");
    let result = {  };

    for (let line of robots)
}

async function getRobots(baseUrl) {
    const url = new URL("/robots.txt", baseUrl);

    try {
	const headers = new Headers(globalHeaders);
	const options = {
	    headers: headers
	};
	
	const res = await fetch('https://gnu.org/robots.txt', );
	const robots = await res.text();

	
    } catch (err) {
	throw err;
    }
}

console.log(await getRobots("https://gnu.org"));

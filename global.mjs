'use strict';

const config = {
    instance: {
	url: "https://search.duanin2.top",
	version: "0.0.0"
    },
    bot: {
	productToken: "SeWWW_Bot",
	version: "0.0.0",
	crawlStart: [
	    "https://www.gnu.org",
	    "https://www.fsf.org"
	]
    }
};

const globalHeaders = new Headers({
    "User-Agent": `${config.bot.productToken}/${config.bot.version}; ${config.instance.url}/botinfo.html; Currently in development`
});

export { config, globalHeaders };

'use strict';

import { getRobotsRules, getRobots } from './robots.mjs';
import { config } from './global.mjs';

console.log(getRobotsRules(config.bot.productToken, await getRobots("https://gnu.org")));

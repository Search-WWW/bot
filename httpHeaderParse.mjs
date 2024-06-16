'use strict';

function httpHeaderParse(headers) {
    let results = [];
    
    for (let header of headers.split(",")) {
	header = header.trim();

	let params = [];
	for (let param of header.split(";")) {
	    param = param.trim().split("=");

	    params.push(param);
	}

	params[0] = params[0][0];

	results.push(params);
    }

    return results;
}

// console.log(httpHeaderParse("text/html, application/xml; charset=utf-8"));

export { httpHeaderParse };

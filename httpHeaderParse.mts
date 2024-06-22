type parsedHTTPHeaders = Array<{
  mainParam : string,
  params : Map<string, string>
}>;

function httpHeaderParse(headers : string) {
  let results : parsedHTTPHeaders = [];
    
  for (let header of headers.split(",")) {
    header = header.trim();

    const strParams : Array<string> = header.split(";");

    let mainParam : string = strParams.shift() ?? "";
    let params : Map<string, string> = new Map<string, string>();
    
    for (let param of strParams) {
      let keyValue = param.trim().split("=");

      params.set(keyValue[0], keyValue[1]);
    }

    results.push({
      mainParam,
      params
    });
  }

  return results;
}

// console.log(httpHeaderParse("text/html, application/xml; charset=utf-8"));

export { httpHeaderParse, parsedHTTPHeaders };

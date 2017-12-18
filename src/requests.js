const httpRequest = require("http").request;
const httpsRequest = require("https").request;
const operation = require("retry").operation;
const parse = require("url").parse;

function createRequest(method, uri, cb) {
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };
  
  if (process.env.API_KEY) {
    headers["X-DreamFactory-Api-Key"] = process.env.API_KEY;
  }

  const parsed = parse(uri);
  const options = {
    auth: parsed.auth,
    headers,
    hostname: parsed.hostname,
    method,
    path: parsed.path,
    port: parsed.port,
    query: parsed.query,
  };

  switch (parsed.protocol) {
    case "http:": return httpRequest(options, cb);
    case "https:": return httpsRequest(options, cb);
    default: throw new Error(`Unknown protocol: ${uri}`);
  }
}

function createRetryableRequest(method, uri, body) {
  const op = operation({
    factor: 1,
    minTimeout: 100,
    retries: 5,
  });

  return new Promise((resolve, reject) => {
    const maybeReject = (err, getBody) => {
      if (err) {
        if (op.retry(err)) {
          return;
        }
      }
      if (getBody) {
        console.error("Response Error:", err.stack || err);
        console.error(getBody());
      }
      else {
        console.error("Request Error:", err.stack || err);
      }
      reject(err);
    };

    op.attempt(send);
    
    function send(currentAttempt) {
      const req = createRequest(method, uri, resHandler);
      req.on("error", maybeReject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();

      function resHandler(res) {
        if (res.statusCode && res.statusCode >= 400) {
          if (op.retry(new Error(`Unexpected HTTP Status Code: ${res.statusCode}`))) {
            return;
          }
        }
        const chunks = [];
        const getBody = () => Buffer.concat(chunks).toString();
        res.on("data", (chunk) => {
          if (typeof chunk === "string") {
            chunk = new Buffer(chunk);
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve(getBody()));
        res.on("error", (err) => maybeReject(err, getBody));
      }
    }
  });
}

const get = (uri) => createRetryableRequest("GET", uri);
const post = (uri, body) => createRetryableRequest("POST", uri, body);
const patch = (uri, body) => createRetryableRequest("PATCH", uri, body);

module.exports = {
  get, 
  post, 
  patch,
}

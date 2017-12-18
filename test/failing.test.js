const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const express = require("express");
const bodyParser = require("body-parser");

const KEY = fs.readFileSync(path.resolve(__dirname, "key.pem"));
const CERT = fs.readFileSync(path.resolve(__dirname, "cert.pem"));

const get = require("../src/requests").get;

describe("Micro servers", () => {
  beforeEach(() => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  });
  afterEach(() => {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  });

  const CONTENT = JSON.stringify({ hello: "world" });

  const servers = createServers(["get", "post", "patch"], (req, res) => {
    res.send(CONTENT);
  });

  it("should work", makeTest("http", servers.httpServer, CONTENT, (uri, checkCb) => {
    get(uri).then(res => checkCb(null, res)).catch(checkCb);
  }));

  it("should work too", makeTest("https", servers.httpsServer, CONTENT, (uri, checkCb) => {
    get(uri).then(res => checkCb(null, res)).catch(checkCb);
  }));
});

function createServers(methods, handler) {
  const app = express();
  app.use(bodyParser.json({ limit: "20mb" }));

  methods.forEach(method => {
    app[method]("/", handler);
  });

  const httpServer = http.createServer(app);
  const httpsServer = https.createServer({
    key: KEY,
    cert: CERT,
    passphrase: "jest",
  }, app);

  return { httpServer, httpsServer };
}

function makeTest(protocol, server, expected, cb) {
  return () => new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      server.close();
      reject(new Error("TIMED OUT"));
    }, 5000);

    function close() {
      clearTimeout(id);
      server.close();
    }

    server.listen((err) => {
      if (err) {
        close();
        return reject(err);
      }

      const port = server.address().port;
      const uri = `${protocol}://0.0.0.0:${port}/`;

      cb(uri, (err2, actual) => {
        close();
        if (err) {
          return reject(err);
        }

        expect(actual).toEqual(expected);
        resolve(actual);
      });
    });
  });
}

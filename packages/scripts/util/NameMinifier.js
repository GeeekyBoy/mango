/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import http from "http";

export default class NameMinifier {
  /**
   * @param {number} port
   * @param {() => Promise<void>} callback
   */
  constructor(port, callback) {
    this.port = port;
    this.classesLookup = {};
    this.propsLookup = {};
    this.classesCounter = 1;
    this.propsCounter = 1;
    /**
     * @type {import("http").RequestListener} req
     * @type {import("http").ServerResponse} res
     */
    this.handleReq = async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith("/classes/")) {
        const names = url.pathname.slice(9).split(",");
        const result = {};
        for (const name of names) {
          if (!this.classesLookup[name]) this.classesLookup[name] = this.classesCounter++;
          result[name] = "a" + this.classesLookup[name];
        }
        res.writeHead(200);
        res.end(JSON.stringify(result), "utf-8");
        return;
      } else if (url.pathname.startsWith("/props/")) {
        const names = url.pathname.slice(7).split(",");
        const result = {};
        for (const name of names) {
          if (!this.propsLookup[name]) this.propsLookup[name] = this.propsCounter++;
          result[name] = "a" + this.propsLookup[name];
        }
        res.writeHead(200);
        res.end(JSON.stringify(result), "utf-8");
        return;
      }
      res.writeHead(404);
      res.end("Not found", "utf-8");
    };
    this.server = http.createServer(this.handleReq);
    this.server.listen(this.port, async () => {
      await callback();
      this.server.close();
    });
  }
}

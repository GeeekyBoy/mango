/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createGzip, createBrotliCompress } from "zlib";

/**
 * @param {string} code
 * @param {string} filePath
 * @param {import("@parcel/fs").FileSystem} fs
 */
export default function compressCode(code, filePath, fs) {
  const isNetlify = !!process.env.NETLIFY;
  if (!isNetlify) {
    const gzip = createGzip();
    const gzipStream = fs.createWriteStream(filePath + ".gz");
    gzip.pipe(gzipStream);
    gzip.write(code);
    gzip.end();
    const brotli = createBrotliCompress();
    const brotliStream = fs.createWriteStream(filePath + ".br");
    brotli.pipe(brotliStream);
    brotli.write(code);
    brotli.end();
  }
}

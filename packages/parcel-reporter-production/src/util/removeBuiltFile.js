/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @param {string} filePath
 * @param {import("@parcel/fs").FileSystem} fs
 */
export default async function removeBuiltFile(filePath, fs) {
  const isNetlify = !!process.env.NETLIFY;
  await fs.unlink(filePath)
  if (!isNetlify) {
    await fs.unlink(filePath + ".gz");
    await fs.unlink(filePath + ".br");
  }
}

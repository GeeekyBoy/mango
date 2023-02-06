import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = await fs.readdir(path.join(__dirname, "../../docs"));

export const docsList = files
  .map((file) => {
    const fileBasename = path.basename(file, ".mdx");
    const firstUnderscoreIndex = fileBasename.indexOf("-");
    const slug = fileBasename.slice(firstUnderscoreIndex + 1);
    const title = slug
      .replace(/-/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (s) => s.toUpperCase())
      .replaceAll("Api", "API")
      .replaceAll("Typescript", "TypeScript");
    const route = "/" + slug;
    return { title, route, fileBasename };
  })
  .sort(
    (a, b) =>
      parseInt(a.fileBasename.split("-", 1)[0], 10) -
      parseInt(b.fileBasename.split("-", 1)[0], 10)
  );

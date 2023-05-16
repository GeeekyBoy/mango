import Prism from "prismjs";
import "prismjs/components/prism-jsx.js";

const beforeDemo = `const res = await fetch("https://example.com/api/encrypt", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ msg: "Hello World!" }),
});
const { encryptedMsg } = await res.json();
console.log(encryptedMsg);`;

const afterDemo = `import { encrypt } from "./encryption.remote";
const encryptedMsg = await encrypt("Hello World!");
console.log(encryptedMsg);`;

export const beforeDemoHighlight = Prism.highlight(beforeDemo, Prism.languages.jsx, "jsx");
export const afterDemoHighlight = Prism.highlight(afterDemo, Prism.languages.jsx, "jsx");

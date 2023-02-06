import Prism from "prismjs";
import CodeWindow from "./CodeWindow";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-tsx.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-scss.js";
import "prismjs/components/prism-markdown.js";
import "prismjs/components/prism-typescript.js";
import "prism-material-themes/themes/material-darker.css";

function Snippet({
  language = "jsx",
  children
}) {
  return (
    <CodeWindow language={language} highlighter={Prism.highlightElement}>
      {children}
    </CodeWindow>
  );
}

export default Snippet;
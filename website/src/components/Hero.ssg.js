import Prism from "prismjs";
import "prismjs/components/prism-jsx.js";

const demoCode = `var $globalCounter = 0;
$createEffect(() => {
  console.log("Global counter increased to", $globalCounter);
});
function Component() {
  var $localCounter = 0;
  var increment = function() {
    $globalCounter++;
    $localCounter++;
  };
  return (
    <div>
      <button onClick={increment}>
        Increment to {$localCounter}
      </button>
    </div>
  );
}

export default Component;
export { $globalCounter }`;

export const demoHighlight = Prism.highlight(demoCode, Prism.languages.jsx, "jsx");
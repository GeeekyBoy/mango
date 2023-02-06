import Prism from "prismjs";
import "prismjs/components/prism-jsx.js";

const firstDemo = `<button
  id={true && 'real-id'}
  id={false && 'troll-id'}
  class="base-class"
  class={new Date().getHours() > 12 ? 'afternoon' : 'morning'}
  onClick={() => alert('Hello World!')}
  onClick={() => alert('Goodbye World!')}
/>`;

const secondDemo = `<button
  ID="myDiv"
  onClick={() => alert('Hello World!')}
  onclick={() => alert('Goodbye World!')}
  innerHTML="Click Me"
  auto_focus
/>`;

const thirdDemo = `<video
  bind:currentTime={$progress}
  bind:duration={$duration}
  bind:paused={$isPaused}
  bind:volume={$volume}
  bind:muted={$isMuted}
/>`;

const fourthDemo = `<p
  color="red"
  font-size={20}
  font-weight="bold"
  text-align="center"
  text-decoration="underline"
/>`;

const fifthDemo = `<Card
  title="Hello World"
  link="https://google.com"
  style:color="black"
  event:onClick={toggleBgColor}
  event:onClick={() => console.log("Card clicked!")}
/>`;

const sixthDemo = `<Range
  min={0}
  max={$duration || 0}
  step={1}
  disabled={false}
  $value={$progress}
/>`;

export const firstDemoHighlight = Prism.highlight(firstDemo, Prism.languages.jsx, "jsx");
export const secondDemoHighlight = Prism.highlight(secondDemo, Prism.languages.jsx, "jsx");
export const thirdDemoHighlight = Prism.highlight(thirdDemo, Prism.languages.jsx, "jsx");
export const fourthDemoHighlight = Prism.highlight(fourthDemo, Prism.languages.jsx, "jsx");
export const fifthDemoHighlight = Prism.highlight(fifthDemo, Prism.languages.jsx, "jsx");
export const sixthDemoHighlight = Prism.highlight(sixthDemo, Prism.languages.jsx, "jsx");

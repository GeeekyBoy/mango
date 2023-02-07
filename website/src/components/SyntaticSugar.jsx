import CodeWindow from "./CodeWindow";
import {
  firstDemoHighlight,
  secondDemoHighlight,
  thirdDemoHighlight,
  fourthDemoHighlight,
  fifthDemoHighlight,
  sixthDemoHighlight,
} from "./SyntaticSugar.ssg";
import cupcakeEmoji from "../assets/img/cupcake-emoji.png";

const PieceOfSugar = ({ htmlCode, title, description }) => (
  <div>
    <div class="flex items-center justify-center rounded-xl bg-[linear-gradient(45deg,hsl(270deg,67%,25%)-15%,hsl(212deg,100%,30%))] p-3">
      <CodeWindow htmlCode={htmlCode} style:height="16rem" />
    </div>
    <p class="mt-2 text-center text-xl">{title}</p>
    <p class="text-center">{description}</p>
  </div>
);

function SyntaticSugar() {
  return (
    <section
      id="syntatic-sugar"
      class="col-span-4 mx-auto mb-4 max-w-screen-xl rounded-xl px-6 py-12 md:mb-12 md:px-0"
    >
      <div class="center grid gap-x-4 gap-y-12">
        <h2 class="w-full text-center text-4xl font-bold lg:text-6xl">
          <img
            src={cupcakeEmoji}
            alt="cupcake emoji"
            class="m-auto h-28 w-28 lg:h-32 lg:w-32"
          />
          <span class="block bg-vivid-pink bg-clip-text text-transparent">
            Much Sweet
          </span>
        </h2>
        <div class="m-auto grid w-full grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 md:grid-cols-3 md:px-0">
          <PieceOfSugar
            htmlCode={firstDemoHighlight}
            title="Attribute Accumulation"
            description="Feel free to use the same attribute multiple times. Compiler will merge them into one."
          />
          <PieceOfSugar
            htmlCode={secondDemoHighlight}
            title="Case Insensitivity"
            description="Whatever the case you use for HTML attribute names, compiler will interpret them correctly."
          />
          <PieceOfSugar
            htmlCode={thirdDemoHighlight}
            title="Bound Attributes"
            description="Brought from Svelte, keep form controls and media elements attributes in sync with variables."
          />
          <PieceOfSugar
            htmlCode={fourthDemoHighlight}
            title="Attribute-Like Styles"
            description="No problem if you want to define styles as attributes. Compiler can differentiate them from attributes."
          />
          <PieceOfSugar
            htmlCode={fifthDemoHighlight}
            title="Component Styling"
            description="Style components or add event listeners to them using attributes. No need to manipulate their definitions."
          />
          <PieceOfSugar
            htmlCode={sixthDemoHighlight}
            title="2-Way Binding"
            description="Brought from Angular, keep parents and their children in communication with each other."
          />
        </div>
      </div>
    </section>
  );
}

export default SyntaticSugar;

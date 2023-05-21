import CodeWindow from "./CodeWindow";
import { demoHighlight } from "./Hero.ssg";

function Hero() {
  return (
    <div class="relative mb-20 flex h-full min-h-full w-full flex-col items-center justify-center gap-4 px-6 pt-8 md:px-8">
      <CodeWindow htmlCode={demoHighlight} style:maxHeight="18rem" />
      <h1 class="w-fit bg-vivid-red bg-clip-text text-center text-4xl font-bold !leading-snug text-transparent sm:text-6xl">
        Mango Framework
      </h1>
      <p class="-mt-2 text-center text-base text-gray-100 sm:text-2xl">
        <span class="">A framework designed with performance and&nbsp;</span>
        <span class="inline-block">compatibility in mind.</span>
      </p>
      <ul class="flex flex-col items-center justify-center gap-4 text-center text-gray-100 lg:flex-row">
        <li>👾 IE5+ Compatibility</li>
        <li>✨ 1.53kb (gzipped)</li>
        <li>🚀 Native DOM manipulation</li>
        <li>🤏 Negligible memory usage</li>
      </ul>
      <div class="flex flex-row items-center justify-center gap-4">
        <a href="./docs">
          <button class="w-32 rounded-lg border-2 border-white bg-transparent py-1 text-gray-100">
            Get Started
          </button>
        </a>
        <a href="https://github.com/GeeekyBoy/mango">
          <button class="w-32 rounded-lg border-2 border-white bg-transparent py-1 text-gray-100">
            Star Us ⭐
          </button>
        </a>
      </div>
    </div>
  );
}

export default Hero;

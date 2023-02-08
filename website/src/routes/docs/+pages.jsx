import Snippet from "../../components/Snippet";
import Skeleton from "../../components/Skeleton";
import Footer from "../../components/Footer";
import logo from "../../assets/img/mango.svg";
import { navigate, $routeParams } from "@mango-js/router";
import { docsList } from "./docsList.ssg";

function SectionHeader({ children }) {
  const id = children.join("").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
  return (
    <h2 id={id}>
      <div class="before:contents-[''] before:relative before:-mt-20 before:block before:h-20 before:w-0 before:touch-none" />
      <a
        href={`#${id}`}
        className="font-bold no-underline after:mx-2 after:font-normal after:text-[#646464] after:opacity-0 after:transition-opacity after:duration-150 after:ease-in-out after:content-['#'] hover:after:opacity-100"
      >
        {children}
      </a>
    </h2>
  );
}

const CustomCode = ({ language, children }) => language ? (
  <Snippet language={language}>{children}</Snippet>
) : (
  <code>{children}</code>
);

function App() {
  var $selectedDoc = null;
  var $isHamburgerOpen = false;
  var $$TOC = [];
  var TOC = [];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          for (let i = 0; i < TOC.length; i++) {
            const isActive = TOC[i][1] === entry.target.id;
            console.log(TOC[i][1], entry.target.id, isActive);
            if (TOC[i][2] !== isActive) {
              TOC[i] = [TOC[i][0], TOC[i][1], isActive];
            }
          }
          $$TOC = TOC;
          break;
        }
      }
    },
    { threshold: 0.5, rootMargin: "0px 0px -50% 0px" }
  );
  const onLoadContent = (content) => {
    const sections = Array.from(content.getElementsByTagName("h2"));
    sections.forEach((section) => TOC.push([section.innerText, section.id, false]));
    $$TOC = TOC;
    sections.forEach((section) => observer.observe(section));
  };
  const onUnloadContent = (content) => {
    const sections = Array.from(content.getElementsByTagName("h2"));
    sections.forEach((section) => observer.unobserve(section));
    TOC.length = 0;
    $$TOC = TOC;
  };
  $createIEffect(() => {
    if (!$routeParams["*"]) {
      navigate("/docs/getting-started", true);
    } else {
      $selectedDoc = docsList.find((doc) => doc.route === $routeParams["*"]);
    }
  }, [$routeParams]);
  return (
    <div class="flex min-h-screen flex-col justify-between bg-[#111111]">
      <head>
        <title>Docs | Mango Framework</title>
        <meta
          name="description"
          content="A framework designed with performance and compatibility in mind."
        />
      </head>
      <div class="sticky top-0 z-20 w-full bg-transparent">
        <div class="pointer-events-none absolute z-[-1] h-full w-full  shadow-[0_-1px_0_rgba(255,255,255,.1)_inset] backdrop-blur-md"></div>
        <nav class="mx-auto flex h-16 max-w-[90rem] items-center justify-end gap-2 px-6">
          <a class="mr-auto flex items-center justify-center gap-2" href="/">
            <img src={logo} height={32} width={23.12} alt="mango logo" />
            <span class="text-2xl font-bold">Mango</span>
          </a>
          <a
            class="-ml-2 inline-block whitespace-nowrap p-2 text-sm font-semibold text-primary-500 subpixel-antialiased"
            href="/docs"
          >
            Docs
          </a>
          <a
            class="-ml-2 inline-block whitespace-nowrap p-2 text-sm font-semibold subpixel-antialiased"
            href="https://github.com/GeeekyBoy/mango"
            target="_blank"
          >
            GitHub
          </a>
          <button
            class="-mr-2 rounded p-2 active:bg-gray-400/20 md:hidden"
            aria-label="toggle navigation menu"
            onClick={() => ($isHamburgerOpen = !$isHamburgerOpen)}
          >
            <svg
              fill="none"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <g
                class="origin-center"
                className={$isHamburgerOpen ? "rotate-45" : ""}
                transition="transform .2s cubic-bezier(.25,1,.5,1)"
                transition={
                  $isHamburgerOpen
                    ? "transform .2s cubic-bezier(.25,1,.5,1) .2s"
                    : "transform .2s cubic-bezier(.25,1,.5,1)"
                }
              >
                <path
                  transform={$isHamburgerOpen ? "translate3d(0, 6px, 0)" : "translate3d(0, 0, 0)"}
                  transition={
                    $isHamburgerOpen
                      ? "transform .2s cubic-bezier(.25,1,.5,1),opacity 0s ease .2s"
                      : "transform .2s cubic-bezier(.25,1,.5,1) .2s,opacity .2s ease .2s"
                  }
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16"
                />
              </g>
              <path
                transition={
                  $isHamburgerOpen
                    ? "transform .2s cubic-bezier(.25,1,.5,1),opacity 0s ease .2s"
                    : "transform .2s cubic-bezier(.25,1,.5,1) .2s,opacity .2s ease .2s"
                }
                opacity={$isHamburgerOpen ? 0 : 1}
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 12h16"
              />
              <g
                class="origin-center"
                className={$isHamburgerOpen ? "-rotate-45" : ""}
                transition={
                  $isHamburgerOpen
                    ? "transform .2s cubic-bezier(.25,1,.5,1) .2s"
                    : "transform .2s cubic-bezier(.25,1,.5,1)"
                }
              >
                <path
                  transform={$isHamburgerOpen ? "translate3d(0, -6px, 0)" : "translate3d(0, 0, 0)"}
                  transition={
                    $isHamburgerOpen
                      ? "transform .2s cubic-bezier(.25,1,.5,1),opacity 0s ease .2s"
                      : "transform .2s cubic-bezier(.25,1,.5,1) .2s,opacity .2s ease .2s"
                  }
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 18h16"
                />
              </g>
            </svg>
          </button>
        </nav>
      </div>
      <div class="relative mx-auto flex w-full flex-1 justify-around">
        <div
          class="[transition:background-color_1.5s_ease] md:hidden motion-reduce:transition-none fixed inset-0 z-10"
          className={$isHamburgerOpen ? "bg-black/60" : "bg-transparent pointer-events-none"}
          onClick={() => $isHamburgerOpen = false}
        />
        <aside
          class="fixed top-0 z-10 flex w-full flex-col bg-black/50 pt-16 backdrop-blur-md md:relative md:w-64 md:flex-shrink-0 md:transform-none md:self-start md:bg-transparent md:pt-0 md:transition-none"
          className={!$isHamburgerOpen ? "-translate-y-full" : ""}
          transition="transform .8s cubic-bezier(.52,.16,.04,1)"
        >
          <div class="grow overflow-y-auto p-4 md:h-[calc(100vh-4rem-3.75rem)]">
            <ul class="flex flex-col gap-1">
              {docsList.map((doc) => (
                <li class="flex flex-col gap-1">
                  <a
                    class="flex break-words rounded px-2 py-1.5 text-sm transition-colors"
                    className={
                      doc === $selectedDoc
                        ? "bg-primary-500/10 text-primary-500"
                        : "hover:bg-primary-100/5 hover:text-gray-50"
                    }
                    href={"/docs" + doc.route}
                    onClick={(e) => {
                      e.preventDefault();
                      if (doc !== $selectedDoc) {
                        navigate("/docs" + doc.route);
                        $isHamburgerOpen = false;
                      }
                    }}
                  >
                    {doc.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <div class="order-last hidden w-64 flex-shrink-0 px-4 xl:block">
          <div class="sticky top-16 -mr-4 max-h-[calc(100vh-var(--nextra-navbar-height)-env(safe-area-inset-bottom))] overflow-y-auto pr-4 pt-8 text-sm [hyphens:auto]">
            <p class="mb-4 font-semibold tracking-tight">On This Page</p>
            <ul>
              <for of={$$TOC} render={($item) => (
                <li class="my-2 scroll-my-6 scroll-py-6">
                  <a
                    href={`#${$item[1]}`}
                    class="font-semibold"
                    className={
                      $item[2]
                        ? "text-primary-500"
                        : "text-gray-400 hover:text-gray-300"
                    }
                  >
                    {$item[0]}
                  </a>
                </li>
              )} />
            </ul>
            {$selectedDoc && (
              <div class="sticky bottom-0 mt-8 flex flex-col items-start gap-2 border-t border-neutral-800 pt-8 pb-8">
                <a
                  class="text-xs font-medium text-gray-400 hover:text-gray-100"
                  href={`https://github.com/GeeekyBoy/mango/blob/website/src/docs/${$selectedDoc.fileBasename}.mdx`}
                >
                  Edit this page on GitHub
                </a>
              </div>
            )}
          </div>
        </div>
        <article class="flex w-full min-w-0 max-w-4xl flex-1 justify-center pb-8">
          <main class="prose prose-invert w-full min-w-0 max-w-4xl px-6 pt-6 text-gray-100 prose-pre:bg-[#111111] md:px-8">
            {$selectedDoc ? (
              <lazy
                lazy:src={"/docs/" + $selectedDoc.fileBasename}
                lazy:glob="../../docs/*"
                lazy:loader={<Skeleton />}
                event:onCreate={onLoadContent}
                event:onDestroy={onUnloadContent}
                h2={SectionHeader}
                code={CustomCode}
              />
            ) : (
              <div class="flex h-full flex-col items-center justify-center">
                <h1 class="!mb-4 text-4xl font-bold">404</h1>
                <p class="!mt-4 text-xl">Page not found</p>
              </div>
            )}
          </main>
        </article>
      </div>
      <Footer />
    </div>
  );
}

document.body.appendChild(App());

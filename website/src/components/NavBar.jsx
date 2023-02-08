import logo from "../assets/img/mango.svg";

function NavBar() {
  return (
    <div class="sticky top-0 z-20 w-full bg-transparent">
      <div class="pointer-events-none absolute z-[-1] h-full w-full  shadow-[0_-1px_0_rgba(255,255,255,.1)_inset] backdrop-blur-md"></div>
      <nav class="mx-auto flex h-16 max-w-[90rem] items-center justify-end gap-2 px-6">
        <a class="mr-auto flex items-center justify-center gap-2" href="/">
          <img src={logo} height={32} width={23.12} alt="mango logo" />
          <span class="text-2xl font-bold">Mango</span>
        </a>
        <a
          class="-ml-2 inline-block whitespace-nowrap p-2 text-sm font-semibold subpixel-antialiased"
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
      </nav>
    </div>
  );
}

export default NavBar;

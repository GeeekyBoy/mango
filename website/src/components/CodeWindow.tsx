type CodeWindowProps = {
  language: string;
  htmlCode: string;
  children: Element[];
  highlighter: (elem: HTMLElement) => void;
};

function CodeWindow({
  language = "jsx",
  htmlCode,
  children,
  highlighter,
}: CodeWindowProps) {
  if (children?.length && htmlCode) {
    throw new Error("CodeWindow can only accept one of code or htmlCode");
  }
  if (children?.length && !highlighter) {
    throw new Error("CodeWindow requires a highlighter when using children");
  }
  return (
    <div class="relative m-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-slate-800 bg-slate-900/70 shadow-xl ring-1 ring-inset ring-white/10 backdrop-blur">
      <div class="flex-none border-b border-slate-500/30">
        <div class="flex h-8 items-center space-x-1.5 px-3">
          <div class="h-2.5 w-2.5 rounded-full bg-slate-600"></div>
          <div class="h-2.5 w-2.5 rounded-full bg-slate-600"></div>
          <div class="h-2.5 w-2.5 rounded-full bg-slate-600"></div>
        </div>
      </div>
      <pre class="!m-0 flex min-h-full !bg-transparent !p-0 text-sm leading-6">
        {children?.length ? (
          <code
            class="relative block flex-auto overflow-auto p-6 text-slate-50"
            className={`language-${language}`}
            onCreate={highlighter}
          >
            {children}
          </code>
        ) : (
          <code
            class="relative block flex-auto overflow-auto p-6 text-slate-50"
            innerHTML={htmlCode}
          />
        )}
      </pre>
    </div>
  );
}

export default CodeWindow;

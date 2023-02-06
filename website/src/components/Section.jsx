function Section({
  id,
  titlePrefix,
  title,
  demo,
  demoAlign = "center",
  titleColor,
  contentColor,
  bgImage,
  bgOverlay = 0,
  children,
}) {
  return (
    <section
      id={id}
      class="col-span-4 rounded-xl mx-auto mb-12 max-w-screen-xl px-6 md:px-8"
      class={bgImage ? `py-16 bg-cover bg-center bg-blend-multiply` : "py-12"}
      style:backgroundImage={bgImage ? `url(${bgImage})` : ""}
      style:backgroundColor={bgImage ? `rgba(11, 17, 33, ${bgOverlay})` : ""}
    >
      <div
        class="grid gap-x-4 gap-y-8"
        class={demoAlign !== "center" ? "lg:grid-cols-2 lg:gap-12" : ""}
      >
        <div
          class="space-y-4"
          class={demoAlign === "left" ? "lg:order-2" : "order-1" }
        >
          <h2
            class="w-full text-4xl font-bold lg:text-6xl"
            class={demoAlign === "center" ? "text-center" : ""}
          >
            {titlePrefix && (
              <span
                class={"mb-2 block w-fit p-1 " + titleColor}
                class={demoAlign === "center" ? "mx-auto font-normal bg-clip-text text-transparent block p-0" : "text-[#0b1121]"}
              >
                {titlePrefix}
              </span>
            )}
            <span class={"block bg-clip-text text-transparent " + titleColor}>
              {title}
            </span>
          </h2>
          <div
            class={"text-lg lg:text-xl " + contentColor}
            class={demoAlign === "center" ? "m-auto max-w-3xl text-center text-xl" : ""}
          >
            {children}
          </div>
        </div>
        <div
          class="m-auto w-full md:px-0"
          class={demoAlign === "left" ? "lg:order-1" : "order-2" }
          class={demoAlign === "center" ? "md:w-[640px]" : "" }
        >
          {demo}
        </div>
      </div>
    </section>
  );
}

export default Section;

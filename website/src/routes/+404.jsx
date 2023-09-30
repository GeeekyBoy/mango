import Footer from "../components/Footer";
import NavBar from "../components/NavBar";

function App() {
  return (
    <div class="flex min-h-screen flex-col justify-between bg-[#111111]">
      <head>
        <title>404 | Mango Framework</title>
        <meta
          name="description"
          content="A framework designed with performance and compatibility in mind."
        />
      </head>
      <NavBar />
      <div class="relative mx-auto flex w-full flex-1 justify-around">
        <article class="flex w-full min-w-0 max-w-4xl flex-1 justify-center pb-8">
          <main class="prose prose-invert w-full min-w-0 max-w-4xl px-6 pt-6 text-gray-100 prose-pre:bg-[#111111] md:px-8">
            <div class="flex h-full flex-col items-center justify-center">
              <h1 class="!mb-4 text-4xl font-bold">404</h1>
              <p class="!mt-4 text-xl">Page not found</p>
            </div>
          </main>
        </article>
      </div>
      <Footer />
    </div>
  );
}

export default App;

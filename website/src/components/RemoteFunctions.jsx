import CodeWindow from "./CodeWindow";
import { beforeDemoHighlight, afterDemoHighlight } from "./RemoteFunctions.ssg";
import fireEmoji from "../assets/img/fire-emoji.png";
import { encrypt, decrypt } from "../util/encryption.remote";

function RemoteFunctions() {
  let $msg = "Hello World!";
  const handleEncrypt = async () => {
    $msg = await encrypt($msg);
  };
  const handleDecrypt = async () => {
    try {
      $msg = await decrypt($msg);
    } catch (e) {
      alert(e.error);
    }
  };
  return (
    <section
      id="remote-functions"
      class="col-span-4 mx-auto mb-4 max-w-screen-xl rounded-xl px-6 py-12 md:mb-12"
    >
      <div class="center grid gap-x-4 gap-y-12">
        <h2 class="w-full text-center text-4xl font-bold lg:text-6xl">
          <img
            src={fireEmoji}
            alt="fire emoji"
            class="m-auto h-28 w-28 lg:h-32 lg:w-32"
          />
          <span class="block bg-vivid-indigo bg-clip-text text-transparent">
            Remote Functions
          </span>
        </h2>
        <div class="m-auto grid w-full grid-cols-1 items-center justify-items-center gap-x-6 gap-y-8 lg:grid-cols-11 lg:px-0">
          <div class="relative m-auto w-full lg:col-span-5 lg:h-64">
            <CodeWindow htmlCode={beforeDemoHighlight} style:height="100%" />
          </div>
          <svg
            class="w-full lg:col-span-1 lg:-rotate-90"
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>

          <div class="relative m-auto w-full lg:col-span-5 lg:h-64">
            <CodeWindow htmlCode={afterDemoHighlight} style:height="100%" />
          </div>
          <div class="mx-4 -mt-12 flex flex-col items-center justify-center gap-4 justify-self-stretch rounded-xl bg-[linear-gradient(45deg,hsl(270deg,67%,25%)-15%,hsl(212deg,100%,30%))] p-4 pt-12 lg:col-span-full lg:-mt-36 lg:pt-36">
            <input
              placeholder="Search by name..."
              class="w-full max-w-xl rounded-md border-2 border-white bg-transparent p-2 text-gray-100 outline-none"
              bind:value={$msg}
            />
            <div class="flex flex-row gap-4 transition-colors">
              <button
                class="w-32 rounded-lg border-2 border-white bg-transparent py-1 text-gray-100"
                onClick={handleEncrypt}
              >
                Encrypt
              </button>
              <button
                class="w-32 rounded-lg border-2 border-white bg-transparent py-1 text-gray-100"
                onClick={handleDecrypt}
              >
                Decrypt
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default RemoteFunctions;

import Section from "../components/Section";
import SyntaticSugar from "../components/SyntaticSugar";
import Hero from "../components/Hero";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";
import ListDemo from "../components/demos/ListDemo";
import AnimationDemo from "../components/demos/AnimationDemo";
import VideoDemo from "../components/demos/VideoDemo";
import BarChart from "../components/BarChart";
import ie6Logo from "../assets/img/ie6.png";
import ff1Logo from "../assets/img/ff1.png";
import chrome1Logo from "../assets/img/chrome1.png";
import safari1Logo from "../assets/img/safari1.png";
import ecoBG from "../assets/img/eco.jpg";
import earthBG from "../assets/img/earth.jpg";
import { ip } from "./ip.ssr";

function App() {
  return (
    <div class="bg-black">
      <head>
        <title>Mango Framework</title>
        <meta
          name="description"
          content="A framework designed with performance and compatibility in mind."
        />
      </head>
      <NavBar />
      <Hero />
      <Section
        id="ecofriendly"
        title="Eco Friendly"
        demo={
          <div class="grid grid-cols-[repeat(2,minmax(0,128px))] items-center justify-center gap-8 sm:grid-cols-[repeat(4,minmax(0,128px))]">
            <img
              src={ie6Logo}
              width="128px"
              height="128px"
              alt="internet explorer 6 logo"
            />
            <img
              src={ff1Logo}
              width="128px"
              height="128px"
              alt="firefox 1 logo"
            />
            <img
              src={chrome1Logo}
              width="128px"
              height="128px"
              alt="chrome 1 logo"
            />
            <img
              src={safari1Logo}
              width="128px"
              height="128px"
              alt="safari 1 logo"
            />
          </div>
        }
        demoAlign="center"
        titleColor="bg-vivid-green"
        contentColor="text-gray-100"
        bgImage={ecoBG}
        bgOverlay={0.15}
      >
        <p>
          For the sake of reduced carbon footprint, Mango is designed to be
          compatible with every browser released since 1999. In addition, It's
          very small and uses negligible memory and CPU processing power.
        </p>
      </Section>
      <Section
        id="dynamiccontent"
        title="Dynamic Content"
        demo={
          <div class="w-full text-center text-xl font-bold">
            YOUR IP ADDRESS
            <br />
            <span class="m-auto block max-w-xs break-words text-center text-4xl">
              {ip}
            </span>
          </div>
        }
        demoAlign="center"
        titleColor="bg-vivid-lavender"
        contentColor="text-gray-100"
        bgImage={earthBG}
        bgOverlay={0.4}
      >
        <p>
          Whatever your content is dynamically generated at runtime or
          compile-time, Mango can handle it. All pages templates are loaded into
          the server memory to make sure that content is populated and served as
          fast as possible.
        </p>
      </Section>
      <SyntaticSugar />
      <Section
        id="nativeperformance"
        titlePrefix="Native"
        title="Performance"
        demo={<ListDemo />}
        demoAlign="right"
        titleColor="bg-vivid-green"
        contentColor="text-gray-100"
      >
        <p class="mb-4">
          Mango does not use a virtual DOM but instead applies changes through
          DOM API. To reduce the time needed to render changes, only attributes
          whose values have changed are updated natively without re-rendering
          the entire element.
        </p>
        <p>
          Innovated techniques are used to manipulate and render massive lists
          efficiently. This is done by manipulating values of elements
          attributes instead of replacing the existing elements with new ones.
        </p>
      </Section>
      <Section
        id="friendlytomemory"
        titlePrefix="Friendly"
        title="To Memory"
        demo={<BarChart />}
        demoAlign="center"
        titleColor="bg-vivid-indigo"
        contentColor="text-gray-100"
      >
        <p>
          Every piece of data retained by Mango is optimized for low memory
          consumption. This makes it ideal for building web applications that
          are used on small gadgets.
        </p>
      </Section>
      <Section
        id="powerefficient"
        title="Power Efficient"
        demo={<AnimationDemo />}
        demoAlign="left"
        titleColor="bg-vivid-red"
        contentColor="text-gray-100"
      >
        <p>
          Unlike other frameworks, Mango exploits the existing implementation of
          DOM API to render any change that happened. It does not use a virtual
          DOM, nor re-render the entire element when a change occurs. Instead,
          it uses publisher-subscriber design pattern to update the attributes
          of the updated element natively. This secures enough resources to run
          heavy tasks such as JavaScript-driven animations.
        </p>
      </Section>
      <Section
        id="powerefficient"
        title="Bound Attributes"
        demo={<VideoDemo />}
        demoAlign="right"
        titleColor="bg-vivid-purple"
        contentColor="text-gray-100"
      >
        <p>
          Developing custom media players and form controls isn't a problem
          anymore. Mango provides a set of attributes that can be kept in sync
          with any state variable. Whenever the state of your application
          changes, the bound attributes are updated automatically. The same
          applies when the value of a bound attribute changes, where the state
          variable is updated accordingly.
        </p>
      </Section>
      <Footer />
    </div>
  );
}
export default App;
document.body.appendChild(App());

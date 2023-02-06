import * as styles from "./styles.module.scss";
import moonEmoji from "../assets/img/first_quarter_moon_face_3d.gif";
import sunEmoji from "../assets/img/sun_with_face_3d.gif";

function App() {
  var $isDark = false;
  return (
    <div class={styles.root} className={$isDark ? styles.dark : ""}>
      <head>
        <title>Mango App</title>
        <meta name="description" content="A template for getting started with Mango." />
      </head>
      <lazy lazy:src="../components/Time.jsx" />
      <button class={styles.themeToggler} onClick={function () { $isDark = !$isDark; }}>
        <img src={$isDark ? moonEmoji : sunEmoji} alt="theme toggle" width={36} height={36} position="relative" />
      </button>
      <footer>
        <center position="relative">
          <small>
            This page is powered by <a href="https://mangojs.geeekyboy.com">Mango Framework</a>
            <br />
            <a href="https://github.com/microsoft/fluentui-emoji">Fluent Emojis</a> are designed by Microsoft and backgrounds are from <a href="https://fluenticons.co/">fluenticons.co</a>
          </small>
        </center>
      </footer>
    </div>
  );
}

document.body.appendChild(App());

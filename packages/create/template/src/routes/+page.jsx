import * as styles from "./styles.module.scss";
import moonEmoji from "../assets/img/first_quarter_moon_face_3d.gif";
import sunEmoji from "../assets/img/sun_with_face_3d.gif";

export default function App() {
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
      <a class={styles.languageSwitcher} href={$t("app.lang") === "en" ? "/ar" : "/en"}>
        {$t("app.lang") === "en" ? "العربية" : "English"}
      </a>
      <footer>
        <center position="relative">
          <small>
            {$t("app.footer.poweredBy")} <a href="https://mangojs.geeekyboy.com">{$t("app.brands.mangoFramework")}</a>
            <br />
            <$t id="app.footer.emojisCredits">
              <a href="https://github.com/microsoft/fluentui-emoji">{$t("app.brands.fluentEmojis")}</a>
              <a href="https://fluenticons.co/">fluenticons.co</a>
            </$t>
          </small>
        </center>
      </footer>
    </div>
  );
}

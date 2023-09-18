import * as styles from "./Time.module.scss";
import clockEmoji from "../assets/img/eight_oclock_3d.gif";

function Time() {
  var $time = /\d\d:\d\d:\d\d/.exec(new Date())[0];
  setInterval(function () {
    $time = /\d\d:\d\d:\d\d/.exec(new Date())[0];
  }, 1000);
  return (
    <div class={styles.timeContainer}>
      <img src={clockEmoji} alt="clock" width={128} height={128} position="absolute" left={0} top={10} />
      <p position="absolute" left={143} width={280}>
        <b>{$t("app.timer.title")}</b>
        <b>{$time}</b>
      </p>
    </div>
  );
}

export default Time;

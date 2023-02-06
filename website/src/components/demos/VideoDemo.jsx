import PlayIcon from "jsx:@fluentui/svg-icons/icons/play_24_regular.svg";
import PauseIcon from "jsx:@fluentui/svg-icons/icons/pause_24_regular.svg";
import SpeakerOffIcon from "jsx:@fluentui/svg-icons/icons/speaker_off_24_regular.svg";
import Speaker1Icon from "jsx:@fluentui/svg-icons/icons/speaker_1_24_regular.svg";
import Speaker2Icon from "jsx:@fluentui/svg-icons/icons/speaker_2_24_regular.svg";
import Range from "./Range"
import * as styles from "./VideoDemo.module.scss";
import film from "url:../../assets/movies/caminandes-llamigos.mp4";
import filmPoster from "../../assets/img/caminandes-llamigos.jpg";

function AnimationDemo() {
  var $progress = 0;
  var $volume = 1;
  var $duration;
  var $isPaused = true;
  var $isMuted = false;
  var $showControls = true;

	let showControlsTimeout;
	let lastMouseDown;

  function handleRootMouseMove(e) {
    e.preventDefault();
		clearTimeout(showControlsTimeout);
		showControlsTimeout = setTimeout(() => $showControls = false, 2500);
		$showControls = true;
  }

	function handleMove(e) {
    e.preventDefault();
		if (!$duration) return;
		if (e.type !== 'touchmove' && !(e.buttons & 1)) return;
		const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
		const { left, right } = this.getBoundingClientRect();
		$progress = $duration * (clientX - left) / (right - left);
	}
	function handleMousedown() {
		lastMouseDown = new Date();
	}
	function handleMouseup(e) {
		if (new Date() - lastMouseDown < 300) {
			if ($isPaused) e.target.play();
			else e.target.pause();
		}
	}
  function handleMouseWheel(e) {
    e.preventDefault();
    $volume = Math.max(0, Math.min(1, $volume - e.deltaY / 6000));
  }
	function format(seconds) {
		if (isNaN(seconds)) return '...';
		const minutes = Math.floor(seconds / 60);
    let milliseconds = Math.floor(seconds % 1 * 1000);
    if (milliseconds < 10) milliseconds = '00' + milliseconds;
    else if (milliseconds < 100) milliseconds = '0' + milliseconds;
		seconds = Math.floor(seconds % 60);
		if (seconds < 10) seconds = '0' + seconds;
		return `${minutes}:${seconds}:${milliseconds}`;
	}
  return (
    <div
      class={styles.root}
      onMouseMove={handleRootMouseMove}
      onTouchMove={handleRootMouseMove}
    >
      <video
        poster={filmPoster}
        src={film}
        onMouseMove={handleMove}
        onTouchMove={handleMove}
        onMouseDown={handleMousedown}
        onMouseUp={handleMouseup}
        onWheel={handleMouseWheel}
        bind:currentTime={$progress}
        bind:duration={$duration}
        bind:paused={$isPaused}
        bind:volume={$volume}
        bind:muted={$isMuted}
      >
        <track kind="captions" />
      </video>
      <div class={styles.title} style:opacity={$isPaused || ($duration && $showControls) ? "1" : "0"}>
        <a href="https://youtu.be/SkVqJ1SGeL0" target="_blank">
          Caminandes: Llamigos
        </a>
        <p>by Blender Foundation</p>
      </div>
      <div class={styles.controls} style:opacity={$isPaused || ($duration && $showControls) ? "1" : "0"}>
        <Range min={0} max={$duration || 0} $value={$progress} />
        <div class={styles.info}>
          {$isPaused ? (
            <PlayIcon
              event:onclick={() => $isPaused = false}
              style:fill="#ffffff"
              style:opacity="0.9"
              style:cursor="pointer"
            />
          ) : (
            <PauseIcon
              event:onclick={() => $isPaused = true}
              style:fill="#ffffff"
              style:opacity="0.9"
              style:cursor="pointer"
            />
          )}
          {$isMuted || $volume === 0 ? (
            <SpeakerOffIcon
              event:onclick={() => $isMuted = !$isMuted}
              style:fill="#ffffff"
              style:opacity="0.9"
              style:cursor="pointer"
            />
          ) : $volume < 0.5 ? (
            <Speaker1Icon
              event:onclick={() => $isMuted = !$isMuted}
              style:fill="#ffffff"
              style:opacity="0.9"
              style:cursor="pointer"
            />
          ) : (
            <Speaker2Icon
              event:onclick={() => $isMuted = !$isMuted}
              style:fill="#ffffff"
              style:opacity="0.9"
              style:cursor="pointer"
            />
          )}
          <input
            class="w-16"
            type="range"
            min="0"
            max="1"
            step="0.01"
            bind:value={$volume}
            aria-label="animation seek bar"
            style:accentColor="white"
            style:opacity="0.9"
          />
          <div>
            <span class={styles.time}>{format($progress)}</span>
            <span>/</span>
            <span class={styles.time}>{format($duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnimationDemo;

import animations from "../../util/animations";
import PlayIcon from "jsx:@fluentui/svg-icons/icons/play_24_regular.svg";
import PauseIcon from "jsx:@fluentui/svg-icons/icons/pause_24_regular.svg";
import StopIcon from "jsx:@fluentui/svg-icons/icons/stop_24_regular.svg";

function AnimationDemo() {
  var $firstX = 0;
  var $firstScale = 1;
  var $secondX = 0;
  var $secondScale = 1;
  var $thirdX = 0;
  var $thirdScale = 1;
  var $progress = 0;
  var $fps = "--";
  var $isPlaying = true;
  var progressUp = true;
  $createEffect(() => {
    const easingFn = progressUp
      ? animations.easeInOutElastic
      : animations.easeInOutExpo;
    $firstX = 250 * easingFn($progress);
    $firstScale = 1 + 0.5 * easingFn($progress);
    $secondX = 250 * easingFn($progress + 0.04);
    $secondScale = 1 + 0.5 * easingFn($progress + 0.04);
    $thirdX = 250 * easingFn($progress + 0.08);
    $thirdScale = 1 + 0.5 * easingFn($progress + 0.08);
  });
  const progressCounter = () => {
    if (delayRemaining-- > 0) {
      return;
    }
    if (progressUp) {
      if ($progress + 0.006 >= 1) {
        $progress = 1;
        progressUp = false;
        delayRemaining = 50;
      } else {
        $progress += 0.006;
      }
    } else {
      if ($progress - 0.006 <= 0) {
        $progress = 0;
        progressUp = true;
        delayRemaining = 50;
      } else {
        $progress -= 0.006;
      }
    }
  };
  var delayRemaining = 50;
  const play = () => {
    $isPlaying = true;
    let be = Date.now();
    let nextUpdate = 0;
    let remainingTillNextUpdate = 0;
    requestAnimationFrame(function loop() {
      let now = Date.now();
      nextUpdate = Math.round(1000 / (now - be));
      if (remainingTillNextUpdate-- <= 0) {
        $fps = nextUpdate;
        remainingTillNextUpdate = 20;
      }
      be = now;
      if ($isPlaying) {
        requestAnimationFrame(loop);
      } else {
        $fps = "--";
      }
      progressCounter();
    });
  };
  const pause = () => {
    $isPlaying = false;
    delayRemaining = 0;
  };
  const stop = () => {
    pause();
    $progress = 0;
    progressUp = true;
  };
  const toggle = () => {
    if ($isPlaying) pause();
    else play();
  };
  play();
  return (
    <div class="relative flex w-full flex-col items-center justify-center gap-4 m-auto">
      <div class="w-[300px]">
        <div
          class="relative mb-2 h-12 w-12 rounded-full bg-green-500"
          transform={`translateX(${$firstX}px) scale(${$firstScale})`}
        />
        <div
          class="relative mb-2 h-12 w-12 rounded-full bg-blue-500"
          transform={`translateX(${$secondX}px) scale(${$secondScale})`}
        />
        <div
          class="relative h-12 w-12 rounded-full bg-red-500"
          transform={`translateX(${$thirdX}px) scale(${$thirdScale})`}
        />
      </div>
      <input
        class="w-full"
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={$progress}
        aria-label="animation seek bar"
      />
      <div class="flex flex-row gap-4">
        <button onClick={toggle} aria-label="toggle animation">
          {$isPlaying ? (
            <PauseIcon style:fill="#ffffff" />
          ) : (
            <PlayIcon style:fill="#ffffff" />
          )}
        </button>
        <button onClick={stop} aria-label="stop animation">
          <StopIcon style:fill="#ffffff" />
        </button>
      </div>
      <span class="text-xl text-gray-100">
        {Math.round($progress * 100)}% @ {$fps} fps
      </span>
    </div>
  );
}

export default AnimationDemo;

import * as styles from "./Range.module.scss";

type RangeProps = {
  min: number;
  max: number;
  $value: number;
};

function Range({
  min,
  max,
  $value,
}: RangeProps) {
  var $element: HTMLDivElement;

  let container: HTMLDivElement;
  let thumb: HTMLDivElement;
  let progressBar: HTMLDivElement | null = null;
  let currentThumb: HTMLDivElement | null = null;

  function onTrackEvent(e: MouseEvent | TouchEvent) {
    updateValueOnEvent(e);
    onDragStart();
  }

  function onDragStart() {
    currentThumb = thumb;
  }

  function onDragEnd() {
    currentThumb = null;
  }

  function calculateNewValue(clientX: number) {
    const elementX = $element.getBoundingClientRect().left;
    const delta = clientX - (elementX + 10);
    let percent = (delta * 100) / (container.clientWidth - 10);
    percent = percent < 0 ? 0 : percent > 100 ? 100 : percent;
    $value = (percent * (max - min)) / 100 + min;
  }

  function updateValueOnEvent(e: MouseEvent | TouchEvent) {
    if (!currentThumb && e.type !== "touchstart" && e.type !== "mousedown") {
      return false;
    }

    e.stopPropagation();
    e.preventDefault();

    const clientX = e instanceof TouchEvent
      ? e.touches[0].clientX
      : e.clientX;

    calculateNewValue(clientX);
  }

  $createEffect(() => {
    if (progressBar && thumb) {
      $value = $value > min ? $value : min;
      $value = $value < max ? $value : max;
      let percent = (($value - min) * 100) / (max - min);
      let offsetLeft = (container.clientWidth - 10) * (percent / 100) + 5;
      thumb.style.left = `${offsetLeft}px`;
      progressBar.style.width = `${offsetLeft}px`;
    }
  });

  window.addEventListener("resize", function() {
    if (progressBar && thumb) {
      let percent = (($value - min) * 100) / (max - min);
      let offsetLeft = (container.clientWidth - 10) * (percent / 100) + 5;
      thumb.style.left = `${offsetLeft}px`;
      progressBar.style.width = `${offsetLeft}px`;
    }
  })

  return (
    <div
      class={styles.root}
      onTouchMove={updateValueOnEvent}
      onTouchCancel={onDragEnd}
      onTouchEnd={onDragEnd}
      onMouseMove={updateValueOnEvent}
      onMouseUp={onDragEnd}
    >
      <div
        class={styles.range__wrapper}
        bind:this={$element}
        tabIndex={0}
        role="slider"
        aria-label="seekbar"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={$value}
        onMouseDown={onTrackEvent}
        onTouchStart={onTrackEvent}
      >
        <div class={styles.range__track} ref={container}>
          <div class={styles.range__track__highlighted} ref={progressBar} />
          <div
            class={styles.range__thumb}
            ref={thumb}
            onTouchStart={onDragStart}
            onMouseDown={onDragStart}
          />
        </div>
      </div>
    </div>
  )
}

export default Range;

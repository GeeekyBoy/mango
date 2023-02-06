function BarChart() {
  var dataset = [
    ["Mango", 18.57, "linear-gradient(45deg, #ffe259, #ffa751)"],
    ["Svelte", 22.86, "linear-gradient(45deg, #dd0000, #ff7700)"],
    ["Vue", 26.77, "linear-gradient(45deg, #00d6a3, #44ffcd)"],
    ["React", 34.65, "linear-gradient(45deg, #3255ff, #00c8ff)"],
  ];
  return (
    <div class="flex w-full flex-col gap-4">
      <div class="flex w-full flex-row items-center justify-between text-gray-100">
        <div class="flex flex-1 flex-col items-start justify-center gap-1.5">
          {dataset.map((item) => (
            <div class="relative flex w-full flex-row items-center justify-start gap-1.5">
              <span class="min-w-[3.5rem] text-sm">{item[0]}</span>
              <div
                class="h-2 rounded-full"
                style={{ width: `${(item[1] / 34.65) * 100}%` }}
                background={item[2]}
              />
              <span class="text-sm">{item[1]}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p class="text-center text-sm text-tertiary">
          Size of memory snapshot when 10K rows are rendered. Unit: megabytes
        </p>
      </div>
    </div>
  );
}

export default BarChart;

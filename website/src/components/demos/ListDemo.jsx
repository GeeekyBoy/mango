import RemoveIcon from "jsx:@fluentui/svg-icons/icons/delete_24_regular.svg";
import avatarImg from "../../assets/img/avatar.jpg";

function ListDemo() {
  var $search = "";
  var $$results = [];
  var $selected = undefined;
  const data = new Array(100).fill(0).map((_, i) => ({
    id: i,
    name: "Joe Doe " + (i + 1),
    email: "joedoe" + (i + 1) + "@example.com",
  }));
  $$results = data;
  $createEffect(() => {
    $$results = data.filter((d) =>
      d.name.toLowerCase().includes($search.toLowerCase())
    );
  })
  return (
    <div class="relative flex h-[420px] flex-col gap-2 overflow-auto text-gray-100">
      <input
        placeholder="Search by name..."
        class="rounded-md border-2 border-white bg-transparent p-2 text-gray-100 outline-none"
        bind:value={$search}
      />
      {$search && (
        <span class="text-gray-100">Showing results for: {$search}</span>
      )}
      <div class="flex h-full flex-col gap-2 overflow-auto">
        <for of={$$results} render={($item) => (
          <>
          <div
            class="flex flex-row gap-4 rounded-md border-2 p-4 transition-colors"
            class={$item.id === $selected ? "border-[#44ffcd]" : "border-white"}
            onClick={() => ($selected = $item.id)}
          >
            <div class="flex flex-col justify-center">
              <img
                class="h-12 w-12 rounded-full bg-gray-300"
                src={avatarImg}
                alt={`avatar of ${$item.name}`}
              />
            </div>
            <div class="flex flex-1 flex-col justify-center overflow-hidden">
              <div class="overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold text-gray-100">
                {$item.name}
              </div>
              <div class="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-secondary">
                {$item.email}
              </div>
            </div>
            <div class="flex flex-col justify-center">
              <button
                class="flex h-8 w-8 items-center justify-center rounded bg-transparent transition-colors"
                aria-label="remove item"
                onClick={(e) => {
                  e.stopPropagation();
                  data.splice(data.indexOf($item), 1);
                  $$results = data;
                }}
              >
                <RemoveIcon
                  style:fill={$item.id === $selected ? "#44ffcd" : "#ffffff"}
                />
              </button>
            </div>
          </div></>
        )} />
      </div>
    </div>
  );
}

export default ListDemo;

export default function App() {
  let rowId = 1,
  data = [],
  $$data = $keyedArray([], (item) => item.id),
  $selected = undefined;

  const add = () => {
      data = data.concat(buildData(1000));
      $$data = data;
    },
    clear = () => {
      data = [];
      $$data = data;
      $selected = undefined;
    },
    partialUpdate = () => {
      for (let i = 0; i < data.length; i += 10) {
        data[i] = { ...data[i], label: data[i].label + ' !!!' };
      }
      $$data = data;
    },
    remove = (num) => {
      const idx = data.findIndex(d => d.id === num);
      data = [...data.slice(0, idx), ...data.slice(idx + 1)];
      $$data = data;
    },
    run = () => {
      data = buildData(1000);
      $$data = data;
      $selected = undefined;
    },
    runLots = () => {
      data = buildData(10000);
      $$data = data;
      $selected = undefined;
    },
    select = (id) => $selected = id,
    swapRows = () => {
      if (data.length > 998) {
        data = [data[0], data[998], ...data.slice(2, 998), data[1], data[999]];
        $$data = data;
      }
    };

  function _random (max) { return Math.round(Math.random() * 1000) % max; };

  function buildData(count = 1000) {
    const adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"],
      colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"],
      nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"],
      data = new Array(count);
    for (var i = 0; i < count; i++)
      data[i] = { id: rowId++, label: adjectives[_random(adjectives.length)] + " " + colours[_random(colours.length)] + " " + nouns[_random(nouns.length)] };
    return data;
  }
  return (
    <div class="container">
      <div class="jumbotron">
        <div class="row">
          <div class="col-md-6">
            <h1>Mango (keyed)</h1>
          </div>
          <div class="col-md-6">
            <div class="row">
              <div class="col-sm-6 smallpad">
                <button type="button" class="btn btn-primary btn-block" id="run" onClick={run}>
                  Create 1,000 rows
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button type="button" class="btn btn-primary btn-block" id="runlots" onClick={runLots}>
                  Create 10,000 rows
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button type="button" class="btn btn-primary btn-block" id="add" onClick={add}>
                  Append 1,000 rows
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button type="button" class="btn btn-primary btn-block" id="update" onClick={partialUpdate}>
                  Update every 10th row
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button type="button" class="btn btn-primary btn-block" id="clear" onClick={clear}>
                  Clear
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button type="button" class="btn btn-primary btn-block" id="swaprows" onClick={swapRows}>
                  Swap Rows
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <table class="table table-hover table-striped test-data">
        <tbody>
          <for of={$$data} render={($row) => (
            <tr class={$selected === $row.id ? 'danger' : ''}>
              <td class="col-md-1">{$row.id}</td>
              <td class="col-md-4">
                <a onClick={() => select($row.id)}>{$row.label}</a>
              </td>
              <td class="col-md-1">
                <a onClick={() => remove($row.id)}>
                  <span class="glyphicon glyphicon-remove" aria-hidden="true" />
                </a>
              </td>
              <td class="col-md-6" />
            </tr>
          )} />
        </tbody>
      </table>
      <span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true"></span>
    </div>
  );
}

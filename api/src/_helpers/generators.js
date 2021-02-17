function* pairwise(iter) {
  let last;
  let firstLoop = true;
  for (const it of iter) {
    if (firstLoop) {
      firstLoop = false;
    } else {
      yield [last, it];
    }
    last = it;
  }
}

function* enumerate(iter) {
  let i = 0;
  for (const it of iter) {
    yield [i, it];
    i++;
  }
}

const map = (fn) =>
  function* (iter) {
    for (const [i, it] of enumerate(iter)) {
      yield fn(it, i);
    }
  };

const filter = (fn) =>
  function* (iter) {
    for (const it of iter) {
      if (fn(it)) {
        yield it;
      }
    }
  };

const reduce = (fn, init) => (iter) => {
  let acc = init;
  for (const it of iter) {
    acc = fn(acc, it);
  }
  return acc;
};

const scan = (fn) =>
  function* (iter, init) {
    let acc = init;
    for (const it of iter) {
      acc = fn(acc, it);
      yield acc;
    }
  };

const flow = (...reducers) => (input) => reducers.reduce((c, fn) => fn(c), input);

module.exports = {
  filter,
  map,
  enumerate,
  pairwise,
  flow,
  reduce,
  scan,
};

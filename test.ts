const range = {
  from: 1,
  to: 3,
  [Symbol.iterator]() {
    let cur = this.from;
    const last = this.to;
    return {
      next: () => (cur <= last ? { value: cur++, done: false } : { value: undefined, done: true })
    };
  }
};

Promise.allSettled([...range]).then((result) => console.log(result)); // [1, 2, 3]

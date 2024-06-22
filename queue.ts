class Queue<Type> {
  protected queue : Array<Type>;

  constructor() {
    this.queue = [];
  }

  public add(elem : Type) : number {
    for (let oldElem of this.queue) {
      if (elem === oldElem) {
	return this.queue.length;
      }
    }

    return this.queue.push(elem);
  }

  public remove() : Type | undefined {
    return this.queue.shift();
  }

  public get length() : number {
    return this.queue.length;
  }

  public [Symbol.iterator]() : IterableIterator<Type> {
    return this.queue[Symbol.iterator]();
  }
}

export { Queue };

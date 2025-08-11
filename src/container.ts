export type Newable<
  TInstance = unknown,
  TArgs extends unknown[] = any[],
> = new (...args: TArgs) => TInstance;

export type CtorType = {
  ctor: Newable;
  type: "transient" | "scoped" | "singleton";
};

export class Container {
  #map = new WeakMap<symbol, CtorType>();

  addTransient(token: symbol, ctor: Newable) {
    this.#map.set(token, {
      ctor,
      type: "transient",
    });
  }

  addScoped(token: symbol, ctor: Newable) {
    this.#map.set(token, {
      ctor,
      type: "scoped",
    });
  }

  resolve<T = unknown>(token: symbol): T {
    const scopedMap = new WeakMap();

    const obj = this.#map.get(token);
    if (!obj) throw new Error(`Token not found: ${String(token)}`);

    const ctor = new obj.ctor() as T;

    const meta = obj.ctor[Symbol.metadata];
    if (!meta) return ctor;

    for (const key of Object.getOwnPropertyNames(meta)) {
      const depToken = meta[key] as symbol;
      let depCtor: any = {};
      if (obj.type === "scoped") {
        depCtor = scopedMap.has(depToken)
          ? scopedMap.get(depToken)
          : this.resolve(depToken);

        scopedMap.set(depToken, depCtor);
      } else if (obj.type === "transient") {
        depCtor = this.resolve(depToken);
      }
      Object.defineProperty(ctor, key, {
        value: depCtor,
        writable: true,
      });
    }

    return ctor;
  }
}

export function Inject(token: Symbol) {
  return (_: undefined, ctx: ClassFieldDecoratorContext) => {
    ctx.metadata[ctx.name] = token;
  };
}

export type Newable<
  TInstance = unknown,
  TArgs extends unknown[] = any[],
> = new (...args: TArgs) => TInstance;

export type CtorType = {
  ctor: Newable;
  dep?: symbol[];
};

export class Container {
  #map = new WeakMap<symbol, CtorType & { type: string }>();

  addTransient(token: symbol, obj: CtorType) {
    this.#map.set(token, {
      ...obj,
      type: "transient",
    });
  }

  resolve<T = unknown>(token: symbol): T {
    const obj = this.#map.get(token);
    if (!obj) throw new Error(`Token not found: ${String(token)}`);

    const deps = obj.dep?.map((depToken) => this.resolve(depToken)) ?? [];
    const ctor = new obj.ctor(...deps) as T;

    const meta = obj.ctor[Symbol.metadata];
    if (!meta) return ctor;

    for (const key of Object.getOwnPropertyNames(meta)) {
      const depToken = meta[key] as symbol;
      const depCtor = this.resolve(depToken);
      Object.defineProperty(ctor, key, {
        value: depCtor,
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

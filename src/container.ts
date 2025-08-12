(Symbol.metadata as any) ??= Symbol("Symbol.metadata");

export type Newable<
  TInstance = unknown,
  TArgs extends unknown[] = any[],
> = new (...args: TArgs) => TInstance;

type ResolveContext = {
  ctor: Newable;
  type: "transient" | "request" | "singleton";
  dep: symbol[];
  cycleChecked: boolean;
};

type MetaData = {
  token: symbol;
};

export class Container {
  #map = new Map<symbol, ResolveContext>();

  #getDep(ctor: Newable): symbol[] {
    const metadata = ctor[Symbol.metadata];
    if (!metadata) return [];

    return Object.getOwnPropertyNames(metadata).map(
      (key) => (metadata[key] as MetaData).token,
    );
  }

  #depCycleDetect() {
    const visited = new Set<symbol>();
    const onStack = new Set<symbol>();
    const path: symbol[] = [];

    const dfs = (token: symbol): void => {
      if (onStack.has(token)) {
        const cycleStartIndex = path.indexOf(token);
        const cyclePath = path
          .slice(cycleStartIndex)
          .map((s) => String(s))
          .join(" -> ");
        throw new Error(`Cycle detected: ${cyclePath} -> ${String(token)}`);
      }

      if (visited.has(token)) return;

      visited.add(token);
      onStack.add(token);
      path.push(token);

      const ctx = this.#map.get(token);

      if (ctx) {
        for (const depToken of ctx.dep) {
          if (this.#map.has(depToken)) {
            dfs(depToken);
          }
        }
      }

      onStack.delete(token);
      path.pop();
      if (ctx) ctx.cycleChecked = true;
    };

    for (const [token, ctx] of this.#map.entries()) {
      if (!ctx.cycleChecked) dfs(token);
    }
  }

  addTransient(token: symbol, ctor: Newable) {
    this.#map.set(token, {
      ctor,
      dep: this.#getDep(ctor),
      type: "transient",
      cycleChecked: false,
    });
    this.#depCycleDetect();
  }

  addRequest(token: symbol, ctor: Newable) {
    this.#map.set(token, {
      ctor,
      dep: this.#getDep(ctor),
      type: "request",
      cycleChecked: false,
    });
    this.#depCycleDetect();
  }

  addSingleton(token: symbol, ctor: Newable) {
    this.#map.set(token, {
      ctor,
      dep: this.#getDep(ctor),
      type: "singleton",
      cycleChecked: false,
    });
    this.#depCycleDetect();
  }

  resolve<T = unknown>(token: symbol): T {
    const obj = this.#map.get(token);
    if (!obj) throw new Error(`Token not found: ${String(token)}`);

    const ctor = new obj.ctor() as T;

    const meta = obj.ctor[Symbol.metadata];
    if (!meta) return ctor;

    for (const key of Object.getOwnPropertyNames(meta)) {
      const depToken = (meta[key] as MetaData).token;
      let depCtor: any = {};
      depCtor = this.resolve(depToken);
      Object.defineProperty(ctor, key, {
        value: depCtor,
        writable: true,
      });
    }

    return ctor;
  }
}

export function Inject(token: symbol) {
  return (_: undefined, ctx: ClassFieldDecoratorContext) => {
    ctx.metadata[ctx.name] = {
      token,
    };
  };
}

(Symbol.metadata as any) ??= Symbol("Symbol.metadata");

export type Newable<
  TInstance = unknown,
  TArgs extends unknown[] = any[],
> = new (...args: TArgs) => TInstance;

type ScopeType = "transient" | "request" | "singleton";

type DepContext = {
  ctor: Newable;
  type: ScopeType;
  dep: symbol[];
  cycleChecked: boolean;
};

type Identifier = symbol | Newable;

type MetaData =
  | {
      idType: "symbol";
      token: symbol;
    }
  | {
      idType: "Newable";
      token: symbol;
      ctor: Newable;
      scope: ScopeType;
    };

export class Container {
  #map = new Map<symbol, DepContext>();
  #singletonMap = new Map<symbol, any>();

  #getDep(ctor: Newable): symbol[] {
    return Object.values(ctor[Symbol.metadata] ?? {})
      .filter((m): m is MetaData => !!(m as MetaData).token)
      .map((m) => m.token);
  }

  #depCycleDetect() {
    const visited = new Set<symbol>();
    const stack = new Set<symbol>();
    const path: symbol[] = [];

    const dfs = (token: symbol) => {
      if (stack.has(token)) {
        const cycle = path.slice(path.indexOf(token)).map(String).join(" -> ");
        throw new Error(`Cycle detected: ${cycle} -> ${String(token)}`);
      }
      if (visited.has(token)) return;

      const ctx = this.#map.get(token);
      if (!ctx) return;

      visited.add(token);
      stack.add(token);
      path.push(token);

      for (const dep of ctx.dep) dfs(dep);

      stack.delete(token);
      path.pop();
      ctx.cycleChecked = true;
    };

    for (const [token, ctx] of this.#map) {
      if (!ctx.cycleChecked) dfs(token);
    }
  }

  #register(token: symbol, ctor: Newable, type: ScopeType) {
    this.#map.set(token, {
      ctor,
      dep: this.#getDep(ctor),
      type,
      cycleChecked: false,
    });
    this.#depCycleDetect();
  }

  addTransient(token: symbol, ctor: Newable) {
    this.#register(token, ctor, "transient");
  }

  addRequest(token: symbol, ctor: Newable) {
    this.#register(token, ctor, "request");
  }

  addSingleton(token: symbol, ctor: Newable) {
    this.#register(token, ctor, "singleton");
  }

  resolve<T = unknown>(token: symbol): T {
    return this.#innerResolve(token, new Map<symbol, any>());
  }

  #innerResolve(token: symbol, requestMap: Map<symbol, any>) {
    const ctx = this.#map.get(token);
    if (!ctx) throw Error(`${String(token)} is not registered`);

    const scope =
      ctx.type === "singleton"
        ? this.#singletonMap
        : ctx.type === "request"
          ? requestMap
          : undefined;

    if (scope?.has(token)) return scope.get(token);

    const instance = new ctx.ctor();
    for (const [key, m] of Object.entries(ctx.ctor[Symbol.metadata] ?? {})) {
      const meta = m as MetaData;
      if (meta.idType === "Newable" && !this.#map.has(meta.token)) {
        const { ctor, scope, token } = meta;
        scope === "singleton"
          ? this.addSingleton(token, ctor)
          : scope === "request"
            ? this.addRequest(token, ctor)
            : this.addTransient(token, ctor);
      }
      Object.defineProperty(instance, key, {
        value: this.#innerResolve(meta.token, requestMap),
      });
    }

    scope?.set(token, instance);
    return instance;
  }
}

export function Inject(identifier: Identifier, scope?: ScopeType) {
  return (_: undefined, ctx: ClassFieldDecoratorContext) => {
    const meta: MetaData =
      typeof identifier === "symbol"
        ? { idType: "symbol", token: identifier }
        : {
            idType: "Newable",
            token: Symbol.for(identifier.name),
            ctor: identifier,
            scope: scope ?? "transient",
          };
    ctx.metadata[ctx.name] = meta;
  };
}

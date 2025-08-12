(Symbol.metadata as any) ??= Symbol("Symbol.metadata");

export type Newable<
  TInstance = unknown,
  TArgs extends unknown[] = any[],
> = new (...args: TArgs) => TInstance;

type ScopeType = "transient" | "request" | "singleton";

type ResolveContext = {
  ctor: Newable;
  type: ScopeType;
  dep: symbol[];
  cycleChecked: boolean;
};

type MetaData = {
  token: symbol;
};

type TopoContext = {
  token: symbol;
  ctor: Newable;
  type: ScopeType;
};

export class Container {
  #map = new Map<symbol, ResolveContext>();
  #singletonMap = new Map<symbol, any>();
  #transientMap = new Map<symbol, Function>();
  #plan = new Map<symbol, TopoContext[]>();

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

    const dfs = (token: symbol): boolean => {
      if (onStack.has(token)) {
        const cycleStartIndex = path.indexOf(token);
        const cyclePath = path
          .slice(cycleStartIndex)
          .map((s) => String(s))
          .join(" -> ");
        throw new Error(`Cycle detected: ${cyclePath} -> ${String(token)}`);
      }

      if (visited.has(token)) return true;

      const ctx = this.#map.get(token);
      if (!ctx) return false;

      visited.add(token);
      onStack.add(token);
      path.push(token);

      for (const depToken of ctx.dep) {
        const nodeResult = dfs(depToken);
        if (!nodeResult) {
          visited.delete(token);
          onStack.delete(token);
          path.pop();
          return false;
        }
      }

      onStack.delete(token);
      path.pop();
      ctx.cycleChecked = true;
      return true;
    };

    for (const [token, ctx] of this.#map.entries()) {
      if (!ctx.cycleChecked) dfs(token);
    }
  }

  #topoSortFrom(token: symbol): TopoContext[] {
    const visited = new Set<symbol>();
    const result: TopoContext[] = [];

    const dfs = (curToken: symbol) => {
      if (visited.has(curToken)) return;
      visited.add(curToken);

      const ctx = this.#map.get(curToken);
      if (!ctx || !ctx.cycleChecked) return;

      for (const depToken of ctx.dep) {
        dfs(depToken);
      }

      result.push({
        token: curToken,
        ctor: ctx.ctor,
        type: ctx.type,
      });
    };

    dfs(token);
    return result;
  }

  #buildPlans() {
    for (const [token, ctx] of this.#map.entries()) {
      if (ctx.cycleChecked) {
        this.#plan.set(token, this.#topoSortFrom(token));
      }
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
    this.#buildPlans();
  }

  addRequest(token: symbol, ctor: Newable) {
    this.#map.set(token, {
      ctor,
      dep: this.#getDep(ctor),
      type: "request",
      cycleChecked: false,
    });
    this.#depCycleDetect();
    this.#buildPlans();
  }

  addSingleton(token: symbol, ctor: Newable) {
    this.#map.set(token, {
      ctor,
      dep: this.#getDep(ctor),
      type: "singleton",
      cycleChecked: false,
    });
    this.#depCycleDetect();
    this.#buildPlans();
  }

  resolve<T = unknown>(token: symbol): T {
    const requestMap = new Map<symbol, any>();

    const plan = this.#plan.get(token);
    if (!plan) throw new Error(`Plan not found: ${String(token)}`);

    for (const dep of plan) {
      const meta = dep.ctor[Symbol.metadata];
      if (dep.type === "transient") {
        const depInstance = this.#transientMap.get(dep.token);
        if (depInstance) {
        }

        if (meta) {
          for (const key of Object.getOwnPropertyNames(meta)) {
            // const depInstance;
          }
        }
      }
    }

    return {} as T;
  }
}

export function Inject(token: symbol) {
  return (_: undefined, ctx: ClassFieldDecoratorContext) => {
    ctx.metadata[ctx.name] = {
      token,
    };
  };
}

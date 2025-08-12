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

type MetaData = {
  token: symbol;
};

type PlanContext = {
  token: symbol;
  ctor: Newable;
  type: ScopeType;
};

export class Container {
  #map = new Map<symbol, DepContext>();
  #singletonMap = new Map<symbol, any>();
  #plan = new Map<symbol, Set<PlanContext>>();

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

  #topoSortFrom(token: symbol): PlanContext[] {
    const visited = new Set<symbol>();
    const result: PlanContext[] = [];

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
    return result.reverse();
  }

  #buildPlans() {
    for (const [token, ctx] of this.#map.entries()) {
      if (ctx.cycleChecked) {
        this.#plan.set(token, new Set(this.#topoSortFrom(token)));
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
    if (!plan) throw Error(`Plan is not found ${String(token)}`);

    for (const ctx of plan) {
      if (ctx.type === "transient") {
        return this.#createInstance(ctx) as T;
      } else if (ctx.type === "singleton") {
        return this.#createInstance(ctx, this.#singletonMap);
      } else if (ctx.type === "request") {
        return this.#createInstance(ctx, requestMap);
      }
    }

    return this.resolve(token);
  }

  #createInstance(ctx: PlanContext, scope?: Map<symbol, any>) {
    if (scope?.has(ctx.token)) return scope.get(ctx.token);

    const instance = new ctx.ctor();
    const meta = ctx.ctor[Symbol.metadata] ?? {};

    for (const [key, m] of Object.entries(meta)) {
      const depToken = (m as any).token as symbol;
      Object.defineProperty(instance, key, {
        value: this.resolve(depToken),
        writable: true,
      });
    }

    scope?.set(ctx.token, instance);
    return instance;
  }
}

export function Inject(token: symbol) {
  return (_: undefined, ctx: ClassFieldDecoratorContext) => {
    ctx.metadata[ctx.name] = {
      token,
    };
  };
}

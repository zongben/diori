import { ClassFactory, Container, Inject } from "../src/container";

const TOKEN = {
  logger: Symbol("logger"),
  depA: Symbol("A"),
  depB: Symbol("B"),
  depC: Symbol("C"),
  service: Symbol("Service"),
};

class Logger {
  name!: string;

  log() {
    console.log("logger log");
  }
}

const DepBFactory = () => {
  return {
    id: 456,
  };
};

@ClassFactory(DepBFactory)
class DepB {
  @Inject(TOKEN.depC)
  depC!: DepC;

  id: number;

  constructor({ id }: ReturnType<typeof DepBFactory>) {
    this.id = id;
  }

  execB() {
    console.log("B exec, id is:", this.id);
    this.depC.get();
  }
}

const DepAFactory = () => {
  return {
    id: 123,
    name: "test",
  };
};

@ClassFactory(DepAFactory)
class DepA extends DepB {
  constructor({ id }: ReturnType<typeof DepAFactory>) {
    super({ id });
  }

  execA() {
    console.log("A exec");
    this.execB();
  }
}

class DepC {
  index: number = 0;

  get() {
    console.log(this.index++);
  }
}

class LogService {
  @Inject(TOKEN.depA)
  depA!: DepA;

  @Inject(TOKEN.depB)
  depB!: DepB;

  exec() {
    this.depA.execA();
    this.depB.execB();
  }
}

const container = new Container();
container.addTransient(TOKEN.logger, Logger);
container.addTransient(TOKEN.service, LogService);
container.addTransient(TOKEN.depA, DepA);
container.addTransient(TOKEN.depB, DepB);
container.addConstant(TOKEN.depC, new DepC());

const svc = container.resolve<LogService>(TOKEN.service);
svc.exec();

const svc2 = container.resolve<LogService>(TOKEN.service);
svc2.exec();

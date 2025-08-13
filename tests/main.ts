import { Container, Inject } from "../src/container";

const TOKEN = {
  logger: Symbol("logger"),
  depA: Symbol("A"),
  depB: Symbol("B"),
  service: Symbol("Service"),
};

class Logger {
  log() {
    console.log("logger log");
  }
}

class DepC {
  index: number = 0;

  get() {
    console.log(this.index++);
  }
}

class DepA {
  @Inject(DepC, "request")
  depC!: DepC;

  execA() {
    console.log("A exec");
    this.depC.get();
  }
}

class DepB {
  @Inject(DepC, "request")
  depC!: DepC;

  execB() {
    console.log("B exec");
    this.depC.get();
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

const svc = container.resolve<LogService>(TOKEN.service);
svc.exec();

const svc2 = container.resolve<LogService>(TOKEN.service);
svc2.exec();

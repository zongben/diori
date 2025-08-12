import { Container, Inject } from "./src/container";

const TOKEN = {
  logger: Symbol("logger"),
  depA: Symbol("A"),
  depB: Symbol("B"),
  depC: Symbol("C"),
  service: Symbol("Service"),
};

class Logger {
  @Inject(TOKEN.depB)
  depB!: DepB;

  log() {
    console.log("logger log");
  }
}

class DepA {
  @Inject(TOKEN.depB)
  depB!: DepB;

  @Inject(TOKEN.depC)
  depC!: DepC;

  doA() {
    console.log("A is doing");
  }
}

class DepB {
  @Inject(TOKEN.depC)
  depC!: DepC;
}

class DepC {}

class LogService {
  @Inject(TOKEN.logger)
  private logger!: Logger;

  @Inject(TOKEN.depA)
  private svcA!: DepA;


  execLog() {
    this.logger.log();
    this.svcA.doA();
  }
}

const container = new Container();
container.addTransient(TOKEN.logger, Logger);
container.addTransient(TOKEN.service, LogService);
container.addTransient(TOKEN.depA, DepA);
container.addTransient(TOKEN.depB, DepB);
container.addTransient(TOKEN.depC, DepC);

const svc = container.resolve<LogService>(TOKEN.service);
svc.execLog();

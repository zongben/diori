import { Container, Inject } from "./src/container";

const TOKEN = {
  logger: Symbol("logger"),
  depSvcA: Symbol("A"),
  service: Symbol("Service"),
};

class Logger {
  log() {
    console.log("logger log");
  }
}

class DepA {
  doA() {
    console.log("A is doing");
  }
}

class LogService {
  @Inject(TOKEN.logger)
  private logger!: Logger;

  @Inject(TOKEN.depSvcA)
  private svcA!: DepA;

  execLog() {
    this.logger.log();
    this.svcA.doA();
  }
}

const container = new Container();
container.addTransient(TOKEN.logger, Logger);
container.addTransient(TOKEN.service, LogService);
container.addTransient(TOKEN.depSvcA, DepA);

const svc = container.resolve<LogService>(TOKEN.service);
svc.execLog();

import { Container, Inject } from "./src/container";
(Symbol.metadata as any) ??= Symbol("Symbol.metadata");

const TOKEN = {
  logger: Symbol("logger"),
  service: Symbol("Service"),
};

class Logger {
  log() {
    console.log("logger log");
  }
}

class LogService {
  @Inject(TOKEN.logger)
  private logger!: Logger;

  execLog() {
    this.logger.log();
  }
}

const container = new Container();
container.addTransient(TOKEN.logger, {
  ctor: Logger,
});
container.addTransient(TOKEN.service, {
  ctor: LogService,
  dep: [TOKEN.logger],
});

const svc = container.resolve<LogService>(TOKEN.service);
svc.execLog();

import { ILogObj, Logger } from "tslog";

const logger: Logger<ILogObj> = new Logger({
  type: "pretty",
  prettyLogTemplate: `{{hh}}:{{MM}}:{{ss}} {{logLevelName}} {{name}}`,
  prettyLogStyles: {
    logLevelName: {
      "*": ["bold", "black", "bgWhiteBright", "dim"],
      SILLY: ["bold", "white"],
      TRACE: ["bold", "whiteBright"],
      DEBUG: ["bold", "green"],
      INFO: ["bold", "blue"],
      WARN: ["bold", "yellow"],
      ERROR: ["bold", "red"],
      FATAL: ["bold", "redBright"],
    },
    dateIsoStr: ["dim", "gray"],
    filePathWithLine: ["italic", "gray"],
    name: ["magentaBright", "bold"],
    nameWithDelimiterPrefix: ["magentaBright", "bold"],
    nameWithDelimiterSuffix: ["magentaBright", "bold"],
    errorName: ["bold", "bgRedBright", "whiteBright", "underline"],
    fileName: ["yellow", "underline"],
  },
  prettyErrorTemplate: `\n{{errorName}} {{errorMessage}}\nerror stack:\n{{errorStack}}`,
  prettyErrorStackTemplate: `  • {{fileName}}\t{{method}}\t{{lineNumber}}`,
  prettyErrorParentNamesSeparator: ":",
  prettyErrorLoggerNameDelimiter: "\t",
  stylePrettyLogs: true,
});

export default logger;

import {createLogger, format, transports} from "winston";
const {combine, timestamp, json, colorize} = format;

// Custom format for console logging with colors
const consoleLogFormat = format.combine(
  format.colorize(),
  // We use the rest operator (...meta) to catch any extra objects you pass in!
  format.printf(({ level, message, timestamp, ...meta }) => {
    // Check if there is extra data. If yes, stringify it so we can read it in the console.
    const metaData = Object.keys(meta).length ? JSON.stringify(meta) : "";
    
    return `${level}: ${message} ${metaData}`;
  })
);

// Create a Winston logger
const logger = createLogger({
  level: "info",
  format: combine(colorize(), timestamp(), json()),
  transports: [
    new transports.Console({
      format: consoleLogFormat,
    }),
    new transports.File({ filename: "app.log" }),
  ],
});

export default logger;
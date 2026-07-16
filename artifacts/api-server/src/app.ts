import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";

const app: Express = express();

// Explicit JSON body-size limit — oversized or malformed bodies are turned
// into controlled 413/400 responses by the centralized error handler below,
// instead of crashing the process or leaking a raw parser stack trace.
const JSON_BODY_LIMIT = "1mb";

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

app.use("/api", router);

// Must be mounted last: 404 for unmatched routes, then the centralized error handler.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

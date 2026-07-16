import { Router, type IRouter } from "express";
import healthRouter from "./health";
import readyzRouter from "./readyz";
import gamesRouter from "./games";
import accountsRouter from "./accounts";
import ordersRouter from "./orders";
import capacityCustomersRouter from "./capacity-customers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(readyzRouter);
router.use(gamesRouter);
router.use(accountsRouter);
router.use(ordersRouter);
router.use(capacityCustomersRouter);

export default router;

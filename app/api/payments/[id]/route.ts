import { itemRoutes } from "../../../../lib/collection-routes";
import { validatePayment } from "../../../../lib/validators";
import type { Payment } from "../../../../lib/types";
export const dynamic = "force-dynamic";
export const { PUT, DELETE } = itemRoutes<Payment>("payments", validatePayment);

import { collectionRoutes } from "../../../lib/collection-routes";
import { validateRecord } from "../../../lib/validators";
import type { ServiceRecord } from "../../../lib/types";
export const dynamic = "force-dynamic";
export const { GET, POST } = collectionRoutes<ServiceRecord>("records", validateRecord);

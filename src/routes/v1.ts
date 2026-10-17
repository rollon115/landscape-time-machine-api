import { methodNotAllowed } from "../http";
import { createAsset } from "./assets";
import type { V1Dependencies } from "./contracts";
import { createDirector } from "./director";
import { cancelJob, getJob } from "./jobs";
import { createTimeShift } from "./timeshifts";

export async function routeV1(
  request: Request,
  pathname: string,
  dependencies: V1Dependencies,
): Promise<Response | undefined> {
  if (pathname === "/v1/assets") {
    return request.method === "POST"
      ? await createAsset(request, dependencies)
      : methodNotAllowed(request.method, ["POST"]);
  }
  if (pathname === "/v1/timeshifts") {
    return request.method === "POST"
      ? await createTimeShift(request, dependencies)
      : methodNotAllowed(request.method, ["POST"]);
  }
  if (pathname === "/v1/director") {
    return request.method === "POST"
      ? await createDirector(request, dependencies)
      : methodNotAllowed(request.method, ["POST"]);
  }

  const cancelMatch = pathname.match(/^\/v1\/jobs\/([^/]+)\/cancel$/);
  if (cancelMatch?.[1]) {
    return request.method === "POST"
      ? await cancelJob(cancelMatch[1], dependencies)
      : methodNotAllowed(request.method, ["POST"]);
  }
  const jobMatch = pathname.match(/^\/v1\/jobs\/([^/]+)$/);
  if (jobMatch?.[1]) {
    return request.method === "GET"
      ? await getJob(jobMatch[1], dependencies)
      : methodNotAllowed(request.method, ["GET"]);
  }

  return undefined;
}

export type { V1Dependencies } from "./contracts";

import { fromError, methodNotAllowed, notFound } from "./http";
import { handleHealth } from "./routes/health";
import { routeV1, type V1Dependencies } from "./routes/v1";

export function createApp(dependencies: V1Dependencies) {
  return {
    async fetch(request: Request): Promise<Response> {
      const { pathname } = new URL(request.url);
      try {
        if (pathname === "/health") {
          return request.method === "GET"
            ? handleHealth()
            : methodNotAllowed(request.method, ["GET"]);
        }
        return (await routeV1(request, pathname, dependencies)) ?? notFound(pathname);
      } catch (error) {
        return fromError(error);
      }
    },
  };
}

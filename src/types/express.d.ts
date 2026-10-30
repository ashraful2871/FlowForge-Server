import type { Membership } from "../generated/prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string; email: string };
      sessionId?: string;
    }
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
      };
      sessionId: string;
      membership?: Membership;
    }
  }
}
export {};

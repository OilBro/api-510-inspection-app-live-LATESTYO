import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // DEV MODE: Inject a dev user when running locally without OAuth
  if (!user && process.env.NODE_ENV === 'development') {
    user = {
      id: process.env.OWNER_OPEN_ID || 'dev-user',
      name: process.env.OWNER_NAME || 'Dev User',
      email: 'dev@localhost',
      role: 'admin',
      avatarUrl: null,
      createdAt: new Date(),
    } as unknown as User;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

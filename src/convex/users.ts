import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { appRoleValidator } from "./schema";
import { mutation, query } from "./_generated/server";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/**
 * Choose the account type during onboarding.
 * Employers also set a company display name.
 */
export const setAppRole = mutation({
  args: {
    appRole: appRoleValidator,
    name: v.optional(v.string()),
    companyName: v.optional(v.string()),
  },
  handler: async (ctx, { appRole, name, companyName }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const patch: {
      appRole: typeof appRole;
      companyName?: string;
      name?: string;
    } = { appRole };
    if (appRole === "employer") {
      patch.companyName =
        companyName && companyName.trim().length > 0
          ? companyName.trim()
          : undefined;
    }
    if (name && name.trim().length > 0) {
      patch.name = name.trim();
    }

    await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});

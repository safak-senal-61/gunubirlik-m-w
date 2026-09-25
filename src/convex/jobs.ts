import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { jobTypeValidator } from "./schema";
import { mutation, query } from "./_generated/server";

/** Create a job posting (employers only). */
export const createJob = mutation({
  args: {
    title: v.string(),
    location: v.string(),
    type: jobTypeValidator,
    salaryMin: v.number(),
    salaryMax: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.appRole !== "employer") {
      throw new Error("Only employer accounts can post jobs");
    }

    const company =
      user.companyName && user.companyName.trim().length > 0
        ? user.companyName.trim()
        : user.name && user.name.trim().length > 0
          ? user.name.trim()
          : "Şirketim";

    return await ctx.db.insert("jobs", {
      employerId: userId,
      company,
      title: args.title.trim(),
      location: args.location.trim(),
      type: args.type,
      salaryMin: args.salaryMin,
      salaryMax: args.salaryMax,
      description: args.description.trim(),
      isActive: true,
    });
  },
});

/** All jobs owned by the signed-in employer, with applicant counts. */
export const myJobs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_employer", (q) => q.eq("employerId", userId))
      .collect();

    const withCounts = await Promise.all(
      jobs.map(async (job) => {
        const apps = await ctx.db
          .query("applications")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect();
        return {
          ...job,
          applicationCount: apps.length,
          pendingCount: apps.filter((a) => a.status === "pending").length,
        };
      }),
    );

    return withCounts.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** Public feed of active job postings, newest first. */
export const browseJobs = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Whether the signed-in seeker already applied (null-safe for guests)
    const userId = await getAuthUserId(ctx);
    let appliedJobIds: Set<string> = new Set();
    if (userId !== null) {
      const mine = await ctx.db
        .query("applications")
        .withIndex("by_seeker", (q) => q.eq("seekerId", userId))
        .collect();
      appliedJobIds = new Set(mine.map((a) => a.jobId));
    }

    return jobs
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((job) => ({
        ...job,
        hasApplied: appliedJobIds.has(job._id),
      }));
  },
});

/** Single job posting by id. */
export const getJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

/** Activate / pause a posting (owner only). */
export const setJobActive = mutation({
  args: { jobId: v.id("jobs"), isActive: v.boolean() },
  handler: async (ctx, { jobId, isActive }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Job not found");
    if (job.employerId !== userId) throw new Error("Not your job");

    await ctx.db.patch(jobId, { isActive });
  },
});

/** Delete a posting and all of its applications (owner only). */
export const deleteJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Job not found");
    if (job.employerId !== userId) throw new Error("Not your job");

    const apps = await ctx.db
      .query("applications")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .collect();
    for (const app of apps) {
      await ctx.db.delete(app._id);
    }
    await ctx.db.delete(jobId);
  },
});

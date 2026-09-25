import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { applicationStatusValidator } from "./schema";
import { mutation, query } from "./_generated/server";

/** Seeker applies to a job with a short note. */
export const applyToJob = mutation({
  args: { jobId: v.id("jobs"), coverNote: v.string() },
  handler: async (ctx, { jobId, coverNote }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.appRole !== "seeker") {
      throw new Error("Only seeker accounts can apply");
    }

    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("İlan bulunamadı");
    if (!job.isActive) throw new Error("Bu ilan artık başvuruya kapalı");
    if (job.employerId === userId) throw new Error("Kendi ilanınıza başvuramazsınız");

    const existing = await ctx.db
      .query("applications")
      .withIndex("by_seeker", (q) => q.eq("seekerId", userId))
      .filter((q) => q.eq(q.field("jobId"), jobId))
      .first();
    if (existing) throw new Error("Bu ilana zaten başvurdunuz");

    return await ctx.db.insert("applications", {
      jobId,
      seekerId: userId,
      employerId: job.employerId,
      coverNote: coverNote.trim(),
      status: "pending",
    });
  },
});

/** Signed-in seeker's applications with job details, newest first. */
export const myApplications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const apps = await ctx.db
      .query("applications")
      .withIndex("by_seeker", (q) => q.eq("seekerId", userId))
      .collect();

    return await Promise.all(
      apps
        .sort((a, b) => b._creationTime - a._creationTime)
        .map(async (app) => {
          const job = await ctx.db.get(app.jobId);
          return {
            _id: app._id,
            _creationTime: app._creationTime,
            status: app.status,
            coverNote: app.coverNote,
            job: job
              ? {
                  _id: job._id,
                  title: job.title,
                  company: job.company,
                  location: job.location,
                  type: job.type,
                  salaryMin: job.salaryMin,
                  salaryMax: job.salaryMax,
                  isActive: job.isActive,
                }
              : null,
          };
        }),
    );
  },
});

/** Employer: applicants of one of their jobs. */
export const jobApplicants = query({
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

    return await Promise.all(
      apps
        .sort((a, b) => b._creationTime - a._creationTime)
        .map(async (app) => {
          const seeker = await ctx.db.get(app.seekerId);
          return {
            _id: app._id,
            _creationTime: app._creationTime,
            status: app.status,
            coverNote: app.coverNote,
            applicantName: seeker?.name ?? seeker?.email ?? "Aday",
            applicantEmail: seeker?.email ?? null,
          };
        }),
    );
  },
});

/** Employer: applicants across all of their jobs (for the applications tab). */
export const allApplicants = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const apps = await ctx.db
      .query("applications")
      .withIndex("by_employer", (q) => q.eq("employerId", userId))
      .collect();

    return await Promise.all(
      apps
        .sort((a, b) => b._creationTime - a._creationTime)
        .map(async (app) => {
          const job = await ctx.db.get(app.jobId);
          const seeker = await ctx.db.get(app.seekerId);
          return {
            _id: app._id,
            _creationTime: app._creationTime,
            status: app.status,
            coverNote: app.coverNote,
            jobTitle: job?.title ?? "Silinmiş ilan",
            jobIsActive: job?.isActive ?? false,
            applicantName: seeker?.name ?? seeker?.email ?? "Aday",
            applicantEmail: seeker?.email ?? null,
          };
        }),
    );
  },
});

/** Employer updates an application status: pending | accepted | rejected. */
export const updateApplicationStatus = mutation({
  args: { applicationId: v.id("applications"), status: applicationStatusValidator },
  handler: async (ctx, { applicationId, status }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const app = await ctx.db.get(applicationId);
    if (!app) throw new Error("Application not found");

    const job = await ctx.db.get(app.jobId);
    if (!job || job.employerId !== userId) throw new Error("Not your job");

    await ctx.db.patch(applicationId, { status });
  },
});

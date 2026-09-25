import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// app-level account types for the hiring product
export const APP_ROLES = {
  SEEKER: "seeker",
  EMPLOYER: "employer",
} as const;

export const appRoleValidator = v.union(
  v.literal(APP_ROLES.SEEKER),
  v.literal(APP_ROLES.EMPLOYER),
);
export type AppRole = Infer<typeof appRoleValidator>;

export const JOB_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
export const jobTypeValidator = v.union(...JOB_TYPES.map((t) => v.literal(t)));
export type JobType = Infer<typeof jobTypeValidator>;

export const APPLICATION_STATUSES = ["pending", "accepted", "rejected"] as const;
export const applicationStatusValidator = v.union(
  ...APPLICATION_STATUSES.map((s) => v.literal(s)),
);
export type ApplicationStatus = Infer<typeof applicationStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // hiring-product fields
      appRole: v.optional(appRoleValidator), // seeker | employer (unset = onboarding not done)
      companyName: v.optional(v.string()), // employer display name
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // job postings created by employers
    jobs: defineTable({
      employerId: v.id("users"),
      title: v.string(),
      company: v.string(),
      location: v.string(),
      type: jobTypeValidator,
      salaryMin: v.number(),
      salaryMax: v.number(),
      description: v.string(),
      isActive: v.boolean(),
    })
      .index("by_employer", ["employerId"])
      .index("by_active", ["isActive"]),

    // applications: a seeker applying to a job
    applications: defineTable({
      jobId: v.id("jobs"),
      seekerId: v.id("users"),
      employerId: v.id("users"), // denormalized from the job for employer queries
      coverNote: v.string(),
      status: applicationStatusValidator,
    })
      .index("by_job", ["jobId"])
      .index("by_seeker", ["seekerId"])
      .index("by_employer", ["employerId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;

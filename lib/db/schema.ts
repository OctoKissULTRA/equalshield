import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  json,
  decimal,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const scans = pgTable('scans', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').references(() => teams.id),
  url: varchar('url', { length: 500 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }),
  pagesScanned: integer('pages_scanned').default(1),
  scanDepth: varchar('scan_depth', { length: 50 }).default('standard'),
  
  // Compliance scores
  wcagScore: integer('wcag_score'),
  adaRiskScore: integer('ada_risk_score'),
  lawsuitProbability: decimal('lawsuit_probability', { precision: 5, scale: 2 }),
  
  // Violation summary
  totalViolations: integer('total_violations').default(0),
  criticalViolations: integer('critical_violations').default(0),
  seriousViolations: integer('serious_violations').default(0),
  moderateViolations: integer('moderate_violations').default(0),
  minorViolations: integer('minor_violations').default(0),
  
  // Detailed results
  violations: json('violations'),
  aiAnalysis: json('ai_analysis'),
  recommendations: json('recommendations'),
  legalAssessment: json('legal_assessment'),
  
  // Status tracking
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  errorMessage: text('error_message'),
  processingTimeMs: integer('processing_time_ms'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Detailed violations tracking
export const violations = pgTable('violations', {
  id: serial('id').primaryKey(),
  scanId: integer('scan_id').notNull().references(() => scans.id, { onDelete: 'cascade' }),
  
  // WCAG details
  wcagCriterion: varchar('wcag_criterion', { length: 20 }).notNull(),
  wcagVersion: varchar('wcag_version', { length: 10 }).default('2.1'),
  conformanceLevel: varchar('conformance_level', { length: 3 }).default('AA'),
  
  // Violation info
  severity: varchar('severity', { length: 20 }).notNull(),
  elementType: varchar('element_type', { length: 50 }),
  elementSelector: text('element_selector'),
  elementHtml: text('element_html'),
  pageUrl: text('page_url'),
  
  // Impact analysis
  userImpact: text('user_impact').notNull(),
  businessImpact: text('business_impact'),
  legalRiskLevel: varchar('legal_risk_level', { length: 20 }),
  lawsuitCases: json('lawsuit_cases'), // Similar cases that resulted in lawsuits
  
  // Fix information
  fixDescription: text('fix_description').notNull(),
  fixCode: text('fix_code'),
  fixEffort: varchar('fix_effort', { length: 20 }), // 'trivial', 'easy', 'moderate', 'complex'
  estimatedFixTime: varchar('estimated_fix_time', { length: 50 }), // '5 minutes', '1 hour', etc
  
  // Tracking
  status: varchar('status', { length: 50 }).default('open'),
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }), // 0.00 to 1.00
  falsePositive: integer('false_positive').default(0), // Using integer for boolean (0/1)
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Usage tracking for billing
export const usageEvents = pgTable('usage_events', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id),
  eventType: varchar('event_type', { length: 50 }), // 'page_scan', 'ai_analysis', 'report_generated'
  count: integer('count').default(1),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  scans: many(scans),
  usageEvents: many(usageEvents),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const scansRelations = relations(scans, ({ one, many }) => ({
  team: one(teams, {
    fields: [scans.teamId],
    references: [teams.id],
  }),
  violations: many(violations),
}));

export const violationsRelations = relations(violations, ({ one }) => ({
  scan: one(scans, {
    fields: [violations.scanId],
    references: [scans.id],
  }),
}));

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  team: one(teams, {
    fields: [usageEvents.teamId],
    references: [teams.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type Scan = typeof scans.$inferSelect;
export type NewScan = typeof scans.$inferInsert;
export type Violation = typeof violations.$inferSelect;
export type NewViolation = typeof violations.$inferInsert;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}

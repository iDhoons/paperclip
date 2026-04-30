import { describe, expect, it } from "vitest";
import {
  createIssueSchema,
  createIssueLabelSchema,
  updateIssueSchema,
  checkoutIssueSchema,
  addIssueCommentSchema,
  linkIssueApprovalSchema,
  upsertIssueDocumentSchema,
  issueDocumentKeySchema,
  issueDocumentFormatSchema,
  createIssueAttachmentMetadataSchema,
  restoreIssueDocumentRevisionSchema,
} from "../issue.js";

// ---------------------------------------------------------------------------
// createIssueSchema
// ---------------------------------------------------------------------------
describe("createIssueSchema", () => {
  it("accepts a minimal valid issue", () => {
    const result = createIssueSchema.safeParse({ title: "Bug fix" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Bug fix");
      expect(result.data.status).toBe("backlog");
      expect(result.data.priority).toBe("medium");
    }
  });

  it("accepts a fully populated issue", () => {
    const result = createIssueSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      projectWorkspaceId: "550e8400-e29b-41d4-a716-446655440001",
      goalId: "550e8400-e29b-41d4-a716-446655440002",
      parentId: "550e8400-e29b-41d4-a716-446655440003",
      title: "Implement feature X",
      description: "Detailed description",
      status: "in_progress",
      priority: "high",
      assigneeAgentId: "550e8400-e29b-41d4-a716-446655440004",
      assigneeUserId: "user-123",
      labelIds: ["550e8400-e29b-41d4-a716-446655440005"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createIssueSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = createIssueSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = createIssueSchema.safeParse({
      title: "Test",
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority", () => {
    const result = createIssueSchema.safeParse({
      title: "Test",
      priority: "urgent",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for projectId", () => {
    const result = createIssueSchema.safeParse({
      title: "Test",
      projectId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts null for nullable fields", () => {
    const result = createIssueSchema.safeParse({
      title: "Test",
      description: null,
      projectId: null,
      assigneeAgentId: null,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createIssueLabelSchema
// ---------------------------------------------------------------------------
describe("createIssueLabelSchema", () => {
  it("accepts a valid label", () => {
    const result = createIssueLabelSchema.safeParse({
      name: "bug",
      color: "#FF0000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createIssueLabelSchema.safeParse({
      name: "",
      color: "#FF0000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 48 chars", () => {
    const result = createIssueLabelSchema.safeParse({
      name: "a".repeat(49),
      color: "#FF0000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid color format", () => {
    const result = createIssueLabelSchema.safeParse({
      name: "bug",
      color: "red",
    });
    expect(result.success).toBe(false);
  });

  it("rejects 3-digit hex color", () => {
    const result = createIssueLabelSchema.safeParse({
      name: "bug",
      color: "#FFF",
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from name", () => {
    const result = createIssueLabelSchema.safeParse({
      name: "  bug  ",
      color: "#FF0000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("bug");
    }
  });
});

// ---------------------------------------------------------------------------
// updateIssueSchema
// ---------------------------------------------------------------------------
describe("updateIssueSchema", () => {
  it("accepts an empty partial update", () => {
    const result = updateIssueSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial fields", () => {
    const result = updateIssueSchema.safeParse({
      title: "Updated title",
      comment: "Changed title",
    });
    expect(result.success).toBe(true);
  });

  it("accepts reopen and interrupt flags", () => {
    const result = updateIssueSchema.safeParse({
      reopen: true,
      interrupt: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts hiddenAt with datetime string", () => {
    const result = updateIssueSchema.safeParse({
      hiddenAt: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null hiddenAt", () => {
    const result = updateIssueSchema.safeParse({ hiddenAt: null });
    expect(result.success).toBe(true);
  });

  it("rejects empty comment", () => {
    const result = updateIssueSchema.safeParse({ comment: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkoutIssueSchema
// ---------------------------------------------------------------------------
describe("checkoutIssueSchema", () => {
  it("accepts valid checkout", () => {
    const result = checkoutIssueSchema.safeParse({
      agentId: "550e8400-e29b-41d4-a716-446655440000",
      expectedStatuses: ["backlog", "in_progress"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing agentId", () => {
    const result = checkoutIssueSchema.safeParse({
      expectedStatuses: ["backlog"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty expectedStatuses", () => {
    const result = checkoutIssueSchema.safeParse({
      agentId: "550e8400-e29b-41d4-a716-446655440000",
      expectedStatuses: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status in expectedStatuses", () => {
    const result = checkoutIssueSchema.safeParse({
      agentId: "550e8400-e29b-41d4-a716-446655440000",
      expectedStatuses: ["invalid_status"],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addIssueCommentSchema
// ---------------------------------------------------------------------------
describe("addIssueCommentSchema", () => {
  it("accepts a valid comment", () => {
    const result = addIssueCommentSchema.safeParse({
      body: "This is a comment",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty body", () => {
    const result = addIssueCommentSchema.safeParse({ body: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional flags", () => {
    const result = addIssueCommentSchema.safeParse({
      body: "Reopening this",
      reopen: true,
      interrupt: false,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// linkIssueApprovalSchema
// ---------------------------------------------------------------------------
describe("linkIssueApprovalSchema", () => {
  it("accepts a valid approval link", () => {
    const result = linkIssueApprovalSchema.safeParse({
      approvalId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = linkIssueApprovalSchema.safeParse({
      approvalId: "not-uuid",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// issueDocumentKeySchema
// ---------------------------------------------------------------------------
describe("issueDocumentKeySchema", () => {
  it("accepts a valid key", () => {
    const result = issueDocumentKeySchema.safeParse("my-doc-1");
    expect(result.success).toBe(true);
  });

  it("rejects empty key", () => {
    const result = issueDocumentKeySchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects key starting with hyphen", () => {
    const result = issueDocumentKeySchema.safeParse("-invalid");
    expect(result.success).toBe(false);
  });

  it("rejects uppercase letters", () => {
    const result = issueDocumentKeySchema.safeParse("MyDoc");
    expect(result.success).toBe(false);
  });

  it("rejects key exceeding 64 chars", () => {
    const result = issueDocumentKeySchema.safeParse("a".repeat(65));
    expect(result.success).toBe(false);
  });

  it("accepts key at exactly 64 chars", () => {
    const result = issueDocumentKeySchema.safeParse("a".repeat(64));
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// issueDocumentFormatSchema
// ---------------------------------------------------------------------------
describe("issueDocumentFormatSchema", () => {
  it("accepts markdown format", () => {
    const result = issueDocumentFormatSchema.safeParse("markdown");
    expect(result.success).toBe(true);
  });

  it("rejects unknown format", () => {
    const result = issueDocumentFormatSchema.safeParse("html");
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// upsertIssueDocumentSchema
// ---------------------------------------------------------------------------
describe("upsertIssueDocumentSchema", () => {
  it("accepts a valid document", () => {
    const result = upsertIssueDocumentSchema.safeParse({
      format: "markdown",
      body: "# Hello World",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing format", () => {
    const result = upsertIssueDocumentSchema.safeParse({ body: "content" });
    expect(result.success).toBe(false);
  });

  it("rejects missing body", () => {
    const result = upsertIssueDocumentSchema.safeParse({ format: "markdown" });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields", () => {
    const result = upsertIssueDocumentSchema.safeParse({
      format: "markdown",
      body: "content",
      title: "My Doc",
      changeSummary: "Updated",
      baseRevisionId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null optional fields", () => {
    const result = upsertIssueDocumentSchema.safeParse({
      format: "markdown",
      body: "content",
      title: null,
      changeSummary: null,
      baseRevisionId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects body exceeding max length", () => {
    const result = upsertIssueDocumentSchema.safeParse({
      format: "markdown",
      body: "x".repeat(524289),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createIssueAttachmentMetadataSchema
// ---------------------------------------------------------------------------
describe("createIssueAttachmentMetadataSchema", () => {
  it("accepts empty object", () => {
    const result = createIssueAttachmentMetadataSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid issueCommentId", () => {
    const result = createIssueAttachmentMetadataSchema.safeParse({
      issueCommentId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null issueCommentId", () => {
    const result = createIssueAttachmentMetadataSchema.safeParse({
      issueCommentId: null,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// restoreIssueDocumentRevisionSchema
// ---------------------------------------------------------------------------
describe("restoreIssueDocumentRevisionSchema", () => {
  it("accepts empty object", () => {
    const result = restoreIssueDocumentRevisionSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

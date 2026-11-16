export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "share.git API",
    version: "1.1.1",
    description: "Read-only GitHub repository sharing for share.keysi.dev",
  },
  servers: [{ url: "https://share.keysi.dev", description: "Production" }],
  tags: [
    { name: "Authorisation", description: "Short-lived GitHub App authorisation" },
    { name: "Shares", description: "Resolve an expiring repository share" },
    { name: "GitHub", description: "Read-only GitHub API proxy scoped to one shared repository" },
  ],
  paths: {
    "/api/auth/start": {
      get: {
        tags: ["Authorisation"],
        summary: "Start GitHub App authorisation",
        parameters: [
          { $ref: "#/components/parameters/RepositoryOwnerQuery" },
          { $ref: "#/components/parameters/RepositoryQuery" },
        ],
        responses: {
          302: { description: "Redirect to GitHub authorisation" },
          400: { $ref: "#/components/responses/Error" },
          429: { $ref: "#/components/responses/Error" },
          503: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/auth/callback": {
      get: {
        tags: ["Authorisation"],
        summary: "Complete GitHub App authorisation",
        parameters: [
          { name: "code", in: "query", required: true, schema: { type: "string", minLength: 1 } },
          {
            name: "state",
            in: "query",
            required: true,
            schema: { type: "string", pattern: "^[A-Za-z0-9_-]{43}$" },
          },
        ],
        responses: {
          302: { description: "Redirect to the new share link" },
          400: { $ref: "#/components/responses/Error" },
          403: { $ref: "#/components/responses/Error" },
          502: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/shares/{owner}/{shareId}": {
      get: {
        tags: ["Shares"],
        summary: "Resolve a repository share",
        parameters: [{ $ref: "#/components/parameters/ShareOwner" }, { $ref: "#/components/parameters/ShareId" }],
        responses: {
          200: {
            description: "Shared repository identity",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Repository" },
              },
            },
          },
          404: { $ref: "#/components/responses/Error" },
          429: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/github/{owner}/{shareId}/rate_limit": {
      get: {
        tags: ["GitHub"],
        summary: "Read the GitHub API rate limit",
        parameters: [{ $ref: "#/components/parameters/ShareOwner" }, { $ref: "#/components/parameters/ShareId" }],
        responses: {
          200: { description: "GitHub API response" },
          404: { $ref: "#/components/responses/Error" },
          429: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/github/{owner}/{shareId}/repos/{repositoryOwner}/{repository}": {
      get: {
        tags: ["GitHub"],
        summary: "Read shared repository metadata",
        parameters: [
          { $ref: "#/components/parameters/ShareOwner" },
          { $ref: "#/components/parameters/ShareId" },
          { $ref: "#/components/parameters/RepositoryOwner" },
          { $ref: "#/components/parameters/Repository" },
        ],
        responses: {
          200: { description: "GitHub API response" },
          403: { $ref: "#/components/responses/Error" },
          404: { $ref: "#/components/responses/Error" },
          429: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/github/{owner}/{shareId}/repos/{repositoryOwner}/{repository}/{resource}": {
      get: {
        tags: ["GitHub"],
        summary: "Read a supported shared repository resource",
        description:
          "Supports branches, contributors, git/trees, contents and commits paths within the shared repository",
        parameters: [
          { $ref: "#/components/parameters/ShareOwner" },
          { $ref: "#/components/parameters/ShareId" },
          { $ref: "#/components/parameters/RepositoryOwner" },
          { $ref: "#/components/parameters/Repository" },
          {
            name: "resource",
            in: "path",
            required: true,
            description: "Supported GitHub resource suffix, including any nested path",
            schema: { type: "string", minLength: 1 },
          },
        ],
        responses: {
          200: { description: "GitHub API response or raw repository file" },
          403: { $ref: "#/components/responses/Error" },
          404: { $ref: "#/components/responses/Error" },
          429: { $ref: "#/components/responses/Error" },
        },
      },
    },
  },
  components: {
    parameters: {
      RepositoryOwnerQuery: {
        name: "owner",
        in: "query",
        required: true,
        schema: { type: "string", pattern: "^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$" },
      },
      RepositoryQuery: {
        name: "repo",
        in: "query",
        required: true,
        schema: { type: "string", minLength: 1, maxLength: 100 },
      },
      ShareOwner: {
        name: "owner",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$" },
      },
      ShareId: {
        name: "shareId",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^[2-9a-hj-km-z]{4}(?:-[2-9a-hj-km-z]{4}){3}$" },
      },
      RepositoryOwner: {
        name: "repositoryOwner",
        in: "path",
        required: true,
        schema: { type: "string", minLength: 1 },
      },
      Repository: {
        name: "repository",
        in: "path",
        required: true,
        schema: { type: "string", minLength: 1 },
      },
    },
    responses: {
      Error: {
        description: "Request failed",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
    },
    schemas: {
      Repository: {
        type: "object",
        additionalProperties: false,
        required: ["owner", "repo"],
        properties: {
          owner: { type: "string" },
          repo: { type: "string" },
        },
      },
      Error: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: { message: { type: "string" } },
      },
    },
  },
} as const;

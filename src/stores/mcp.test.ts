/* Tests for the MCP store — verifies defaults and CRUD actions. */

import { describe, expect, it, beforeEach } from "vitest";
import { useMcpStore } from "./mcp";
import type { McpServer } from "@/types/mcp";

function createTestServer(overrides?: Partial<McpServer>): McpServer {
  return {
    id: "mcp-1",
    name: "Test Server",
    command: "npx",
    args: "-y @modelcontextprotocol/server-test",
    env: "",
    scope: "global",
    enabled: true,
    lastHealthCheck: null,
    ...overrides,
  };
}

function resetStore(): void {
  useMcpStore.setState({ servers: [], isLoading: false });
}

describe("useMcpStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("defaults", () => {
    it("starts with empty servers", () => {
      expect(useMcpStore.getState().servers).toEqual([]);
    });

    it("starts not loading", () => {
      expect(useMcpStore.getState().isLoading).toBe(false);
    });
  });

  describe("setServers", () => {
    it("replaces the server list", () => {
      useMcpStore.getState().setServers([createTestServer(), createTestServer({ id: "mcp-2" })]);
      expect(useMcpStore.getState().servers).toHaveLength(2);
    });
  });

  describe("addServer", () => {
    it("appends a server", () => {
      useMcpStore.getState().addServer(createTestServer());
      expect(useMcpStore.getState().servers).toHaveLength(1);
    });
  });

  describe("updateServer", () => {
    it("updates a server by ID", () => {
      useMcpStore.getState().setServers([createTestServer()]);
      useMcpStore.getState().updateServer("mcp-1", createTestServer({ enabled: false }));
      expect(useMcpStore.getState().servers[0]?.enabled).toBe(false);
    });
  });

  describe("removeServer", () => {
    it("removes a server by ID", () => {
      useMcpStore.getState().setServers([createTestServer({ id: "mcp-1" }), createTestServer({ id: "mcp-2" })]);
      useMcpStore.getState().removeServer("mcp-1");
      expect(useMcpStore.getState().servers).toHaveLength(1);
      expect(useMcpStore.getState().servers[0]?.id).toBe("mcp-2");
    });
  });
});

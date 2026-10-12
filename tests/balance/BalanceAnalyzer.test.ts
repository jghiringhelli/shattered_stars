/**
 * Balance Analyzer Tests
 *
 * Tests for the comprehensive balance analysis system.
 */

import { describe, it, expect } from "vitest";
import {
  BalanceAnalyzer,
  type BalanceReport,
} from "../../src/simulation/BalanceAnalyzer";

describe("BalanceAnalyzer", () => {
  // Use smaller sample sizes for faster tests
  const analyzer = new BalanceAnalyzer("continuous", 10);

  describe("Faction Balance Analysis", () => {
    it("should analyze all factions", async () => {
      const report = await analyzer.analyze();

      expect(report.factionBalance).toBeDefined();
      expect(report.factionBalance.factions.size).toBe(5);
    });

    it("should track matchup data", async () => {
      const report = await analyzer.analyze();

      // 5 factions = 10 unique matchups
      expect(report.factionBalance.matchups.size).toBe(10);
    });

    it("should identify imbalance warnings", async () => {
      const report = await analyzer.analyze();

      expect(Array.isArray(report.factionBalance.imbalanceWarnings)).toBe(true);
    });
  });

  describe("Ship Balance Analysis", () => {
    it("should analyze all ships", async () => {
      const report = await analyzer.analyze();

      expect(report.shipBalance).toBeDefined();
      expect(report.shipBalance.ships.size).toBeGreaterThan(0);
    });

    it("should identify overperformers and underperformers", async () => {
      const report = await analyzer.analyze();

      expect(Array.isArray(report.shipBalance.overperformers)).toBe(true);
      expect(Array.isArray(report.shipBalance.underperformers)).toBe(true);
    });

    it("should rate ships A-F", async () => {
      const report = await analyzer.analyze();

      const validRatings = ["S", "A", "B", "C", "D", "F"];
      for (const [, stats] of report.shipBalance.ships) {
        expect(validRatings).toContain(stats.rating);
      }
    });
  });

  describe("Role Balance Analysis", () => {
    it("should analyze all roles", async () => {
      const report = await analyzer.analyze();

      expect(report.roleBalance).toBeDefined();
      expect(report.roleBalance.roles.size).toBeGreaterThan(0);
    });

    it("should check for rock-paper-scissors balance", async () => {
      const report = await analyzer.analyze();

      expect(typeof report.roleBalance.rockPaperScissors).toBe("boolean");
    });
  });

  describe("Gameplay Feel Integration", () => {
    it("should include gameplay feel analysis", async () => {
      const report = await analyzer.analyze();

      expect(report.gameplayFeel).toBeDefined();
      expect(report.gameplayFeel.ttk).toBeDefined();
      expect(report.gameplayFeel.pacing).toBeDefined();
      expect(report.gameplayFeel.skillExpression).toBeDefined();
      expect(report.gameplayFeel.funFactor).toBeDefined();
    });
  });

  describe("Monster Analysis", () => {
    it("should analyze monster content", async () => {
      const report = await analyzer.analyze();

      expect(report.monsterAnalysis).toBeDefined();
      expect(report.monsterAnalysis.totalMonsters).toBeGreaterThan(0);
      expect(report.monsterAnalysis.bossCount).toBeGreaterThan(0);
    });

    it("should provide difficulty spread", async () => {
      const report = await analyzer.analyze();

      expect(report.monsterAnalysis.difficultySpread).toBeDefined();
      expect(typeof report.monsterAnalysis.difficultySpread.easy).toBe(
        "number",
      );
      expect(typeof report.monsterAnalysis.difficultySpread.medium).toBe(
        "number",
      );
      expect(typeof report.monsterAnalysis.difficultySpread.hard).toBe(
        "number",
      );
      expect(typeof report.monsterAnalysis.difficultySpread.extreme).toBe(
        "number",
      );
    });
  });

  describe("Overall Health Score", () => {
    it("should calculate overall health", async () => {
      const report = await analyzer.analyze();

      expect(report.overallHealth).toBeDefined();
      expect(report.overallHealth.score).toBeGreaterThanOrEqual(0);
      expect(report.overallHealth.score).toBeLessThanOrEqual(100);
    });

    it("should assign a grade", async () => {
      const report = await analyzer.analyze();

      const validGrades = ["A", "B", "C", "D", "F"];
      expect(validGrades).toContain(report.overallHealth.grade);
    });

    it("should provide breakdown scores", async () => {
      const report = await analyzer.analyze();

      expect(
        report.overallHealth.breakdown.factionBalance,
      ).toBeGreaterThanOrEqual(0);
      expect(report.overallHealth.breakdown.shipBalance).toBeGreaterThanOrEqual(
        0,
      );
      expect(
        report.overallHealth.breakdown.gameplayFeel,
      ).toBeGreaterThanOrEqual(0);
      expect(report.overallHealth.breakdown.pveContent).toBeGreaterThanOrEqual(
        0,
      );
    });
  });

  describe("Recommendations", () => {
    it("should generate recommendations", async () => {
      const report = await analyzer.analyze();

      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it("should have valid priority levels", async () => {
      const report = await analyzer.analyze();

      const validPriorities = ["critical", "high", "medium", "low"];
      for (const rec of report.recommendations) {
        expect(validPriorities).toContain(rec.priority);
      }
    });

    it("should have valid categories", async () => {
      const report = await analyzer.analyze();

      const validCategories = ["balance", "gameplay", "content", "polish"];
      for (const rec of report.recommendations) {
        expect(validCategories).toContain(rec.category);
      }
    });

    it("should sort recommendations by priority", async () => {
      const report = await analyzer.analyze();

      const priorityOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };

      for (let i = 1; i < report.recommendations.length; i++) {
        const prev = report.recommendations[i - 1]!;
        const curr = report.recommendations[i]!;
        expect(priorityOrder[prev.priority]).toBeLessThanOrEqual(
          priorityOrder[curr.priority]!,
        );
      }
    });
  });

  describe("Report Generation", () => {
    it("should generate text report", async () => {
      const report = await analyzer.analyze();
      const textReport = analyzer.generateReport(report);

      expect(textReport).toContain("BALANCE ANALYSIS REPORT");
      expect(textReport).toContain("OVERALL HEALTH");
      expect(textReport).toContain("FACTION BALANCE");
      expect(textReport).toContain("SHIP BALANCE");
      expect(textReport).toContain("PVE CONTENT");
      expect(textReport).toContain("RECOMMENDATIONS");
    });

    it("should include metadata", async () => {
      const report = await analyzer.analyze();

      expect(report.generatedAt).toBeTruthy();
      expect(report.simulationRuns).toBeGreaterThan(0);
      expect(report.mode).toBe("continuous");
    });
  });

  describe("Performance", () => {
    it("should complete analysis in reasonable time", async () => {
      const start = Date.now();
      await analyzer.analyze();
      const elapsed = Date.now() - start;

      // Should complete in under 30 seconds for small sample
      expect(elapsed).toBeLessThan(30000);
    }, 35000);
  });
});

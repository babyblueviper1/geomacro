import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const growth = JSON.parse(readFileSync("config/growth-agent.json", "utf8"));

describe("Geomacro zero-cost Growth Agent", () => {
  it("keeps external publishing and submissions fail-closed by default", () => {
    expect(growth.mode).toBe("prelaunch-shadow");
    expect(growth.live_external_submission_enabled).toBe(false);
    expect(growth.live_social_publish_enabled).toBe(false);
    expect(growth.activation.require_production_endpoint_health).toBe(true);
    expect(growth.activation.require_live_402_before_paid_marketplace_claims).toBe(true);
    expect(growth.activation.require_receipt_or_listing_evidence).toBe(true);
  });

  it("keeps the core acquisition loop zero-cost", () => {
    expect(growth.zero_cost_first).toBe(true);
    expect(growth.cost_guardrails.paid_ads).toBe(false);
    expect(growth.cost_guardrails.paid_social_api).toBe(false);
    expect(growth.cost_guardrails.paid_directory_submission).toBe(false);
    expect(growth.cost_guardrails.paid_influencer_campaign).toBe(false);
    expect(growth.free_social_channels.x.enabled).toBe(false);
  });

  it("requires value-first distribution and forbids spam behavior", () => {
    expect(growth.content_policy.required_value_before_cta).toBe(true);
    expect(growth.anti_spam.mass_unsolicited_dm).toBe(false);
    expect(growth.anti_spam.auto_reply_to_unrelated_threads).toBe(false);
    expect(growth.anti_spam.fake_accounts).toBe(false);
    expect(growth.anti_spam.fake_engagement).toBe(false);
    expect(growth.anti_spam.captcha_bypass).toBe(false);
    expect(growth.anti_spam.terms_bypass).toBe(false);
    expect(growth.anti_spam.max_promotional_posts_per_channel_per_day).toBeLessThanOrEqual(2);
  });

  it("optimizes for repeat paid usage rather than vanity impressions", () => {
    expect(growth.success_metrics).toContain("settled_paid_calls");
    expect(growth.success_metrics).toContain("repeat_paid_callers");
    expect(growth.success_metrics).toContain("revenue_per_distribution_channel");
  });
});

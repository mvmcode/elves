// Curated list of known-good skill source repositories.

use super::types::CuratedSource;

/// Returns the built-in list of curated skill repositories.
pub fn curated_sources() -> Vec<CuratedSource> {
    vec![
        CuratedSource {
            repo_name: "anthropics/skills".into(),
            description: "Official Anthropic skills — Stripe, Vercel, Cloudflare, and more".into(),
            categories: vec!["official".into(), "integrations".into()],
        },
        CuratedSource {
            repo_name: "affaan-m/everything-claude-code".into(),
            description: "40+ commands, 65+ skills, 16 agents — comprehensive Claude Code collection".into(),
            categories: vec!["community".into(), "commands".into(), "agents".into()],
        },
        CuratedSource {
            repo_name: "wshobson/commands".into(),
            description: "57 production-ready slash commands for Claude Code".into(),
            categories: vec!["commands".into(), "production".into()],
        },
        CuratedSource {
            repo_name: "alirezarezvani/claude-skills".into(),
            description: "169 skills across 9 domains — coding, review, testing, and more".into(),
            categories: vec!["skills".into(), "multi-domain".into()],
        },
        CuratedSource {
            repo_name: "qdhenry/Claude-Command-Suite".into(),
            description: "216 commands organized by namespace for Claude Code".into(),
            categories: vec!["commands".into(), "organized".into()],
        },
    ]
}

// Claude world discovery — reads custom agents and settings from ~/.claude/ at startup.
//
// Pure filesystem reads, no subprocess calls. Discovers custom agents from
// ~/.claude/agents/*.md (YAML frontmatter + markdown body), and user settings
// from ~/.claude/settings.json (default model, permission mode).

use serde::{Deserialize, Serialize};

/// A custom agent definition discovered from ~/.claude/agents/<slug>.md.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeAgent {
    /// Filename stem, e.g. "founding-engineer"
    pub slug: String,
    /// Human-readable name from frontmatter (falls back to slug)
    pub name: String,
    /// One-line description from frontmatter
    pub description: String,
    /// Preferred model from frontmatter (e.g. "opus", "sonnet")
    pub model: Option<String>,
    /// Color hint from frontmatter
    pub color: Option<String>,
    /// Markdown body after the YAML frontmatter (the agent's system prompt)
    pub system_prompt: String,
    /// Absolute path to the .md file
    pub file_path: String,
}

/// User-level Claude Code settings from ~/.claude/settings.json.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSettings {
    pub default_model: Option<String>,
    pub default_permission_mode: Option<String>,
}

/// Everything ELVES discovers about the user's Claude Code installation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeDiscovery {
    pub agents: Vec<ClaudeAgent>,
    pub settings: ClaudeSettings,
    pub claude_dir_exists: bool,
    pub has_agents: bool,
}

/// A skill/command discovered from ~/.claude/commands/ or <project>/.claude/commands/.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredSkill {
    pub name: String,
    pub description: String,
    pub content: String,
    pub trigger_pattern: String,
    pub file_path: String,
    /// "global" for ~/.claude/commands/, "project" for <project>/.claude/commands/.
    pub scope: String,
}

/// Discover the user's Claude Code world: custom agents and settings.
///
/// Reads from ~/.claude/ using pure filesystem operations. Returns a
/// ClaudeDiscovery with agents, settings, and existence flags.
/// Never fails — returns empty/default values if anything is missing.
pub fn discover_claude_world() -> ClaudeDiscovery {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => {
            log::warn!("Could not determine home directory for Claude discovery");
            return ClaudeDiscovery {
                agents: vec![],
                settings: ClaudeSettings::default(),
                claude_dir_exists: false,
                has_agents: false,
            };
        }
    };

    let claude_dir = home.join(".claude");
    let claude_dir_exists = claude_dir.is_dir();

    let agents = discover_agents(&claude_dir);
    let settings = read_claude_settings(&claude_dir);
    let has_agents = !agents.is_empty();

    log::info!(
        "Claude discovery: dir_exists={claude_dir_exists}, agents={}, model={:?}",
        agents.len(),
        settings.default_model,
    );

    ClaudeDiscovery {
        agents,
        settings,
        claude_dir_exists,
        has_agents,
    }
}

/// Scan ~/.claude/agents/*.md and parse each into a ClaudeAgent.
fn discover_agents(claude_dir: &std::path::Path) -> Vec<ClaudeAgent> {
    let agents_dir = claude_dir.join("agents");
    if !agents_dir.is_dir() {
        return vec![];
    }

    let entries = match std::fs::read_dir(&agents_dir) {
        Ok(entries) => entries,
        Err(e) => {
            log::warn!("Failed to read agents directory: {e}");
            return vec![];
        }
    };

    let mut agents: Vec<ClaudeAgent> = entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.path().extension().is_some_and(|ext| ext == "md")
        })
        .filter_map(|entry| parse_agent_file(&entry.path()))
        .collect();

    agents.sort_by(|a, b| a.slug.cmp(&b.slug));
    agents
}

/// Parse a single agent .md file with YAML frontmatter.
///
/// Expected format:
/// ```text
/// ---
/// name: founding-engineer
/// description: "Use this agent for..."
/// model: opus
/// color: blue
/// ---
/// <markdown system prompt>
/// ```
///
/// Returns None if the file can't be read or has no valid frontmatter.
fn parse_agent_file(path: &std::path::Path) -> Option<ClaudeAgent> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => {
            log::warn!("Failed to read agent file {}: {e}", path.display());
            return None;
        }
    };

    let slug = path.file_stem()?.to_str()?.to_string();
    let file_path = path.to_string_lossy().to_string();

    // Split on YAML frontmatter delimiters: --- ... ---
    let (frontmatter, body) = split_frontmatter(&content);

    let name = extract_yaml_value(frontmatter, "name")
        .unwrap_or_else(|| slug.clone());
    let description = extract_yaml_value(frontmatter, "description")
        .unwrap_or_default();
    let model = extract_yaml_value(frontmatter, "model");
    let color = extract_yaml_value(frontmatter, "color");

    // Truncate description to first sentence or 200 chars for UI display
    let description = truncate_description(&description);

    Some(ClaudeAgent {
        slug,
        name,
        description,
        model,
        color,
        system_prompt: body.to_string(),
        file_path,
    })
}

/// Split a markdown file into (frontmatter, body) at YAML --- delimiters.
/// Returns ("", full_content) if no valid frontmatter is found.
fn split_frontmatter(content: &str) -> (&str, &str) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return ("", content);
    }

    // Find the closing --- after the opening one
    let after_open = &trimmed[3..];
    if let Some(close_pos) = after_open.find("\n---") {
        let frontmatter = &after_open[..close_pos];
        let body_start = close_pos + 4; // skip \n---
        let body = after_open.get(body_start..).unwrap_or("");
        (frontmatter.trim(), body.trim())
    } else {
        ("", content)
    }
}

/// Extract a simple key: value from YAML-ish frontmatter.
///
/// Handles quoted values (strips surrounding quotes) and multi-line values
/// by taking only the first line. This is intentionally simple — agent
/// frontmatter has 3-5 simple key: value lines.
fn extract_yaml_value(frontmatter: &str, key: &str) -> Option<String> {
    let prefix = format!("{key}:");
    for line in frontmatter.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix(&prefix) {
            let value = rest.trim();
            // Strip surrounding quotes if present
            let value = value
                .strip_prefix('"')
                .and_then(|v| v.strip_suffix('"'))
                .or_else(|| {
                    value
                        .strip_prefix('\'')
                        .and_then(|v| v.strip_suffix('\''))
                })
                .unwrap_or(value);
            if value.is_empty() {
                return None;
            }
            return Some(value.to_string());
        }
    }
    None
}

/// Truncate a long description to the first sentence or 200 chars.
fn truncate_description(desc: &str) -> String {
    // Take up to the first paragraph break
    let first_para = desc.split("\n\n").next().unwrap_or(desc);
    // Then take up to first sentence end
    if let Some(period_pos) = first_para.find(". ") {
        let sentence = &first_para[..=period_pos];
        if sentence.len() > 200 {
            let mut result = sentence[..197].to_string();
            result.push_str("...");
            return result;
        }
        return sentence.to_string();
    }
    if first_para.len() > 200 {
        let mut result = first_para[..197].to_string();
        result.push_str("...");
        return result;
    }
    first_para.to_string()
}

/// Discover skills/commands from ~/.claude/commands/ (global) and optionally
/// from <project_path>/.claude/commands/ (project-scoped).
///
/// Each .md file becomes a skill: filename stem is the trigger pattern (e.g.
/// `deploy.md` → `/deploy`), optional YAML frontmatter for name/description,
/// and the file content is the skill body.
pub fn discover_commands(project_path: Option<&str>) -> Vec<DiscoveredSkill> {
    let mut skills = Vec::new();

    // Global commands from ~/.claude/commands/
    if let Some(home) = dirs::home_dir() {
        let global_dir = home.join(".claude").join("commands");
        skills.extend(scan_commands_dir(&global_dir, "global"));
    }

    // Project-level commands from <project>/.claude/commands/
    if let Some(path) = project_path {
        let project_dir = std::path::Path::new(path).join(".claude").join("commands");
        skills.extend(scan_commands_dir(&project_dir, "project"));
    }

    skills.sort_by(|a, b| a.trigger_pattern.cmp(&b.trigger_pattern));
    log::info!("Discovered {} Claude commands/skills", skills.len());
    skills
}

/// Scan a single commands directory and parse each .md file into a DiscoveredSkill.
fn scan_commands_dir(dir: &std::path::Path, scope: &str) -> Vec<DiscoveredSkill> {
    if !dir.is_dir() {
        return vec![];
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) => {
            log::warn!("Failed to read commands directory {}: {e}", dir.display());
            return vec![];
        }
    };

    entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "md"))
        .filter_map(|entry| parse_command_file(&entry.path(), scope))
        .collect()
}

/// Parse a single command .md file into a DiscoveredSkill.
///
/// Supports optional YAML frontmatter with `name` and `description` fields.
/// Falls back to filename stem for name and empty string for description.
fn parse_command_file(path: &std::path::Path, scope: &str) -> Option<DiscoveredSkill> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => {
            log::warn!("Failed to read command file {}: {e}", path.display());
            return None;
        }
    };

    let slug = path.file_stem()?.to_str()?.to_string();
    let file_path = path.to_string_lossy().to_string();
    let trigger_pattern = format!("/{slug}");

    let (frontmatter, body) = split_frontmatter(&content);

    let name = extract_yaml_value(frontmatter, "name")
        .unwrap_or_else(|| slug.clone());
    let description = extract_yaml_value(frontmatter, "description")
        .unwrap_or_default();
    let description = truncate_description(&description);

    Some(DiscoveredSkill {
        name,
        description,
        content: body.to_string(),
        trigger_pattern,
        file_path,
        scope: scope.to_string(),
    })
}

/// Read ~/.claude/settings.json and extract model + permission mode.
fn read_claude_settings(claude_dir: &std::path::Path) -> ClaudeSettings {
    let settings_path = claude_dir.join("settings.json");
    let content = match std::fs::read_to_string(&settings_path) {
        Ok(c) => c,
        Err(_) => return ClaudeSettings::default(),
    };

    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("Failed to parse settings.json: {e}");
            return ClaudeSettings::default();
        }
    };

    let default_model = json
        .get("model")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let default_permission_mode = json
        .get("permissions")
        .and_then(|p| p.get("defaultMode"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    ClaudeSettings {
        default_model,
        default_permission_mode,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_frontmatter_valid() {
        let content = "---\nname: test\nmodel: opus\n---\n# Body content\nHello world";
        let (fm, body) = split_frontmatter(content);
        assert_eq!(fm, "name: test\nmodel: opus");
        assert_eq!(body, "# Body content\nHello world");
    }

    #[test]
    fn split_frontmatter_no_frontmatter() {
        let content = "# Just markdown\nNo frontmatter here";
        let (fm, body) = split_frontmatter(content);
        assert_eq!(fm, "");
        assert_eq!(body, content);
    }

    #[test]
    fn split_frontmatter_unclosed() {
        let content = "---\nname: test\nNo closing delimiter";
        let (fm, body) = split_frontmatter(content);
        assert_eq!(fm, "");
        assert_eq!(body, content);
    }

    #[test]
    fn extract_yaml_value_simple() {
        let fm = "name: founding-engineer\nmodel: opus\ncolor: blue";
        assert_eq!(extract_yaml_value(fm, "name"), Some("founding-engineer".into()));
        assert_eq!(extract_yaml_value(fm, "model"), Some("opus".into()));
        assert_eq!(extract_yaml_value(fm, "color"), Some("blue".into()));
        assert_eq!(extract_yaml_value(fm, "missing"), None);
    }

    #[test]
    fn extract_yaml_value_quoted() {
        let fm = r#"name: "test agent"
description: "A helpful agent for testing""#;
        assert_eq!(extract_yaml_value(fm, "name"), Some("test agent".into()));
        assert_eq!(
            extract_yaml_value(fm, "description"),
            Some("A helpful agent for testing".into()),
        );
    }

    #[test]
    fn extract_yaml_value_single_quoted() {
        let fm = "name: 'my-agent'";
        assert_eq!(extract_yaml_value(fm, "name"), Some("my-agent".into()));
    }

    #[test]
    fn extract_yaml_value_empty_returns_none() {
        let fm = "name: \nmodel: opus";
        assert_eq!(extract_yaml_value(fm, "name"), None);
        assert_eq!(extract_yaml_value(fm, "model"), Some("opus".into()));
    }

    #[test]
    fn truncate_description_short() {
        assert_eq!(truncate_description("A short description"), "A short description");
    }

    #[test]
    fn truncate_description_with_sentence_break() {
        let desc = "Use this agent for complex tasks. It handles architecture decisions and more.";
        assert_eq!(truncate_description(desc), "Use this agent for complex tasks.");
    }

    #[test]
    fn truncate_description_long_single_sentence() {
        let long = "a".repeat(300);
        let result = truncate_description(&long);
        assert!(result.len() <= 200);
        assert!(result.ends_with("..."));
    }

    #[test]
    fn parse_agent_file_with_tempfile() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test-agent.md");
        std::fs::write(
            &file_path,
            "---\nname: test-agent\ndescription: A test agent\nmodel: sonnet\ncolor: red\n---\n# System Prompt\nYou are a test agent.",
        )
        .unwrap();

        let agent = parse_agent_file(&file_path).expect("Should parse agent file");
        assert_eq!(agent.slug, "test-agent");
        assert_eq!(agent.name, "test-agent");
        assert_eq!(agent.description, "A test agent");
        assert_eq!(agent.model, Some("sonnet".into()));
        assert_eq!(agent.color, Some("red".into()));
        assert!(agent.system_prompt.contains("You are a test agent"));
        assert_eq!(agent.file_path, file_path.to_string_lossy());
    }

    #[test]
    fn parse_agent_file_minimal_frontmatter() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("minimal.md");
        std::fs::write(&file_path, "---\nname: minimal\n---\nJust a prompt.").unwrap();

        let agent = parse_agent_file(&file_path).unwrap();
        assert_eq!(agent.slug, "minimal");
        assert_eq!(agent.name, "minimal");
        assert_eq!(agent.description, "");
        assert_eq!(agent.model, None);
        assert_eq!(agent.color, None);
        assert_eq!(agent.system_prompt, "Just a prompt.");
    }

    #[test]
    fn discover_agents_from_temp_dir() {
        let dir = tempfile::tempdir().unwrap();
        let agents_dir = dir.path().join("agents");
        std::fs::create_dir(&agents_dir).unwrap();

        std::fs::write(
            agents_dir.join("alpha.md"),
            "---\nname: alpha\ndescription: First\n---\nAlpha prompt",
        )
        .unwrap();
        std::fs::write(
            agents_dir.join("beta.md"),
            "---\nname: beta\ndescription: Second\nmodel: haiku\n---\nBeta prompt",
        )
        .unwrap();
        // Non-.md file should be ignored
        std::fs::write(agents_dir.join("notes.txt"), "Not an agent").unwrap();

        let agents = discover_agents(dir.path());
        assert_eq!(agents.len(), 2);
        assert_eq!(agents[0].slug, "alpha"); // sorted alphabetically
        assert_eq!(agents[1].slug, "beta");
        assert_eq!(agents[1].model, Some("haiku".into()));
    }

    #[test]
    fn read_settings_from_temp_dir() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("settings.json"),
            r#"{"model": "opus", "permissions": {"defaultMode": "plan"}}"#,
        )
        .unwrap();

        let settings = read_claude_settings(dir.path());
        assert_eq!(settings.default_model, Some("opus".into()));
        assert_eq!(settings.default_permission_mode, Some("plan".into()));
    }

    #[test]
    fn read_settings_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let settings = read_claude_settings(dir.path());
        assert_eq!(settings.default_model, None);
        assert_eq!(settings.default_permission_mode, None);
    }

    #[test]
    fn read_settings_partial_json() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("settings.json"),
            r#"{"model": "sonnet"}"#,
        )
        .unwrap();

        let settings = read_claude_settings(dir.path());
        assert_eq!(settings.default_model, Some("sonnet".into()));
        assert_eq!(settings.default_permission_mode, None);
    }

    #[test]
    fn scan_commands_dir_discovers_md_files() {
        let dir = tempfile::tempdir().unwrap();
        let cmds_dir = dir.path().join("commands");
        std::fs::create_dir(&cmds_dir).unwrap();

        std::fs::write(
            cmds_dir.join("deploy.md"),
            "---\nname: deploy\ndescription: Deploy the app\n---\nRun deploy steps.",
        )
        .unwrap();
        std::fs::write(
            cmds_dir.join("test.md"),
            "Just run tests, no frontmatter.",
        )
        .unwrap();
        // Non-.md should be ignored
        std::fs::write(cmds_dir.join("notes.txt"), "Not a command").unwrap();

        let skills = scan_commands_dir(&cmds_dir, "global");
        assert_eq!(skills.len(), 2);

        let deploy = skills.iter().find(|s| s.trigger_pattern == "/deploy").unwrap();
        assert_eq!(deploy.name, "deploy");
        assert_eq!(deploy.description, "Deploy the app");
        assert!(deploy.content.contains("Run deploy steps"));
        assert_eq!(deploy.scope, "global");

        let test_skill = skills.iter().find(|s| s.trigger_pattern == "/test").unwrap();
        assert_eq!(test_skill.name, "test");
        assert!(test_skill.content.contains("Just run tests"));
    }

    #[test]
    fn scan_commands_dir_nonexistent_returns_empty() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("nonexistent");
        assert!(scan_commands_dir(&missing, "global").is_empty());
    }

    #[test]
    fn parse_command_file_with_frontmatter() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("review.md");
        std::fs::write(
            &file_path,
            "---\nname: Code Review\ndescription: Review the PR\n---\n# Review\nCheck for bugs.",
        )
        .unwrap();

        let skill = parse_command_file(&file_path, "project").unwrap();
        assert_eq!(skill.name, "Code Review");
        assert_eq!(skill.trigger_pattern, "/review");
        assert_eq!(skill.scope, "project");
        assert!(skill.content.contains("Check for bugs"));
    }

    #[test]
    fn parse_command_file_without_frontmatter() {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("simple.md");
        std::fs::write(&file_path, "Just do the thing.").unwrap();

        let skill = parse_command_file(&file_path, "global").unwrap();
        assert_eq!(skill.name, "simple");
        assert_eq!(skill.trigger_pattern, "/simple");
        assert_eq!(skill.description, "");
        assert!(skill.content.contains("Just do the thing"));
    }
}

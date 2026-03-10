// Insights command — reads Claude Code usage JSON files (session-meta, facets, stats-cache, report.html),
// returning a single aggregated InsightsData struct for the dashboard.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// ── Output structs (sent to frontend, camelCase) ────────────────────────────

/// A single day's count for timeline charts.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyActivityEntry {
    pub date: String,
    pub session_count: u32,
    pub message_count: u32,
    pub tool_call_count: u32,
}

/// A named item with a numeric count.
#[derive(Debug, Clone, Serialize)]
pub struct NamedCount {
    pub name: String,
    pub count: u32,
}

/// Outcome distribution entry.
#[derive(Debug, Clone, Serialize)]
pub struct OutcomeEntry {
    pub outcome: String,
    pub count: u32,
    pub percentage: f64,
}

/// Per-model token breakdown from stats-cache.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsageEntry {
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_creation_tokens: u64,
    pub cache_hit_rate: f64,
}

/// Per-project aggregated summary.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub name: String,
    pub sessions: u32,
    pub lines_added: u64,
    pub commits: u32,
    pub duration_minutes: u64,
    pub tokens: u64,
}

/// Per-session summary for the recent sessions list.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub session_id: String,
    pub project: String,
    pub start_time: String,
    pub duration_minutes: u64,
    pub first_prompt: String,
    pub outcome: String,
    pub brief_summary: String,
    pub lines_added: u64,
    pub tokens: u64,
    pub commits: u32,
}

/// Feature adoption stats.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureAdoption {
    pub task_agent: u32,
    pub mcp: u32,
    pub web_search: u32,
    pub web_fetch: u32,
    pub total: u32,
}

/// Full aggregated insights data returned to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightsData {
    // KPIs
    pub total_sessions: u32,
    pub total_messages: u64,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_duration_minutes: u64,
    pub total_commits: u32,
    pub lines_added: u64,
    pub lines_removed: u64,
    pub files_changed: u32,
    pub first_session_date: Option<String>,

    // Timeline
    pub daily_activity: Vec<DailyActivityEntry>,
    pub hourly_distribution: Vec<u32>,

    // Models
    pub model_usage: Vec<ModelUsageEntry>,

    // Projects
    pub projects: Vec<ProjectSummary>,

    // Quality
    pub outcomes: Vec<OutcomeEntry>,
    pub top_helpfulness: Vec<NamedCount>,
    pub top_satisfaction: Vec<NamedCount>,
    pub top_friction: Vec<NamedCount>,
    pub top_goals: Vec<NamedCount>,
    pub top_session_types: Vec<NamedCount>,

    // Tools
    pub top_tools: Vec<NamedCount>,
    pub top_languages: Vec<NamedCount>,

    // Features
    pub feature_adoption: FeatureAdoption,

    // Sessions
    pub recent_sessions: Vec<SessionSummary>,

    // Report
    pub report_html: Option<String>,
}

// ── Input structs (deserialized from Claude Code JSON files) ─────────────────

/// Raw session metadata from `~/.claude/usage-data/session-meta/*.json`.
/// Fields are snake_case in the actual JSON — no rename_all.
#[derive(Debug, Deserialize)]
struct RawSessionMeta {
    session_id: Option<String>,
    project_path: Option<String>,
    start_time: Option<String>,
    duration_minutes: Option<u64>,
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    git_commits: Option<u32>,
    #[allow(dead_code)]
    git_pushes: Option<u32>,
    tool_counts: Option<HashMap<String, u32>>,
    languages: Option<HashMap<String, u32>>,
    lines_added: Option<u64>,
    lines_removed: Option<u64>,
    files_modified: Option<u32>,
    first_prompt: Option<String>,
    user_message_count: Option<u32>,
    assistant_message_count: Option<u32>,
    #[allow(dead_code)]
    tool_errors: Option<u32>,
    uses_task_agent: Option<bool>,
    uses_mcp: Option<bool>,
    uses_web_search: Option<bool>,
    uses_web_fetch: Option<bool>,
}

/// Raw facets data from `~/.claude/usage-data/facets/*.json`.
/// Fields are snake_case in the actual JSON — no rename_all.
#[derive(Debug, Deserialize)]
struct RawSessionFacet {
    session_id: Option<String>,
    outcome: Option<String>,
    goal_categories: Option<HashMap<String, u32>>,
    friction_counts: Option<HashMap<String, u32>>,
    user_satisfaction_counts: Option<HashMap<String, u32>>,
    claude_helpfulness: Option<String>,
    session_type: Option<String>,
    brief_summary: Option<String>,
}

/// Stats cache from `~/.claude/stats-cache.json`.
/// This file IS camelCase — use per-field rename.
#[derive(Debug, Deserialize)]
struct RawStatsCache {
    #[serde(rename = "totalSessions")]
    total_sessions: Option<u32>,
    #[serde(rename = "totalMessages")]
    total_messages: Option<u64>,
    #[serde(rename = "firstSessionDate")]
    first_session_date: Option<String>,
    #[serde(rename = "longestSession")]
    #[allow(dead_code)]
    longest_session: Option<serde_json::Value>,
    #[serde(rename = "dailyActivity")]
    daily_activity: Option<Vec<RawDailyActivity>>,
    #[serde(rename = "hourCounts")]
    hour_counts: Option<HashMap<String, u32>>,
    #[serde(rename = "modelUsage")]
    model_usage: Option<HashMap<String, RawModelUsage>>,
}

/// A single daily activity entry from stats-cache (camelCase).
#[derive(Debug, Deserialize)]
struct RawDailyActivity {
    date: Option<String>,
    #[serde(rename = "messageCount")]
    message_count: Option<u32>,
    #[serde(rename = "sessionCount")]
    session_count: Option<u32>,
    #[serde(rename = "toolCallCount")]
    tool_call_count: Option<u32>,
}

/// Per-model usage from stats-cache (camelCase).
#[derive(Debug, Deserialize)]
struct RawModelUsage {
    #[serde(rename = "inputTokens")]
    input_tokens: Option<u64>,
    #[serde(rename = "outputTokens")]
    output_tokens: Option<u64>,
    #[serde(rename = "cacheReadInputTokens")]
    cache_read_input_tokens: Option<u64>,
    #[serde(rename = "cacheCreationInputTokens")]
    cache_creation_input_tokens: Option<u64>,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/// Read and deserialize all JSON files from a directory, skipping any that fail to parse.
fn read_json_dir<T: serde::de::DeserializeOwned>(dir: &PathBuf) -> Vec<T> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .is_some_and(|ext| ext == "json")
        })
        .filter_map(|entry| {
            let content = fs::read_to_string(entry.path()).ok()?;
            serde_json::from_str::<T>(&content).ok()
        })
        .collect()
}

/// Extract the project name from a path — last path component.
fn project_name_from_path(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

/// Aggregate top-N items from a frequency map, sorted by count descending.
fn top_n(map: &HashMap<String, u32>, n: usize) -> Vec<NamedCount> {
    let mut items: Vec<_> = map
        .iter()
        .map(|(name, &count)| NamedCount {
            name: name.clone(),
            count,
        })
        .collect();
    items.sort_by(|a, b| b.count.cmp(&a.count));
    items.truncate(n);
    items
}

/// Truncate a string to at most `max_len` characters, appending "…" if truncated.
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        let mut truncated = s[..max_len].to_string();
        truncated.push('…');
        truncated
    }
}

// ── Main command ────────────────────────────────────────────────────────────

/// Load insights data from Claude Code usage files: session-meta, facets, stats-cache, report.html.
#[tauri::command]
pub fn load_insights() -> Result<InsightsData, String> {
    let home = dirs::home_dir().ok_or("Could not resolve home directory")?;
    let usage_dir = home.join(".claude").join("usage-data");
    let meta_dir = usage_dir.join("session-meta");
    let facets_dir = usage_dir.join("facets");
    let stats_cache_path = home.join(".claude").join("stats-cache.json");
    let report_path = usage_dir.join("report.html");

    // 1. Read stats-cache.json for global totals, daily activity, hour counts, model usage
    let stats: Option<RawStatsCache> = fs::read_to_string(&stats_cache_path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok());

    let total_sessions = stats.as_ref().and_then(|s| s.total_sessions).unwrap_or(0);
    let total_messages = stats.as_ref().and_then(|s| s.total_messages).unwrap_or(0);
    let first_session_date = stats.as_ref().and_then(|s| s.first_session_date.clone());

    // Daily activity from stats-cache
    let daily_activity: Vec<DailyActivityEntry> = stats
        .as_ref()
        .and_then(|s| s.daily_activity.as_ref())
        .map(|days| {
            days.iter()
                .filter_map(|d| {
                    Some(DailyActivityEntry {
                        date: d.date.clone()?,
                        session_count: d.session_count.unwrap_or(0),
                        message_count: d.message_count.unwrap_or(0),
                        tool_call_count: d.tool_call_count.unwrap_or(0),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    // Hourly distribution from stats-cache (keys are string hour numbers)
    let mut hourly: Vec<u32> = vec![0; 24];
    if let Some(hour_counts) = stats.as_ref().and_then(|s| s.hour_counts.as_ref()) {
        for (hour_str, &count) in hour_counts {
            if let Ok(hour) = hour_str.parse::<usize>() {
                if hour < 24 {
                    hourly[hour] = count;
                }
            }
        }
    }

    // Model usage from stats-cache
    let model_usage: Vec<ModelUsageEntry> = stats
        .as_ref()
        .and_then(|s| s.model_usage.as_ref())
        .map(|models| {
            let mut entries: Vec<ModelUsageEntry> = models
                .iter()
                .map(|(model, usage)| {
                    let input = usage.input_tokens.unwrap_or(0);
                    let output = usage.output_tokens.unwrap_or(0);
                    let cache_read = usage.cache_read_input_tokens.unwrap_or(0);
                    let cache_creation = usage.cache_creation_input_tokens.unwrap_or(0);
                    let total_input = input + cache_read + cache_creation;
                    let cache_hit_rate = if total_input > 0 {
                        (cache_read as f64 / total_input as f64) * 100.0
                    } else {
                        0.0
                    };

                    ModelUsageEntry {
                        model: model.clone(),
                        input_tokens: input,
                        output_tokens: output,
                        cache_read_tokens: cache_read,
                        cache_creation_tokens: cache_creation,
                        cache_hit_rate,
                    }
                })
                .collect();
            // Sort by total tokens descending
            entries.sort_by(|a, b| {
                let total_a = a.input_tokens + a.output_tokens + a.cache_read_tokens;
                let total_b = b.input_tokens + b.output_tokens + b.cache_read_tokens;
                total_b.cmp(&total_a)
            });
            entries
        })
        .unwrap_or_default();

    // Aggregate global input/output tokens from model usage
    let total_input_tokens: u64 = model_usage.iter().map(|m| m.input_tokens + m.cache_read_tokens + m.cache_creation_tokens).sum();
    let total_output_tokens: u64 = model_usage.iter().map(|m| m.output_tokens).sum();

    // 2. Read session-meta/*.json for per-project, feature adoption, tool/language, code impact
    let metas: Vec<RawSessionMeta> = read_json_dir(&meta_dir);

    let mut total_duration_minutes: u64 = 0;
    let mut total_commits: u32 = 0;
    let mut lines_added: u64 = 0;
    let mut lines_removed: u64 = 0;
    let mut files_changed: u32 = 0;
    let mut tool_counts: HashMap<String, u32> = HashMap::new();
    let mut lang_counts: HashMap<String, u32> = HashMap::new();
    let mut project_map: HashMap<String, ProjectSummary> = HashMap::new();

    // Feature adoption counters
    let mut feat_task_agent: u32 = 0;
    let mut feat_mcp: u32 = 0;
    let mut feat_web_search: u32 = 0;
    let mut feat_web_fetch: u32 = 0;

    for meta in &metas {
        let duration = meta.duration_minutes.unwrap_or(0);
        let commits = meta.git_commits.unwrap_or(0);
        let la = meta.lines_added.unwrap_or(0);
        let lr = meta.lines_removed.unwrap_or(0);
        let fm = meta.files_modified.unwrap_or(0);
        let input = meta.input_tokens.unwrap_or(0);
        let output = meta.output_tokens.unwrap_or(0);

        total_duration_minutes += duration;
        total_commits += commits;
        lines_added += la;
        lines_removed += lr;
        files_changed += fm;

        if let Some(tools) = &meta.tool_counts {
            for (tool, &count) in tools {
                *tool_counts.entry(tool.clone()).or_insert(0) += count;
            }
        }

        if let Some(langs) = &meta.languages {
            for (lang, &count) in langs {
                *lang_counts.entry(lang.clone()).or_insert(0) += count;
            }
        }

        // Feature adoption
        if meta.uses_task_agent.unwrap_or(false) {
            feat_task_agent += 1;
        }
        if meta.uses_mcp.unwrap_or(false) {
            feat_mcp += 1;
        }
        if meta.uses_web_search.unwrap_or(false) {
            feat_web_search += 1;
        }
        if meta.uses_web_fetch.unwrap_or(false) {
            feat_web_fetch += 1;
        }

        // Per-project aggregation
        let project_name = meta
            .project_path
            .as_deref()
            .map(project_name_from_path)
            .unwrap_or_else(|| "unknown".to_string());

        let entry = project_map.entry(project_name.clone()).or_insert_with(|| ProjectSummary {
            name: project_name,
            sessions: 0,
            lines_added: 0,
            commits: 0,
            duration_minutes: 0,
            tokens: 0,
        });
        entry.sessions += 1;
        entry.lines_added += la;
        entry.commits += commits;
        entry.duration_minutes += duration;
        entry.tokens += input + output;
    }

    // Sort projects by sessions descending
    let mut projects: Vec<ProjectSummary> = project_map.into_values().collect();
    projects.sort_by(|a, b| b.sessions.cmp(&a.sessions));

    let meta_count = metas.len() as u32;
    let feature_adoption = FeatureAdoption {
        task_agent: feat_task_agent,
        mcp: feat_mcp,
        web_search: feat_web_search,
        web_fetch: feat_web_fetch,
        total: meta_count,
    };

    // 3. Read facets/*.json for outcomes, helpfulness, satisfaction, friction, goals, session types
    let facets: Vec<RawSessionFacet> = read_json_dir(&facets_dir);

    let mut outcome_counts: HashMap<String, u32> = HashMap::new();
    let mut helpfulness_counts: HashMap<String, u32> = HashMap::new();
    let mut satisfaction_counts: HashMap<String, u32> = HashMap::new();
    let mut friction_counts: HashMap<String, u32> = HashMap::new();
    let mut goal_counts: HashMap<String, u32> = HashMap::new();
    let mut session_type_counts: HashMap<String, u32> = HashMap::new();

    // Build a lookup from session_id → facet for joining with metas
    let mut facet_map: HashMap<String, &RawSessionFacet> = HashMap::new();

    for facet in &facets {
        if let Some(outcome) = &facet.outcome {
            *outcome_counts.entry(outcome.clone()).or_insert(0) += 1;
        }

        if let Some(helpfulness) = &facet.claude_helpfulness {
            *helpfulness_counts.entry(helpfulness.clone()).or_insert(0) += 1;
        }

        if let Some(satisfaction) = &facet.user_satisfaction_counts {
            for (level, &count) in satisfaction {
                *satisfaction_counts.entry(level.clone()).or_insert(0) += count;
            }
        }

        if let Some(friction) = &facet.friction_counts {
            for (point, &count) in friction {
                *friction_counts.entry(point.clone()).or_insert(0) += count;
            }
        }

        if let Some(goals) = &facet.goal_categories {
            for (goal, &count) in goals {
                *goal_counts.entry(goal.clone()).or_insert(0) += count;
            }
        }

        if let Some(session_type) = &facet.session_type {
            *session_type_counts.entry(session_type.clone()).or_insert(0) += 1;
        }

        if let Some(sid) = &facet.session_id {
            facet_map.insert(sid.clone(), facet);
        }
    }

    let total_outcome_count: u32 = outcome_counts.values().sum();
    let mut outcomes: Vec<OutcomeEntry> = outcome_counts
        .into_iter()
        .map(|(outcome, count)| {
            let percentage = if total_outcome_count > 0 {
                (count as f64 / total_outcome_count as f64) * 100.0
            } else {
                0.0
            };
            OutcomeEntry {
                outcome,
                count,
                percentage,
            }
        })
        .collect();
    outcomes.sort_by(|a, b| b.count.cmp(&a.count));

    // 4. Join metas + facets → build recent sessions (last 20 by start_time)
    let mut session_pairs: Vec<(&RawSessionMeta, Option<&&RawSessionFacet>)> = metas
        .iter()
        .map(|m| {
            let facet = m
                .session_id
                .as_ref()
                .and_then(|sid| facet_map.get(sid.as_str()));
            (m, facet)
        })
        .collect();

    // Sort by start_time descending
    session_pairs.sort_by(|a, b| {
        let time_a = a.0.start_time.as_deref().unwrap_or("");
        let time_b = b.0.start_time.as_deref().unwrap_or("");
        time_b.cmp(time_a)
    });

    let recent_sessions: Vec<SessionSummary> = session_pairs
        .iter()
        .take(20)
        .filter_map(|(meta, facet)| {
            let session_id = meta.session_id.clone()?;
            let project = meta
                .project_path
                .as_deref()
                .map(project_name_from_path)
                .unwrap_or_else(|| "unknown".to_string());
            let start_time = meta.start_time.clone().unwrap_or_default();
            let first_prompt = meta
                .first_prompt
                .as_deref()
                .map(|p| truncate(p, 120))
                .unwrap_or_default();
            let outcome = facet
                .and_then(|f| f.outcome.clone())
                .unwrap_or_else(|| "unknown".to_string());
            let brief_summary = facet
                .and_then(|f| f.brief_summary.clone())
                .unwrap_or_default();

            Some(SessionSummary {
                session_id,
                project,
                start_time,
                duration_minutes: meta.duration_minutes.unwrap_or(0),
                first_prompt,
                outcome,
                brief_summary,
                lines_added: meta.lines_added.unwrap_or(0),
                tokens: meta.input_tokens.unwrap_or(0) + meta.output_tokens.unwrap_or(0),
                commits: meta.git_commits.unwrap_or(0),
            })
        })
        .collect();

    // 5. Read report.html
    let report_html = fs::read_to_string(&report_path).ok();

    // Use stats-cache totalSessions if available, otherwise fall back to meta file count
    let final_total_sessions = if total_sessions > 0 {
        total_sessions
    } else {
        meta_count
    };

    // Use stats-cache totalMessages if available, otherwise sum from metas
    let final_total_messages = if total_messages > 0 {
        total_messages
    } else {
        metas
            .iter()
            .map(|m| {
                (m.user_message_count.unwrap_or(0) + m.assistant_message_count.unwrap_or(0)) as u64
            })
            .sum()
    };

    Ok(InsightsData {
        total_sessions: final_total_sessions,
        total_messages: final_total_messages,
        total_input_tokens,
        total_output_tokens,
        total_duration_minutes,
        total_commits,
        lines_added,
        lines_removed,
        files_changed,
        first_session_date,
        daily_activity,
        hourly_distribution: hourly,
        model_usage,
        projects,
        outcomes,
        top_helpfulness: top_n(&helpfulness_counts, 10),
        top_satisfaction: top_n(&satisfaction_counts, 10),
        top_friction: top_n(&friction_counts, 10),
        top_goals: top_n(&goal_counts, 10),
        top_session_types: top_n(&session_type_counts, 10),
        top_tools: top_n(&tool_counts, 10),
        top_languages: top_n(&lang_counts, 10),
        feature_adoption,
        recent_sessions,
        report_html,
    })
}

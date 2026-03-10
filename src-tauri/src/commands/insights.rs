// Insights command — reads Claude Code usage JSON files and ELVES session data,
// returning a single aggregated InsightsData struct for the dashboard.

use crate::commands::projects::DbState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::State;

/// A single day's count for timeline charts.
#[derive(Debug, Clone, Serialize)]
pub struct DailyCount {
    pub date: String,
    pub count: u32,
}

/// A named item with a numeric count.
#[derive(Debug, Clone, Serialize)]
pub struct NamedCount {
    pub name: String,
    pub count: u32,
}

/// Runtime split — sessions and cost per runtime.
#[derive(Debug, Clone, Serialize)]
pub struct RuntimeSplit {
    pub runtime: String,
    pub sessions: u32,
    pub cost: f64,
}

/// Outcome distribution entry.
#[derive(Debug, Clone, Serialize)]
pub struct OutcomeEntry {
    pub outcome: String,
    pub count: u32,
    pub percentage: f64,
}

/// Full aggregated insights data returned to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightsData {
    pub total_sessions: u32,
    pub total_tokens: u64,
    pub total_cost: f64,
    pub total_duration: u64,
    pub total_commits: u32,
    pub lines_added: u64,
    pub lines_removed: u64,
    pub files_changed: u32,
    pub daily_sessions: Vec<DailyCount>,
    pub hourly_distribution: Vec<u32>,
    pub runtime_split: Vec<RuntimeSplit>,
    pub outcomes: Vec<OutcomeEntry>,
    pub top_tools: Vec<NamedCount>,
    pub top_languages: Vec<NamedCount>,
    pub top_goals: Vec<NamedCount>,
    pub top_friction: Vec<NamedCount>,
}

/// Raw session metadata from Claude Code's `~/.claude/usage-data/session-meta/*.json`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawSessionMeta {
    #[allow(dead_code)]
    session_id: Option<String>,
    timestamp: Option<String>,
    duration_seconds: Option<u64>,
    total_tokens_used: Option<u64>,
    total_cost_usd: Option<f64>,
    num_commits: Option<u32>,
    lines_added: Option<u64>,
    lines_removed: Option<u64>,
    files_modified: Option<u32>,
    tools_used: Option<HashMap<String, u32>>,
    languages_used: Option<HashMap<String, u32>>,
}

/// Raw facets data from Claude Code's `~/.claude/usage-data/facets/*.json`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawSessionFacet {
    #[allow(dead_code)]
    session_id: Option<String>,
    outcome: Option<String>,
    #[allow(dead_code)]
    satisfaction: Option<String>,
    goals: Option<Vec<String>>,
    friction_points: Option<Vec<String>>,
}

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
                .map_or(false, |ext| ext == "json")
        })
        .filter_map(|entry| {
            let content = fs::read_to_string(entry.path()).ok()?;
            serde_json::from_str::<T>(&content).ok()
        })
        .collect()
}

/// Extract the date (YYYY-MM-DD) from an ISO timestamp string.
fn extract_date(timestamp: &str) -> Option<String> {
    if timestamp.len() >= 10 {
        Some(timestamp[..10].to_string())
    } else {
        None
    }
}

/// Extract the hour (0-23) from an ISO timestamp string.
fn extract_hour(timestamp: &str) -> Option<usize> {
    // ISO format: "2025-01-15T14:30:00..."
    if timestamp.len() >= 13 && timestamp.as_bytes().get(10) == Some(&b'T') {
        timestamp[11..13].parse::<usize>().ok()
    } else {
        None
    }
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

/// Load insights data from Claude Code usage files and ELVES sessions DB.
#[tauri::command]
pub fn load_insights(db: State<'_, DbState>) -> Result<InsightsData, String> {
    let home = dirs::home_dir().ok_or("Could not resolve home directory")?;
    let usage_dir = home.join(".claude").join("usage-data");
    let meta_dir = usage_dir.join("session-meta");
    let facets_dir = usage_dir.join("facets");

    // Read Claude Code telemetry files
    let metas: Vec<RawSessionMeta> = read_json_dir(&meta_dir);
    let facets: Vec<RawSessionFacet> = read_json_dir(&facets_dir);

    // Aggregate session meta stats
    let mut total_tokens: u64 = 0;
    let mut total_cost: f64 = 0.0;
    let mut total_duration: u64 = 0;
    let mut total_commits: u32 = 0;
    let mut lines_added: u64 = 0;
    let mut lines_removed: u64 = 0;
    let mut files_changed: u32 = 0;
    let mut tool_counts: HashMap<String, u32> = HashMap::new();
    let mut lang_counts: HashMap<String, u32> = HashMap::new();
    let mut daily_map: HashMap<String, u32> = HashMap::new();
    let mut hourly: Vec<u32> = vec![0; 24];

    for meta in &metas {
        total_tokens += meta.total_tokens_used.unwrap_or(0);
        total_cost += meta.total_cost_usd.unwrap_or(0.0);
        total_duration += meta.duration_seconds.unwrap_or(0);
        total_commits += meta.num_commits.unwrap_or(0);
        lines_added += meta.lines_added.unwrap_or(0);
        lines_removed += meta.lines_removed.unwrap_or(0);
        files_changed += meta.files_modified.unwrap_or(0);

        if let Some(tools) = &meta.tools_used {
            for (tool, &count) in tools {
                *tool_counts.entry(tool.clone()).or_insert(0) += count;
            }
        }

        if let Some(langs) = &meta.languages_used {
            for (lang, &count) in langs {
                *lang_counts.entry(lang.clone()).or_insert(0) += count;
            }
        }

        if let Some(ts) = &meta.timestamp {
            if let Some(date) = extract_date(ts) {
                *daily_map.entry(date).or_insert(0) += 1;
            }
            if let Some(hour) = extract_hour(ts) {
                if hour < 24 {
                    hourly[hour] += 1;
                }
            }
        }
    }

    // Build sorted daily sessions (last 90 days)
    let mut daily_sessions: Vec<DailyCount> = daily_map
        .into_iter()
        .map(|(date, count)| DailyCount { date, count })
        .collect();
    daily_sessions.sort_by(|a, b| a.date.cmp(&b.date));
    if daily_sessions.len() > 90 {
        let start = daily_sessions.len() - 90;
        daily_sessions = daily_sessions[start..].to_vec();
    }

    // Aggregate facets
    let mut outcome_counts: HashMap<String, u32> = HashMap::new();
    let mut goal_counts: HashMap<String, u32> = HashMap::new();
    let mut friction_counts: HashMap<String, u32> = HashMap::new();

    for facet in &facets {
        if let Some(outcome) = &facet.outcome {
            *outcome_counts.entry(outcome.clone()).or_insert(0) += 1;
        }
        if let Some(goals) = &facet.goals {
            for goal in goals {
                *goal_counts.entry(goal.clone()).or_insert(0) += 1;
            }
        }
        if let Some(friction) = &facet.friction_points {
            for point in friction {
                *friction_counts.entry(point.clone()).or_insert(0) += 1;
            }
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

    // Query ELVES sessions DB for runtime split
    let total_claude_sessions = metas.len() as u32;
    let mut runtime_split: Vec<RuntimeSplit> = Vec::new();

    let conn = db.0.lock().map_err(|e| format!("Lock error: {e}"))?;

    let mut stmt = conn
        .prepare(
            "SELECT runtime, COUNT(*) as cnt, COALESCE(SUM(cost_estimate), 0.0) as total_cost
             FROM sessions GROUP BY runtime",
        )
        .map_err(|e| format!("Query error: {e}"))?;

    let db_splits: Vec<RuntimeSplit> = stmt
        .query_map(params![], |row| {
            Ok(RuntimeSplit {
                runtime: row.get(0)?,
                sessions: row.get::<_, u32>(1)?,
                cost: row.get::<_, f64>(2)?,
            })
        })
        .map_err(|e| format!("Query error: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

    // Merge DB runtime data
    let mut elves_total_sessions: u32 = 0;
    let mut elves_total_cost: f64 = 0.0;
    let mut elves_total_tokens: u64 = 0;
    let mut elves_total_duration: u64 = 0;

    for split in &db_splits {
        runtime_split.push(split.clone());
        elves_total_sessions += split.sessions;
        elves_total_cost += split.cost;
    }

    // Query ELVES aggregate tokens and duration
    let row: Result<(i64, i64), _> = conn.query_row(
        "SELECT COALESCE(SUM(tokens_used), 0), COALESCE(SUM(CASE WHEN ended_at IS NOT NULL THEN ended_at - started_at ELSE 0 END), 0) FROM sessions",
        params![],
        |row| Ok((row.get(0)?, row.get(1)?)),
    );
    if let Ok((tokens, duration)) = row {
        elves_total_tokens = tokens as u64;
        elves_total_duration = duration as u64;
    }

    // If no Claude Code meta files, use only ELVES data
    let combined_sessions = if total_claude_sessions > 0 {
        total_claude_sessions
    } else {
        elves_total_sessions
    };

    // If no Claude telemetry, use ELVES totals
    if total_claude_sessions == 0 {
        total_tokens = elves_total_tokens;
        total_cost = elves_total_cost;
        total_duration = elves_total_duration;
    }

    // If runtime_split is empty, add a default entry
    if runtime_split.is_empty() && total_claude_sessions > 0 {
        runtime_split.push(RuntimeSplit {
            runtime: "claude-code".to_string(),
            sessions: total_claude_sessions,
            cost: total_cost,
        });
    }

    Ok(InsightsData {
        total_sessions: combined_sessions,
        total_tokens,
        total_cost,
        total_duration,
        total_commits,
        lines_added,
        lines_removed,
        files_changed,
        daily_sessions,
        hourly_distribution: hourly,
        runtime_split,
        outcomes,
        top_tools: top_n(&tool_counts, 10),
        top_languages: top_n(&lang_counts, 10),
        top_goals: top_n(&goal_counts, 10),
        top_friction: top_n(&friction_counts, 10),
    })
}

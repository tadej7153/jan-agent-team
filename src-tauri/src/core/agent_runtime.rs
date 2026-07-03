use once_cell::sync::Lazy;
use serde::Serialize;
use std::{path::PathBuf, process::Stdio, sync::Arc, time::Duration};
use tauri::{AppHandle, Manager, Runtime};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::{Child, Command},
    sync::Mutex,
    time::sleep,
};

use crate::core::app::commands::get_jan_data_folder_path;

const HOST: &str = "127.0.0.1";
const PORT: u16 = 8765;
const HEALTH_URL: &str = "http://127.0.0.1:8765/health";

static AGENT_RUNTIME_PROCESS: Lazy<Arc<Mutex<Option<Child>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

#[derive(Debug, Clone, Serialize)]
pub struct AgentRuntimeStatus {
    pub running: bool,
    pub url: String,
    #[serde(rename = "ag2Available")]
    pub ag2_available: Option<bool>,
    pub message: Option<String>,
}

#[tauri::command]
pub async fn agent_runtime_status<R: Runtime>(
    app: AppHandle<R>,
) -> Result<AgentRuntimeStatus, String> {
    cleanup_dead_child().await;
    let status = probe_health().await;
    if status.running {
        return Ok(status);
    }

    let process_running = AGENT_RUNTIME_PROCESS.lock().await.is_some();
    Ok(AgentRuntimeStatus {
        running: process_running,
        url: runtime_url(),
        ag2_available: None,
        message: Some(resolve_runtime_dir(&app).display().to_string()),
    })
}

#[tauri::command]
pub async fn ensure_agent_runtime<R: Runtime>(
    app: AppHandle<R>,
) -> Result<AgentRuntimeStatus, String> {
    cleanup_dead_child().await;

    let health = probe_health().await;
    if health.running {
        return Ok(health);
    }

    {
        let process = AGENT_RUNTIME_PROCESS.lock().await;
        if process.is_some() {
            drop(process);
            return wait_for_health().await;
        }
    }

    start_runtime(app).await?;
    wait_for_health().await
}

#[tauri::command]
pub async fn stop_agent_runtime() -> Result<AgentRuntimeStatus, String> {
    stop_agent_runtime_processes().await;
    Ok(AgentRuntimeStatus {
        running: false,
        url: runtime_url(),
        ag2_available: None,
        message: Some("Agent runtime stopped".to_string()),
    })
}

pub async fn cleanup_agent_runtime_processes() {
    stop_agent_runtime_processes().await;
}

async fn start_runtime<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let runtime_dir = resolve_runtime_dir(&app);
    let server_py = runtime_dir.join("server.py");
    if !server_py.exists() {
        return Err(format!("Agent runtime 文件不存在：{}", server_py.display()));
    }

    let uv = resolve_uv_path(&app)?;
    let data_dir = get_jan_data_folder_path(app.clone()).join("agent-runtime");
    let uv_cache = data_dir.join("uv-cache");
    std::fs::create_dir_all(&uv_cache).map_err(|e| e.to_string())?;

    let mut command = Command::new(&uv);
    command
        .arg("run")
        .arg("--python")
        .arg("3.11")
        .arg("--with")
        .arg("fastapi")
        .arg("--with")
        .arg("uvicorn")
        .arg("--with")
        .arg("httpx")
        .arg("--with")
        .arg("pydantic")
        .arg("--with")
        .arg("ag2")
        .arg(server_py)
        .arg("--host")
        .arg(HOST)
        .arg("--port")
        .arg(PORT.to_string())
        .current_dir(runtime_dir)
        .env("UV_CACHE_DIR", uv_cache)
        .env("UV_PYTHON_PREFERENCE", "only-managed")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    log::info!("Starting Agent Team runtime with uv at {}", uv.display());
    let mut child = command
        .spawn()
        .map_err(|e| format!("无法启动 Agent runtime：{e}"))?;

    if let Some(stdout) = child.stdout.take() {
        tauri::async_runtime::spawn(log_child_output(stdout, "agent-runtime stdout"));
    }
    if let Some(stderr) = child.stderr.take() {
        tauri::async_runtime::spawn(log_child_output(stderr, "agent-runtime stderr"));
    }

    *AGENT_RUNTIME_PROCESS.lock().await = Some(child);
    Ok(())
}

async fn log_child_output<R>(stream: R, label: &'static str)
where
    R: tokio::io::AsyncRead + Unpin,
{
    let mut reader = BufReader::new(stream).lines();
    while let Ok(Some(line)) = reader.next_line().await {
        if !line.trim().is_empty() {
            log::info!("[{}] {}", label, line);
        }
    }
}

async fn wait_for_health() -> Result<AgentRuntimeStatus, String> {
    for _ in 0..180 {
        let status = probe_health().await;
        if status.running {
            return Ok(status);
        }
        cleanup_dead_child().await;
        if AGENT_RUNTIME_PROCESS.lock().await.is_none() {
            return Err(
                "Agent runtime 启动失败，请检查网络、uv/Python 依赖下载或日志。".to_string(),
            );
        }
        sleep(Duration::from_secs(1)).await;
    }
    Err("Agent runtime 启动超时，请检查网络和 Python 依赖安装。".to_string())
}

async fn probe_health() -> AgentRuntimeStatus {
    let result = reqwest::Client::new()
        .get(HEALTH_URL)
        .timeout(Duration::from_millis(800))
        .send()
        .await;

    match result {
        Ok(response) if response.status().is_success() => {
            let payload = response.json::<serde_json::Value>().await.ok();
            AgentRuntimeStatus {
                running: true,
                url: runtime_url(),
                ag2_available: payload
                    .as_ref()
                    .and_then(|v| v.get("ag2Available"))
                    .and_then(|v| v.as_bool()),
                message: None,
            }
        }
        Ok(response) => AgentRuntimeStatus {
            running: false,
            url: runtime_url(),
            ag2_available: None,
            message: Some(format!(
                "Agent runtime health check returned {}",
                response.status()
            )),
        },
        Err(error) => AgentRuntimeStatus {
            running: false,
            url: runtime_url(),
            ag2_available: None,
            message: Some(error.to_string()),
        },
    }
}

async fn cleanup_dead_child() {
    let mut guard = AGENT_RUNTIME_PROCESS.lock().await;
    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(Some(status)) => {
                log::info!("Agent runtime exited: {}", status);
                *guard = None;
            }
            Ok(None) => {}
            Err(error) => {
                log::warn!("Agent runtime status check failed: {}", error);
                *guard = None;
            }
        }
    }
}

async fn stop_agent_runtime_processes() {
    let child = AGENT_RUNTIME_PROCESS.lock().await.take();
    if let Some(mut child) = child {
        if let Err(error) = child.start_kill() {
            log::warn!("Failed to kill Agent runtime: {}", error);
        }
        let _ = tokio::time::timeout(Duration::from_secs(3), child.wait()).await;
    }
}

fn runtime_url() -> String {
    format!("http://{}:{}/v1/agent-team/runs", HOST, PORT)
}

fn resolve_uv_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let candidates = [
        app.path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("resources/bin/uv")),
        app.path().resource_dir().ok().map(|dir| dir.join("uv")),
        app.path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("uv-aarch64-apple-darwin")),
        app.path()
            .resource_dir()
            .ok()
            .map(|dir| dir.join("uv-universal-apple-darwin")),
        Some(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/bin/uv")),
    ];

    candidates
        .into_iter()
        .flatten()
        .find(|path| path.exists())
        .ok_or_else(|| "找不到 bundled uv，无法启动 Agent runtime。".to_string())
}

fn resolve_runtime_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    let packaged = app
        .path()
        .resource_dir()
        .ok()
        .map(|dir| dir.join("resources/agent-runtime"));
    if let Some(path) = packaged {
        if path.exists() {
            return path;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/agent-runtime")
}

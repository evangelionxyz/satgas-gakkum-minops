mod docx_engine;
use docx_engine::{FileInput, MergeRequest, ParseResult};
use std::fs;
use tauri::Manager;

#[tauri::command]
fn parse_docx_files(files: Vec<FileInput>) -> Result<ParseResult, String> {
    Ok(docx_engine::parse_multiple_docx(files))
}

#[tauri::command]
fn merge_docx(payload: MergeRequest) -> Result<Vec<u8>, String> {
    docx_engine::merge_items_to_master(payload)
}

#[tauri::command]
fn merge_and_save_docx(payload: MergeRequest, file_path: String) -> Result<String, String> {
    let bytes = docx_engine::merge_items_to_master(payload)?;
    fs::write(&file_path, bytes).map_err(|e| format!("Gagal menyimpan berkas ke {}: {}", file_path, e))?;
    Ok(file_path)
}

#[tauri::command]
fn open_file(app: tauri::AppHandle, file_path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_path(&file_path, None::<&str>).map_err(|e| format!("Gagal membuka berkas: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            parse_docx_files,
            merge_docx,
            merge_and_save_docx,
            open_file
        ]);

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::docx_engine::SignatureConfig;

    #[test]
    fn test_tauri_command_read_write() {
        let sample_file = FileInput {
            filename: "MINOPS JAYAPURA.docx".to_string(),
            data: fs::read("test/example/MINOPS JAYAPURA.docx").unwrap_or_default(),
        };

        if sample_file.data.is_empty() {
            return;
        }

        // Test Tauri command: parse_docx_files
        let parse_res = parse_docx_files(vec![sample_file]).expect("parse_docx_files command failed");
        assert_eq!(parse_res.total_files, 1);
        assert!(!parse_res.items.is_empty(), "Should extract activity items");

        // Test Tauri command: merge_docx
        let payload = MergeRequest {
            date: "2026-10-05".to_string(),
            items: parse_res.items,
            incidents: Some(vec![]),
            signature_config: Some(SignatureConfig {
                signature_city: Some("Jayapura".to_string()),
                kasatgas_name: Some("I G.G. ERA ADHINATA, S.I.K.".to_string()),
                kasatgas_rank_nrp: Some("KOMISARIS BESAR POLISI NRP 80020993".to_string()),
            }),
        };

        let bytes = merge_docx(payload.clone()).expect("merge_docx command failed");
        assert!(!bytes.is_empty());

        // Test Tauri command: merge_and_save_docx
        let target_save_path = "test/test_tauri_saved_output.docx".to_string();
        let saved_path = merge_and_save_docx(payload, target_save_path.clone()).expect("merge_and_save_docx failed");
        assert_eq!(saved_path, target_save_path);

        // Read back written file to verify read/write check
        let written_bytes = fs::read(&target_save_path).expect("Failed reading back saved file");
        assert_eq!(written_bytes.len(), bytes.len());
        assert_eq!(&written_bytes[0..4], b"PK\x03\x04", "Valid zip/docx magic bytes");
    }
}


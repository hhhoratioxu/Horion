mod controller;
mod core;
mod profile;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> tauri::Result<()> {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(
            |app, _arguments, _working_directory| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            },
        ))
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            let core = core::CoreService::new(app_data)?;
            app.manage(core.profiles());
            app.manage(core);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            controller::proxy_get_overview,
            controller::proxy_select,
            controller::proxy_test_delay,
            controller::proxy_set_mode,
            core::core_get_status,
            core::core_install_official,
            core::core_import_from_path,
            core::core_start,
            core::core_stop,
            core::core_restart,
            core::core_get_logs,
            profile::profile_list,
            profile::profile_import_local,
            profile::profile_add_subscription,
            profile::profile_update,
            profile::profile_update_all,
            profile::profile_rename,
            profile::profile_duplicate,
            profile::profile_delete,
            profile::profile_get_content,
            profile::profile_save_content,
            profile::profile_activate,
        ])
        .build(tauri::generate_context!())?;

    app.run(|handle, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            if let Some(service) = handle.try_state::<core::CoreService>() {
                service.shutdown_sync();
            }
        }
    });
    Ok(())
}

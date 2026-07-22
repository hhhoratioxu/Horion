fn main() -> tauri_build::Result<()> {
    let windows_gnu_target =
        matches!(
            std::env::var("CARGO_CFG_TARGET_OS").as_deref(),
            Ok("windows")
        ) && matches!(std::env::var("CARGO_CFG_TARGET_ENV").as_deref(), Ok("gnu"));

    let attributes = if windows_gnu_target {
        // Rust's GNU target already embeds an application manifest. Avoid a
        // duplicate resource while retaining Tauri's default manifest on MSVC.
        tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest())
    } else {
        tauri_build::Attributes::new()
    };

    tauri_build::try_build(attributes)
}

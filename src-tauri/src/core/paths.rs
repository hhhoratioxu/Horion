use std::{
    fs,
    path::{Component, Path, PathBuf},
};

use super::{
    error::{CoreError, CoreResult},
    model::CoreManifest,
};

#[derive(Clone, Debug)]
pub(crate) struct CorePaths {
    pub root: PathBuf,
    pub versions: PathBuf,
    pub runtime: PathBuf,
    pub manifest: PathBuf,
}

impl CorePaths {
    pub fn create(app_data: impl AsRef<Path>) -> CoreResult<Self> {
        let root = app_data.as_ref().join("core");
        let versions = root.join("versions");
        let runtime = root.join("runtime");
        fs::create_dir_all(&versions)
            .map_err(|error| CoreError::io("creating the core versions directory", error))?;
        fs::create_dir_all(&runtime)
            .map_err(|error| CoreError::io("creating the core runtime directory", error))?;

        Ok(Self {
            manifest: root.join("current.json"),
            root,
            versions,
            runtime,
        })
    }

    pub fn resolve_manifest_executable(&self, manifest: &CoreManifest) -> CoreResult<PathBuf> {
        let relative = Path::new(&manifest.executable);
        if relative.as_os_str().is_empty()
            || relative.is_absolute()
            || relative.components().any(|component| {
                matches!(
                    component,
                    Component::ParentDir | Component::RootDir | Component::Prefix(_)
                )
            })
        {
            return Err(CoreError::InvalidManifest(
                "the executable path must stay inside the managed core directory".to_owned(),
            ));
        }

        let candidate = self.root.join(relative);
        let canonical_root = self
            .root
            .canonicalize()
            .map_err(|error| CoreError::io("resolving the core directory", error))?;
        let canonical_candidate = candidate
            .canonicalize()
            .map_err(|error| CoreError::io("resolving the installed executable", error))?;
        if !canonical_candidate.starts_with(canonical_root) {
            return Err(CoreError::InvalidManifest(
                "the executable resolves outside the managed core directory".to_owned(),
            ));
        }

        Ok(canonical_candidate)
    }
}

#[cfg(test)]
mod tests {
    use super::CorePaths;
    use crate::core::model::CoreManifest;

    fn manifest(path: &str) -> CoreManifest {
        CoreManifest {
            schema_version: 1,
            version: "v1.0.0".to_owned(),
            source: "test".to_owned(),
            executable: path.to_owned(),
            sha256: "00".repeat(32),
            installed_at: "2026-01-01T00:00:00Z".to_owned(),
        }
    }

    #[test]
    fn rejects_manifest_path_traversal_and_absolute_paths() {
        let temp = tempfile::tempdir().expect("temp directory");
        let paths = CorePaths::create(temp.path()).expect("core paths");

        assert!(paths
            .resolve_manifest_executable(&manifest("../outside.exe"))
            .is_err());
        assert!(paths
            .resolve_manifest_executable(&manifest("C:\\Windows\\notepad.exe"))
            .is_err());
    }
}

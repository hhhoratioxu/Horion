use zeroize::Zeroizing;

use super::error::{ProfileError, ProfileResult};

pub(crate) const MAX_SUBSCRIPTION_URL_BYTES: usize = 2_048;

#[cfg(windows)]
pub(crate) fn store(key: &str, secret: &str) -> ProfileResult<()> {
    use std::ptr;
    use windows_sys::Win32::Security::Credentials::{
        CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };

    if secret.is_empty() || secret.len() > MAX_SUBSCRIPTION_URL_BYTES {
        return Err(ProfileError::Credential);
    }
    let mut target = wide(key);
    let mut blob = secret.as_bytes().to_vec();
    let credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: target.as_mut_ptr(),
        CredentialBlobSize: u32::try_from(blob.len()).map_err(|_| ProfileError::Credential)?,
        CredentialBlob: blob.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: ptr::null_mut(),
        ..Default::default()
    };
    // SAFETY: all pointers reference live buffers for the duration of this synchronous call;
    // CredWriteW copies the credential before returning.
    let succeeded = unsafe { CredWriteW(&credential, 0) };
    blob.fill(0);
    if succeeded == 0 {
        let _ = std::io::Error::last_os_error();
        return Err(ProfileError::Credential);
    }
    Ok(())
}

#[cfg(windows)]
pub(crate) fn load(key: &str) -> ProfileResult<Zeroizing<String>> {
    use std::{ffi::c_void, ptr};
    use windows_sys::Win32::Security::Credentials::{
        CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC,
    };

    let target = wide(key);
    let mut raw: *mut CREDENTIALW = ptr::null_mut();
    // SAFETY: target is NUL terminated and raw points to writable output storage.
    if unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut raw) } == 0 || raw.is_null() {
        return Err(ProfileError::Credential);
    }
    // SAFETY: CredReadW returned a valid CREDENTIALW allocation owned by CredFree.
    let credential = unsafe { &*raw };
    let length = credential.CredentialBlobSize as usize;
    if length == 0 || length > MAX_SUBSCRIPTION_URL_BYTES || credential.CredentialBlob.is_null() {
        // SAFETY: raw is the allocation returned by CredReadW.
        unsafe { CredFree(raw.cast::<c_void>()) };
        return Err(ProfileError::Credential);
    }
    // SAFETY: the credential blob contains CredentialBlobSize readable bytes.
    let bytes = unsafe { std::slice::from_raw_parts(credential.CredentialBlob, length) };
    let value = String::from_utf8(bytes.to_vec()).map_err(|_| ProfileError::Credential);
    // SAFETY: raw is the allocation returned by CredReadW and is freed exactly once.
    unsafe { CredFree(raw.cast::<c_void>()) };
    value.map(Zeroizing::new)
}

#[cfg(windows)]
pub(crate) fn delete(key: &str) -> ProfileResult<()> {
    use windows_sys::Win32::{
        Foundation::ERROR_NOT_FOUND,
        Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC},
    };

    let target = wide(key);
    // SAFETY: target is a valid, NUL-terminated UTF-16 string.
    if unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) } != 0 {
        return Ok(());
    }
    if std::io::Error::last_os_error().raw_os_error() == Some(ERROR_NOT_FOUND as i32) {
        Ok(())
    } else {
        Err(ProfileError::Credential)
    }
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(not(windows))]
pub(crate) fn store(_key: &str, _secret: &str) -> ProfileResult<()> {
    Err(ProfileError::Unsupported("subscription credential storage"))
}

#[cfg(not(windows))]
pub(crate) fn load(_key: &str) -> ProfileResult<Zeroizing<String>> {
    Err(ProfileError::Unsupported("subscription credential storage"))
}

#[cfg(not(windows))]
pub(crate) fn delete(_key: &str) -> ProfileResult<()> {
    Err(ProfileError::Unsupported("subscription credential storage"))
}

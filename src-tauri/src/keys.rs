//! Windows Credential Manager wrapper for the Anthropic API key.
//!
//! The key NEVER lives on disk in plaintext — `keyring` v3 stores it in the
//! per-user Credential Vault (encrypted by Windows DPAPI).

use keyring::Entry;

const SERVICE: &str = "accuCountFM";
const USER: &str = "anthropic_api_key";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, USER).map_err(|e| format!("keyring entry: {e}"))
}

pub fn get_api_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("keyring read: {e}")),
    }
}

pub fn set_api_key(value: &str) -> Result<(), String> {
    entry()?
        .set_password(value)
        .map_err(|e| format!("keyring write: {e}"))
}

pub fn clear_api_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("keyring delete: {e}")),
    }
}

# DenX persistent Android signing

Add these encrypted GitHub repository secrets before running the Android workflow:

- `DENX_KEYSTORE_BASE64`
- `DENX_KEYSTORE_PASSWORD`
- `DENX_KEY_ALIAS`
- `DENX_KEY_PASSWORD`

The separate DenX signing-backup package contains the permanent `.jks` key, its credentials, and the Base64 value. Never commit that package or the key to GitHub.

Every Palm Store release and every future DenX update must use this same key. Losing it means the existing published app cannot be updated.

## [loco-translation-status-checker](https://github.com/framna-dk/actions/tree/main/loco-translation-status-checker/action.yml)

Checks if there are missing translations in the Localize.biz project throws error.

```yml
- name: Verify Loco Translations
  uses: framna-dk/actions/loco-translation-status-checker@v1
  with:
    op-loco-api-key-reference: op://My Vault/My Loco API Key/key
```
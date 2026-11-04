## [install-certificate](https://github.com/framna-dk/actions/blob/main/install-certificate/action.yml)

Installs the specified certificate in the keychain.

```yml
- name: Install Certificate
  uses: framna-dk/actions/install-certificate@v1
  with:
    password-op-reference: op://My Vault/My Certificate/password
    certificate-op-reference: op://My Vault/My Certificate/Certificate.p12
```

Note that you must supply a password. Empty passwords are not supported.

The action makes the keychain the default keychain on the system. You can disable this as shown below.

```yml
- name: Install Certificate
  uses: framna-dk/actions/install-certificate@v1
  with:
    password-op-reference: op://My Vault/My Certificate/password
    certificate-op-reference: op://My Vault/My Certificate/Certificate.p12
    set-default-keychain: false
```

You may optionally specify the name of the keychain to install the certificate and the password of that keychain.

```yml
- name: Install Certificate
  uses: framna-dk/actions/install-certificate@v1
  with:
    password-op-reference: op://My Vault/My Certificate/password
    certificate-op-reference: op://My Vault/My Certificate/Certificate.p12
    keychain-name: signing.keychain
    keychain-password: h3ll0w0rld
```

The keychain will be created with a random password if no password is specified. Therefore you will need to specify a password when installing multiple certificates into the same keychain. You may consider using the `uuidgen` command to create a random password as shown below.

```yml
- name: Generate Keychain Password
  id: generate-keychain-password
  run: |
    PASSWORD=$(uuidgen)
    echo "::add-mask::$PASSWORD"
    echo "password=$PASSWORD" >> $GITHUB_OUTPUT
- name: Install First Certificate
  uses: framna-dk/actions/install-certificate@v1
  with:
    password-op-reference: op://My Vault/First Certificate/password
    certificate-op-reference: op://My Vault/First Certificate/Certificate.p12
    keychain-password: ${{ steps.generate-keychain-password.outputs.password }}
- name: Install Second Certificate
  uses: framna-dk/actions/install-certificate@v1
  with:
    password-op-reference: op://My Vault/Second Certificate/password
    certificate-op-reference: op://My Vault/Second Certificate/Certificate.p12
    keychain-password: ${{ steps.generate-keychain-password.outputs.password }}
```
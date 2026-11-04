## [install-shipshape](https://github.com/framna-dk/actions/blob/main/install-shipshape/action.yml)

Installs Shipshape and sets an activation code.

```yml
- name: Install Shipshape
  uses: framna-dk/actions/install-shipshape@v1
```

You may optionally specify an activation code to be used by Shipshape. You will likely want to use the default activation code though.

```yml
- name: Install CI SSH Key
  uses: framna-dk/actions/install-shipshape@v1
  with:
    op-reference: op://My Vault/My Shipshape Activation Code/password
```
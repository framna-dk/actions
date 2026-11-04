## [install-ssh-key](https://github.com/framna-dk/actions/tree/main/install-ssh-key/action.yml)

Installs an SSH key or a [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys), which is an SSH key that grants access to a single repository.

```yml
- name: Install SSH Key
  uses: framna-dk/actions/install-ssh-key@v1
  with:
    op-reference: op://My Vault/My SSH Key/ssh-key
```

Set the `op-password-reference` input to install a password-protected SSH key.

```yml
- name: Install SSH Key
  uses: framna-dk/actions/install-ssh-key@v1
  with:
    op-reference: op://My Vault/My SSH Key/ssh-key
    op-password-reference: op://My Vault/My SSH Key/password
```

You may optionally specify the name of the file to store the SSH key in. Only do this if you are storing multiple SSH keys to avoid overriding an SSH key.

```yml
- name: Install SSH Key
  uses: framna-dk/actions/install-ssh-key@v1
  with:
    op-reference: op://My Vault/My SSH Key/ssh-key
    filename: my_ssh_key
```

Attempting to install multiple SSH keys with the same name will cause the SSH key to be overwritten.

When installing multiple SSH keys, you may need to specify which SSH key to use when accessing a repository. For example, you may clone a repository using a specific SSH key by setting the `GIT_SSH_COMMAND` environment variable as shown below:

```bash
GIT_SSH_COMMAND='ssh -i ~/.ssh/my_ssh_key’ git clone git@github.com:framna-dk/example.git
```
## [install-ci-ssh-key](https://github.com/framna-dk/actions/blob/main/install-ci-ssh-key/action.yml)

Install the CI's SSH key.

```yml
- name: Install CI SSH Key
  uses: framna-dk/actions/install-ci-ssh-key@v1
```

You may optionally specify the name of the file to store the SSH key in. Only do this if you are storing multiple SSH keys to avoid overriding an SSH key.

```yml
- name: Install CI SSH Key
  uses: framna-dk/actions/install-ci-ssh-key@v1
  with:
    filename: ci
```

Use the [install-ssh-key](https://github.com/framna-dk/actions?tab=readme-ov-file#install-ssh-key) action to install a specified SSH key.
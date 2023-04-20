{ pkgs, ... }:

{
  languages.c.enable = true;

  packages = [
    pkgs.cargo-lambda
    pkgs.rustup
    pkgs.libiconv
    pkgs.openssl
  ];
}

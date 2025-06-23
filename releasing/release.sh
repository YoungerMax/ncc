#!/bin/bash

read -p "Enter extension path: " ext_path
read -p "Enter key path: " key_path

chromium --pack-extension="$ext_path" --pack-extension-key="$key_path"

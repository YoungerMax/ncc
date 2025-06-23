#!/bin/bash

read -p "Enter extension path: " ext_path

chromium --pack-extension="$ext_path"

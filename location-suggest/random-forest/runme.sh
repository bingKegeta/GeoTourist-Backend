#!/bin/bash

cd ./setup
bash ./setup.sh
cd ..

python3 dataset.py
python3 model.py
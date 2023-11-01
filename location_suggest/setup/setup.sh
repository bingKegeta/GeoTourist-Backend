#!/bin/bash

# Set up the environment
conda create -n geoenv python=3.10
conda activate geoenv
pip3 install -r requirements.txt

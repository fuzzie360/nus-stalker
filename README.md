NUS Stalker
===========

You can access the website at [stalker.fuzzie.sg](http://stalker.fuzzie.sg). A NUS student log in is required.

Created and maintained by Fazli Sapuan.

Installation
------------

These instructions have been tested on Ubuntu 14.04.1 LTS.

Firstly, retrieve the code by running:

    git clone https://github.com/fuzzie360/nus-stalker.git

Obtain a recent version of Node.js:

    sudo add-apt-repository ppa:chris-lea/node.js
    sudo apt-get update && sudo apt-get install nodejs

Install required dependencies:

    sudo apt-get install mysql-server python-minimal make build-essential
    cd ~/nus-stalker
    npm install

Create the required database:

    mysql -uroot -p
    > CREATE DATABASE stalker;
    > \q

Configure NUS Stalker:

    cp config.json.example config.json
    vim config.json

Then start the server:

    node stalker.js


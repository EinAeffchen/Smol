# SMOL

Small Media Organization System

This is a very rudimentary setup only meant for local hosting.

## Contribute

- Fork and create a new branch, give it an appropriate name and submit a pull request.
- Post Ideas, bugs, wishes, etc. as issues please. 

## Get started

### Setup
* Rename Makefile.template to Makefile
* Run `pip install -r requirements.txt`
* Either link your local files to smol/local_media or change the `MEDIA_ROOT` in [settings.py](smol/smol/settings.py).
* Run first time analysis using `make analyze`
* Start server with `make up`
* Open browser: [Server](http://localhost:8080)


## Licensed under: 
[GNU AFFERO GENERAL PUBLIC LICENSE](./LICENSE.md)
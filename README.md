# SMOL

Small Media Organization System

## Support

[![Donate with Bitcoin](https://en.cryptobadges.io/badge/big/1GDoR1t9AQcB3KHymRgoE8iKnikaw8GwMh)](https://en.cryptobadges.io/donate/1GDoR1t9AQcB3KHymRgoE8iKnikaw8GwMh)

[![Donate with Ethereum](https://en.cryptobadges.io/badge/big/0x18ceee47b45b9a149b3f6940b1705530f3425ea1)](https://en.cryptobadges.io/donate/0x18ceee47b45b9a149b3f6940b1705530f3425ea1)

## Contribute

- Fork and create a new branch, give it an appropriate name and submit a pull request.
- Post Ideas, bugs, wishes, etc. as issues please. 

## Get started

![Setup Smol](https://github.com/EinAeffchen/smol2.0/blob/master/screenshots/main.png?raw=true)

###  Prerequisites
- Docker installed

### Setup
1. Clone this repository
2. Rename `docker-compose.yml.sample` to `docker-compose.yml`
3. Change line 25 `<Change to your video folder>` to the path of your media folder. (e.g. `C:/Videos:/srv/data/smol/viewer/static/viewer/ext_videos)`
2. Run `make build`
3. Run `make up`

### Setable Environment Variables
* *HOST* - Allowed Host/Address

### First Use
1. Open [localhost](http://localhost) in your webbrowser. (This can take a few seconds to spin up, so have a little patience)
2. Go to the Loader page and click 'Update Content'. This will look for all images and videos, create thumbnails, previews and detect faces.
![Load Images](https://github.com/EinAeffchen/smol2.0/blob/master/screenshots/loader.png?raw=true)
If you run this for the first time, it can take a while because all the Face detection models have to be downloaded first.
Run `make logs` to check what's going on behind the scenes.
You can cancel and continue this process any time. Missing faces will be detected afterwards. Also you can always add new files to the linked folder and simpy add them by running 'Update Content' again.

### Create Persons
There are two options to create persons:
1. Automatically generate them by clicking 'Generate person' button on a video.
![Auto Generate Person](https://github.com/EinAeffchen/smol2.0/blob/master/screenshots/video.png?raw=true)
This might take a while at the first time, as the face recognition models have to be downloaded and the face vectors for all detected faces have to be created.
2. Alternatively you go to the Persons page and manually create an person. Afterwards you can add a profile picture, videos he/she acts in etc.
![Person Page](https://github.com/EinAeffchen/smol2.0/blob/master/screenshots/person.png?raw=true)

### Docker version
If you have trouble with make all due to the docker volumes, try updating your docker and docker-compose versions.
* Docker version 20.10.8
* Docker-compose version 1.29.2

## Licensed under: 
[GNU AFFERO GENERAL PUBLIC LICENSE](./LICENSE.md)

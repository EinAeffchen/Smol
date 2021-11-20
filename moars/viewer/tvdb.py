from typing import Tuple
from tmdbv3api import TMDb, Movie, TV, Episode
from django.conf import settings
from langdetect import detect
import re
import os

import tmdbv3api

tmdb = TMDb()

GENRES = {
    10402: "music",
    10749: "romance",
    10751: "family",
    10752: "war",
    10759: "action & adventure",
    10762: "kids",
    10763: "news",
    10764: "reality",
    10765: "sci-fi & fantasy",
    10766: "soap",
    10767: "talk",
    10768: "war & politics",
    10770: "tv movie",
    12: "adventure",
    14: "fantasy",
    16: "animation",
    18: "drama",
    27: "horror",
    28: "action",
    35: "comedy",
    36: "history",
    37: "western",
    37: "western",
    53: "thriller",
    80: "crime",
    80: "crime",
    878: "science fiction",
    9648: "mystery",
    99: "documentary",
}


if os.environ.get("TVDB_KEY"):
    tmdb.api_key = os.environ.get("TVDB_KEY")
    tmdb.language = os.environ.get("TVDB_LANG", "en")
else:
    print("No api key set!")


def detect_lang(title: str) -> str:
    return detect(title)


def filename_to_title(filename: str) -> str:
    filename = re.sub("(\[\w+\])", "", filename)
    filename = re.sub("(「\w+」)", "", filename)
    filename = re.sub("(\([\w\d]+\))", "", filename)
    filename = filename.replace(".", "")
    filename = filename.replace("_", "")
    matches = re.findall("^([\w\s]+)", filename)
    if matches:
        longest = max(matches, key=len)
        return longest
    else:
        print(filename)
        return ""


def replace_jap_numbers(string: str) -> str:
    return (
        string.replace("１", "1")
        .replace("２", "2")
        .replace("３", "3")
        .replace("４", "4")
        .replace("５", "5")
        .replace("６", "6")
        .replace("７", "7")
        .replace("８", "8")
        .replace("９", "9")
        .replace("０", "0")
    )


def get_season_and_episode(filename: str) -> Tuple[int, int]:
    filename = re.sub("(\[\w+\])", "", filename)
    filename = re.sub("(\([\w\d]+\))", "", filename)
    filename = filename.replace(".", "")
    filename = filename.replace("_", "")
    filename = filename.replace("-", "")
    filename = filename.lower()
    season = re.match(r"^.*?((s|season)\s?(?P<season>\d+)).*$", filename)
    if season:
        season = int(season.group("season"))
        # fix episode regex
    else:
        season = 1
    episode = re.match(
        "^.*?((e|episode|ep)(?P<episode>(?<!s\d\d)\s?\d{1,3})).*$", filename
    )
    if not episode:
        episode = re.match("^.*?(?P<episode>\d{1,3}(?!\d)).*$", filename)
    if episode:
        episode = int(episode.group("episode"))
    else:
        episode = 1
    print(f"Got season: {season} and episode {episode} from {filename}")
    return season, episode


def result_to_dict_show(result) -> dict:
    result_dict = dict()
    result_dict["id"] = result.id
    result_dict["name"] = result.original_name
    result_dict["overview"] = result.overview
    result_dict["poster"] = f"https://image.tmdb.org/t/p/original{result.poster_path}"
    result_dict[
        "backdrop"
    ] = f"https://image.tmdb.org/t/p/original{result.backdrop_path}"
    result_dict["rating"] = result.vote_average
    result_dict["origin_country"] = result.origin_country[0]
    for genre_id in result.genre_ids:
        genre_list = []
        genre_list.append(GENRES.get(genre_id))
    result_dict[
        "genres"
    ] = genre_list  # [GENRES.get(genre_id) for genre_id in result.genre_ids]
    return result_dict


def result_to_dict_movie(result) -> dict:
    result_dict = dict()
    result["adult"] = result.adult
    result["genres"] = [GENRES.get(genre_id) for genre_id in result.genre_ids]
    result["title"] = result.original_title
    result["overview"] = result.overview
    result["rating"] = result.vote_average
    result["release_date"] = result.release_date
    return result_dict


def get_episode_details(show_id: int, season: int, episode: int):
    print(f"id: {show_id} - episode: {episode} season: {season}")
    episode_obj = Episode()
    result = episode_obj.details(
        tv_id=int(show_id),
        season_num=int(season),
        episode_num=int(episode),
        append_to_response="images",
    )
    print(result)
    return result


def search_title(title: str, type: str) -> dict:
    print(f"Searching for title {title}")
    if type == "movie":
        object = Movie()
    elif type == "show":
        object = TV()
    search = object.search(title)
    if search:
        first_res = search[0]
        if type == "show":
            return result_to_dict_show(first_res)
        elif type == "movie":
            return result_to_dict_movie(first_res)
    else:
        return {}
